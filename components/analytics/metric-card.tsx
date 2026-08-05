"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendIndicator } from "./trend-indicator";
import { AnomalyBadge } from "./anomaly-badge";
import type { TrendDirection } from "@/lib/analytics/trend-calculations";
import type { AnomalySeverity } from "@/lib/analytics/anomaly-thresholds";

export interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  description?: string;
  trend?: {
    direction: TrendDirection;
    changePercent: number;
  };
  anomaly?: {
    severity: AnomalySeverity;
    label?: string;
  };
  className?: string;
  footer?: ReactNode;
}

export function MetricCard({
  title,
  value,
  unit,
  description,
  trend,
  anomaly,
  className,
  footer,
}: MetricCardProps) {
  const t = useTranslations("Analytics.trends");

  return (
    <Card
      className={cn(
        anomaly?.severity === "critical" &&
          "border-red-400 dark:border-red-600",
        anomaly?.severity === "warning" &&
          "border-amber-400 dark:border-amber-600",
        className
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </div>
        {anomaly ? (
          <AnomalyBadge severity={anomaly.severity} label={anomaly.label} />
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight">{value}</span>
          {unit ? (
            <span className="text-sm text-muted-foreground">{unit}</span>
          ) : null}
        </div>
        {trend ? (
          <div className="mt-2 flex items-center gap-2">
            <TrendIndicator
              direction={trend.direction}
              changePercent={trend.changePercent}
            />
            <span className="text-xs text-muted-foreground">
              {t("vsPrevious")}
            </span>
          </div>
        ) : null}
        {footer ? <div className="mt-3">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
