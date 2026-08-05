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
import type { StudentActivityData } from "@/service/analytics/instructor-analytics.service";
import { useAnalyticsDefaultRange } from "@/components/analytics/analytics-preferences-context";
import { ExportButton } from "@/components/analytics/export-button";
import type { CourseOption } from "./student-progress";

function formatDuration(seconds: number, locale: string): string {
  if (!seconds || seconds <= 0) return "—";
  const mins = Math.round(seconds / 60);
  if (mins < 60) {
    return new Intl.NumberFormat(locale).format(mins) + " min";
  }
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours}h ${rem}m`;
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function buildActivityUrl(
  rangeValue: AnalyticsDateRangeValue,
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
  });
  if (courseId) {
    params.set("courseId", courseId);
  }
  return `/api/analytics/instructor/activity?${params.toString()}`;
}

export function ActivityAnalytics({ courses }: { courses: CourseOption[] }) {
  const t = useTranslations("Analytics");
  const locale = useLocale();
  const preferredRange = useAnalyticsDefaultRange();
  const [rangeValue, setRangeValue] =
    useState<AnalyticsDateRangeValue>(preferredRange);
  const [courseId, setCourseId] = useState("");
  const [inactiveWindow, setInactiveWindow] = useState<"7d" | "30d">("7d");
  const [data, setData] = useState<StudentActivityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [initialLoading, setInitialLoading] = useState(true);

  const load = useCallback(
    (nextRange: AnalyticsDateRangeValue, nextCourseId: string) => {
      startTransition(async () => {
        setError(null);
        try {
          const res = await fetch(
            buildActivityUrl(nextRange, nextCourseId || undefined),
            { credentials: "include" }
          );
          const body = await res.json();
          if (!res.ok || !body.success) {
            setError(body.error ?? t("errors.loadFailed"));
            setData(null);
            return;
          }
          setData(body.data as StudentActivityData);
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
    load(preferredRange, courseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferredKey]);

  const loading = initialLoading || pending;

  const onRangeChange = (next: AnalyticsDateRangeValue) => {
    setRangeValue(next);
    load(next, courseId);
  };

  const onCourseChange = (nextCourseId: string) => {
    setCourseId(nextCourseId);
    load(rangeValue, nextCourseId);
  };

  const inactiveList =
    inactiveWindow === "7d"
      ? data?.inactiveStudents.list7Days ?? []
      : data?.inactiveStudents.list30Days ?? [];

  const hourChartData = (data?.activityByHour ?? []).map((h) => ({
    hour: `${String(h.hour).padStart(2, "0")}:00`,
    count: h.count,
  }));

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
        <ExportButton
          section="activity"
          rangeValue={rangeValue}
          courseId={courseId || undefined}
        />
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
              title={t("metrics.avgSessionDuration")}
              value={formatDuration(data.avgSessionDuration, locale)}
            />
            <MetricCard
              title={t("metrics.inactive7d")}
              value={data.inactiveStudents.last7Days}
            />
            <MetricCard
              title={t("metrics.inactive30d")}
              value={data.inactiveStudents.last30Days}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartWrapper
              title={t("charts.activityTrend")}
              empty={data.activityTrend.length === 0}
              emptyMessage={t("empty.noActivity")}
            >
              <AreaChart data={data.activityTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#0f766e"
                  fill="#0f766e33"
                  name={t("charts.activityTrend")}
                />
              </AreaChart>
            </ChartWrapper>

            <ChartWrapper
              title={t("charts.activityByDay")}
              empty={data.activityByDay.every((d) => d.count === 0)}
              emptyMessage={t("empty.noActivity")}
            >
              <BarChart data={data.activityByDay}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  fill="#0369a1"
                  name={t("charts.activityByDay")}
                />
              </BarChart>
            </ChartWrapper>
          </div>

          <ChartWrapper
            title={t("charts.activityByHour")}
            empty={hourChartData.every((d) => d.count === 0)}
            emptyMessage={t("empty.noActivity")}
          >
            <BarChart data={hourChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar
                dataKey="count"
                fill="#a16207"
                name={t("charts.activityByHour")}
              />
            </BarChart>
          </ChartWrapper>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">
                {t("metrics.inactiveStudents")}
              </h3>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={inactiveWindow === "7d" ? "default" : "outline"}
                  onClick={() => setInactiveWindow("7d")}
                >
                  {t("dateRange.last7Days")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={inactiveWindow === "30d" ? "default" : "outline"}
                  onClick={() => setInactiveWindow("30d")}
                >
                  {t("dateRange.last30Days")}
                </Button>
              </div>
            </div>

            {inactiveList.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("empty.noInactiveStudents")}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th scope="col" className="px-3 py-2 font-medium">
                        {t("table.student")}
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        {t("table.lastLogin")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveList.map((s) => (
                      <tr key={s.studentId} className="border-b last:border-0">
                        <td className="px-3 py-2">{s.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatDate(s.lastLoginAt, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("empty.noActivity")}</p>
      )}
    </div>
  );
}
