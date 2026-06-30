"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/ui/alert-dialog";

import { GENERATION_POLL_INTERVAL_MS } from "@/lib/constants";
import { DraftQuestionCard } from "./draft-question-card";

const DIFFICULTY_BADGE_CLASS = {
    easy: "bg-emerald-100 text-emerald-800 border-emerald-200",
    medium: "bg-amber-100 text-amber-800 border-amber-200",
    hard: "bg-rose-100 text-rose-800 border-rose-200"
};

const DIFFICULTY_LABEL_KEY = {
    easy: "draftDifficultyEasy",
    medium: "draftDifficultyMedium",
    hard: "draftDifficultyHard"
};

// Upper bound on regeneration polling. The orchestrator runs in `after()` and
// typically completes in ≤45s; we allow up to 3 minutes before giving up.
const REGEN_POLL_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * MCQ complement draft review (specs/002-ai-mcq-complement, US1 + US2).
 *
 * Renders the draft MCQs produced by a succeeded MCQ complement job, the
 * validation summary (generated / dropped / included counts), per-MCQ
 * inline editing, reject (delete), and single-question regeneration, plus
 * an "Append to quiz" action that calls POST /jobs/[jobId]/append. When the
 * target quiz is published and has existing attempts, the append endpoint
 * returns a requiresConfirmation payload; the UI surfaces it via an
 * AlertDialog and re-issues the request with confirmPublishedAppend=true.
 *
 * On a successful append, the parent route is refreshed (via router.refresh)
 * so the quiz editor re-reads the new question list from the server.
 *
 * US2 additions over US1:
 *   - Inline editing (stem, options A–D, correct answer letter, justification)
 *     via the existing PATCH /questions/[draftId] endpoint, reusing the
 *     spec 001 DraftQuestionCard.
 *   - Per-MCQ "Remove" action that sets instructorState="rejected" via PATCH;
 *     rejected MCQs are filtered out of the visible draft list and count.
 *   - Per-MCQ "Regenerate" action that POSTs to /regenerate with scope
 *     "single", then polls the job and replaces the card content when the
 *     job returns to "succeeded".
 *
 * Props:
 *   jobId — GenerationJob _id string for the succeeded MCQ complement job
 *   job   — succeeded job JSON (must include draftQuestions and
 *           mcqValidationSummary)
 *   onClose — optional callback when the instructor dismisses the draft view
 */
