import { NextResponse } from "next/server";
import { dbConnect } from "@/service/mongo";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { isAdmin } from "@/lib/authorization";
import { GenerationJob } from "@/model/generation-job-model";
import { updateDraftQuestionSchema } from "@/lib/validations";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/quiz-generation/jobs/[jobId]/questions/[draftId] (contracts §4).
 *
 * Partial update of a single DraftQuestion sub-document. Sets instructorState
 * to "edited" if the caller did not specify a state.
 *
 * Auth: job owner or admin.
 */
export async function PATCH(request, { params }) {
    try {
        const { jobId, draftId } = await params;
        const user = await getLoggedInUser();
        if (!user) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            return NextResponse.json({ ok: false, error: "Invalid jobId" }, { status: 400 });
        }
        if (!draftId) {
            return NextResponse.json({ ok: false, error: "Missing draftId" }, { status: 400 });
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
        }
        const parsed = updateDraftQuestionSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { ok: false, error: parsed.error.issues?.[0]?.message || "Invalid update" },
                { status: 400 }
            );
        }
        const updates = parsed.data;

        await dbConnect();
        const job = await GenerationJob.findById(jobId);
        if (!job) {
            return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
        }
        const jobUserId = job.userId?.toString?.() || String(job.userId);
        if (jobUserId !== user.id && !isAdmin(user)) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
        }

        // DraftQuestion sub-schema is `_id: false`, so we can't use Mongoose's
        // DocumentArray.id() helper (which looks up by _id). Find by the
        // `draftId` field instead.
        const draft = job.draftQuestions.find(
            (d) => d.draftId === draftId
        );
        if (!draft) {
            return NextResponse.json({ ok: false, error: "Draft question not found" }, { status: 404 });
        }

        // Apply partial updates. Mongoose sub-doc validators run on save.
        if (updates.type !== undefined) draft.type = updates.type;
        if (updates.difficulty !== undefined) draft.difficulty = updates.difficulty;
        if (updates.text !== undefined) draft.text = updates.text;
        if (updates.options !== undefined) draft.options = updates.options;
        if (updates.correctOptionIds !== undefined) draft.correctOptionIds = updates.correctOptionIds;
        if (updates.modelAnswer !== undefined) draft.modelAnswer = updates.modelAnswer;
        if (updates.explanation !== undefined) draft.explanation = updates.explanation;
        if (updates.sourceQuote !== undefined) draft.sourceQuote = updates.sourceQuote;
        draft.instructorState = updates.instructorState || "edited";

        try {
            await job.save();
        } catch (saveError) {
            return NextResponse.json(
                { ok: false, error: saveError?.message || "Invalid question data" },
                { status: 400 }
            );
        }

        return NextResponse.json({
            ok: true,
            draftId,
            instructorState: draft.instructorState
        });
    } catch (error) {
        console.error("[DRAFT_QUESTION_PATCH] Error:", error);
        return NextResponse.json(
            { ok: false, error: error?.message || "Failed to update draft question" },
            { status: 500 }
        );
    }
}
