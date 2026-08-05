"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { MetricCard } from "@/components/analytics/metric-card";
import { DateRangePicker, type AnalyticsDateRangeValue } from "@/components/analytics/date-range-picker";
import { Skeleton } from "@/components/ui/skeleton";
import {
  resolveDateRange,
  toIsoDateString,
} from "@/lib/analytics/date-ranges";
import type { AnomalyResult, PlatformOverview } from "@/lib/analytics/schemas";
import { useAnalyticsDefaultRange } from "@/components/analytics/analytics-preferences-context";
import { ExportButton } from "@/components/analytics/export-button";

type OverviewPayload = PlatformOverview & { anomalies?: AnomalyResult[] };

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
  return `/api/analytics/admin/overview?${params.toString()}`;
}

function anomalyFor(
  anomalies: AnomalyResult[] | undefined,
  metric: string
): { severity: AnomalyResult["severity"]; label?: string } | undefined {
  const hit = anomalies?.find((a) => a.detected && a.metric === metric);
  if (!hit) return undefined;
  return { severity: hit.severity, label: hit.message || undefined };
}

export function OverviewCards() {
  const t = useTranslations("Analytics");
  const tAdmin = useTranslations("Admin");
  const locale = useLocale();
  const preferredRange = useAnalyticsDefaultRange();
  const [rangeValue, setRangeValue] =
    useState<AnalyticsDateRangeValue>(preferredRange);
  const [data, setData] = useState<OverviewPayload | null>(null);
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
          setData(body.data as OverviewPayload);
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

  const cards = data
    ? [
        {
          key: "courses",
          title: t("metrics.totalCourses"),
          value: formatNumber(data.totalCourses, locale),
          description: `${formatNumber(data.activeCourses, locale)} active`,
          trend: data.trends.courses,
          anomaly: undefined,
        },
        {
          key: "users",
          title: t("metrics.totalUsers"),
          value: formatNumber(data.totalUsers, locale),
          description: `${formatNumber(data.totalStudents, locale)} ${t("metrics.totalStudents").toLowerCase()} · ${formatNumber(data.totalInstructors, locale)} ${t("metrics.totalInstructors").toLowerCase()}`,
          trend: data.trends.users,
          anomaly: anomalyFor(data.anomalies, "registrations"),
        },
        {
          key: "revenue",
          title: t("metrics.totalRevenue"),
          value: formatMoney(data.totalRevenue, locale),
          description: t("dateRange.comparePrevious"),
          trend: data.trends.revenue,
          anomaly: anomalyFor(data.anomalies, "revenue"),
        },
        {
          key: "enrollments",
          title: t("metrics.totalEnrollments"),
          value: formatNumber(data.totalEnrollments, locale),
          trend: data.trends.enrollments,
          anomaly: undefined,
        },
        {
          key: "activeToday",
          title: t("metrics.activeUsers"),
          value: formatNumber(data.activeUsersToday, locale),
        },
      ]
    : [];

  // Mobile key metrics only
  const mobileKeys = new Set(["courses", "users", "revenue", "activeToday"]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <DateRangePicker
          value={rangeValue}
          onChange={onRangeChange}
          disabled={loading}
        />
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton section="enrollments" rangeValue={rangeValue} />
          <ExportButton section="activity" rangeValue={rangeValue} />
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            disabled={loading}
            onClick={() => load(rangeValue)}
          >
            {tAdmin("refreshData")}
          </button>
        </div>
      </div>

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

      {!loading && data && cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty.noData")}</p>
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
              {cards
                .filter((c) => mobileKeys.has(c.key))
                .map((card) => (
                  <MetricCard
                    key={card.key}
                    title={card.title}
                    value={card.value}
                    description={card.description}
                    trend={
                      card.trend
                        ? {
                            direction: card.trend.direction,
                            changePercent: card.trend.changePercent,
                          }
                        : undefined
                    }
                    anomaly={card.anomaly}
                  />
                ))}
            </div>
          </div>

          {/* Desktop / tablet full overview */}
          <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <MetricCard
                key={card.key}
                title={card.title}
                value={card.value}
                description={card.description}
                trend={
                  card.trend
                    ? {
                        direction: card.trend.direction,
                        changePercent: card.trend.changePercent,
                      }
                    : undefined
                }
                anomaly={card.anomaly}
                className={pending ? "opacity-70" : undefined}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
