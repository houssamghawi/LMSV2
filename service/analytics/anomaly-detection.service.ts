import {
  ANOMALY_CONFIGS,
  type AnomalyConfig,
} from "@/lib/analytics/anomaly-thresholds";
import type { AnomalyResult } from "@/lib/analytics/schemas";
import { changePercent } from "@/lib/analytics/trend-calculations";

export interface MetricSample {
  metric: string;
  currentValue: number;
  /** Previous period value, or rolling average for spike metrics. */
  expectedValue: number;
}

function crossedThreshold(
  config: AnomalyConfig,
  currentValue: number,
  expectedValue: number
): boolean {
  if (config.absolute) {
    const delta = currentValue - expectedValue;
    if (config.direction === "increase") return delta > config.threshold;
    if (config.direction === "decrease") return delta < -config.threshold;
    return Math.abs(delta) > config.threshold;
  }

  if (expectedValue === 0) {
    if (currentValue === 0) return false;
    // Treat any non-zero move from zero as exceeding relative thresholds
    // when direction matches the sign of the change.
    if (config.direction === "increase") return currentValue > 0;
    if (config.direction === "decrease") return currentValue < 0;
    return true;
  }

  const relative = (currentValue - expectedValue) / Math.abs(expectedValue);

  if (config.direction === "increase") return relative > config.threshold;
  if (config.direction === "decrease") return relative < -config.threshold;
  return Math.abs(relative) > config.threshold;
}

function formatMessage(config: AnomalyConfig, percent: number): string {
  const absPercent = Math.abs(Math.round(percent * 10) / 10);
  // English fallback; UI should prefer i18n via messageKey when rendering.
  switch (config.metric) {
    case "revenue":
      return `Revenue dropped more than ${Math.round(config.threshold * 100)}% vs last period (${absPercent}%)`;
    case "errorRate":
      return `Error rate increased by more than ${Math.round(config.threshold * 100)}%`;
    case "registrations":
      return `Registrations dropped more than ${Math.round(config.threshold * 100)}% vs last period (${absPercent}%)`;
    case "activeUsers":
      return `Active users declined more than ${Math.round(config.threshold * 100)}% vs last period (${absPercent}%)`;
    case "activity":
      return `Activity spiked more than ${Math.round(config.threshold * 100)}% above the rolling average (${absPercent}%)`;
    default:
      return `Anomaly detected on ${config.metric} (${absPercent}%)`;
  }
}

export function evaluateAnomaly(
  sample: MetricSample,
  config?: AnomalyConfig
): AnomalyResult {
  const resolved =
    config ?? ANOMALY_CONFIGS.find((c) => c.metric === sample.metric);

  if (!resolved) {
    return {
      metric: sample.metric,
      detected: false,
      severity: "info",
      currentValue: sample.currentValue,
      expectedValue: sample.expectedValue,
      threshold: 0,
      changePercent: changePercent(sample.currentValue, sample.expectedValue),
      message: "",
    };
  }

  const detected = crossedThreshold(
    resolved,
    sample.currentValue,
    sample.expectedValue
  );
  const percent = changePercent(sample.currentValue, sample.expectedValue);

  return {
    metric: resolved.metric,
    detected,
    severity: resolved.severity,
    currentValue: sample.currentValue,
    expectedValue: sample.expectedValue,
    threshold: resolved.threshold,
    changePercent: Math.round(percent * 10) / 10,
    message: detected ? formatMessage(resolved, percent) : "",
  };
}

/**
 * Evaluate all configured anomaly metrics against provided samples.
 * Only detected anomalies are returned (for dashboard highlighting).
 */
export function detectAnomalies(samples: MetricSample[]): AnomalyResult[] {
  const byMetric = new Map(samples.map((s) => [s.metric, s]));
  const results: AnomalyResult[] = [];

  for (const config of ANOMALY_CONFIGS) {
    const sample = byMetric.get(config.metric);
    if (!sample) continue;
    const result = evaluateAnomaly(sample, config);
    if (result.detected) results.push(result);
  }

  return results;
}
