import { NextResponse } from "next/server";
import { dbConnect, runWithOptionalTransaction } from "@/service/mongo";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { isAdmin } from "@/lib/authorization";
import { GenerationJob } from "@/model/generation-job-model";
import { Quiz } from "@/model/quizv2-model";
import { Question } from "@/model/questionv2-model";
import { Attempt } from "@/model/attemptv2-model";
import { appendMcqsSchema } from "@/lib/validations";
import { forgetExtractedText } from "@/service/generation-orchestrator";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

/**
 * POST /api/quiz-generation/jobs/[jobId]/append (contracts/mcq-complement-api.md §5).
 *
 * Atomically append approved MCQs from a succeeded MCQ complement job to the
 * job's target quiz. Does NOT create a Quiz document — only inserts new
 * Question documents referencing the existing quiz.
 *
 * Auth: job owner or admin. Job must be in "succeeded" status with
 * jobType "mcq_complement". When the target quiz is published and has existing
 * attempts, the client must pass confirmPublishedAppend=true (the route
 * returns a 200 requiresConfirmation payload otherwise).
 */
export async function POST(request, { params }) {
    try {
        const { jobId } = await params;
        const user = await getLoggedInUser();
        if (!user) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
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
        const parsed = appendMcqsSchema.safeParse(body ?? {});
        if (!parsed.success) {
            return NextResponse.json(
                { ok: false, error: parsed.error.issues?.[0]?.message || "Invalid body" },
                { status: 400 }
            );
        }
        const confirmPublishedAppend = parsed.data.confirmPublishedAppend === true;

        await dbConnect();
        const job = await GenerationJob.findById(jobId).lean();
        if (!job) {
            return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
        }
        const jobUserId = job.userId?.toString?.() || String(job.userId);
        if (jobUserId !== user.id && !isAdmin(user)) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
        }
        if (job.status !== "succeeded") {
            return NextResponse.json(
                { ok: false, error: "This generation job has not completed successfully yet." },
                { status: 400 }
            );
        }
        if (job.jobType !== "mcq_complement") {
            return NextResponse.json(
                { ok: false, error: "This generation job is not an MCQ complement job." },
                { status: 400 }
            );
        }
        const targetQuizId = job.targetQuizId?.toString?.() || String(job.targetQuizId);
        if (!targetQuizId) {
            return NextResponse.json(
                { ok: false, error: "The target quiz for this job could not be found." },
                { status: 404 }
            );
        }

        const targetQuiz = await Quiz.findById(targetQuizId).lean();
        if (!targetQuiz) {
            return NextResponse.json(
                { ok: false, error: "The target quiz for this job could not be found." },
                { status: 404 }
            );
        }

        // Published-quiz warning (FR-011, contracts §5 step 4). When the quiz
        // is published and has any attempts, the client must explicitly confirm
        // before we append. Past attempts are not retroactively modified — new
        // questions only appear on future attempts.
        if (targetQuiz.published) {
            const existingAttemptCount = await Attempt.countDocuments({
                quizId: new mongoose.Types.ObjectId(targetQuizId)
            });
            if (existingAttemptCount > 0 && !confirmPublishedAppend) {
                return NextResponse.json({
                    ok: false,
                    requiresConfirmation: true,
                    reason: `This quiz is published and has ${existingAttemptCount} existing student attempt(s). New MCQs will only appear on future attempts.`,
                    existingAttemptCount
                }, { status: 200 });
            }
        }

        // Filter drafts: include only those not rejected by the instructor.
        const drafts = (job.draftQuestions || []).filter(
            (d) => d.instructorState !== "rejected"
        );
        if (drafts.length === 0) {
            return NextResponse.json(
                { ok: false, error: "No approved MCQs to append. Approve or leave untouched the questions you want to keep." },
                { status: 400 }
            );
        }

        // New MCQs continue from the existing question count so they appear
        // after the existing questions (FR-008, research.md §4 step 5).
        const existingQuestionCount = await Question.countDocuments({
            quizId: new mongoose.Types.ObjectId(targetQuizId)
        });

        let insertedCount = 0;
        try {
            await runWithOptionalTransaction(async (session) => {
                const txOpts = session ? { session } : {};
                const questionDocs = drafts.map((d, idx) => ({
                    quizId: new mongoose.Types.ObjectId(targetQuizId),
                    type: d.type,
                    text: d.text,
                    options: d.options,
                    correctOptionIds: d.correctOptionIds,
                    modelAnswer: d.modelAnswer || "",
                    explanation: d.explanation || "",
                    sourceQuote: d.sourceQuote || "",
                    difficulty: d.difficulty || null,
                    points: 1,
                    order: existingQuestionCount + idx
                }));
                await Question.insertMany(questionDocs, txOpts);
                insertedCount = questionDocs.length;
            });
        } catch (txError) {
            console.error("[MCQ_COMPLEMENT_APPEND] append error:", txError);
            return NextResponse.json(
                { ok: false, error: txError?.message || "Failed to append MCQs to the quiz" },
                { status: 500 }
            );
        }

        // Release the in-memory extracted text — regeneration is no longer
        // meaningful after the draft has been appended.
        forgetExtractedText(jobId);

        const totalQuestionCount = existingQuestionCount + insertedCount;
        return NextResponse.json({
            ok: true,
            quizId: targetQuizId,
            appendedCount: insertedCount,
            totalQuestionCount,
            aiGenerated: true
        }, { status: 201 });
    } catch (error) {
        console.error("[MCQ_COMPLEMENT_APPEND] Error:", error);
        return NextResponse.json(
            { ok: false, error: error?.message || "Failed to append MCQs to the quiz" },
            { status: 500 }
        );
    }
}
