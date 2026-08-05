import {
  addHours,
  differenceInCalendarDays,
  eachDayOfInterval,
  formatISO,
  startOfHour,
} from "date-fns";
import type { DateRange } from "@/lib/analytics/date-ranges";

/**
 * Application performance metrics adapter (FR-005).
 *
 * SOURCE: `estimated`
 * ---------------------------------------------------------------------------
 * This deployment has no APM (e.g. Vercel Analytics, OpenTelemetry) and no
 * request-log collection. Metrics below are deterministic estimates so the
 * admin Performance panel and API contract can be exercised end-to-end.
 *
 * When a real source is available, replace `buildEstimatedPerformanceMetrics`
 * with an adapter that reads that store and set `source` to `"apm"` or
 * `"request-log"`. Payment failure counts may still be merged as a business
 * signal under `errorsByType`.
 */

export type PerformanceMetricsSource = "estimated" | "request-log" | "apm";

export interface PerformanceCurrent {
  avgResponseTime: number;
  p95ResponseTime: number;
  errorRate: number;
  uptime: number;
}

export interface PerformanceTrendPoint {
  date: string;
  value: number;
}

export interface PerformanceErrorBucket {
  type: string;
  count: number;
}

export interface PerformanceMetricsPayload {
  current: PerformanceCurrent;
  responseTrend: PerformanceTrendPoint[];
  errorTrend: PerformanceTrendPoint[];
  errorsByType: PerformanceErrorBucket[];
  /** Where the numbers came from — UI must label non-APM sources. */
  source: PerformanceMetricsSource;
  sourceLabel: string;
}

function daySeed(isoDate: string): number {
  let h = 2166136261;
  for (let i = 0; i < isoDate.length; i++) {
    h ^= isoDate.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Build estimated performance series for the given range.
 * Optional `paymentFailureRate` (0–1) gently biases error metrics toward
 * observed payment failures when available.
 */
export function buildEstimatedPerformanceMetrics(
  range: DateRange,
  options?: { paymentFailureRate?: number; paymentFailedCount?: number }
): PerformanceMetricsPayload {
  const days = eachDayOfInterval({ start: range.start, end: range.end });
  const dayCount = Math.max(1, differenceInCalendarDays(range.end, range.start) + 1);
  const useHourly = dayCount <= 3;

  const responseTrend: PerformanceTrendPoint[] = [];
  const errorTrend: PerformanceTrendPoint[] = [];

  if (useHourly) {
    let cursor = startOfHour(range.start);
    const end = range.end;
    while (cursor <= end) {
      const iso = formatISO(cursor);
      const seed = daySeed(iso);
      const responseMs = 140 + (seed % 100);
      const err =
        0.008 +
        ((seed % 40) / 1000) +
        (options?.paymentFailureRate ?? 0) * 0.15;
      responseTrend.push({ date: iso, value: responseMs });
      errorTrend.push({
        date: iso,
        value: Number(clamp(err, 0.005, 0.08).toFixed(4)),
      });
      cursor = addHours(cursor, 1);
    }
  } else {
    for (const day of days) {
      const iso = formatISO(day, { representation: "date" });
      const seed = daySeed(iso);
      const responseMs = 150 + (seed % 90);
      const err =
        0.01 +
        ((seed % 35) / 1000) +
        (options?.paymentFailureRate ?? 0) * 0.12;
      responseTrend.push({ date: `${iso}T12:00:00.000Z`, value: responseMs });
      errorTrend.push({
        date: `${iso}T12:00:00.000Z`,
        value: Number(clamp(err, 0.005, 0.08).toFixed(4)),
      });
    }
  }

  const avgResponseTime =
    responseTrend.length > 0
      ? Math.round(
          responseTrend.reduce((s, p) => s + p.value, 0) / responseTrend.length
        )
      : 180;
  const sorted = [...responseTrend.map((p) => p.value)].sort((a, b) => a - b);
  const p95ResponseTime =
    sorted.length > 0
      ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))])
      : Math.round(avgResponseTime * 1.6);

  const avgErrorRate =
    errorTrend.length > 0
      ? errorTrend.reduce((s, p) => s + p.value, 0) / errorTrend.length
      : 0.015;

  const uptime = Number(clamp(0.9998 - avgErrorRate * 0.05, 0.99, 0.9999).toFixed(4));

  const baseErrors = Math.max(8, Math.round(dayCount * 4));
  const failedPayments = options?.paymentFailedCount ?? 0;
  const errorsByType: PerformanceErrorBucket[] = [
    { type: "500", count: Math.round(baseErrors * 0.15) },
    { type: "404", count: Math.round(baseErrors * 0.55) },
    { type: "429", count: Math.round(baseErrors * 0.1) },
    { type: "other", count: Math.round(baseErrors * 0.2) },
  ];
  if (failedPayments > 0) {
    errorsByType.push({ type: "payment_failed", count: failedPayments });
  }

  return {
    current: {
      avgResponseTime,
      p95ResponseTime,
      errorRate: Number(avgErrorRate.toFixed(4)),
      uptime,
    },
    responseTrend,
    errorTrend,
    errorsByType,
    source: "estimated",
    sourceLabel:
      "Estimated metrics (no APM/request log). Replace adapter when monitoring is configured.",
  };
}
