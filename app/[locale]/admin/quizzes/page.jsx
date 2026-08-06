import { getLoggedInUser } from "@/lib/loggedin-user";
import { isAdmin } from "@/lib/authorization";
import { notFound } from "next/navigation";
import { Quiz } from "@/model/quizv2-model";
import { GenerationJob } from "@/model/generation-job-model";
import { dbConnect } from "@/service/mongo";
import { replaceMongoIdInArray, replaceMongoIdInObject } from "@/lib/convertData";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

/**
 * Admin quiz administration view (FR-016, US3 acceptance scenario 2).
 *
 * Adds:
 *   - An "AI-generated" filter (searchParams ?aiGenerated=true)
 *   - Per-quiz generation audit details (source filename, content hash, params,
 *     AI provider/model, generating user) pulled from the linked GenerationJob.
 */
export default async function AdminQuizzesPage({ searchParams }) {
    const user = await getLoggedInUser();
    if (!user || !isAdmin(user)) {
        notFound();
    }

    const t = await getTranslations("Admin");
    const tGen = await getTranslations("QuizGeneration");

    const sp = await searchParams;
    const aiGeneratedFilter = sp?.aiGenerated === "true" ? true : sp?.aiGenerated === "false" ? false : null;

    await dbConnect();

    const filter = {};
    if (aiGeneratedFilter === true) filter.aiGenerated = true;
    if (aiGeneratedFilter === false) filter.aiGenerated = false;

    const quizzes = await Quiz.find(filter)
        .populate("courseId", "title")
        .populate("lessonId", "title")
        .sort({ createdAt: -1 })
        .lean();

    const quizzesPlain = replaceMongoIdInArray(quizzes || []);

    // Fetch the linked GenerationJob for each AI-generated quiz so we can show
    // audit details (source filename, content hash, params, AI model, user).
    const aiQuizIds = quizzesPlain
        .filter((q) => q.aiGenerated && q.generationJobId)
        .map((q) => q.generationJobId);
    const jobMap = new Map();
    if (aiQuizIds.length > 0) {
        const jobs = await GenerationJob.find({
            _id: { $in: aiQuizIds.map((id) => new mongoose.Types.ObjectId(id)) }
        })
            .populate("userId", "firstName lastName email")
            .lean();
        for (const job of jobs) {
            jobMap.set(job._id.toString(), replaceMongoIdInObject(job));
        }
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h1 className="text-2xl font-bold" dir="auto">{t("allQuizzes")}</h1>
                <div className="flex gap-1 text-sm">
                    <FilterLink href="/admin/quizzes" active={aiGeneratedFilter === null} label={t("filterAll")} />
                    <FilterLink href="/admin/quizzes?aiGenerated=true" active={aiGeneratedFilter === true} label={tGen("aiGeneratedBadge")} />
                    <FilterLink href="/admin/quizzes?aiGenerated=false" active={aiGeneratedFilter === false} label={t("filterNonAi")} />
                </div>
            </div>

            {quizzesPlain.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <p className="text-slate-500">{t("noQuizzesFound")}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {quizzesPlain.map((quiz) => {
                        const job = quiz.generationJobId && jobMap.get(quiz.generationJobId);
                        return (
                            <div key={quiz.id} className="border rounded-lg p-6 bg-white">
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <h3 className="text-lg font-medium" dir="auto">{quiz.title}</h3>
                                            {quiz.published ? (
                                                <Badge variant="default" className="bg-emerald-100 text-emerald-800">
                                                    <Eye className="w-3 h-3 me-1 rtl:rotate-180" />
                                                    {t("publishedBadge")}
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">
                                                    <EyeOff className="w-3 h-3 me-1 rtl:rotate-180" />
                                                    {t("draft")}
                                                </Badge>
                                            )}
                                            {quiz.aiGenerated && (
                                                <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
                                                    <Sparkles className="w-3 h-3 me-1 rtl:rotate-180" />
                                                    {tGen("aiGeneratedBadge")}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-600 mb-2" dir="auto">
                                            {t("course")}: {quiz.courseId?.title || t("unknown")}
                                            {quiz.lessonId && ` • ${t("lesson")}: ${quiz.lessonId.title}`}
                                        </p>
                                        {quiz.description && (
                                            <p className="text-sm text-slate-500" dir="auto">{quiz.description}</p>
                                        )}

                                        {job && (
                                            <div className="mt-3 rounded-md border border-violet-100 bg-violet-50/40 p-3 text-xs text-slate-700 space-y-1" dir="auto">
                                                <div className="font-medium text-slate-800 mb-1">{t("auditHeading")}</div>
                                                <AuditRow label={t("auditSourceFilename")} value={job.sourceFilename} />
                                                <AuditRow label={t("auditContentHash")} value={job.sourceContentHash ? `${job.sourceContentHash.slice(0, 12)}…` : "—"} mono />
                                                <AuditRow label={t("auditParams")} value={job.params ? `${job.params.totalQuestions} (MCQ ${job.params.mcqCount}/TF ${job.params.trueFalseCount})` : "—"} />
                                                <AuditRow label={t("auditAiModel")} value={job.aiModel ? `${job.aiProvider || "google-gemini"} / ${job.aiModel}` : "—"} />
                                                <AuditRow label={t("auditGeneratedBy")} value={job.userId?.name || job.userId?.email || "—"} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="ms-4">
                                        <Link href={`/dashboard/courses/${quiz.courseId?.id || ""}/quizzes/${quiz.id}/attempts`}>
                                            <Badge variant="outline" className="cursor-pointer">
                                                {t("viewAttempts")}
                                            </Badge>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function FilterLink({ href, active, label }) {
    return (
        <Link
            href={href}
            className={`px-3 py-1.5 rounded-md border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-white text-slate-700 hover:bg-slate-100 border-slate-200"}`}
        >
            {label}
        </Link>
    );
}

function AuditRow({ label, value, mono }) {
    return (
        <div className="flex gap-2">
            <span className="text-slate-500 min-w-[120px]">{label}:</span>
            <span className={mono ? "font-mono" : ""}>{value}</span>
        </div>
    );
}
