import { NextResponse } from "next/server";
import { dbConnect } from "@/service/mongo";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { isAdmin, isAdminOrInstructor } from "@/lib/authorization";
import { GenerationJob } from "@/model/generation-job-model";
import { regenerateDraftSchema, quizGenerationParamsSchema } from "@/lib/validations";
import {
    getAdminQuizConfig,
    checkQuota
} from "@/queries/quiz-generation";
import { DEFAULT_GENERATION_PARAMS } from "@/lib/constants";
import {
    runGenerationJob,
    runSingleQuestionRegeneration,
    rememberExtractedText,
    resolveJobSourceText
} from "@/service/generation-orchestrator";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function normalizeParamsInput(params) {
    if (!params || typeof params !== "object") return params;
    return {
        ...params,
        totalQuestions: params.totalQuestions ?? params.total_questions,
        mcqCount: params.mcqCount ?? params.mcq_count,
        trueFalseCount: params.trueFalseCount ?? params.tf_count,
        easyCount: params.easyCount ?? params.easy_count,
        mediumCount: params.mediumCount ?? params.medium_count,
        hardCount: params.hardCount ?? params.hard_count
    };
}

function serializeGenerationJob(job) {
    const plain = job?.toObject ? job.toObject() : job;
    const id = plain?._id?.toString?.() || plain?.id;

    return {
        ok: true,
        jobId: id,
        status: plain?.status,
        jobType: plain?.jobType,
        targetQuizId: plain?.targetQuizId ? plain.targetQuizId.toString() : null,
        sourceFilename: plain?.sourceFilename,
        extractionWarnings: plain?.extractionWarnings || [],
        aiModel: plain?.aiModel,
        aiProvider: plain?.aiProvider,
        draftQuestions: plain?.draftQuestions || [],
        failureReason: plain?.failureReason || null
    };
}

/**
 * POST /api/quiz-generation/jobs/[jobId]/regenerate (contracts §5).
 *
 * Body:
 *   { scope: "single" | "all", draftId?: string, params?: {...} }
 *
 * - scope "single": regenerate only the draft identified by draftId; other
 *   drafts are untouched. Does NOT consume a quota slot.
 * - scope "all": replace the entire draft with a fresh AI call using the
 *   provided `params` (or the job's existing params). Consumes one quota slot.
 *
 * Returns 200 with the updated draft after synchronous generation completes.
 *
 * Auth: job owner or admin.
 */
