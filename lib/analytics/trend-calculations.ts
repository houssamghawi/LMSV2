import type { TrendIndicator } from "./schemas";

export type TrendDirection = "up" | "down" | "stable";

/** Absolute relative change below this is treated as stable (0.5%). */
export const STABLE_THRESHOLD = 0.005;

/**
 * Relative change as a percentage (e.g. 5.4 means +5.4%).
 * When previous is 0: returns 0 if current is also 0, otherwise 100 (or -100 if negative).
 */
export function changePercent(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0;
    return current > 0 ? 100 : -100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function trendDirection(
  current: number,
  previous: number,
  stableThreshold: number = STABLE_THRESHOLD
): TrendDirection {
  if (previous === 0 && current === 0) return "stable";
  const relative =
    previous === 0
      ? current === 0
        ? 0
        : 1
      : (current - previous) / Math.abs(previous);

  if (Math.abs(relative) < stableThreshold) return "stable";
  return relative > 0 ? "up" : "down";
}

export function buildTrendIndicator(
  current: number,
  previous: number,
  stableThreshold: number = STABLE_THRESHOLD
): TrendIndicator {
  const percent = changePercent(current, previous);
  return {
    current,
    previous,
    changePercent: Math.round(percent * 10) / 10,
    direction: trendDirection(current, previous, stableThreshold),
  };
}
