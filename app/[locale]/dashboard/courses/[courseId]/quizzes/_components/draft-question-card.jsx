"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Check, Edit3, X, AlertCircle, RefreshCw, Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_LABEL_KEY = {
    single: "draftTypeSingle",
    true_false: "draftTypeTrueFalse"
};
const DIFFICULTY_LABEL_KEY = {
    easy: "draftDifficultyEasy",
    medium: "draftDifficultyMedium",
    hard: "draftDifficultyHard"
};
const DIFFICULTY_VALUES = ["easy", "medium", "hard"];
// Color-coded badge classes per difficulty (US3 T021). Easy = emerald, Medium
// = amber, Hard = rose. Kept in sync with the map exported from
// mcq-complement-draft.jsx.
const DIFFICULTY_BADGE_CLASS = {
    easy: "bg-emerald-100 text-emerald-800 border-emerald-200",
    medium: "bg-amber-100 text-amber-800 border-amber-200",
    hard: "bg-rose-100 text-rose-800 border-rose-200"
};
const STATE_LABEL_KEY = {
    untouched: "draftStateUntouched",
    edited: "draftStateEdited",
    approved: "draftStateApproved",
    rejected: "draftStateRejected",
    regenerated: "draftStateRegenerated"
};

/**
 * Read-only + edit-mode card for a single DraftQuestion (US1 + US2).
 *
 * US1 surface: text/explanation/sourceQuote/modelAnswer editing, approve, and
 * "delete" (mark rejected, excluded on save).
 *
 * US2 additions: per-question "Regenerate" control (calls onRegenerate), inline
 * options editing with correct-option toggles, and a disabled state while the
 * parent is regenerating this draft or the entire job.
 */
