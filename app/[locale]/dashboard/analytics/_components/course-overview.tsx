"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MetricCard } from "@/components/analytics/metric-card";
import {
  DateRangePicker,
  type AnalyticsDateRangeValue,
} from "@/components/analytics/date-range-picker";
import { Skeleton } from "@/components/ui/skeleton";
import {
  resolveDateRange,
  toIsoDateString,
} from "@/lib/analytics/date-ranges";
import type { InstructorOverviewData } from "@/service/analytics/instructor-analytics.service";
import { useAnalyticsDefaultRange } from "@/components/analytics/analytics-preferences-context";

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

function buildOverviewUrl(rangeValue: AnalyticsDateRangeValue): string {
  const range = resolveDateRange({
    preset: rangeValue.preset,
    startDate: rangeValue.from,
    endDate: rangeValue.to,
  });
  const params = new URLSearchParams({
    startDate: toIsoDateString(range.start),
    endDate: toIsoDateString(range.end),
  });
  return `/api/analytics/instructor/overview?${params.toString()}`;
}

export function CourseOverview() {
  const t = useTranslations("Analytics");
  const locale = useLocale();
  const preferredRange = useAnalyticsDefaultRange();
  const [rangeValue, setRangeValue] =
    useState<AnalyticsDateRangeValue>(preferredRange);
  const [data, setData] = useState<InstructorOverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [initialLoading, setInitialLoading] = useState(true);

  const load = useCallback(
    (nextRange: AnalyticsDateRangeValue) => {
      startTransition(async () => {
        setError(null);
        try {
          const res = await fetch(buildOverviewUrl(nextRange), {
            credentials: "include",
          });
          const body = await res.json();
          if (!res.ok || !body.success) {
            setError(body.error ?? t("errors.loadFailed"));
            setData(null);
            return;
          }
          setData(body.data as InstructorOverviewData);
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
    load(preferredRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferredKey]);

  const loading = initialLoading || pending;

  const onRangeChange = (next: AnalyticsDateRangeValue) => {
    setRangeValue(next);
    load(next);
  };

  return (
    <div className="space-y-6">
      <DateRangePicker
        value={rangeValue}
        onChange={onRangeChange}
        disabled={loading}
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !data ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : null}

      {data ? (
        <>
          {/* Mobile summary */}
          <div className="space-y-3 md:hidden">
            <div>
              <h2 className="text-sm font-medium">{t("mobile.summaryTitle")}</h2>
              <p className="text-xs text-muted-foreground">
                {t("mobile.summaryHint")}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MetricCard
                title={t("metrics.totalCourses")}
                value={formatNumber(data.totalCourses, locale)}
              />
              <MetricCard
                title={t("metrics.totalEnrollments")}
                value={formatNumber(data.totalEnrollments, locale)}
                trend={{
                  direction: data.trends.enrollments.direction,
                  changePercent: data.trends.enrollments.changePercent,
                }}
              />
              <MetricCard
                title={t("metrics.activeStudents")}
                value={formatNumber(data.activeStudents, locale)}
              />
              <MetricCard
                title={t("metrics.totalRevenue")}
                value={formatMoney(data.totalRevenue, locale)}
                trend={{
                  direction: data.trends.revenue.direction,
                  changePercent: data.trends.revenue.changePercent,
                }}
              />
            </div>
          </div>

          {/* Desktop metrics */}
          <div
            className={`hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4 ${pending ? "opacity-70" : ""}`}
          >
            <MetricCard
              title={t("metrics.totalCourses")}
              value={formatNumber(data.totalCourses, locale)}
            />
            <MetricCard
              title={t("metrics.totalEnrollments")}
              value={formatNumber(data.totalEnrollments, locale)}
              trend={{
                direction: data.trends.enrollments.direction,
                changePercent: data.trends.enrollments.changePercent,
              }}
            />
            <MetricCard
              title={t("metrics.activeStudents")}
              value={formatNumber(data.activeStudents, locale)}
            />
            <MetricCard
              title={t("metrics.totalRevenue")}
              value={formatMoney(data.totalRevenue, locale)}
              trend={{
                direction: data.trends.revenue.direction,
                changePercent: data.trends.revenue.changePercent,
              }}
            />
          </div>

          <div className="hidden md:block">
            <h2 className="mb-3 text-lg font-semibold">{t("sections.courses")}</h2>
            {data.courses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("empty.noCourses")}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {data.courses.map((course) => (
                  <div
                    key={course.courseId}
                    className="rounded-xl border p-4 space-y-3"
                  >
                    <h3 className="font-medium">{course.title}</h3>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-muted-foreground">
                          {t("table.enrollments")}
                        </dt>
                        <dd className="font-semibold">
                          {formatNumber(course.enrollments, locale)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          {t("metrics.activeStudents")}
                        </dt>
                        <dd className="font-semibold">
                          {formatNumber(course.activeStudents, locale)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          {t("metrics.completionRate")}
                        </dt>
                        <dd className="font-semibold">
                          {(course.completionRate * 100).toFixed(0)}%
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          {t("table.revenue")}
                        </dt>
                        <dd className="font-semibold">
                          {formatMoney(course.revenue, locale)}
                        </dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-muted-foreground">
                          {t("metrics.averageProgress")}
                        </dt>
                        <dd className="font-semibold">
                          {(course.avgProgress * 100).toFixed(0)}%
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
