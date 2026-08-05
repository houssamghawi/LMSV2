"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  resolveDateRange,
  toIsoDateString,
} from "@/lib/analytics/date-ranges";
import type { Granularity } from "@/lib/analytics/schemas";
import type { CourseAnalyticsData } from "@/service/analytics/admin-analytics.service";
import { useAnalyticsDefaultRange } from "@/components/analytics/analytics-preferences-context";
import { ExportButton } from "@/components/analytics/export-button";

const CATEGORY_COLORS = [
  "#0f766e",
  "#0369a1",
  "#a16207",
  "#7c3aed",
  "#b91c1c",
  "#6b7280",
];

function formatMoney(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

function buildCoursesUrl(
  rangeValue: AnalyticsDateRangeValue,
  granularity: Granularity
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
    limit: "10",
  });
  return `/api/analytics/admin/courses?${params.toString()}`;
}

export function CourseAnalytics() {
  const t = useTranslations("Analytics");
  const locale = useLocale();
  const preferredRange = useAnalyticsDefaultRange();
  const [rangeValue, setRangeValue] =
    useState<AnalyticsDateRangeValue>(preferredRange);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [data, setData] = useState<CourseAnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [initialLoading, setInitialLoading] = useState(true);

  const load = useCallback(
    (nextRange: AnalyticsDateRangeValue, nextGranularity: Granularity) => {
      startTransition(async () => {
        setError(null);
        try {
          const res = await fetch(
            buildCoursesUrl(nextRange, nextGranularity),
            { credentials: "include" }
          );
          const body = await res.json();
          if (!res.ok || !body.success) {
            setError(body.error ?? t("errors.loadFailed"));
            setData(null);
            return;
          }
          setData(body.data as CourseAnalyticsData);
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
    load(preferredRange, granularity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferredKey]);

  const loading = initialLoading || pending;

  const onRangeChange = (next: AnalyticsDateRangeValue) => {
    setRangeValue(next);
    load(next, granularity);
  };

  const onGranularityChange = (next: Granularity) => {
    setGranularity(next);
    load(rangeValue, next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <DateRangePicker
          value={rangeValue}
          onChange={onRangeChange}
          disabled={loading}
        />
        <div className="flex flex-wrap items-center gap-2" role="group">
          {(["day", "week", "month"] as Granularity[]).map((g) => (
            <Button
              key={g}
              type="button"
              size="sm"
              variant={granularity === g ? "default" : "outline"}
              disabled={loading}
              aria-pressed={granularity === g}
              onClick={() => onGranularityChange(g)}
            >
              {t(`granularity.${g}`)}
            </Button>
          ))}
          <ExportButton section="courses" rangeValue={rangeValue} />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-80 w-full rounded-xl" />
          ))}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                {t("metrics.totalCourses")}
              </p>
              <p className="text-2xl font-semibold">
                {formatNumber(data.totals.courses, locale)}
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                {t("metrics.publishedCourses")}
              </p>
              <p className="text-2xl font-semibold">
                {formatNumber(data.totals.published, locale)}
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                {t("metrics.draftCourses")}
              </p>
              <p className="text-2xl font-semibold">
                {formatNumber(data.totals.draft, locale)}
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                {t("metrics.avgEnrollments")}
              </p>
              <p className="text-2xl font-semibold">
                {data.totals.avgEnrollments.toFixed(1)}
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                {t("metrics.completionRate")}
              </p>
              <p className="text-2xl font-semibold">
                {(data.totals.avgCompletionRate * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          <div
            className={`grid grid-cols-1 gap-6 lg:grid-cols-2 ${pending ? "opacity-70" : ""}`}
          >
            <ChartWrapper
              title={t("charts.enrollmentTrend")}
              empty={data.enrollmentTrend.length === 0}
              emptyMessage={t("empty.noEnrollments")}
            >
              <AreaChart data={data.enrollmentTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#0f766e"
                  fill="#99f6e4"
                  name={t("table.enrollments")}
                />
              </AreaChart>
            </ChartWrapper>

            <ChartWrapper
              title={t("charts.completionTrend")}
              empty={data.completionTrend.length === 0}
              emptyMessage={t("empty.noData")}
            >
              <AreaChart data={data.completionTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#0369a1"
                  fill="#bae6fd"
                  name={t("metrics.completionRate")}
                />
              </AreaChart>
            </ChartWrapper>

            <ChartWrapper
              title={t("charts.categoryDistribution")}
              empty={data.categoryDistribution.length === 0}
              emptyMessage={t("empty.noCourses")}
            >
              <PieChart>
                <Pie
                  data={data.categoryDistribution}
                  dataKey="count"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {data.categoryDistribution.map((_, index) => (
                    <Cell
                      key={`cat-${index}`}
                      fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ChartWrapper>

            <ChartWrapper
              title={t("charts.topCourses")}
              empty={data.topCourses.length === 0}
              emptyMessage={t("empty.noCourses")}
            >
              <BarChart
                data={data.topCourses.slice(0, 8)}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="title"
                  width={120}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip />
                <Bar
                  dataKey="enrollments"
                  fill="#a16207"
                  name={t("table.enrollments")}
                />
              </BarChart>
            </ChartWrapper>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[48rem] text-sm">
              <caption className="sr-only">{t("sections.courses")}</caption>
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">{t("table.course")}</th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t("table.instructor")}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t("table.enrollments")}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t("metrics.completionRate")}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">{t("table.revenue")}</th>
                </tr>
              </thead>
              <tbody>
                {data.topCourses.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-muted-foreground"
                    >
                      {t("table.noRows")}
                    </td>
                  </tr>
                ) : (
                  data.topCourses.map((row) => (
                    <tr key={row.courseId} className="border-b last:border-0">
                      <td className="px-4 py-3">{row.title}</td>
                      <td className="px-4 py-3">{row.instructor}</td>
                      <td className="px-4 py-3">
                        {formatNumber(row.enrollments, locale)}
                      </td>
                      <td className="px-4 py-3">
                        {(row.completionRate * 100).toFixed(0)}%
                      </td>
                      <td className="px-4 py-3">
                        {formatMoney(row.revenue, locale)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
