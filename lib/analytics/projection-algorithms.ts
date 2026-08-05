/**
 * Projection algorithms (research.md §3 / FR-006).
 * Linear regression + residual-based 95% confidence bands.
 * Not ML — explainable slope/intercept and R² only.
 */

export interface XYPoint {
  x: number;
  y: number;
}

export interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
  /** Residual standard deviation (population). */
  residualStdDev: number;
}

export type ProjectionConfidence = "high" | "medium" | "low";

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface ProjectionScenarios {
  baseline: TimeSeriesPoint[];
  optimistic: TimeSeriesPoint[];
  conservative: TimeSeriesPoint[];
  rSquared: number;
  confidence: ProjectionConfidence;
}

const Z_95 = 1.96;

export function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Ordinary least-squares linear regression with R² and residual σ.
 */
export function linearRegression(data: XYPoint[]): RegressionResult {
  const n = data.length;
  if (n < 2) {
    const y = data[0]?.y ?? 0;
    return { slope: 0, intercept: y, rSquared: 0, residualStdDev: 0 };
  }

  const sumX = data.reduce((s, p) => s + p.x, 0);
  const sumY = data.reduce((s, p) => s + p.y, 0);
  const sumXY = data.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = data.reduce((s, p) => s + p.x * p.x, 0);
  const sumY2 = data.reduce((s, p) => s + p.y * p.y, 0);

  const denom = n * sumX2 - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const ssTot = sumY2 - (sumY * sumY) / n;
  const ssRes = data.reduce((s, p) => {
    const pred = slope * p.x + intercept;
    return s + (p.y - pred) ** 2;
  }, 0);

  const rSquared =
    ssTot <= 0 ? 1 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));
  const residualStdDev = Math.sqrt(ssRes / n);

  return { slope, intercept, rSquared, residualStdDev };
}

/** Simple moving average; pads leading values with the expanding mean. */
export function simpleMovingAverage(values: number[], window: number): number[] {
  if (window <= 1 || values.length === 0) return [...values];
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    out.push(slice.reduce((s, v) => s + v, 0) / slice.length);
  }
  return out;
}

export function confidenceLevel(rSquared: number): ProjectionConfidence {
  if (rSquared >= 0.7) return "high";
  if (rSquared >= 0.5) return "medium";
  return "low";
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addCalendarDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}

/**
 * Fit SMA-smoothed linear regression on historical daily points and
 * project `horizonDays` ahead with optimistic/conservative bands.
 */
export function projectFromHistorical(
  historical: TimeSeriesPoint[],
  horizonDays: number,
  options?: { smaWindow?: number; floorAtZero?: boolean }
): ProjectionScenarios {
  const smaWindow = options?.smaWindow ?? 7;
  const floorAtZero = options?.floorAtZero ?? true;

  const sorted = [...historical].sort((a, b) => a.date.localeCompare(b.date));
  const rawY = sorted.map((p) => p.value);
  const smoothed = simpleMovingAverage(rawY, smaWindow);
  const xy: XYPoint[] = smoothed.map((y, i) => ({ x: i, y }));

  const { slope, intercept, rSquared, residualStdDev } = linearRegression(xy);
  const margin = Z_95 * residualStdDev;
  const lastDate = sorted[sorted.length - 1]?.date ?? toIsoDate(new Date());
  const startX = sorted.length;

  const baseline: TimeSeriesPoint[] = [];
  const optimistic: TimeSeriesPoint[] = [];
  const conservative: TimeSeriesPoint[] = [];

  for (let i = 0; i < horizonDays; i++) {
    const x = startX + i;
    const pred = slope * x + intercept;
    const date = addCalendarDays(lastDate, i + 1);
    let base = pred;
    let high = pred + margin;
    let low = pred - margin;
    if (floorAtZero) {
      base = Math.max(0, base);
      high = Math.max(0, high);
      low = Math.max(0, low);
    }
    baseline.push({ date, value: Number(base.toFixed(2)) });
    optimistic.push({ date, value: Number(high.toFixed(2)) });
    conservative.push({ date, value: Number(low.toFixed(2)) });
  }

  return {
    baseline,
    optimistic,
    conservative,
    rSquared: Number(rSquared.toFixed(4)),
    confidence: confidenceLevel(rSquared),
  };
}

export function calculateConfidenceBand(
  prediction: number,
  residualStdDev: number
): { low: number; high: number } {
  const margin = Z_95 * residualStdDev;
  return { low: prediction - margin, high: prediction + margin };
}
