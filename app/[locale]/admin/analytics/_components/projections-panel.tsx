"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { ChartWrapper } from "@/components/analytics/chart-wrapper";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ProjectionMetric,
  ProjectionResult,
} from "@/service/analytics/projection.service";

const METRICS: ProjectionMetric[] = ["users", "revenue", "enrollments"];
const HORIZONS = [30, 60, 90] as const;

function formatValue(
  metric: ProjectionMetric,
  value: number,
  locale: string
): string {
  if (metric === "revenue") {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }
  return new Intl.NumberFormat(locale).format(Math.round(value));
}

export function ProjectionsPanel() {
  const t = useTranslations("Analytics");
  const locale = useLocale();
  const [metric, setMetric] = useState<ProjectionMetric>("revenue");
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(30);
  const [data, setData] = useState<ProjectionResult | null>(null);
  const [insufficientDays, setInsufficientDays] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [initialLoading, setInitialLoading] = useState(true);

  const load = useCallback(
    (nextMetric: ProjectionMetric, nextHorizon: number) => {
      startTransition(async () => {
        setError(null);
        setInsufficientDays(null);
        try {
          const params = new URLSearchParams({
            metric: nextMetric,
            horizon: String(nextHorizon),
          });
          const res = await fetch(
            `/api/analytics/admin/projections?${params.toString()}`,
            { credentials: "include" }
          );
          const body = await res.json();
          if (!res.ok || !body.success) {
            if (body?.error?.code === "INSUFFICIENT_DATA") {
              setInsufficientDays(body.error.actualDays ?? 0);
              setData(null);
              return;
            }
            const msg =
              typeof body.error === "string"
                ? body.error
                : body.error?.message ?? t("errors.loadFailed");
            setError(msg);
            setData(null);
            return;
          }
          setData(body.data as ProjectionResult);
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

  useEffect(() => {
    load(metric, horizon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loading = initialLoading || pending;

  const chartData = useMemo(() => {
    if (!data) return [];
    const map = new Map<
      string,
      {
        date: string;
        historical?: number;
        baseline?: number;
        optimistic?: number;
        conservative?: number;
      }
    >();

    for (const p of data.historicalData) {
      map.set(p.date, { date: p.date, historical: p.value });
    }
    for (const p of data.projections.baseline) {
      const row = map.get(p.date) ?? { date: p.date };
      row.baseline = p.value;
      map.set(p.date, row);
    }
    for (const p of data.projections.optimistic) {
      const row = map.get(p.date) ?? { date: p.date };
      row.optimistic = p.value;
      map.set(p.date, row);
    }
    for (const p of data.projections.conservative) {
      const row = map.get(p.date) ?? { date: p.date };
      row.conservative = p.value;
      map.set(p.date, row);
    }

    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  // Show last ~60 historical days + full projection for readability
  const displayData = useMemo(() => {
    if (!data || chartData.length === 0) return [];
    const histLen = data.historicalData.length;
    const keepFrom = Math.max(0, histLen - 60);
    const histCutoff = data.historicalData[keepFrom]?.date;
    if (!histCutoff) return chartData;
    return chartData.filter(
      (row) =>
        row.date >= histCutoff ||
        row.baseline !== undefined ||
        row.optimistic !== undefined
    );
  }, [chartData, data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">
            {t("projections.metric")}
          </span>
          <div className="flex flex-wrap gap-1">
            {METRICS.map((m) => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={metric === m ? "default" : "outline"}
                disabled={loading}
                onClick={() => {
                  setMetric(m);
                  load(m, horizon);
                }}
              >
                {t(`projections.metrics.${m}`)}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">
            {t("projections.horizon")}
          </span>
          <div className="flex gap-1">
            {HORIZONS.map((h) => (
              <Button
                key={h}
                type="button"
                size="sm"
                variant={horizon === h ? "default" : "outline"}
                disabled={loading}
                onClick={() => {
                  setHorizon(h);
                  load(metric, h);
                }}
              >
                {t("projections.horizonDays", { days: h })}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {insufficientDays !== null ? (
        <div
          className="rounded-md border border-dashed bg-muted/40 px-4 py-8 text-center"
          role="status"
        >
          <p className="text-sm font-medium">
            {t("empty.projectionsUnavailable")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("projections.actualDays", {
              actual: insufficientDays,
              required: 90,
            })}
          </p>
        </div>
      ) : null}

      {loading && !data && insufficientDays === null ? (
        <Skeleton className="h-80 w-full" />
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span
              className={
                data.confidence === "high"
                  ? "rounded-md bg-emerald-100 px-2 py-1 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                  : data.confidence === "medium"
                    ? "rounded-md bg-amber-100 px-2 py-1 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
                    : "rounded-md bg-red-100 px-2 py-1 text-red-800 dark:bg-red-950 dark:text-red-200"
              }
            >
              {t(`projections.confidence.${data.confidence}`)}
            </span>
            <span className="text-muted-foreground">
              {t("projections.rSquared", {
                value: data.rSquared.toFixed(2),
              })}
            </span>
            <span className="text-muted-foreground">
              {t("projections.historyDays", {
                days: data.actualDataDays,
              })}
            </span>
          </div>

          {data.confidence === "low" ? (
            <p className="text-sm text-amber-800 dark:text-amber-200" role="status">
              {t("projections.lowConfidenceHint")}
            </p>
          ) : null}

          <ChartWrapper
            title={t("charts.projections", {
              metric: t(`projections.metrics.${metric}`),
            })}
            empty={displayData.length === 0}
            emptyMessage={t("empty.chartEmpty")}
          >
            <LineChart data={displayData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={24} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  metric === "revenue"
                    ? formatValue(metric, Number(v), locale)
                    : String(Math.round(Number(v)))
                }
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatValue(metric, value, locale),
                  t(`projections.series.${name}`),
                ]}
              />
              <Legend
                formatter={(value) => t(`projections.series.${value}`)}
              />
              <Line
                type="monotone"
                dataKey="historical"
                stroke="#0f766e"
                dot={false}
                strokeWidth={2}
                connectNulls={false}
                name="historical"
              />
              <Line
                type="monotone"
                dataKey="baseline"
                stroke="#0369a1"
                strokeDasharray="4 2"
                dot={false}
                strokeWidth={2}
                connectNulls={false}
                name="baseline"
              />
              <Line
                type="monotone"
                dataKey="optimistic"
                stroke="#15803d"
                strokeDasharray="2 2"
                dot={false}
                strokeWidth={1.5}
                connectNulls={false}
                name="optimistic"
              />
              <Line
                type="monotone"
                dataKey="conservative"
                stroke="#a16207"
                strokeDasharray="2 2"
                dot={false}
                strokeWidth={1.5}
                connectNulls={false}
                name="conservative"
              />
            </LineChart>
          </ChartWrapper>
        </>
      ) : null}
    </div>
  );
}