export function DraftQuestionCard({ jobId, draft, onChange, onRegenerate, regenerating = false, disabled = false }) {
    const t = useTranslations("QuizGeneration");
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [form, setForm] = useState(() => ({
        text: draft.text,
        explanation: draft.explanation,
        sourceQuote: draft.sourceQuote,
        modelAnswer: draft.modelAnswer,
        options: (draft.options || []).map((o) => ({ id: o.id, text: o.text })),
        correctOptionIds: [...(draft.correctOptionIds || [])]
    }));

    function update(field, value) {
        setForm((f) => ({ ...f, [field]: value }));
    }

    function updateOption(idx, value) {
        setForm((f) => {
            const next = f.options.map((o, i) => (i === idx ? { ...o, text: value } : o));
            return { ...f, options: next };
        });
    }

    function addOption() {
        setForm((f) => {
            const id = `opt-${Date.now()}-${f.options.length}`;
            return { ...f, options: [...f.options, { id, text: "" }] };
        });
    }

    function removeOption(idx) {
        setForm((f) => {
            const removedId = f.options[idx]?.id;
            const next = f.options.filter((_, i) => i !== idx);
            const correct = f.correctOptionIds.filter((id) => id !== removedId);
            return { ...f, options: next, correctOptionIds: correct };
        });
    }

    function toggleCorrect(optId) {
        setForm((f) => {
            const isCorrect = f.correctOptionIds.includes(optId);
            // For single/true_false we replace; for safety we treat both as
            // single-correct here since the generator emits single-correct MCQ.
            return {
                ...f,
                correctOptionIds: isCorrect ? [] : [optId]
            };
        });
    }

    async function persist(patch) {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/quiz-generation/jobs/${jobId}/questions/${draft.draftId}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(patch)
                }
            );
            const json = await res.json();
            if (!res.ok || !json.ok) {
                throw new Error(json.error || "Failed to update");
            }
            onChange?.({ ...draft, ...patch, instructorState: json.instructorState });
            return true;
        } catch (e) {
            setError(e?.message || "Failed to update");
            return false;
        } finally {
            setSaving(false);
        }
    }

    async function handleSaveEdit() {
        // For MCQ/TF: persist options + correctOptionIds together so the
        // schema's conditional validator sees a consistent pair.
        const patch = {
            text: form.text,
            explanation: form.explanation,
            sourceQuote: form.sourceQuote,
            modelAnswer: "",
            instructorState: "edited",
            options: form.options,
            correctOptionIds: form.correctOptionIds
        };
        const ok = await persist(patch);
        if (ok) setEditing(false);
    }

    async function handleReject() {
        await persist({ instructorState: "rejected" });
    }

    async function handleApprove() {
        await persist({ instructorState: "approved" });
    }

    /**
     * Inline difficulty re-tag (US3 T021). Persists the new difficulty via the
     * existing PATCH /questions/[draftId] endpoint and marks the draft as
     * "edited" so the append flow picks up the updated tag.
     */
    async function handleDifficultyRetag(nextDifficulty) {
        if (!nextDifficulty || nextDifficulty === draft.difficulty) return;
        await persist({ difficulty: nextDifficulty, instructorState: "edited" });
    }

    async function handleRegenerateClick() {
        if (onRegenerate) {
            await onRegenerate(draft.draftId);
            return;
        }
        // Fallback: call the regenerate endpoint directly. The parent is
        // expected to handle polling, but this keeps the card usable in
        // isolation (e.g. tests).
        setError(null);
        try {
            const res = await fetch(`/api/quiz-generation/jobs/${jobId}/regenerate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scope: "single", draftId: draft.draftId })
            });
            const json = await res.json();
            if (!res.ok || !json.ok) {
                throw new Error(json.error || t("regenerateFailedToast"));
            }
        } catch (e) {
            setError(e?.message || t("regenerateFailedToast"));
        }
    }

    const isRejected = draft.instructorState === "rejected";
    const isBusy = saving || regenerating || disabled;
    const showRegenerateSpinner = regenerating;

    return (
        <div
            className={cn(
                "rounded-lg border bg-white p-4 space-y-3",
                isRejected && "opacity-60 border-dashed",
                regenerating && "border-blue-400 bg-blue-50/40"
            )}
        >
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{t(TYPE_LABEL_KEY[draft.type])}</Badge>
                    {draft.difficulty && (
                        <Badge
                            variant="outline"
                            className={cn(DIFFICULTY_BADGE_CLASS[draft.difficulty])}
                        >
                            {t(DIFFICULTY_LABEL_KEY[draft.difficulty])}
                        </Badge>
                    )}
                    <Badge variant="outline" className="text-slate-500">
                        {t(STATE_LABEL_KEY[draft.instructorState] || "draftStateUntouched")}
                    </Badge>
                    {/* Inline difficulty re-tag (US3 T021). Always available
                        when the card is not rejected and not being edited or
                        regenerated — lets the instructor fix mis-tagged MCQs
                        without entering full edit mode. */}
                    {!isRejected && !editing && (
                        <Select
                            value={draft.difficulty || "easy"}
                            onValueChange={handleDifficultyRetag}
                            disabled={isBusy}
                        >
                            <SelectTrigger
                                className="h-7 w-auto text-xs gap-1"
                                aria-label={t("draftDifficultyRetag")}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {DIFFICULTY_VALUES.map((d) => (
                                    <SelectItem key={d} value={d}>
                                        {t(DIFFICULTY_LABEL_KEY[d])}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                    {!editing && !isRejected && (
                        <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={isBusy}>
                            <Edit3 className="w-4 h-4 me-1 rtl:rotate-180" />
                            {t("draftEdit")}
                        </Button>
                    )}
                    {!isRejected && (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleRegenerateClick}
                            disabled={isBusy}
                            aria-label={t("draftRegenerate")}
                        >
                            {showRegenerateSpinner ? (
                                <Loader2 className="w-4 h-4 me-1 animate-spin" />
                            ) : (
                                <RefreshCw className="w-4 h-4 me-1 rtl:rotate-180" />
                            )}
                            {showRegenerateSpinner ? t("draftRegenerating") : t("draftRegenerate")}
                        </Button>
                    )}
                    {!isRejected && (
                        <Button size="sm" variant="ghost" onClick={handleApprove} disabled={isBusy}>
                            <Check className="w-4 h-4 me-1" />
                            {t("draftStateApproved")}
                        </Button>
                    )}
                    {!isRejected && (
                        <Button size="sm" variant="ghost" onClick={handleReject} disabled={isBusy}>
                            <X className="w-4 h-4 me-1" />
                            {t("draftDelete")}
                        </Button>
                    )}
                </div>
            </div>

            {editing ? (
                <div className="space-y-3">
                    <div>
                        <Label>{t("draftQuestionLabel")}</Label>
                        <Textarea
                            value={form.text}
                            onChange={(e) => update("text", e.target.value)}
                            rows={2}
                        />
                    </div>
                    <div className="space-y-2">
                            <Label>{t("draftOptionsLabel")}</Label>
                            <ul className="space-y-2">
                                {form.options.map((opt, idx) => {
                                    const isCorrect = form.correctOptionIds.includes(opt.id);
                                    return (
                                        <li key={opt.id || idx} className="flex items-center gap-2">
                                            <Checkbox
                                                checked={isCorrect}
                                                onCheckedChange={() => toggleCorrect(opt.id)}
                                                aria-label={t("draftCorrectOptionLabel")}
                                            />
                                            <Input
                                                value={opt.text}
                                                onChange={(e) => updateOption(idx, e.target.value)}
                                                aria-label={t("draftOptionTextLabel")}
                                            />
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => removeOption(idx)}
                                                aria-label={t("draftRemoveOption")}
                                                disabled={form.options.length <= 2}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </li>
                                    );
                                })}
                            </ul>
                            <Button size="sm" variant="outline" onClick={addOption} disabled={form.options.length >= 6}>
                                <Plus className="w-4 h-4 me-1" />
                                {t("draftAddOption")}
                            </Button>
                        </div>
                    <div>
                        <Label>{t("draftExplanationLabel")}</Label>
                        <Textarea
                            value={form.explanation}
                            onChange={(e) => update("explanation", e.target.value)}
                            rows={2}
                        />
                    </div>
                    <div>
                        <Label>{t("draftSourceQuoteLabel")}</Label>
                        <Input
                            value={form.sourceQuote}
                            onChange={(e) => update("sourceQuote", e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit} disabled={saving}>
                            {saving ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : null}
                            {saving ? t("generating") : t("draftSave")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                            {t("draftCancelEdit")}
                        </Button>
                    </div>
                </div>
            ) : (
                <>
                    <p className="font-medium" dir="auto">{draft.text}</p>
                    {Array.isArray(draft.options) && draft.options.length > 0 && (
                        <ul className="text-sm text-slate-700 space-y-1">
                            {draft.options.map((opt) => {
                                const correct = (draft.correctOptionIds || []).includes(opt.id);
                                return (
                                    <li key={opt.id} className={cn("flex items-center gap-2", correct && "text-emerald-700 font-medium")}>
                                        {correct && <Check className="w-3 h-3" />}
                                        <span dir="auto">{opt.text}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {draft.explanation && (
                        <div className="text-sm text-slate-600">
                            <span className="text-slate-500">{t("draftExplanationLabel")}: </span>
                            <span dir="auto">{draft.explanation}</span>
                        </div>
                    )}
                    {draft.sourceQuote && (
                        <blockquote className="text-sm text-slate-600 border-s-2 ps-3 italic" dir="auto">
                            <span className="text-slate-500 not-italic">{t("draftSourceQuoteLabel")}: </span>
                            “{draft.sourceQuote}”
                        </blockquote>
                    )}
                </>
            )}

            {error && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span dir="auto">{error}</span>
                </div>
            )}
        </div>
    );
}
