"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useDropzone } from "react-dropzone";
import { FileText, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import {
    DEFAULT_MCQ_COMPLEMENT_PARAMS,
    AI_CONSENT_VERSION,
    GENERATION_POLL_INTERVAL_MS
} from "@/lib/constants";
import { mcqComplementParamsSchema } from "@/lib/validations";
import { GenerationStatus } from "./generation-status";

/**
 * Distribute `total` MCQs across Easy/Medium/Hard following the spec 002
 * balanced default shape (≈3/3/2 for 8). Used when the instructor changes the
 * total count — the three inputs are rebalanced so the sum constraint never
 * fails on a total change. The instructor can still override any count
 * afterwards; only subsequent total changes re-trigger distribution.
 *
 * Roughly equal thirds with Hard slightly lighter:
 *   hard  = round(total * 0.25)
 *   easy  = round((total - hard) / 2)
 *   medium = total - hard - easy
 */
function distributeDifficulty(total) {
    const n = Math.max(0, Math.floor(Number(total) || 0));
    const hard = Math.round(n * 0.25);
    const remaining = n - hard;
    const easy = Math.round(remaining / 2);
    const medium = n - hard - easy;
    return { easyCount: easy, mediumCount: medium, hardCount: hard };
}

/**
 * MCQ complement trigger (specs/002-ai-mcq-complement, US1).
 *
 * Renders a "Generate MCQs" button on the quiz editor. When clicked, opens a
 * dialog to upload a .docx, configure the MCQ count + difficulty distribution
 * (defaults: 8 MCQs, 3/3/2), acknowledge the AI consent, and start an MCQ
 * complement job (POST /api/quiz-generation/jobs with targetQuizId). Polls
 * the job and forwards the succeeded job (with draftQuestions +
 * mcqValidationSummary) to onSucceeded so the parent can swap in the draft
 * review view.
 *
 * Props:
 *   courseId     — ObjectId string for the course the quiz belongs to
 *   quizId       — ObjectId string for the existing quiz to complement
 *   onSucceeded  — called with the succeeded job JSON when generation completes
 */
export function McqComplementTrigger({ courseId, quizId, onSucceeded }) {
    const t = useTranslations("McqComplement");
    const fmt = useFormatter();

    const [open, setOpen] = useState(false);
    const [consent, setConsent] = useState({ checked: false, hasConsented: false });
    const [file, setFile] = useState(null);
    const [params, setParams] = useState(DEFAULT_MCQ_COMPLEMENT_PARAMS);
    const [submitting, setSubmitting] = useState(false);
    const [jobId, setJobId] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/quiz-generation/consent", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "check", consentVersion: AI_CONSENT_VERSION })
                });
                const json = await res.json();
                if (!cancelled) {
                    setConsent({ checked: true, hasConsented: json.ok ? json.hasConsented : false });
                }
            } catch {
                if (!cancelled) setConsent({ checked: true, hasConsented: false });
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const onDrop = useCallback((accepted) => {
        if (accepted.length > 0) setFile(accepted[0]);
    }, []);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
        multiple: false,
        maxFiles: 1
    });

    function updateParam(field, value) {
        const n = Number(value);
        const next = Number.isFinite(n) ? n : 0;
        setParams((p) => {
            if (field === "totalQuestions") {
                // Auto-rebalance the difficulty distribution when the total
                // changes so the Easy+Medium+Hard sum always equals the new
                // total. The instructor can still override individual counts
                // afterwards; only a total change re-triggers distribution.
                const total = Math.max(1, Math.min(30, next));
                const dist = distributeDifficulty(total);
                return {
                    ...p,
                    totalQuestions: total,
                    mcqCount: total,
                    ...dist
                };
            }
            return { ...p, [field]: next };
        });
    }

    const difficultySum = params.easyCount + params.mediumCount + params.hardCount;
    // Zod-validated params (US3 T020). The same schema runs server-side in the
    // POST /api/quiz-generation/jobs route — running it client-side gives early
    // feedback and keeps the submit button disabled until the params are valid.
    const paramsForValidation = {
        totalQuestions: params.totalQuestions,
        mcqCount: params.totalQuestions,
        trueFalseCount: 0,
        shortAnswerCount: 0,
        easyCount: params.easyCount,
        mediumCount: params.mediumCount,
        hardCount: params.hardCount
    };
    const zodResult = mcqComplementParamsSchema.safeParse(paramsForValidation);
    const countsOk = zodResult.success && difficultySum === params.totalQuestions;

    async function acknowledgeConsent() {
        const res = await fetch("/api/quiz-generation/consent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "acknowledge", consentVersion: AI_CONSENT_VERSION })
        });
        const json = await res.json();
        if (json.ok) {
            setConsent({ checked: true, hasConsented: true });
        } else {
            toast.error(json.error || t("genericError"));
        }
    }

    function handleSucceeded(job) {
        toast.success(t("statusSucceeded"));
        if (typeof onSucceeded === "function") onSucceeded(job);
    }

    function handleFailed(job) {
        toast.error(job?.failureReason || t("genericError"));
    }

    function resetState() {
        setFile(null);
        setParams(DEFAULT_MCQ_COMPLEMENT_PARAMS);
        setJobId(null);
    }

    function closeDialog() {
        setOpen(false);
        // Defer reset so the close transition doesn't flash empty content.
        setTimeout(resetState, 200);
    }

    async function handleGenerate() {
        if (!file) {
            toast.error(t("genericError"));
            return;
        }
        if (!countsOk) {
            toast.error(t("configCountsMismatch"));
            return;
        }
        setSubmitting(true);
        setJobId(null);
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("courseId", courseId);
            fd.append("targetQuizId", quizId);
            fd.append("totalQuestions", String(params.totalQuestions));
            fd.append("mcqCount", String(params.totalQuestions));
            fd.append("trueFalseCount", "0");
            fd.append("shortAnswerCount", "0");
            fd.append("easyCount", String(params.easyCount));
            fd.append("mediumCount", String(params.mediumCount));
            fd.append("hardCount", String(params.hardCount));

            const res = await fetch("/api/quiz-generation/jobs", { method: "POST", body: fd });
            const json = await res.json();
            if (!res.ok || !json.ok) {
                let msg = json.error || t("genericError");
                if (res.status === 429 && json.retryAfter) {
                    msg = t("quotaExceeded", { retryAfter: fmt.dateTime(new Date(json.retryAfter)) });
                } else if (res.status === 409) {
                    msg = t("concurrentJobRunning");
                } else if (res.status === 404) {
                    msg = t("targetQuizNotFound");
                } else if (res.status === 403) {
                    msg = t("notQuizOwner");
                }
                toast.error(msg);
                return;
            }
            setJobId(json.jobId);
        } catch (e) {
            toast.error(e?.message || t("genericError"));
        } finally {
            setSubmitting(false);
        }
    }

    const consentBanner = consent.checked && !consent.hasConsented;

    return (
        <Dialog open={open} onOpenChange={(v) => {
            setOpen(v);
            if (!v) setTimeout(resetState, 200);
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" title={t("triggerTooltip")}>
                    <Sparkles className="w-4 h-4 me-1" />
                    {t("triggerButton")}
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle dir="auto">{t("dialogTitle")}</DialogTitle>
                        <DialogDescription dir="auto">{t("dialogDescription")}</DialogDescription>
                    </DialogHeader>

                    {consentBanner ? (
                        <Alert className="bg-amber-50 border-amber-200">
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                            <AlertTitle dir="auto">{t("consentRequired")}</AlertTitle>
                            <AlertDescription className="space-y-3" dir="auto">
                                <p>{t("dialogDescription")}</p>
                                <div className="flex gap-2">
                                    <Button onClick={acknowledgeConsent} size="sm">
                                        <Sparkles className="w-4 h-4 me-1" />
                                        {t("startButton")}
                                    </Button>
                                </div>
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div className="space-y-4">
                            {/* Upload */}
                            <div
                                {...getRootProps()}
                                className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${isDragActive ? "border-emerald-500 bg-emerald-50" : "border-slate-300 hover:border-slate-400"}`}
                            >
                                <input {...getInputProps()} />
                                <FileText className="w-7 h-7 mx-auto text-slate-400 mb-2" />
                                {file ? (
                                    <p className="text-sm" dir="auto">{file.name}</p>
                                ) : (
                                    <p className="text-sm text-slate-500" dir="auto">
                                        {t("dialogDescription")}
                                    </p>
                                )}
                                <Button type="button" size="sm" variant="outline" className="mt-3">
                                    {t("startButton")}
                                </Button>
                            </div>

                            {/* Config: total + difficulty */}
                            <div className="space-y-3">
                                <div>
                                    <Label htmlFor="mcq-total" dir="auto">{t("configTotalQuestions")}</Label>
                                    <Input
                                        id="mcq-total"
                                        type="number"
                                        min={1}
                                        max={30}
                                        value={params.totalQuestions}
                                        onChange={(e) => updateParam("totalQuestions", e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label dir="auto">{t("configDifficultyTitle")}</Label>
                                    <p className="text-xs text-slate-500" dir="auto">{t("configDifficultyHint")}</p>
                                    <div className="grid grid-cols-3 gap-2 mt-2">
                                        <div>
                                            <Label htmlFor="mcq-easy" dir="auto">{t("configEasyCount")}</Label>
                                            <Input
                                                id="mcq-easy"
                                                type="number"
                                                min={0}
                                                value={params.easyCount}
                                                onChange={(e) => updateParam("easyCount", e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="mcq-medium" dir="auto">{t("configMediumCount")}</Label>
                                            <Input
                                                id="mcq-medium"
                                                type="number"
                                                min={0}
                                                value={params.mediumCount}
                                                onChange={(e) => updateParam("mediumCount", e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="mcq-hard" dir="auto">{t("configHardCount")}</Label>
                                            <Input
                                                id="mcq-hard"
                                                type="number"
                                                min={0}
                                                value={params.hardCount}
                                                onChange={(e) => updateParam("hardCount", e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                                {!countsOk && (
                                    <p className="text-sm text-amber-700" dir="auto">{t("configCountsMismatch")}</p>
                                )}
                            </div>

                            {/* Polling lifecycle */}
                            {jobId && (
                                <GenerationStatus
                                    key={jobId}
                                    jobId={jobId}
                                    onSucceeded={handleSucceeded}
                                    onFailed={handleFailed}
                                />
                            )}

                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="ghost" onClick={closeDialog}>
                                        {t("draftCancelEdit")}
                                    </Button>
                                </DialogClose>
                                <Button
                                    onClick={handleGenerate}
                                    disabled={!file || submitting || !countsOk || !!jobId}
                                >
                                    {submitting ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Sparkles className="w-4 h-4 me-2" />}
                                    {submitting ? t("starting") : t("startButton")}
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
    );
}
