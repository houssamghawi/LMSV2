"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useDropzone } from "react-dropzone";
import { FileText, Sparkles, Save, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
    DEFAULT_GENERATION_PARAMS,
    DOCX_MIME_TYPE,
    AI_CONSENT_VERSION
} from "@/lib/constants";
import { DraftQuestionCard } from "./draft-question-card";

/**
 * Quiz generator UI for an instructor. Handles the full US1 + US2 flow:
 * consent -> upload .docx -> configure mix -> generate -> review
 * drafts -> per-question edit/regenerate -> "Regenerate all" with new mix ->
 * save as unpublished quiz.
 */
export function QuizGenerator({ courseId, lessonId: initialLessonId, course }) {
    const t = useTranslations("QuizGeneration");
    const tQuiz = useTranslations("Quiz");
    const fmt = useFormatter();

    const allLessons = [];
    course?.modules?.forEach((module) => {
        module.lessonIds?.forEach((lesson) => {
            allLessons.push({ ...lesson, moduleTitle: module.title });
        });
    });

    const [selectedLessonId, setSelectedLessonId] = useState(initialLessonId || "");
    const selectedLesson = allLessons.find((l) => l.id === selectedLessonId) || null;
    const hasLessonLecture = Boolean(
        selectedLesson?.docxFilename && selectedLesson?.extractedText?.trim()
    );
    const useLessonSource = Boolean(selectedLessonId && hasLessonLecture);

    const [consent, setConsent] = useState({ checked: false, hasConsented: false });
    const [file, setFile] = useState(null);
    const [params, setParams] = useState(DEFAULT_GENERATION_PARAMS);
    const [submitting, setSubmitting] = useState(false);
    const [jobId, setJobId] = useState(null);
    const [job, setJob] = useState(null);
    const [drafts, setDrafts] = useState([]);
    const [saveOpen, setSaveOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveForm, setSaveForm] = useState({
        title: "",
        description: "",
        passPercent: 70
    });

    // US2: regeneration state.
    //   regeneratingDraftId — which draft is currently being regenerated (single).
    //   regeneratingAll — true while a full regeneration is in flight.
    //   pollNonce — bumped to force GenerationStatus to remount and re-poll
    //     after a "Regenerate all" request.
    const [regeneratingDraftId, setRegeneratingDraftId] = useState(null);
    const [regeneratingAll, setRegeneratingAll] = useState(false);

    // Check consent status on mount.
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
                if (!cancelled && json.ok) {
                    setConsent({ checked: true, hasConsented: json.hasConsented });
                } else if (!cancelled) {
                    setConsent({ checked: true, hasConsented: false });
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

    function updateParam(field, value) {
        const n = Number(value);
        const next = Number.isFinite(n) ? n : 0;
        setParams((p) => {
            const updated = { ...p, [field]: next };
            if (field === "totalQuestions") {
                const mcq = Math.ceil(next / 2);
                updated.mcqCount = mcq;
                updated.trueFalseCount = Math.max(0, next - mcq);
                const easy = Math.ceil(next / 3);
                const medium = Math.ceil((next - easy) / 2);
                updated.easyCount = easy;
                updated.mediumCount = medium;
                updated.hardCount = Math.max(0, next - easy - medium);
            }
            return updated;
        });
    }

    const typeSum = params.mcqCount + params.trueFalseCount;
    const difficultySum = params.easyCount + params.mediumCount + params.hardCount;
    const countsOk = typeSum === params.totalQuestions && difficultySum === params.totalQuestions;

    async function handleGenerate() {
        if (!useLessonSource && !file) {
            toast.error(t("uploadEmpty"));
            return;
        }
        if (selectedLessonId && !hasLessonLecture && !file) {
            toast.error(t("lessonNoUpload"));
            return;
        }
        if (!countsOk) {
            toast.error(t("configCountsMismatch"));
            return;
        }
        setSubmitting(true);
        setJob(null);
        setDrafts([]);
        setRegeneratingDraftId(null);
        setRegeneratingAll(false);
        try {
            const fd = new FormData();
            if (file && !useLessonSource) fd.append("file", file);
            fd.append("courseId", courseId);
            if (selectedLessonId) fd.append("lessonId", selectedLessonId);
            for (const [k, v] of Object.entries(params)) fd.append(k, String(v));

            const res = await fetch("/api/quiz-generation/jobs", { method: "POST", body: fd });
            const json = await res.json();
            if (!res.ok || !json.ok) {
                let msg = json.error || t("genericError");
                if (res.status === 429 && json.retryAfter) {
                    msg = t("quotaExceeded", { retryAfter: fmt.dateTime(new Date(json.retryAfter)) });
                }
                toast.error(msg);
                return;
            }
            if (json.isDuplicate) {
                toast.message(t("duplicateDetected"));
            }
            setJobId(json.jobId);
            handleSucceeded(json);
        } catch (e) {
            toast.error(e?.message || t("genericError"));
        } finally {
            setSubmitting(false);
        }
    }

    function handleSucceeded(j) {
        setJob(j);
        setDrafts(j.draftQuestions || []);
        setRegeneratingAll(false);
        setRegeneratingDraftId(null);
        toast.success(t("statusSucceeded"));
    }

    function handleDraftChange(updated) {
        setDrafts((prev) => prev.map((d) => (d.draftId === updated.draftId ? updated : d)));
    }

    // --- US2: per-question regeneration (single scope) ---------------------
    // After the POST returns 202, poll the job until status returns to
    // "succeeded", then refresh drafts. Other drafts stay visible and
    // interactive during the poll.
    async function handleRegenerateSingle(draftId) {
        if (!jobId) return;
        if (regeneratingDraftId || regeneratingAll) return;
        setRegeneratingDraftId(draftId);
        try {
            const res = await fetch(`/api/quiz-generation/jobs/${jobId}/regenerate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scope: "single", draftId })
            });
            const json = await res.json();
            if (!res.ok || !json.ok) {
                throw new Error(json.error || t("regenerateFailedToast"));
            }
            setJob(json);
            setDrafts(json.draftQuestions || []);
            setRegeneratingDraftId(null);
            toast.success(t("statusSucceeded"));
        } catch (e) {
            setRegeneratingDraftId(null);
            const msg = e?.message || t("regenerateFailedToast");
            if (msg.includes("no longer available")) {
                toast.error(t("regenerateSourceUnavailable"));
            } else {
                toast.error(msg);
            }
        }
    }

    // --- US2: full regeneration (all scope) --------------------------------
    async function handleRegenerateAll() {
        if (!jobId) return;
        if (!countsOk) {
            toast.error(t("configCountsMismatch"));
            return;
        }
        if (regeneratingDraftId || regeneratingAll) return;
        setRegeneratingAll(true);
        try {
            const res = await fetch(`/api/quiz-generation/jobs/${jobId}/regenerate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scope: "all", params })
            });
            const json = await res.json();
            if (!res.ok || !json.ok) {
                throw new Error(json.error || t("regenerateFailedToast"));
            }
            setJob(json);
            setDrafts(json.draftQuestions || []);
            setRegeneratingAll(false);
            toast.success(t("statusSucceeded"));
        } catch (e) {
            setRegeneratingAll(false);
            const msg = e?.message || t("regenerateFailedToast");
            if (msg.includes("no longer available")) {
                toast.error(t("regenerateSourceUnavailable"));
            } else if (msg.includes("Daily generation limit")) {
                toast.error(t("quotaExceeded", { retryAfter: "" }));
            } else {
                toast.error(msg);
            }
        }
    }

    async function handleSave() {
        if (!saveForm.title.trim()) {
            toast.error(t("saveFailedToast"));
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`/api/quiz-generation/jobs/${jobId}/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    courseId,
                    lessonId: selectedLessonId || null,
                    title: saveForm.title,
                    description: saveForm.description,
                    passPercent: saveForm.passPercent
                })
            });
            const json = await res.json();
            if (!res.ok || !json.ok) {
                toast.error(json.error || t("saveFailedToast"));
                return;
            }
            toast.success(t("saveSavedToast"));
            setSaveOpen(false);
            if (typeof window !== "undefined") {
                window.location.href = `/dashboard/courses/${courseId}/quizzes/${json.quizId}`;
            }
        } finally {
            setSaving(false);
        }
    }

    if (consent.checked && !consent.hasConsented) {
        return (
            <Alert className="bg-amber-50 border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <AlertTitle dir="auto">{t("consentBannerTitle")}</AlertTitle>
                <AlertDescription className="space-y-3" dir="auto">
                    <p>{t("consentBannerBody")}</p>
                    <div className="flex gap-2">
                        <Button onClick={acknowledgeConsent} size="sm">
                            <Sparkles className="w-4 h-4 me-1" />
                            {t("consentAccept")}
                        </Button>
                    </div>
                </AlertDescription>
            </Alert>
        );
    }

    const draftsAvailable = drafts.length > 0;
    const anyRegenerating = !!regeneratingDraftId || regeneratingAll;

    const hasSource = useLessonSource || (!selectedLessonId && file);
    const canGenerate = countsOk && !anyRegenerating && !submitting && hasSource;
    const lessonSelectedWithoutContent = Boolean(selectedLessonId && !hasLessonLecture);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold" dir="auto">{t("title")}</h2>
                <p className="text-slate-600" dir="auto">{t("subtitle")}</p>
            </div>

            {allLessons.length > 0 && (
                <div className="rounded-lg border bg-white p-4 space-y-3">
                    <div>
                        <h3 className="font-medium" dir="auto">{tQuiz("attachToLesson")}</h3>
                        <p className="text-sm text-slate-500" dir="auto">{t("lessonSelectHint")}</p>
                    </div>
                    <Select
                        value={selectedLessonId || "none"}
                        onValueChange={(value) => {
                            setSelectedLessonId(value === "none" ? "" : value);
                            setFile(null);
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder={t("lessonSelectPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">{t("lessonSelectNone")}</SelectItem>
                            {allLessons.map((lesson) => (
                                <SelectItem key={lesson.id} value={lesson.id}>
                                    {lesson.moduleTitle}: {lesson.title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Upload or lesson lecture source */}
            {useLessonSource ? (
                <div className="rounded-lg border bg-emerald-50 border-emerald-200 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-700" />
                        <h3 className="font-medium text-emerald-900" dir="auto">{t("generateFromUploadedLecture")}</h3>
                    </div>
                    <p className="text-sm text-emerald-800" dir="auto">
                        {t("lessonSourceReady", {
                            filename: selectedLesson.docxOriginalName || selectedLesson.docxFilename
                        })}
                    </p>
                </div>
            ) : lessonSelectedWithoutContent ? (
                <div className="rounded-lg border bg-amber-50 border-amber-200 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-700" />
                        <h3 className="font-medium text-amber-900" dir="auto">{t("lessonNoUploadTitle")}</h3>
                    </div>
                    <p className="text-sm text-amber-800" dir="auto">{t("lessonNoUpload")}</p>
                </div>
            ) : (
                <div className="rounded-lg border bg-white p-4 space-y-3">
                    <div>
                        <h3 className="font-medium" dir="auto">{t("uploadTitle")}</h3>
                        <p className="text-sm text-slate-500" dir="auto">{t("uploadDescription", { maxMB: 10 })}</p>
                    </div>
                    <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDragActive ? "border-emerald-500 bg-emerald-50" : "border-slate-300 hover:border-slate-400"}`}
                    >
                        <input {...getInputProps()} aria-describedby="upload-hint" />
                        <FileText className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                        {file ? (
                            <p className="text-sm" dir="auto">{file.name}</p>
                        ) : (
                            <p className="text-sm text-slate-500" id="upload-hint" dir="auto">
                                {t("uploadDropHint")}
                            </p>
                        )}
                        <Button type="button" size="sm" variant="outline" className="mt-3">
                            {t("uploadButton")}
                        </Button>
                    </div>
                </div>
            )}

            {/* Mix config */}
            <div className="rounded-lg border bg-white p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-medium" dir="auto">{t("configTitle")}</h3>
                    {draftsAvailable && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={anyRegenerating || !countsOk}
                                >
                                    <RefreshCw className="w-4 h-4 me-1 rtl:rotate-180" />
                                    {t("regenerateAll")}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle dir="auto">{t("regenerateAll")}</AlertDialogTitle>
                                    <AlertDialogDescription dir="auto">
                                        {t("regenerateAllConfirm")}
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>{t("regenerateAllConfirmNo")}</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleRegenerateAll}>
                                        {t("regenerateAllConfirmYes")}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                        <Label htmlFor="total">{t("configTotalQuestions")}</Label>
                        <Input id="total" type="number" min={1} value={params.totalQuestions} onChange={(e) => updateParam("totalQuestions", e.target.value)} />
                    </div>
                    <div>
                        <Label htmlFor="mcq">{t("configMcqCount")}</Label>
                        <Input id="mcq" type="number" min={0} value={params.mcqCount} onChange={(e) => updateParam("mcqCount", e.target.value)} />
                    </div>
                    <div>
                        <Label htmlFor="tf">{t("configTrueFalseCount")}</Label>
                        <Input id="tf" type="number" min={0} value={params.trueFalseCount} onChange={(e) => updateParam("trueFalseCount", e.target.value)} />
                    </div>
                    <div>
                        <Label htmlFor="easy">{t("configEasyCount")}</Label>
                        <Input id="easy" type="number" min={0} value={params.easyCount} onChange={(e) => updateParam("easyCount", e.target.value)} />
                    </div>
                    <div>
                        <Label htmlFor="medium">{t("configMediumCount")}</Label>
                        <Input id="medium" type="number" min={0} value={params.mediumCount} onChange={(e) => updateParam("mediumCount", e.target.value)} />
                    </div>
                    <div>
                        <Label htmlFor="hard">{t("configHardCount")}</Label>
                        <Input id="hard" type="number" min={0} value={params.hardCount} onChange={(e) => updateParam("hardCount", e.target.value)} />
                    </div>
                </div>
                {!countsOk && (
                    <p className="text-sm text-amber-700" dir="auto">{t("configCountsMismatch")}</p>
                )}
                <Button onClick={handleGenerate} disabled={!canGenerate}>
                    {submitting ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Sparkles className="w-4 h-4 me-2" />}
                    {submitting ? t("generating") : t("generateButton")}
                </Button>
            </div>

            {/* Polling — initial generation and full regeneration both re-mount
                this component via `pollNonce` so polling restarts from scratch. */}
            {/* Regenerating-all banner while the synchronous request is active. */}
            {regeneratingAll && (
                <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded px-3 py-2" dir="auto">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("regeneratingAllBanner")}
                </div>
            )}

            {/* Drafts */}
            {drafts.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <h3 className="font-medium" dir="auto">
                            {t("draftTitle")} <Badge variant="secondary">{drafts.length}</Badge>
                        </h3>
                        <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
                            <DialogTrigger asChild>
                                <Button disabled={anyRegenerating}>
                                    <Save className="w-4 h-4 me-2" />
                                    {t("draftSave")}
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle dir="auto">{t("saveTitle")}</DialogTitle>
                                    <DialogDescription dir="auto">
                                        {t("unpublishedBadge")}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-3">
                                    <div>
                                        <Label htmlFor="quiz-title">{t("saveQuizTitle")}</Label>
                                        <Input id="quiz-title" value={saveForm.title} onChange={(e) => setSaveForm((f) => ({ ...f, title: e.target.value }))} />
                                    </div>
                                    <div>
                                        <Label htmlFor="quiz-desc">{t("saveQuizDescription")}</Label>
                                        <Textarea id="quiz-desc" value={saveForm.description} onChange={(e) => setSaveForm((f) => ({ ...f, description: e.target.value }))} />
                                    </div>
                                    <div>
                                        <Label htmlFor="quiz-pass">{t("savePassPercent")}</Label>
                                        <Input id="quiz-pass" type="number" min={0} max={100} value={saveForm.passPercent} onChange={(e) => setSaveForm((f) => ({ ...f, passPercent: Number(e.target.value) }))} />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="ghost">{t("consentReject")}</Button>
                                    </DialogClose>
                                    <Button onClick={handleSave} disabled={saving}>
                                        {saving ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Save className="w-4 h-4 me-2" />}
                                        {t("saveButton")}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                    {drafts.map((d) => (
                        <DraftQuestionCard
                            key={d.draftId}
                            jobId={jobId}
                            draft={d}
                            onChange={handleDraftChange}
                            onRegenerate={handleRegenerateSingle}
                            regenerating={regeneratingDraftId === d.draftId}
                            disabled={anyRegenerating && regeneratingDraftId !== d.draftId}
                        />
                    ))}
                </div>
            )}

            {job?.status === "succeeded" && drafts.length === 0 && !regeneratingAll && (
                <p className="text-sm text-slate-500" dir="auto">{t("draftEmpty")}</p>
            )}
        </div>
    );
}
