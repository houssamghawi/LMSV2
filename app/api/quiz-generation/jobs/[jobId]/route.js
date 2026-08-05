import { NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { isAdmin } from "@/lib/authorization";
import { getGenerationJob } from "@/queries/quiz-generation";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

/**
 * GET /api/quiz-generation/jobs/[jobId] (contracts §3).
 *
 * Returns the job status and, when succeeded, the full draft questions array.
 * Auth: job owner or admin.
 */
export async function GET(request, { params }) {
    try {
        const { jobId } = await params;
        const user = await getLoggedInUser();
        if (!user) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: NO_STORE });
        }
        const job = await getGenerationJob(jobId);
        if (!job) {
            return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404, headers: NO_STORE });
        }

        const jobUserId = job.userId?._id?.toString?.() || job.userId?.toString?.() || job.userId;
        const isOwner = jobUserId === user.id;
        if (!isOwner && !isAdmin(user)) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403, headers: NO_STORE });
        }

        const base = {
            ok: true,
            jobId: job.id,
            status: job.status,
            createdAt: job.createdAt
        };

        // spec 002 — include MCQ complement context on every response so the
        // client can route to the MCQ draft view, and the validation summary
        // once the job has succeeded (contracts/mcq-complement-api.md §2, §6).
        if (job.jobType === "mcq_complement") {
            base.jobType = job.jobType;
            base.targetQuizId = job.targetQuizId
                ? (job.targetQuizId._id?.toString?.() || job.targetQuizId.toString?.() || String(job.targetQuizId))
                : null;
        }

        if (job.status === "succeeded") {
            const succeededBody = {
                ...base,
                sourceFilename: job.sourceFilename,
                extractionWarnings: job.extractionWarnings || [],
                aiModel: job.aiModel,
                aiProvider: job.aiProvider,
                draftQuestions: job.draftQuestions || []
            };
            if (job.jobType === "mcq_complement" && job.mcqValidationSummary) {
                succeededBody.mcqValidationSummary = job.mcqValidationSummary;
            }
            return NextResponse.json(succeededBody, { headers: NO_STORE });
        }

        if (job.status === "failed") {
            return NextResponse.json({
                ...base,
                failureReason: job.failureReason
            }, { headers: NO_STORE });
        }

        return NextResponse.json(base, { headers: NO_STORE });
    } catch (error) {
        console.error("[QUIZ_GENERATION_JOB_GET] Error:", error);
        return NextResponse.json(
            { ok: false, error: error?.message || "Failed to fetch job" },
            { status: 500, headers: NO_STORE }
        );
    }
}
