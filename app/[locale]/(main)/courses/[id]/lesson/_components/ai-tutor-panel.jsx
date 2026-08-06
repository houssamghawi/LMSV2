"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MessageSquare, Send } from "lucide-react";
import { ChatMessage } from "@/components/ui/chat-message";
import { TutorHistoryList } from "./tutor-history-list";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TUTOR_QUESTION_MAX_LENGTH } from "@/lib/constants";

function TutorResponseSkeleton() {
    return (
        <div className="space-y-3" aria-hidden="true">
            <Skeleton className="ms-auto h-14 w-[72%] rounded-lg" />
            <Skeleton className="h-20 w-[78%] rounded-lg" />
        </div>
    );
}

/**
 * Context-bound AI tutor chat panel for a lesson page.
 *
 * @param {object} props
 * @param {string} props.courseId
 * @param {string} props.lessonId
 * @param {string} props.lessonTitle
 * @param {boolean} [props.disabled]
 * @param {string | null} [props.disabledReason] - i18n key suffix: noLectureContent | notEnrolled | tutorDisabled
 */
export function AiTutorPanel({
    courseId,
    lessonId,
    lessonTitle,
    disabled = false,
    disabledReason = null
}) {
    const t = useTranslations("Tutor");
    const panelTitleId = useId();
    const errorId = useId();
    const inputId = useId();
    const [messages, setMessages] = useState([]);
    const [reportedIds, setReportedIds] = useState(new Set());
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
    const listRef = useRef(null);
    const inputRef = useRef(null);

    const disabledMessage = disabledReason
        ? t(disabledReason)
        : t("noLectureContent");

    const scrollToBottom = useCallback(() => {
        requestAnimationFrame(() => {
            listRef.current?.scrollTo({
                top: listRef.current.scrollHeight,
                behavior: "smooth"
            });
        });
    }, []);

    const markReported = useCallback((interactionId) => {
        setReportedIds((prev) => new Set(prev).add(interactionId));
    }, []);

    const submitFeedback = useCallback(async (interactionId, feedback) => {
        try {
            const res = await fetch("/api/tutor/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ interactionId, feedback })
            });
            if (!res.ok) return;
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.interactionId === interactionId ? { ...msg, feedback } : msg
                )
            );
        } catch {
            // Non-blocking — feedback failure should not disrupt the chat
        }
    }, []);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const question = input.trim();
        if (!question || loading || disabled) return;

        if (question.length > TUTOR_QUESTION_MAX_LENGTH) {
            setError(t("questionTooLong"));
            return;
        }

        setError(null);
        setInput("");
        setLoading(true);

        const studentMessage = {
            id: `local-q-${Date.now()}`,
            role: "student",
            content: question
        };
        setMessages((prev) => [...prev, studentMessage]);
        scrollToBottom();

        try {
            const res = await fetch("/api/tutor/ask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ courseId, lessonId, question })
            });

            const json = await res.json();

            if (!res.ok || !json.success) {
                const message =
                    json.error ||
                    (json.code === "QUESTION_TOO_LONG"
                        ? t("questionTooLong")
                        : res.status === 429
                          ? t("rateLimitExceeded")
                          : res.status === 503
                            ? t("serviceUnavailable")
                            : t("genericError"));
                setError(message);
                return;
            }

            const { data } = json;
            setMessages((prev) => [
                ...prev,
                {
                    id: data.interactionId,
                    role: "tutor",
                    content: data.answer,
                    citation: data.citation,
                    interactionId: data.interactionId,
                    feedback: null,
                    contextStatus: data.contextStatus
                }
            ]);
            scrollToBottom();
            setHistoryRefreshKey((key) => key + 1);
        } catch {
            setError(t("serviceUnavailable"));
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    return (
        <Card className="mt-8" role="region" aria-labelledby={panelTitleId}>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" aria-hidden="true" />
                    <CardTitle id={panelTitleId}>{t("panelTitle")}</CardTitle>
                </div>
                <CardDescription>{t("panelDescription")}</CardDescription>
                {lessonTitle && (
                    <p className="text-xs text-muted-foreground">{lessonTitle}</p>
                )}
            </CardHeader>
            <CardContent className="space-y-4">
                {!disabled && (
                    <TutorHistoryList
                        courseId={courseId}
                        refreshKey={historyRefreshKey}
                        onFeedback={submitFeedback}
                        onReported={markReported}
                    />
                )}

                {disabled ? (
                    <EmptyState
                        title={t("panelTitle")}
                        description={disabledMessage}
                        icon="notFound"
                        className="min-h-[180px]"
                    />
                ) : (
                    <>
                        <div
                            ref={listRef}
                            className="max-h-80 space-y-3 overflow-y-auto rounded-md border border-border/60 p-3"
                            aria-live="polite"
                            aria-busy={loading}
                            aria-label={t("panelTitle")}
                        >
                            {messages.length === 0 && !loading && (
                                <EmptyState
                                    title={t("emptyStateTitle")}
                                    description={t("emptyState")}
                                    icon="default"
                                    className="min-h-[160px]"
                                />
                            )}

                            {messages.map((message) => (
                                <ChatMessage
                                    key={message.id}
                                    role={message.role}
                                    content={message.content}
                                    citation={message.citation}
                                    interactionId={message.interactionId}
                                    feedback={message.feedback}
                                    showFeedback={message.role === "tutor"}
                                    onFeedback={submitFeedback}
                                    showReport={
                                        message.role === "tutor" &&
                                        Boolean(message.interactionId)
                                    }
                                    reported={reportedIds.has(message.interactionId)}
                                    onReported={markReported}
                                />
                            ))}

                            {loading && (
                                <div
                                    className="space-y-2"
                                    role="status"
                                    aria-label={t("thinking")}
                                >
                                    <p className="sr-only">{t("thinking")}</p>
                                    <TutorResponseSkeleton />
                                </div>
                            )}
                        </div>

                        {error && (
                            <p
                                id={errorId}
                                className="text-sm text-destructive"
                                role="alert"
                            >
                                {error}
                            </p>
                        )}

                        <form
                            onSubmit={handleSubmit}
                            className="flex gap-2"
                            aria-label={t("panelTitle")}
                        >
                            <Textarea
                                ref={inputRef}
                                id={inputId}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={t("inputPlaceholder")}
                                disabled={loading}
                                maxLength={TUTOR_QUESTION_MAX_LENGTH}
                                rows={2}
                                className="min-h-[60px] resize-none"
                                aria-label={t("inputPlaceholder")}
                                aria-describedby={error ? errorId : undefined}
                                aria-invalid={Boolean(error)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                }}
                            />
                            <Button
                                type="submit"
                                disabled={loading || !input.trim()}
                                className="self-end"
                                aria-label={loading ? t("sending") : t("sendButton")}
                            >
                                <Send className="h-4 w-4" aria-hidden="true" />
                                <span className="sr-only">
                                    {loading ? t("sending") : t("sendButton")}
                                </span>
                            </Button>
                        </form>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
