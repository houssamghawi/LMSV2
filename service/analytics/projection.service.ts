import "server-only";
import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  formatISO,
  startOfDay,
} from "date-fns";
import { dbConnect } from "@/service/mongo";
import { User } from "@/model/user-model";
import { Payment } from "@/model/payment-model";
import { Enrollment } from "@/model/enrollment-model";
import {
  getMaxLookbackDate,
  type DateRange,
} from "@/lib/analytics/date-ranges";
import {
  projectFromHistorical,
  type ProjectionConfidence,
  type TimeSeriesPoint,
} from "@/lib/analytics/projection-algorithms";
import { getRegistrationTrend } from "@/queries/analytics/user-aggregations";
import { getRevenueTrend } from "@/queries/analytics/revenue-aggregations";
import { getEnrollmentTrend } from "@/queries/analytics/course-aggregations";

export const MIN_PROJECTION_HISTORY_DAYS = 90;
export const PROJECTION_HORIZONS = [30, 60, 90] as const;
export type ProjectionHorizon = (typeof PROJECTION_HORIZONS)[number];
export type ProjectionMetric = "users" | "revenue" | "enrollments";

export class InsufficientProjectionDataError extends Error {
  readonly code = "INSUFFICIENT_DATA" as const;
  readonly actualDays: number;

  constructor(actualDays: number) {
    super("Projections require at least 90 days of historical data");
    this.name = "InsufficientProjectionDataError";
    this.actualDays = actualDays;
  }
}

export interface ProjectionResult {
  metric: ProjectionMetric;
  historicalData: TimeSeriesPoint[];
  projections: {
    baseline: TimeSeriesPoint[];
    optimistic: TimeSeriesPoint[];
    conservative: TimeSeriesPoint[];
  };
  confidence: ProjectionConfidence;
  rSquared: number;
  minDataDays: number;
  actualDataDays: number;
}

function toIsoDate(d: Date): string {
  return formatISO(d, { representation: "date" });
}

/** Fill every calendar day in [start, end] (inclusive); missing days → 0. */
export function fillDailySeries(
  start: Date,
  end: Date,
  sparse: TimeSeriesPoint[]
): TimeSeriesPoint[] {
  const map = new Map(sparse.map((p) => [p.date.slice(0, 10), p.value]));
  const out: TimeSeriesPoint[] = [];
  let cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor <= last) {
    const date = toIsoDate(cursor);
    out.push({ date, value: map.get(date) ?? 0 });
    cursor = addDays(cursor, 1);
  }
  return out;
}

async function getEarliestMetricDate(
  metric: ProjectionMetric
): Promise<Date | null> {
  await dbConnect();

  if (metric === "users") {
    const row = await User.findOne({})
      .sort({ createdAt: 1 })
      .select("createdAt")
      .lean();
    return row?.createdAt ? new Date(row.createdAt) : null;
  }

  if (metric === "revenue") {
    const row = await Payment.findOne({ status: "succeeded" })
      .sort({ paidAt: 1 })
      .select("paidAt")
      .lean();
    return row?.paidAt ? new Date(row.paidAt) : null;
  }

  const row = await Enrollment.findOne({})
    .sort({ enrollment_date: 1 })
    .select("enrollment_date")
    .lean();
  return row?.enrollment_date ? new Date(row.enrollment_date) : null;
}

async function fetchSparseTrend(
  metric: ProjectionMetric,
  range: DateRange
): Promise<TimeSeriesPoint[]> {
  if (metric === "users") {
    return getRegistrationTrend(range, "day");
  }
  if (metric === "revenue") {
    return getRevenueTrend(range, "day");
  }
  return getEnrollmentTrend(range, "day");
}

/**
 * Build 30/60/90-day projections from platform history (FR-006).
 * Requires ≥90 calendar days from earliest metric event to today.
 */
export async function getProjection(options: {
  metric: ProjectionMetric;
  horizon?: number;
  now?: Date;
}): Promise<ProjectionResult> {
  const metric = options.metric;
  const horizon = (options.horizon ?? 30) as number;
  if (![30, 60, 90].includes(horizon)) {
    throw new Error("horizon must be 30, 60, or 90");
  }

  const now = options.now ?? new Date();
  const end = endOfDay(now);
  const earliest = await getEarliestMetricDate(metric);

  if (!earliest) {
    throw new InsufficientProjectionDataError(0);
  }

  const actualDataDays =
    differenceInCalendarDays(startOfDay(end), startOfDay(earliest)) + 1;

  if (actualDataDays < MIN_PROJECTION_HISTORY_DAYS) {
    throw new InsufficientProjectionDataError(actualDataDays);
  }

  const lookbackFloor = getMaxLookbackDate(now);
  const start = startOfDay(
    earliest > lookbackFloor ? earliest : lookbackFloor
  );

  const range: DateRange = {
    start,
    end,
    preset: "custom",
  };

  const sparse = await fetchSparseTrend(metric, range);
  const historicalData = fillDailySeries(start, end, sparse);

  const scenarios = projectFromHistorical(historicalData, horizon, {
    smaWindow: 7,
    floorAtZero: true,
  });

  // Low-confidence warning when R² < 0.5 (research.md §3)
  const confidence = scenarios.confidence;

  return {
    metric,
    historicalData,
    projections: {
      baseline: scenarios.baseline,
      optimistic: scenarios.optimistic,
      conservative: scenarios.conservative,
    },
    confidence,
    rSquared: scenarios.rSquared,
    minDataDays: MIN_PROJECTION_HISTORY_DAYS,
    actualDataDays,
  };
}
