"use client";

import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Instructor-facing embedding status for AI tutor lecture content.
 *
 * @param {object} props
 * @param {"none" | "pending" | "ready" | "failed"} props.status
 * @param {number} [props.chunkCount]
 * @param {string | Date | null} [props.embeddedAt]
 * @param {string | null} [props.error]
 */
export function LessonEmbeddingStatus({
    status = "none",
    chunkCount = 0,
    embeddedAt = null,
    error = null
}) {
    const t = useTranslations("Tutor");

    const labelMap = {
        none: t("embeddingStatusNone"),
        pending: t("embeddingStatusPending"),
        ready: t("embeddingStatusReady"),
        failed: t("embeddingStatusFailed")
    };

    const variantClass = {
        none: "bg-muted text-muted-foreground",
        pending: "bg-amber-100 text-amber-800",
        ready: "bg-green-100 text-green-800",
        failed: "bg-destructive/10 text-destructive"
    };

    return (
        <div className="mt-3 rounded-md border border-border/60 bg-background p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t("embeddingStatusLabel")}</span>
                <Badge className={cn("gap-1", variantClass[status] || variantClass.none)}>
                    {status === "pending" && (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    )}
                    {labelMap[status] || labelMap.none}
                </Badge>
                {status === "ready" && chunkCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                        {t("embeddingChunkCount", { count: chunkCount })}
                    </span>
                )}
            </div>

            {embeddedAt && status === "ready" && (
                <p className="mt-2 text-xs text-muted-foreground">
                    {t("embeddingLastIndexed", {
                        date: format(new Date(embeddedAt), "PPp")
                    })}
                </p>
            )}

            {status === "failed" && error && (
                <p className="mt-2 text-xs text-destructive" role="alert">
                    {error}
                </p>
            )}

            {status === "none" && (
                <p className="mt-2 text-xs text-muted-foreground">
                    {t("embeddingStatusNoneHint")}
                </p>
            )}
        </div>
    );
}