export function McqComplementDraft({ jobId, job, onClose }) {
    const t = useTranslations("McqComplement");
    const router = useRouter();
    const [appending, setAppending] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [drafts, setDrafts] = useState(() => job?.draftQuestions || []);
    const [regeneratingId, setRegeneratingId] = useState(null);

    // Keep the local draft list in sync when the parent passes a fresh job
    // (e.g. after the initial poll succeeds).
    useEffect(() => {
        if (job?.draftQuestions) {
            setDrafts(job.draftQuestions);
        }
    }, [job]);

    const summary = job?.mcqValidationSummary || null;

    // Rejected MCQs are visually removed from the draft (T017). The visible
    // count drives both the header badge and the "Append to quiz" body.
    const visibleDrafts = drafts.filter(
        (d) => d.instructorState !== "rejected"
    );

    // Difficulty distribution across the visible draft (US3 T021). Lets the
    // instructor verify the draft matches the requested Easy/Medium/Hard mix
    // at a glance, and see how re-tags have shifted it.
    const difficultyCounts = visibleDrafts.reduce(
        (acc, d) => {
            if (d.difficulty === "easy") acc.easy += 1;
            else if (d.difficulty === "medium") acc.medium += 1;
            else if (d.difficulty === "hard") acc.hard += 1;
            return acc;
        },
        { easy: 0, medium: 0, hard: 0 }
    );

    function patchDraft(updated) {
        setDrafts((prev) =>
            prev.map((d) => (d.draftId === updated.draftId ? updated : d))
        );
    }

    async function callAppend(confirmPublishedAppend) {
        const res = await fetch(`/api/quiz-generation/jobs/${jobId}/append`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ confirmPublishedAppend: confirmPublishedAppend === true })
        });
        const json = await res.json().catch(() => ({ ok: false }));
        return { res, json };
    }

    async function handleAppend() {
        setAppending(true);
        try {
            const { res, json } = await callAppend(false);
            if (res.status === 200 && json && json.requiresConfirmation) {
                // Surface the published-quiz warning, then re-issue with
                // confirmation when the instructor accepts.
                setConfirmOpen(true);
                setAppending(false);
                return;
            }
            if (!res.ok || !json.ok) {
                toast.error(json?.error || t("appendFailedToast"));
                setAppending(false);
                return;
            }
            toast.success(t("appendSuccessToast", {
                appendedCount: json.appendedCount,
                totalCount: json.totalQuestionCount
            }));
            router.refresh();
            if (typeof onClose === "function") onClose();
        } catch (e) {
            toast.error(e?.message || t("appendFailedToast"));
            setAppending(false);
        }
    }

    async function handleConfirmAppend() {
        setAppending(true);
        try {
            const { res, json } = await callAppend(true);
            if (!res.ok || !json.ok) {
                toast.error(json?.error || t("appendFailedToast"));
                setAppending(false);
                setConfirmOpen(false);
                return;
            }
            toast.success(t("appendSuccessToast", {
                appendedCount: json.appendedCount,
                totalCount: json.totalQuestionCount
            }));
            setConfirmOpen(false);
            router.refresh();
            if (typeof onClose === "function") onClose();
        } catch (e) {
            toast.error(e?.message || t("appendFailedToast"));
        } finally {
            setAppending(false);
        }
    }

    /**
     * Per-MCQ regeneration (T019). POSTs to /regenerate with scope "single",
     * marks the card as regenerating, then polls GET /jobs/[jobId] until the
     * job returns to "succeeded" and replaces the local draft list with the
     * refreshed drafts. Other cards remain interactive during regeneration.
     */
    async function handleRegenerate(draftId) {
        if (!draftId) return;
        setRegeneratingId(draftId);
        try {
            const res = await fetch(`/api/quiz-generation/jobs/${jobId}/regenerate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scope: "single", draftId })
            });
            const json = await res.json().catch(() => ({ ok: false }));
            if (!res.ok || !json.ok) {
                toast.error(json?.error || t("genericError"));
                return;
            }
            await pollRegeneration();
        } catch (e) {
            toast.error(e?.message || t("genericError"));
        } finally {
            setRegeneratingId(null);
        }
    }

    function pollRegeneration() {
        return new Promise((resolve) => {
            const start = Date.now();
            let timer;
            const tick = async () => {
                if (Date.now() - start > REGEN_POLL_TIMEOUT_MS) {
                    toast.error(t("genericError"));
                    resolve();
                    return;
                }
                try {
                    const res = await fetch(`/api/quiz-generation/jobs/${jobId}`, {
                        cache: "no-store"
                    });
                    const json = await res.json().catch(() => ({ ok: false }));
                    if (json?.ok && json.status === "succeeded") {
                        setDrafts(json.draftQuestions || []);
                        resolve();
                        return;
                    }
                    if (json?.ok && json.status === "failed") {
                        toast.error(json.failureReason || t("genericError"));
                        resolve();
                        return;
                    }
                } catch {
                    // Transient poll error — keep polling until timeout.
                }
                timer = setTimeout(tick, GENERATION_POLL_INTERVAL_MS);
            };
            timer = setTimeout(tick, GENERATION_POLL_INTERVAL_MS);
            // Cleanup is handled by the promise resolution paths above; if the
            // component unmounts mid-poll, the timer is left to fire harmlessly
            // (state setters on unmounted components are no-ops in React 18).
            void timer;
        });
    }

    if (visibleDrafts.length === 0 && drafts.length === 0) {
        return (
            <div className="rounded-lg border bg-white p-4 space-y-2" dir="auto">
                <h3 className="font-medium">{t("draftTitle")}</h3>
                <p className="text-sm text-slate-500">{t("draftEmpty")}</p>
                {onClose && (
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        {t("draftCancelEdit")}
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4" dir="auto">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-medium flex items-center gap-2">
                    {t("draftTitle")}
                    <Badge variant="secondary">{visibleDrafts.length}</Badge>
                </h3>
                <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                    <Button onClick={handleAppend} disabled={appending || !!regeneratingId || visibleDrafts.length === 0}>
                        {appending ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Save className="w-4 h-4 me-2" />}
                        {t("draftSave")}
                    </Button>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle dir="auto">{t("publishedWarningTitle")}</AlertDialogTitle>
                            <AlertDialogDescription dir="auto">
                                {t("publishedWarningBody", { attemptCount: 0 })}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={appending}>
                                {t("publishedWarningCancel")}
                            </AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmAppend} disabled={appending}>
                                {appending ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : null}
                                {t("publishedWarningConfirm")}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>

            {summary && (
                <div className="rounded-lg border bg-slate-50 p-3 text-sm space-y-1" dir="auto">
                    <p className="font-medium">{t("draftSummaryLabel")}</p>
                    <ul className="list-disc ms-5 space-y-0.5 text-slate-700">
                        <li>{t("draftSummaryGenerated", { n: summary.generated })}</li>
                        <li>{t("draftSummaryDroppedUngrounded", { n: summary.droppedUngrounded })}</li>
                        <li>{t("draftSummaryDroppedInvalidStructure", { n: summary.droppedInvalidStructure })}</li>
                        <li>{t("draftSummaryDroppedDuplicate", { n: summary.droppedDuplicate })}</li>
                        <li className="font-medium">{t("draftSummaryIncluded", { n: summary.included })}</li>
                    </ul>
                </div>
            )}

            {/* Difficulty distribution across the visible draft (US3 T021).
                Surfaces the actual Easy/Medium/Hard mix so the instructor can
                verify it against the requested distribution at a glance. */}
            {visibleDrafts.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap text-xs" dir="auto">
                    <span className="text-slate-500">{t("configDifficultyTitle")}:</span>
                    <Badge variant="outline" className={DIFFICULTY_BADGE_CLASS.easy}>
                        {t("draftDifficultyEasy")}: {difficultyCounts.easy}
                    </Badge>
                    <Badge variant="outline" className={DIFFICULTY_BADGE_CLASS.medium}>
                        {t("draftDifficultyMedium")}: {difficultyCounts.medium}
                    </Badge>
                    <Badge variant="outline" className={DIFFICULTY_BADGE_CLASS.hard}>
                        {t("draftDifficultyHard")}: {difficultyCounts.hard}
                    </Badge>
                </div>
            )}

            {visibleDrafts.length === 0 ? (
                <div className="rounded-lg border bg-white p-4 text-sm text-slate-500" dir="auto">
                    {t("appendNoQuestions")}
                </div>
            ) : (
                <div className="space-y-3">
                    {visibleDrafts.map((d) => (
                        <DraftQuestionCard
                            key={d.draftId}
                            jobId={jobId}
                            draft={d}
                            onChange={patchDraft}
                            onRegenerate={handleRegenerate}
                            regenerating={regeneratingId === d.draftId}
                            disabled={!!regeneratingId && regeneratingId !== d.draftId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// Exported for tests that want to assert the difficulty styling map.
export { DIFFICULTY_BADGE_CLASS, DIFFICULTY_LABEL_KEY };
