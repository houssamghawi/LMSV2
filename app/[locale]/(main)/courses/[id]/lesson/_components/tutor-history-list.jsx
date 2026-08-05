"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ChatMessage } from "@/components/ui/chat-message";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

function HistoryItemSkeleton() {
    return (
        <div className="space-y-2 rounded-md bg-muted/30 p-3" aria-hidden="true">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ms-auto h-12 w-[70%] rounded-lg" />
            <Skeleton className="h-16 w-[75%] rounded-lg" />
        </div>
    );
}

/**
 * Collapsible list of past AI tutor Q&A for the current course (student view).
 *
 * @param {object} props
 * @param {string} props.courseId
 * @param {number} [props.refreshKey] - Increment to refetch after a new question
 * @param {(interactionId: string, feedback: "helpful" | "not_helpful") => void} [props.onFeedback]
 * @param {(interactionId: string) => void} [props.onReported]
 */
export function TutorHistoryList({ courseId, refreshKey = 0, onFeedback, onReported }) {
    const t = useTranslations("Tutor");
    const panelId = React.useId();
    const [expanded, setExpanded] = React.useState(false);
    const [interactions, setInteractions] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);

    const fetchHistory = React.useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                courseId,
                limit: "50"
            });

            const res = await fetch(`/api/tutor/history?${params.toString()}`);
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.error || t("genericError"));
            }

            setInteractions(json.data.interactions);
        } catch (err) {
            setError(err.message || t("genericError"));
            setInteractions([]);
        } finally {
            setLoading(false);
        }
    }, [courseId, t]);

    React.useEffect(() => {
        if (expanded) {
            fetchHistory();
        }
    }, [expanded, fetchHistory, refreshKey]);

    const statusLabel = (status) =>
        status === "answered"
            ? t("contextStatusAnswered")
            : t("contextStatusOutOfContext");

    return (
        <div className="rounded-md border border-border/60">
            <Button
                type="button"
                variant="ghost"
                className="flex h-auto w-full items-center justify-between px-4 py-3"
                onClick={() => setExpanded((prev) => !prev)}
                aria-expanded={expanded}
                aria-controls={panelId}
            >
                <span className="font-medium">{t("historyTitle")}</span>
                {expanded ? (
                    <ChevronUp className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                    <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <span className="sr-only">
                    {expanded ? t("historyToggleHide") : t("historyToggleShow")}
                </span>
            </Button>

            {expanded && (
                <div
                    id={panelId}
                    className="max-h-96 space-y-4 overflow-y-auto border-t border-border/60 p-4"
                    role="region"
                    aria-label={t("historyTitle")}
                    aria-busy={loading}
                >
                    {loading ? (
                        <div className="space-y-3" role="status" aria-label={t("loading")}>
                            <p className="sr-only">{t("loading")}</p>
                            <HistoryItemSkeleton />
                            <HistoryItemSkeleton />
                        </div>
                    ) : error ? (
                        <p className="text-sm text-destructive" role="alert">
                            {error}
                        </p>
                    ) : interactions.length === 0 ? (
                        <EmptyState
                            title={t("historyTitle")}
                            description={t("historyEmpty")}
                            icon="notFound"
                            className="min-h-[120px]"
                        />
                    ) : (
                        interactions.map((item) => (
                            <div
                                key={item.id}
                                className="space-y-2 rounded-md bg-muted/30 p-3"
                            >
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    {item.lessonTitle && (
                                        <span className="font-medium text-foreground/80">
                                            {item.lessonTitle}
                                        </span>
                                    )}
                                    <Badge variant="outline" className="text-xs">
                                        {statusLabel(item.contextStatus)}
                                    </Badge>
                                    {item.createdAt && (
                                        <span>
                                            {format(new Date(item.createdAt), "PPp")}
                                        </span>
                                    )}
                                </div>

                                <ChatMessage
                                    role="student"
                                    content={item.question}
                                    language={item.detectedLanguage}
                                />
                                <ChatMessage
                                    role="tutor"
                                    content={item.response}
                                    citation={item.citation}
                                    language={item.detectedLanguage}
                                    interactionId={item.id}
                                    feedback={item.feedback}
                                    showFeedback={Boolean(onFeedback)}
                                    onFeedback={onFeedback}
                                    showReport
                                    onReported={onReported}
                                />
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
