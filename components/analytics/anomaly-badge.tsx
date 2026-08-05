"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { AnomalySeverity } from "@/lib/analytics/anomaly-thresholds";

export interface AnomalyBadgeProps {
  severity: AnomalySeverity;
  label?: string;
  className?: string;
}

const severityStyles: Record<AnomalySeverity, string> = {
  critical:
    "bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-100 dark:border-red-700",
  warning:
    "bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-700",
  info: "bg-sky-100 text-sky-950 border-sky-300 dark:bg-sky-950 dark:text-sky-100 dark:border-sky-700",
};

export function AnomalyBadge({
  severity,
  label,
  className,
}: AnomalyBadgeProps) {
  const t = useTranslations("Analytics.anomalies");
  const text = label ?? t(severity);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        severityStyles[severity],
        className
      )}
      role="status"
    >
      {text}
    </span>
  );
}