export async function POST(request, { params }) {
    try {
        const { jobId } = await params;
        const user = await getLoggedInUser();
        if (!user) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        if (!isAdminOrInstructor(user)) {
            return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
        }
        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            return NextResponse.json({ ok: false, error: "Invalid jobId" }, { status: 400 });
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
        }
        if (body?.params) {
            body = {
                ...body,
                params: normalizeParamsInput(body.params)
            };
        }
        const parsed = regenerateDraftSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { ok: false, error: parsed.error.issues?.[0]?.message || "Invalid body" },
                { status: 400 }
            );
        }
        const { scope, draftId, params: overrideParams } = parsed.data;

        await dbConnect();
        const job = await GenerationJob.findById(jobId);
        if (!job) {
            return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
        }
        const jobUserId = job.userId?.toString?.() || String(job.userId);
        if (jobUserId !== user.id && !isAdmin(user)) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
        }
        // Regeneration only makes sense once the initial generation has produced
        // a draft. Reject if the job hasn't succeeded yet.
        if (job.status !== "succeeded") {
            return NextResponse.json(
                { ok: false, error: "Job is not ready for regeneration." },
                { status: 400 }
            );
        }

        // The source text is required to call the AI again. It is retained in
        // the in-memory extracted-text store after the initial generation
        // succeeds (see service/generation-orchestrator.js).
        const extractedText = await resolveJobSourceText(job, jobId);
        if (!extractedText) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "The source text is no longer available. Please re-upload the document to regenerate."
                },
                { status: 409 }
            );
        }

        if (scope === "single") {
            // Find the target draft before scheduling so we can 404 synchronously
            // for a bad draftId (rather than failing async).
            const draft = job.draftQuestions.find((d) => d.draftId === draftId);
            if (!draft) {
                return NextResponse.json(
                    { ok: false, error: "Draft question not found" },
                    { status: 404 }
                );
            }

            // Transition to "queued" so the polling client sees the job is in
            // flight. The orchestrator will move it to "running" then back to
            // "succeeded" with the regenerated content.
            job.status = "queued";
            job.startedAt = null;
            job.completedAt = null;
            job.failureReason = null;
            await job.save();

            // Defensive: re-remember in case the entry was evicted.
            rememberExtractedText(jobId, extractedText);

            const result = await runSingleQuestionRegeneration(jobId, draftId);
            const updatedJob = await GenerationJob.findById(jobId).lean();
            if (!result.ok || updatedJob?.status === "failed") {
                return NextResponse.json(
                    {
                        ...serializeGenerationJob(updatedJob),
                        ok: false,
                        error: updatedJob?.failureReason || result.failureReason || "Failed to regenerate"
                    },
                    { status: 500 }
                );
            }

            return NextResponse.json(serializeGenerationJob(updatedJob), { status: 200 });
        }

        // scope === "all": replace the entire draft.
        // Consumes one quota slot per contracts §5.
        const config = await getAdminQuizConfig();
        const quota = await checkQuota(user.id, config.dailyQuotaPerInstructor);
        if (!quota.allowed) {
            return NextResponse.json(
                {
                    ok: false,
                    error: `Daily generation limit reached. Try again after ${quota.retryAfter}.`,
                    retryAfter: quota.retryAfter
                },
                { status: 429 }
            );
        }

        // Build the new params. If the caller provided params, validate them
        // against the strict schema; otherwise reuse the job's existing params.
        let newParams;
        if (overrideParams) {
            // Merge with defaults so omitted difficulty counts fall back.
            const merged = { ...DEFAULT_GENERATION_PARAMS, ...overrideParams };
            const parsedParams = quizGenerationParamsSchema.safeParse(merged);
            if (!parsedParams.success) {
                return NextResponse.json(
                    { ok: false, error: parsedParams.error.issues?.[0]?.message || "Invalid params" },
                    { status: 400 }
                );
            }
            newParams = parsedParams.data;
        } else {
            newParams = job.params.toObject?.() ?? job.params;
        }

        // Clamp totalQuestions against admin max (defensive — schema enforces ≤50
        // but admin may have a tighter config).
        if (config.maxQuestionsPerGeneration && newParams.totalQuestions > config.maxQuestionsPerGeneration) {
            newParams.totalQuestions = config.maxQuestionsPerGeneration;
        }

        // Reset the job: clear drafts, update params, re-queue.
        job.params = newParams;
        job.draftQuestions = [];
        job.status = "queued";
        job.startedAt = null;
        job.completedAt = null;
        job.failureReason = null;
        await job.save();

        rememberExtractedText(jobId, extractedText);

        const result = await runGenerationJob(jobId, {
            extractedText,
            fromLessonStoredText: Boolean(job.lessonId)
        });
        const updatedJob = await GenerationJob.findById(jobId).lean();
        if (!result.ok || updatedJob?.status === "failed") {
            return NextResponse.json(
                {
                    ...serializeGenerationJob(updatedJob),
                    ok: false,
                    error: updatedJob?.failureReason || result.failureReason || "Failed to regenerate"
                },
                { status: 500 }
            );
        }

        return NextResponse.json(serializeGenerationJob(updatedJob), { status: 200 });
    } catch (error) {
        console.error("[REGENERATE] Error:", error);
        return NextResponse.json(
            { ok: false, error: error?.message || "Failed to regenerate" },
            { status: 500 }
        );
    }
}
