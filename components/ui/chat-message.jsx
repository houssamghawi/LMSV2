"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Flag, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { TUTOR_REPORT_DETAILS_MAX_LENGTH } from "@/lib/constants";
import { resolveChatTextLayout } from "@/lib/chat-text-direction";

/**
 * Chat bubble for student questions and AI tutor responses.
 *
 * @param {object} props
 * @param {"student" | "tutor"} props.role
 * @param {string} props.content
 * @param {string} [props.citation]
 * @param {"ar" | "en"} [props.language] - Detected response language (tutor answers)
 * @param {string} [props.interactionId]
 * @param {"helpful" | "not_helpful" | null} [props.feedback]
 * @param {boolean} [props.showFeedback]
 * @param {(interactionId: string, feedback: "helpful" | "not_helpful") => void} [props.onFeedback]
 * @param {boolean} [props.showReport]
 * @param {boolean} [props.reported]
 * @param {(interactionId: string) => void} [props.onReported]
 */
export function ChatMessage({
    role,
    content,
    citation = null,
    language = null,
    interactionId = null,
    feedback = null,
    showFeedback = false,
    onFeedback,
    showReport = false,
    reported = false,
    onReported
}) {
    const t = useTranslations("Tutor");
    const isStudent = role === "student";
    const { messageDir, textDir, textClassName } = resolveChatTextLayout({
        role,
        language,
        content
    });

    const [reportOpen, setReportOpen] = useState(false);
    const [reportReason, setReportReason] = useState("incorrect");
    const [reportDetails, setReportDetails] = useState("");
    const [reportSubmitting, setReportSubmitting] = useState(false);
    const [reportError, setReportError] = useState(null);
    const [reportSuccess, setReportSuccess] = useState(reported);

    const handleReportSubmit = async () => {
        if (!interactionId || reportSubmitting || reportSuccess) return;

        setReportSubmitting(true);
        setReportError(null);

        try {
            const res = await fetch("/api/tutor/report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    interactionId,
                    reason: reportReason,
                    details: reportDetails.trim() || undefined
                })
            });

            const json = await res.json();

            if (!res.ok || !json.success) {
                setReportError(json.error || t("genericError"));
                return;
            }

            setReportSuccess(true);
            setReportOpen(false);
            onReported?.(interactionId);
        } catch {
            setReportError(t("genericError"));
        } finally {
            setReportSubmitting(false);
        }
    };

    return (
        <>
            <div
                className={cn(
                    "flex w-full",
                    isStudent ? "justify-end" : "justify-start"
                )}
                dir={messageDir}
            >
                <div
                    className={cn(
                        "max-w-[85%] rounded-lg px-4 py-3 text-sm shadow-sm",
                        isStudent
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                    )}
                    dir={messageDir}
                >
                    <p
                        className={cn("whitespace-pre-wrap break-words", textClassName)}
                        dir={textDir}
                    >
                        {content}
                    </p>

                    {!isStudent && citation && (
                        <div
                            className={cn(
                                "mt-3 border-t border-border/60 pt-2 text-xs text-muted-foreground",
                                textClassName
                            )}
                            dir={textDir}
                        >
                            <p className="font-medium text-foreground/80">{t("citationLabel")}</p>
                            <p className="mt-1 whitespace-pre-wrap">{citation}</p>
                        </div>
                    )}

                    {!isStudent && interactionId && (showFeedback || showReport) && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
                            {reportSuccess && (
                                <span className="text-xs text-muted-foreground">
                                    {t("reportSuccess")}
                                </span>
                            )}
                            {showFeedback && feedback && !reportSuccess && (
                                <span className="text-xs text-muted-foreground">
                                    {t("feedbackThanks")}
                                </span>
                            )}

                            <div className="ms-auto flex gap-1">
                                {showReport && (
                                    <Button
                                        type="button"
                                        variant={reportSuccess ? "default" : "ghost"}
                                        size="sm"
                                        className="h-8 gap-1 px-2 text-xs"
                                        aria-label={t("reportIssue")}
                                        disabled={reportSuccess}
                                        onClick={() => setReportOpen(true)}
                                    >
                                        <Flag className="h-3.5 w-3.5" />
                                        {t("reportIssue")}
                                    </Button>
                                )}

                                {showFeedback && onFeedback && (
                                    <>
                                        <Button
                                            type="button"
                                            variant={feedback === "helpful" ? "default" : "ghost"}
                                            size="icon"
                                            className="h-8 w-8"
                                            aria-label={t("feedbackHelpful")}
                                            disabled={Boolean(feedback)}
                                            onClick={() => onFeedback(interactionId, "helpful")}
                                        >
                                            <ThumbsUp className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={
                                                feedback === "not_helpful" ? "default" : "ghost"
                                            }
                                            size="icon"
                                            className="h-8 w-8"
                                            aria-label={t("feedbackNotHelpful")}
                                            disabled={Boolean(feedback)}
                                            onClick={() =>
                                                onFeedback(interactionId, "not_helpful")
                                            }
                                        >
                                            <ThumbsDown className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Dialog open={reportOpen} onOpenChange={setReportOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("reportTitle")}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <Select value={reportReason} onValueChange={setReportReason}>
                            <SelectTrigger aria-label={t("reportTitle")}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="incorrect">
                                    {t("reportReasonIncorrect")}
                                </SelectItem>
                                <SelectItem value="inappropriate">
                                    {t("reportReasonInappropriate")}
                                </SelectItem>
                                <SelectItem value="other">{t("reportReasonOther")}</SelectItem>
                            </SelectContent>
                        </Select>

                        <Textarea
                            value={reportDetails}
                            onChange={(e) => setReportDetails(e.target.value)}
                            placeholder={t("reportDetailsPlaceholder")}
                            maxLength={TUTOR_REPORT_DETAILS_MAX_LENGTH}
                            rows={3}
                            aria-label={t("reportDetailsPlaceholder")}
                        />

                        {reportError && (
                            <p className="text-sm text-destructive" role="alert">
                                {reportError}
                            </p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setReportOpen(false)}
                            disabled={reportSubmitting}
                        >
                            {t("cancel")}
                        </Button>
                        <Button
                            type="button"
                            onClick={handleReportSubmit}
                            disabled={reportSubmitting}
                        >
                            {reportSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                t("reportSubmit")
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
