"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  resolveDateRange,
  toIsoDateString,
} from "@/lib/analytics/date-ranges";
import type { AnalyticsDateRangeValue } from "@/components/analytics/date-range-picker";

export type ExportButtonSection =
  | "users"
  | "courses"
  | "revenue"
  | "enrollments"
  | "activity"
  | "students";

export interface ExportButtonProps {
  section: ExportButtonSection;
  rangeValue: AnalyticsDateRangeValue;
  courseId?: string;
  className?: string;
}

export function ExportButton({
  section,
  rangeValue,
  courseId,
  className,
}: ExportButtonProps) {
  const t = useTranslations("Analytics.export");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onExport = () => {
    startTransition(async () => {
      setMessage(null);
      try {
        const range = resolveDateRange({
          preset: rangeValue.preset,
          startDate: rangeValue.from,
          endDate: rangeValue.to,
        });
        const res = await fetch("/api/analytics/export", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            section,
            startDate: toIsoDateString(range.start),
            endDate: toIsoDateString(range.end),
            ...(courseId ? { courseId } : {}),
          }),
        });

        const contentType = res.headers.get("Content-Type") || "";
        if (!res.ok) {
          let code = "";
          try {
            const body = await res.json();
            code = body?.error?.code || "";
            setMessage(
              code === "EXPORT_TOO_LARGE"
                ? t("tooLarge")
                : body?.error?.message || t("failed")
            );
          } catch {
            setMessage(t("failed"));
          }
          return;
        }

        if (!contentType.includes("text/csv")) {
          setMessage(t("failed"));
          return;
        }

        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition") || "";
        const match = /filename="([^"]+)"/.exec(disposition);
        const filename = match?.[1] || `analytics-${section}.csv`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setMessage(t("success"));
      } catch {
        setMessage(t("failed"));
      }
    });
  };

  return (
    <div className={className}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={onExport}
      >
        <Download className="me-2 h-4 w-4" aria-hidden="true" />
        {pending ? t("exporting") : t("csv")}
      </Button>
      {message ? (
        <p className="mt-1 text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
