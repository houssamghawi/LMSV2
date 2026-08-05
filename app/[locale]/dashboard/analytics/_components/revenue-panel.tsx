"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { ChartWrapper } from "@/components/analytics/chart-wrapper";
import {
  DateRangePicker,
  type AnalyticsDateRangeValue,
} from "@/components/analytics/date-range-picker";
import { MetricCard } from "@/components/analytics/metric-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  resolveDateRange,
  toIsoDateString,
} from "@/lib/analytics/date-ranges";
import type { Granularity } from "@/lib/analytics/schemas";
import type { InstructorRevenueData } from "@/service/analytics/instructor-analytics.service";
import { useAnalyticsDefaultRange } from "@/components/analytics/analytics-preferences-context";
import { ExportButton } from "@/components/analytics/export-button";
import type { CourseOption } from "./student-progress";

function formatMoney(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

function trendDirection(changePercent: number): "up" | "down" | "stable" {
  if (changePercent > 0.5) return "up";
  if (changePercent < -0.5) return "down";
  return "stable";
}

function buildRevenueUrl(
  rangeValue: AnalyticsDateRangeValue,
  granularity: Granularity,
  courseId?: string
): string {
  const range = resolveDateRange({
    preset: rangeValue.preset,
    startDate: rangeValue.from,
    endDate: rangeValue.to,
  });
  const params = new URLSearchParams({
    startDate: toIsoDateString(range.start),
    endDate: toIsoDateString(range.end),
    granularity,
  });
  if (courseId) {
    params.set("courseId", courseId);
  }
  return `/api/analytics/instructor/revenue?${params.toString()}`;
}

export function RevenuePanel({ courses }: { courses: CourseOption[] }) {
  const t = useTranslations("Analytics");
  const locale = useLocale();
  const preferredRange = useAnalyticsDefaultRange();
  const [rangeValue, setRangeValue] =
    useState<AnalyticsDateRangeValue>(preferredRange);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [courseId, setCourseId] = useState("");
  const [data, setData] = useState<InstructorRevenueData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [initialLoading, setInitialLoading] = useState(true);

  const load = useCallback(
    (
      nextRange: AnalyticsDateRangeValue,
      nextGranularity: Granularity,
      nextCourseId: string
    ) => {
      startTransition(async () => {
        setError(null);
        try {
          const res = await fetch(
            buildRevenueUrl(
              nextRange,
              nextGranularity,
              nextCourseId || undefined
            ),
            { credentials: "include" }
          );
          const body = await res.json();
          if (!res.ok || !body.success) {
            setError(body.error ?? t("errors.loadFailed"));
            setData(null);
            return;
          }
          setData(body.data as InstructorRevenueData);
        } catch {
          setError(t("errors.loadFailed"));
          setData(null);
        } finally {
          setInitialLoading(false);
        }
      });
    },
    [t]
  );

  const preferredKey = `${preferredRange.preset}|${preferredRange.from?.toISOString() ?? ""}|${preferredRange.to?.toISOString() ?? ""}`;

  useEffect(() => {
    setRangeValue(preferredRange);
    load(preferredRange, granularity, courseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferredKey]);

  const loading = initialLoading || pending;

  const onRangeChange = (next: AnalyticsDateRangeValue) => {
    setRangeValue(next);
    load(next, granularity, courseId);
  };

  const onGranularityChange = (next: Granularity) => {
    setGranularity(next);
    load(rangeValue, next, courseId);
  };

  const onCourseChange = (nextCourseId: string) => {
    setCourseId(nextCourseId);
    load(rangeValue, granularity, nextCourseId);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <DateRangePicker
          value={rangeValue}
          onChange={onRangeChange}
          disabled={loading}
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("table.course")}</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={courseId}
            disabled={loading || courses.length === 0}
            onChange={(e) => onCourseChange(e.target.value)}
          >
            <option value="">{t("activity.allCourses")}</option>
            {courses.map((c) => (
              <option key={c.courseId} value={c.courseId}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-1">
          {(["day", "week", "month"] as Granularity[]).map((g) => (
            <Button
              key={g}
              type="button"
              size="sm"
              variant={granularity === g ? "default" : "outline"}
              disabled={loading}
              onClick={() => onGranularityChange(g)}
            >
              {t(`granularity.${g}`)}
            </Button>
          ))}
          <ExportButton
            section="revenue"
            rangeValue={rangeValue}
            courseId={courseId || undefined}
          />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              title={t("metrics.totalEarnings")}
              value={formatMoney(data.totals.earnings, locale)}
              trend={{
                direction: trendDirection(data.comparison.changePercent),
                changePercent: Math.abs(data.comparison.changePercent),
              }}
            />
            <MetricCard
              title={t("metrics.totalEnrollments")}
              value={formatNumber(data.totals.enrollments, locale)}
            />
            <MetricCard
              title={t("metrics.avgPerStudent")}
              value={formatMoney(data.totals.avgPerStudent, locale)}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartWrapper
              title={t("charts.earningsTrend")}
              empty={data.earningsTrend.length === 0}
              emptyMessage={t("empty.noRevenue")}
            >
              <AreaChart data={data.earningsTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number) => formatMoney(value, locale)}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#0f766e"
                  fill="#0f766e33"
                  name={t("charts.earningsTrend")}
                />
              </AreaChart>
            </ChartWrapper>

            <ChartWrapper
              title={t("charts.earningsByCourse")}
              empty={data.earningsByCourse.length === 0}
              emptyMessage={t("empty.noRevenue")}
            >
              <BarChart
                data={data.earningsByCourse.map((c) => ({
                  name:
                    c.title.length > 24
                      ? `${c.title.slice(0, 22)}…`
                      : c.title,
                  amount: c.amount,
                }))}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: number) => formatMoney(value, locale)}
                />
                <Bar
                  dataKey="amount"
                  fill="#0369a1"
                  name={t("charts.earningsByCourse")}
                />
              </BarChart>
            </ChartWrapper>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th scope="col" className="px-3 py-2 font-medium">{t("table.course")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t("table.enrollments")}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("table.revenue")}</th>
                </tr>
              </thead>
              <tbody>
                {data.earningsByCourse.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-3 py-4 text-muted-foreground"
                    >
                      {t("table.noRows")}
                    </td>
                  </tr>
                ) : (
                  data.earningsByCourse.map((row) => (
                    <tr key={row.courseId} className="border-b last:border-0">
                      <td className="px-3 py-2">{row.title}</td>
                      <td className="px-3 py-2">
                        {formatNumber(row.enrollments, locale)}
                      </td>
                      <td className="px-3 py-2">
                        {formatMoney(row.amount, locale)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("empty.noRevenue")}</p>
      )}
    </div>
  );
}
