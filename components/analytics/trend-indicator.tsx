"use client";

import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { TrendDirection } from "@/lib/analytics/trend-calculations";

export interface TrendIndicatorProps {
  direction: TrendDirection;
  changePercent: number;
  className?: string;
  showLabel?: boolean;
}

export function TrendIndicator({
  direction,
  changePercent,
  className,
  showLabel = true,
}: TrendIndicatorProps) {
  const t = useTranslations("Analytics.trends");
  const abs = Math.abs(changePercent);
  const percentLabel = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);

  const Icon =
    direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : ArrowRight;

  const colorClass =
    direction === "up"
      ? "text-emerald-700 dark:text-emerald-400"
      : direction === "down"
        ? "text-red-700 dark:text-red-400"
        : "text-muted-foreground";

  const label =
    direction === "up"
      ? t("up", { percent: percentLabel })
      : direction === "down"
        ? t("down", { percent: percentLabel })
        : t("stable");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm font-medium",
        colorClass,
        className
      )}
      aria-label={label}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {showLabel ? <span>{label}</span> : null}
    </span>
  );
}
