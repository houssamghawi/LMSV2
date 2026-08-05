"use client";

import type { ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface ChartWrapperProps {
  title: string;
  children: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  height?: number;
  className?: string;
  ariaLabel?: string;
}

export function ChartWrapper({
  title,
  children,
  loading = false,
  empty = false,
  emptyMessage,
  height = 320,
  className,
  ariaLabel,
}: ChartWrapperProps) {
  const t = useTranslations("Analytics");
  const label = ariaLabel ?? t("charts.ariaLabel", { title });
  const emptyText = emptyMessage ?? t("empty.chartEmpty");

  return (
    <div
      className={cn("w-full", className)}
      role="img"
      aria-label={label}
    >
      <div className="mb-3">
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {loading ? (
        <Skeleton className="w-full rounded-lg" style={{ height }} />
      ) : empty ? (
        <div
          className="flex items-center justify-center rounded-lg border border-dashed bg-muted/30 px-4 text-center text-sm text-muted-foreground"
          style={{ height }}
        >
          {emptyText}
        </div>
      ) : (
        <div style={{ width: "100%", height }}>
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
