import { NextResponse } from "next/server";
import { dbConnect, runWithOptionalTransaction } from "@/service/mongo";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { isAdmin } from "@/lib/authorization";
import { GenerationJob } from "@/model/generation-job-model";
import { Quiz } from "@/model/quizv2-model";
import { Question } from "@/model/questionv2-model";
import { saveDraftAsQuizSchema } from "@/lib/validations";
import { forgetExtractedText } from "@/service/generation-orchestrator";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

/**
 * POST /api/quiz-generation/jobs/[jobId]/save (contracts §6).
 *
 * Save a succeeded job's draft as an unpublished, AI-generated Quiz with one
 * Question document per non-rejected draft question.
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
        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            return NextResponse.json({ ok: false, error: "Invalid jobId" }, { status: 400 });
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
        }
        const parsed = saveDraftAsQuizSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { ok: false, error: parsed.error.issues?.[0]?.message || "Invalid body" },
                { status: 400 }
            );
        }
        const data = parsed.data;

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
                { ok: false, error: "Job is not in a succeeded state." },
                { status: 400 }
            );
        }

        const drafts = (job.draftQuestions || []).filter(
            (d) => d.instructorState !== "rejected"
        );
        if (drafts.length === 0) {
            return NextResponse.json(
                { ok: false, error: "No draft questions to save." },
                { status: 400 }
            );
        }

        const courseId = data.courseId
            ? new mongoose.Types.ObjectId(data.courseId)
            : job.courseId;
        const lessonId = data.lessonId
            ? new mongoose.Types.ObjectId(data.lessonId)
            : job.lessonId || null;

        let createdQuiz;
        let createdQuestions = [];
        try {
            await runWithOptionalTransaction(async (session) => {
                const txOpts = session ? { session } : {};
                createdQuiz = await Quiz.create([{
                    courseId,
                    lessonId,
                    title: data.title,
                    description: data.description ?? "",
                    published: false,
                    required: false,
                    passPercent: data.passPercent ?? 70,
                    timeLimitSec: data.timeLimitSec ?? null,
                    maxAttempts: data.maxAttempts ?? null,
                    shuffleQuestions: data.shuffleQuestions ?? false,
                    shuffleOptions: data.shuffleOptions ?? false,
                    showAnswersPolicy: data.showAnswersPolicy ?? "after_submit",
                    createdBy: new mongoose.Types.ObjectId(user.id),
                    aiGenerated: true,
                    generationJobId: job._id
                }], txOpts);
                const quizDoc = createdQuiz[0];

                const questionDocs = drafts.map((d, idx) => ({
                    quizId: quizDoc._id,
                    type: d.type,
                    text: d.text,
                    options: d.options,
                    correctOptionIds: d.correctOptionIds,
                    modelAnswer: d.modelAnswer || "",
                    explanation: d.explanation || "",
                    sourceQuote: d.sourceQuote || "",
                    difficulty: d.difficulty || null,
                    points: 1,
                    order: idx
                }));
                createdQuestions = await Question.insertMany(questionDocs, txOpts);
            });
        } catch (txError) {
            if (createdQuiz?.[0]?._id) {
                await Question.deleteMany({ quizId: createdQuiz[0]._id });
                await Quiz.deleteOne({ _id: createdQuiz[0]._id });
            }
            console.error("[SAVE_DRAFT_AS_QUIZ] save error:", txError);
            return NextResponse.json(
                { ok: false, error: txError?.message || "Failed to save quiz" },
                { status: 500 }
            );
        }

        // The draft has been persisted to the Quiz/Question store; release the
        // in-memory extracted text so it doesn't accumulate. Regeneration is no
        // longer possible after save (by design — the instructor should edit
        // the saved quiz instead).
        forgetExtractedText(jobId);

        return NextResponse.json({
            ok: true,
            quizId: createdQuiz[0]._id.toString(),
            questionCount: createdQuestions.length,
            aiGenerated: true
        }, { status: 201 });
    } catch (error) {
        console.error("[SAVE_DRAFT_AS_QUIZ] Error:", error);
        return NextResponse.json(
            { ok: false, error: error?.message || "Failed to save draft as quiz" },
            { status: 500 }
        );
    }
}
