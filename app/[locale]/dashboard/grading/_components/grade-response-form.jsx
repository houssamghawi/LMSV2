"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { gradeShortAnswerResponse } from "@/app/actions/quizv2";

/**
 * Single SA response grading form (FR-018). Shows the student's response
 * alongside the model answer and source quote, lets the instructor award
 * points (0..maxPoints) and add an optional comment. Calls the
 * `gradeShortAnswerResponse` server action; on success, calls onGraded so the
 * parent can advance to the next response or display the finalized state.
 */
export function GradeResponseForm({ attemptId, questionId, maxPoints, studentResponse, modelAnswer, sourceQuote, alreadyGraded, onGraded }) {
    const t = useTranslations("Grading");
    const [awardedPoints, setAwardedPoints] = useState(0);
    const [graderComment, setGraderComment] = useState("");
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(alreadyGraded === true);

    async function handleSave() {
        const n = Number(awardedPoints);
        if (!Number.isFinite(n) || n < 0 || n > maxPoints) {
            toast.error(t("formInvalidPoints", { maxPoints }));
            return;
        }
        setSaving(true);
        const res = await gradeShortAnswerResponse(attemptId, questionId, {
            awardedPoints: n,
            graderComment
        });
        setSaving(false);
        if (!res.ok) {
            toast.error(res.error || t("formGenericError"));
            return;
        }
        if (res.alreadyGraded) {
            toast.message(t("formAlreadyGraded"));
        } else if (res.finalized) {
            toast.success(t("formFinalizedToast"));
        } else {
            toast.success(t("formSavedToast"));
        }
        setDone(true);
        onGraded?.(res);
    }

    return (
        <div className="rounded-lg border bg-white p-4 space-y-4">
            <div className="space-y-2">
                <div>
                    <Label className="text-slate-500">{t("formStudentLabel")}</Label>
                    <p className="mt-1 rounded border bg-slate-50 p-3 whitespace-pre-wrap" dir="auto">
                        {studentResponse || "—"}
                    </p>
                </div>
                <div>
                    <Label className="text-slate-500">{t("formModelAnswerLabel")}</Label>
                    <p className="mt-1 text-sm text-slate-700" dir="auto">{modelAnswer || "—"}</p>
                </div>
                {sourceQuote && (
                    <div>
                        <Label className="text-slate-500">{t("formSourceQuoteLabel")}</Label>
                        <blockquote className="mt-1 text-sm italic text-slate-600 border-s-2 ps-3" dir="auto">
                            “{sourceQuote}”
                        </blockquote>
                    </div>
                )}
            </div>

            <div className="space-y-3">
                <div>
                    <Label htmlFor="points">{t("formPointsLabel")}</Label>
                    <Input
                        id="points"
                        type="number"
                        min={0}
                        max={maxPoints}
                        value={awardedPoints}
                        onChange={(e) => setAwardedPoints(e.target.value)}
                        disabled={done}
                        aria-describedby="points-hint"
                    />
                    <p id="points-hint" className="text-xs text-slate-500 mt-1" dir="auto">
                        {t("formPointsHint", { maxPoints })}
                    </p>
                </div>
                <div>
                    <Label htmlFor="comment">{t("formCommentLabel")}</Label>
                    <Textarea
                        id="comment"
                        value={graderComment}
                        onChange={(e) => setGraderComment(e.target.value)}
                        maxLength={1000}
                        disabled={done}
                        aria-describedby="comment-hint"
                    />
                    <p id="comment-hint" className="text-xs text-slate-500 mt-1" dir="auto">
                        {t("formCommentHint")}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handleSave} disabled={saving || done}>
                        {saving ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 me-2" />}
                        {t("formSaveButton")}
                    </Button>
                    {done && <Badge variant="secondary">{t("badgeFinalized")}</Badge>}
                </div>
            </div>
        </div>
    );
}
