export type AnomalySeverity = "critical" | "warning" | "info";
export type AnomalyDirection = "increase" | "decrease" | "both";

export interface AnomalyConfig {
  metric: string;
  /** Relative threshold (0.20 = 20%) unless `absolute` is true. */
  threshold: number;
  direction: AnomalyDirection;
  severity: AnomalySeverity;
  /** When true, compare absolute delta (e.g. error rate +0.05). */
  absolute?: boolean;
  messageKey: string;
}

/**
 * Percentage-based anomaly thresholds (research.md §4).
 * Visual highlighting only — no external notifications.
 */
export const ANOMALY_CONFIGS: AnomalyConfig[] = [
  {
    metric: "revenue",
    threshold: 0.2,
    direction: "decrease",
    severity: "critical",
    messageKey: "Analytics.anomalies.revenueDrop",
  },
  {
    metric: "errorRate",
    threshold: 0.05,
    direction: "increase",
    severity: "critical",
    absolute: true,
    messageKey: "Analytics.anomalies.errorRateSpike",
  },
  {
    metric: "registrations",
    threshold: 0.3,
    direction: "decrease",
    severity: "warning",
    messageKey: "Analytics.anomalies.registrationDrop",
  },
  {
    metric: "activeUsers",
    threshold: 0.25,
    direction: "decrease",
    severity: "warning",
    messageKey: "Analytics.anomalies.activeUserDecline",
  },
  {
    metric: "activity",
    threshold: 2.0,
    direction: "increase",
    severity: "info",
    messageKey: "Analytics.anomalies.activitySpike",
  },
];

export function getAnomalyConfig(metric: string): AnomalyConfig | undefined {
  return ANOMALY_CONFIGS.find((c) => c.metric === metric);
}
