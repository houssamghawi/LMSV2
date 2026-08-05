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
import { Skeleton } from "@/components/ui/skeleton";
import {
  resolveDateRange,
  toIsoDateString,
} from "@/lib/analytics/date-ranges";
import type { PerformanceMetricsData } from "@/service/analytics/admin-analytics.service";
import { useAnalyticsDefaultRange } from "@/components/analytics/analytics-preferences-context";

function formatMs(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale).format(value)} ms`;
}

function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatAxisTime(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: iso.includes("T") && !iso.endsWith("T12:00:00.000Z") ? "numeric" : undefined,
  }).format(d);
}

function buildPerformanceUrl(rangeValue: AnalyticsDateRangeValue): string {
  const range = resolveDateRange({
    preset: rangeValue.preset,
    startDate: rangeValue.from,
    endDate: rangeValue.to,
  });
  const params = new URLSearchParams({
    startDate: toIsoDateString(range.start),
    endDate: toIsoDateString(range.end),
  });
  return `/api/analytics/admin/performance?${params.toString()}`;
}

export function PerformancePanel() {
  const t = useTranslations("Analytics");
  const locale = useLocale();
  const preferredRange = useAnalyticsDefaultRange();
  const [rangeValue, setRangeValue] =
    useState<AnalyticsDateRangeValue>(preferredRange);
  const [data, setData] = useState<PerformanceMetricsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [initialLoading, setInitialLoading] = useState(true);

  const load = useCallback(
    (nextRange: AnalyticsDateRangeValue) => {
      startTransition(async () => {
        setError(null);
        try {
          const res = await fetch(buildPerformanceUrl(nextRange), {
            credentials: "include",
          });
          const body = await res.json();
          if (!res.ok || !body.success) {
            setError(body.error ?? t("errors.loadFailed"));
            setData(null);
            return;
          }
          setData(body.data as PerformanceMetricsData);
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

  const responseChart = (data?.responseTrend ?? []).map((p) => ({
    ...p,
    label: formatAxisTime(p.date, locale),
  }));
  const errorChart = (data?.errorTrend ?? []).map((p) => ({
    ...p,
    label: formatAxisTime(p.date, locale),
    // show as percentage points for chart readability
    pct: Number((p.value * 100).toFixed(3)),
  }));

  return (
    <div className="space-y-6">
      <DateRangePicker
        value={rangeValue}
        onChange={onRangeChange}
        disabled={loading}
      />

      {data?.source === "estimated" ? (
        <p
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
          role="status"
        >
          {t("performance.estimatedNotice")}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title={t("metrics.avgResponseTime")}
              value={formatMs(data.current.avgResponseTime, locale)}
            />
            <MetricCard
              title={t("metrics.p95ResponseTime")}
              value={formatMs(data.current.p95ResponseTime, locale)}
            />
            <MetricCard
              title={t("metrics.errorRate")}
              value={formatPercent(data.current.errorRate, locale)}
            />
            <MetricCard
              title={t("metrics.uptime")}
              value={formatPercent(data.current.uptime, locale)}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartWrapper
              title={t("charts.responseTrend")}
              empty={responseChart.length === 0}
              emptyMessage={t("empty.noData")}
            >
              <AreaChart data={responseChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  unit=" ms"
                  allowDecimals={false}
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#0f766e"
                  fill="#0f766e33"
                  name={t("charts.responseTrend")}
                />
              </AreaChart>
            </ChartWrapper>

            <ChartWrapper
              title={t("charts.errorTrend")}
              empty={errorChart.length === 0}
              emptyMessage={t("empty.noData")}
            >
              <AreaChart data={errorChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="pct"
                  stroke="#b91c1c"
                  fill="#b91c1c33"
                  name={t("charts.errorTrend")}
                />
              </AreaChart>
            </ChartWrapper>
          </div>

          <ChartWrapper
            title={t("charts.errorsByType")}
            empty={data.errorsByType.every((e) => e.count === 0)}
            emptyMessage={t("empty.noData")}
          >
            <BarChart data={data.errorsByType}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="type" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar
                dataKey="count"
                fill="#a16207"
                name={t("charts.errorsByType")}
              />
            </BarChart>
          </ChartWrapper>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("empty.noData")}</p>
      )}
    </div>
  );
}
