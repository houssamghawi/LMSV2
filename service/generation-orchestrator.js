// Quiz generation orchestrator — the body of the `after()` callback registered
// by POST /api/quiz-generation/jobs (research.md §4, contracts §2).
//
// runGenerationJob(jobId):
//   1. Load the GenerationJob. If not in `queued` state, return (idempotent).
//   2. Transition to `running`, set startedAt.
//   3. Extract text from the cached buffer is NOT possible — the upload route
//      does not retain the .docx bytes. Instead the route pre-extracts the text
//      and stores the normalized text length on the job; the buffer is passed
//      to the orchestrator via the `extractDocxText` call done in the route.
//      To keep the orchestrator self-contained, the route stores the extracted
//      text temporarily in the job's `extractionWarnings`-adjacent field is
//      not permitted by the data model. Therefore the orchestrator accepts an
//      optional `extractedText` argument and, when not provided, re-extracts
//      by reading the source buffer the route cached on the job via the
//      `_extractedTextBuffer` in-memory map (see service/quiz-generator upload
//      route). For tests and direct invocation, pass `extractedText` directly.
//   4. Call generateQuizDraft(extractedText, params) via Gemini.
//   5. Persist draftQuestions, aiProvider, aiModel, aiTokensInput,
//      aiTokensOutput, extractedTextLength, status: "succeeded", completedAt.
//   6. On any failure: status: "failed", failureReason, completedAt.
//
// This function is safe to call directly (used by tests to bypass `after()`).

import { dbConnect } from "@/service/mongo";
import { GenerationJob } from "@/model/generation-job-model";
import { Lesson } from "@/model/lesson.model";
import { generateQuizDraft } from "@/service/quiz-generator";
import { extractDocxText, computeContentHash } from "@/service/docx-extractor";
import { buildMcqComplementMessages } from "@/lib/mcq-complement-prompt";
import {
    validateMcqStructure,
    filterDuplicateStems
} from "@/service/mcq-validator";
import { getExistingQuestionStems } from "@/queries/quiz-generation";

// In-memory store of the most recent extracted text per job, populated by the
// upload route. This avoids re-reading the (already discarded) .docx buffer
// when `after()` runs. Entries are short-lived: deleted once the job reaches a
// terminal state. Tests can bypass this by passing `extractedText` directly.
const extractedTextStore = new Map();

export function rememberExtractedText(jobId, text) {
    if (!jobId || !text) return;
    extractedTextStore.set(jobId.toString(), text);
}

export function forgetExtractedText(jobId) {
    if (!jobId) return;
    extractedTextStore.delete(jobId.toString());
}

export function getRememberedExtractedText(jobId) {
    return jobId ? extractedTextStore.get(jobId.toString()) ?? null : null;
}

async function loadLessonExtractedText(lessonId) {
    if (!lessonId) return null;
    const lesson = await Lesson.findById(lessonId)
        .select("extractedText docxFilename")
        .lean();
    const text = lesson?.extractedText?.trim();
    return text || null;
}

/**
 * Resolve source text for a generation job.
 * Precedence: explicit options.extractedText > lesson stored text (when
 * fromLessonStoredText) > in-memory store > re-extract from sourceBuffer >
 * lesson DB fallback (regeneration after server restart).
 *
 * @param {import("mongoose").Document} job
 * @param {string} jobId
 * @param {object} [options]
 * @returns {Promise<string|null>}
 */
export async function resolveJobSourceText(job, jobId, options = {}) {
    if (options.extractedText?.trim()) {
        return options.extractedText.trim();
    }
    if (options.fromLessonStoredText && job.lessonId) {
        const lessonText = await loadLessonExtractedText(job.lessonId);
        if (lessonText) return lessonText;
    }
    const remembered = getRememberedExtractedText(jobId);
    if (remembered?.trim()) return remembered.trim();
    if (options.sourceBuffer) {
        const extracted = await extractDocxText(options.sourceBuffer);
        if (extracted.text?.trim()) return extracted.text.trim();
    }
    if (job.lessonId) {
        const lessonText = await loadLessonExtractedText(job.lessonId);
        if (lessonText) return lessonText;
    }
    return null;
}

/**
 * Run the generation pipeline for a job. Idempotent: if the job is no longer
 * in `queued` status, the function returns without doing anything.
 *
 * @param {string} jobId
 * @param {object} [options]
 * @param {string} [options.extractedText] - pre-extracted normalized text
 *   (used by tests and by the upload route to avoid re-extracting).
 * @param {Buffer}  [options.sourceBuffer]  - raw .docx bytes; used to
 *   re-extract text when `extractedText` is not provided.
 * @returns {Promise<{ ok: boolean, status: string, failureReason?: string }>}
 */
export async function runGenerationJob(jobId, options = {}) {
    if (!jobId) return { ok: false, status: "failed", failureReason: "Missing jobId" };
    await dbConnect();

    const job = await GenerationJob.findById(jobId);
    if (!job) {
        return { ok: false, status: "failed", failureReason: "Job not found" };
    }
    if (job.status !== "queued") {
        // Already processed (e.g. duplicate callback fire). Idempotent no-op.
        return { ok: true, status: job.status };
    }

    // spec 002 — dispatch MCQ complement jobs to the dedicated runner that
    // uses the MCQ-only prompt and runs structural + duplicate validation.
    if (job.jobType === "mcq_complement") {
        return runMcqComplementJob(job, options);
    }

    try {
        job.status = "running";
        job.startedAt = new Date();
        await job.save();

        const extractedText = await resolveJobSourceText(job, jobId, options);
        if (!extractedText) {
            throw Object.assign(new Error("Document has no extractable text."), {
                code: "EMPTY_DOCUMENT"
            });
        }

        const result = await generateQuizDraft(extractedText, job.params.toObject?.() ?? job.params);

        job.draftQuestions = result.questions.map((q) => ({
            draftId: q.draftId,
            type: q.type,
            difficulty: q.difficulty,
            text: q.text,
            options: q.options,
            correctOptionIds: q.correctOptionIds,
            modelAnswer: q.modelAnswer || "",
            explanation: q.explanation || "",
            sourceQuote: q.sourceQuote || "",
            instructorState: q.instructorState || "untouched"
        }));
        job.aiProvider = result.provider;
        job.aiModel = result.model;
        job.aiTokensInput = result.tokensInput;
        job.aiTokensOutput = result.tokensOutput;
        job.extractedTextLength = extractedText.length;
        job.status = "succeeded";
        job.completedAt = new Date();
        await job.save();

        // NOTE: We intentionally do NOT forget the extracted text here. The
        // text is required for regeneration (contracts §5 "calls AI again with
        // the same source text"). The text is forgotten only after the draft
        // is saved as a quiz (see app/api/quiz-generation/jobs/[jobId]/save)
        // or when the job fails.
        return { ok: true, status: "succeeded" };
    } catch (error) {
        console.error("[GENERATION_ORCHESTRATOR] Error:", {
            jobId: jobId?.toString?.() || jobId,
            code: error?.code,
            message: error?.message,
            cause: error?.cause?.message
        });
        // Use updateOne with optimistic transition: only set failed if the job
        // is still in a non-terminal state. This avoids VersionError races when
        // multiple callbacks fire for the same job.
        await GenerationJob.updateOne(
            { _id: job._id, status: { $in: ["queued", "running"] } },
            {
                $set: {
                    status: "failed",
                    failureReason: humanizeFailureReason(error),
                    completedAt: new Date()
                }
            }
        );
        forgetExtractedText(jobId);
        return { ok: false, status: "failed", failureReason: humanizeFailureReason(error) };
    }
}

/**
 * Run the MCQ complement generation pipeline for a queued job
 * (specs/002-ai-mcq-complement/research.md §1–§3).
 *
 * Flow:
 *   1. Transition job to "running".
 *   2. Resolve extracted text (same precedence as full-quiz runner).
 *   3. Fetch existing question stems on the target quiz (duplicate avoidance).
 *   4. Build the MCQ-only prompt via buildMcqComplementMessages.
 *   5. Call generateQuizDraft with the MCQ prompt (Gemini JSON mode is used;
 *      the grounding filter runs inside that function).
 *   6. Run validateMcqStructure on each grounded question; drop invalid ones.
 *   7. Run filterDuplicateStems against the existing stems; drop duplicates.
 *   8. Persist draftQuestions + mcqValidationSummary, status "succeeded".
 *
 * The job document must already have jobType="mcq_complement" and a
 * non-null targetQuizId (enforced by the POST /jobs route before create).
 *
 * @param {import("mongoose").Document} job - queued GenerationJob document
 * @param {object} [options] - same shape as runGenerationJob's options
 * @returns {Promise<{ ok: boolean, status: string, failureReason?: string }>}
 */
async function runMcqComplementJob(job, options = {}) {
    try {
        job.status = "running";
        job.startedAt = new Date();
        await job.save();

        const extractedText = await resolveJobSourceText(job, job._id.toString(), options);
        if (!extractedText) {
            throw Object.assign(new Error("Document has no extractable text."), {
                code: "EMPTY_DOCUMENT"
            });
        }

        const targetQuizId = job.targetQuizId?.toString?.() || job.targetQuizId;
        const existingStems = targetQuizId
            ? await getExistingQuestionStems(targetQuizId)
            : [];

        const params = job.params.toObject?.() ?? job.params;
        const messages = buildMcqComplementMessages(extractedText, params, existingStems);

        const result = await generateQuizDraft(extractedText, params, { messages });

        let generated = Array.isArray(result.questions) ? result.questions : [];
        const targetCount = params.totalQuestions || 0;
        let droppedUngrounded = Math.max(0, targetCount - generated.length);

        // Structural validation (exactly 4 distinct options, correct answer
        // maps to an option, justification ≤ 2 sentences).
        let structurallyValid = [];
        let droppedInvalidStructure = 0;
        for (const q of generated) {
            if (validateMcqStructure(q)) {
                structurallyValid.push(q);
            } else {
                droppedInvalidStructure += 1;
            }
        }

        // Duplicate detection against existing stems on the target quiz.
        let { kept, dropped } = filterDuplicateStems(structurallyValid, existingStems);
        let droppedDuplicate = dropped.length;

        // Backfill: MCQ complement must still deliver exactly targetCount MCQs
        // after structural + duplicate filtering. Request additional batches
        // until the quota is met or generation fails.
        const MAX_MCQ_BACKFILL_ATTEMPTS = 10;
        const existingStemSet = new Set(existingStems.map((s) => s.trim().toLowerCase()));
        const usedTexts = new Set(kept.map((q) => q.text.trim().toLowerCase()));

        for (let attempt = 0;
            kept.length < targetCount && attempt < MAX_MCQ_BACKFILL_ATTEMPTS;
            attempt += 1
        ) {
            const deficit = targetCount - kept.length;
            const backfillParams = {
                ...params,
                totalQuestions: deficit,
                mcqCount: deficit,
                trueFalseCount: 0
            };
            const avoidanceStems = [
                ...existingStems,
                ...kept.map((q) => q.text),
                ...dropped.map((q) => q.text)
            ];
            const backfillMessages = buildMcqComplementMessages(
                extractedText,
                backfillParams,
                avoidanceStems
            );
            const backfill = await generateQuizDraft(extractedText, backfillParams, {
                messages: backfillMessages
            });
            const candidates = Array.isArray(backfill.questions) ? backfill.questions : [];
            droppedUngrounded += Math.max(0, deficit - candidates.length);

            for (const q of candidates) {
                if (kept.length >= targetCount) break;
                if (!validateMcqStructure(q)) {
                    droppedInvalidStructure += 1;
                    continue;
                }
                const key = q.text.trim().toLowerCase();
                if (existingStemSet.has(key) || usedTexts.has(key)) {
                    droppedDuplicate += 1;
                    continue;
                }
                kept.push(q);
                usedTexts.add(key);
            }
        }

        if (kept.length !== targetCount) {
            throw Object.assign(
                new Error(
                    `MCQ complement produced ${kept.length} usable questions but ${targetCount} were requested.`
                ),
                { code: "AI_GENERATION_FAILED" }
            );
        }

        const included = kept.length;

        job.draftQuestions = kept.map((q) => ({
            draftId: q.draftId,
            type: q.type,
            difficulty: q.difficulty,
            text: q.text,
            options: q.options,
            correctOptionIds: q.correctOptionIds,
            modelAnswer: q.modelAnswer || "",
            explanation: q.explanation || "",
            sourceQuote: q.sourceQuote || "",
            instructorState: q.instructorState || "untouched"
        }));
        job.aiProvider = result.provider;
        job.aiModel = result.model;
        job.aiTokensInput = result.tokensInput;
        job.aiTokensOutput = result.tokensOutput;
        job.extractedTextLength = extractedText.length;
        job.mcqValidationSummary = {
            generated: generated.length,
            droppedUngrounded,
            droppedInvalidStructure,
            droppedDuplicate,
            included
        };
        job.status = "succeeded";
        job.completedAt = new Date();
        await job.save();

        return { ok: true, status: "succeeded" };
    } catch (error) {
        console.error("[MCQ_COMPLEMENT_ORCHESTRATOR] Error:", {
            jobId: job?._id?.toString?.(),
            code: error?.code,
            message: error?.message,
            cause: error?.cause?.message
        });
        await GenerationJob.updateOne(
            { _id: job._id, status: { $in: ["queued", "running"] } },
            {
                $set: {
                    status: "failed",
                    failureReason: humanizeFailureReason(error),
                    completedAt: new Date()
                }
            }
        );
        forgetExtractedText(job._id.toString());
        return { ok: false, status: "failed", failureReason: humanizeFailureReason(error) };
    }
}

// Exported for direct invocation from tests (bypasses the `after()` callback
// the route registers, same pattern as runGenerationJob).
export { runMcqComplementJob as _runMcqComplementJobForTests };

/**
 * Regenerate a single DraftQuestion in-place. Keeps the existing draftId so the
 * client can update its card without re-keying, replaces the question content
 * with a fresh AI output, and marks `instructorState: "regenerated"` (audit).
 *
 * The other drafts on the job are left untouched (FR-008 single-question
 * regeneration, contracts §5 scope="single").
 *
 * The single-question mix is derived from the target draft's type + difficulty
 * (so the regenerated question stays in the same slot). Callers may pass
 * `options.params` to override the mix (still constrained to totalQuestions=1
 * by the caller).
 *
 * @param {string} jobId
 * @param {string} draftId
 * @param {object} [options]
 * @param {string} [options.extractedText] - pre-extracted normalized text
 * @param {object} [options.params] - override single-question mix
 * @returns {Promise<{ ok: boolean, status: string, failureReason?: string }>}
 */
export async function runSingleQuestionRegeneration(jobId, draftId, options = {}) {
    if (!jobId || !draftId) {
        return { ok: false, status: "failed", failureReason: "Missing jobId or draftId" };
    }
    await dbConnect();

    const job = await GenerationJob.findById(jobId);
    if (!job) {
        return { ok: false, status: "failed", failureReason: "Job not found" };
    }
    // Allow regeneration from a "succeeded" state, or from "queued" (set by the
    // route handler when it registers the after() callback). If another regen
    // is already running, bail out idempotently.
    if (job.status === "running") {
        return { ok: false, status: "running", failureReason: "Job is already in progress" };
    }
    if (job.status === "failed") {
        return { ok: false, status: "failed", failureReason: "Cannot regenerate a failed job." };
    }

    const draft = job.draftQuestions.find((d) => d.draftId === draftId);
    if (!draft) {
        return { ok: false, status: "failed", failureReason: "Draft question not found" };
    }

    try {
        job.status = "running";
        job.startedAt = new Date();
        job.completedAt = null;
        job.failureReason = null;
        await job.save();

        const extractedText = await resolveJobSourceText(job, jobId, options);
        if (!extractedText) {
            throw Object.assign(new Error("Source text is no longer available for regeneration."), {
                code: "SOURCE_TEXT_UNAVAILABLE"
            });
        }

        // Build a single-question mix matching the target's type + difficulty,
        // unless the caller supplied an explicit single-question params object.
        const params = options.params || buildSingleQuestionParams(draft);

        // spec 002 — for MCQ complement jobs, route single-question
        // regeneration through the MCQ-only prompt and run the MCQ structural
        // validator on the replacement. Existing stems (target quiz + other
        // drafts in this job, excluding the one being regenerated) are injected
        // for duplicate avoidance.
        const isMcqComplement = job.jobType === "mcq_complement";
        const genOptions = {};
        if (isMcqComplement) {
            const targetQuizId = job.targetQuizId?.toString?.() || job.targetQuizId;
            const existingQuizStems = targetQuizId
                ? await getExistingQuestionStems(targetQuizId)
                : [];
            const otherDraftStems = (job.draftQuestions || [])
                .filter((d) => d.draftId !== draftId)
                .map((d) => d.text)
                .filter(Boolean);
            const duplicateAvoidanceStems = [...existingQuizStems, ...otherDraftStems];
            genOptions.messages = buildMcqComplementMessages(
                extractedText,
                params,
                duplicateAvoidanceStems
            );
        }

        const result = await generateQuizDraft(extractedText, params, genOptions);
        if (!result.questions || result.questions.length === 0) {
            throw Object.assign(new Error("AI returned no questions for this slot."), {
                code: "AI_GENERATION_FAILED"
            });
        }

        const replacement = result.questions[0];
        if (isMcqComplement && !validateMcqStructure(replacement)) {
            throw Object.assign(
                new Error("Regenerated MCQ failed structural validation (4 distinct options, valid correct answer, ≤2-sentence justification)."),
                { code: "MCQ_INVALID_STRUCTURE" }
            );
        }
        // Preserve the existing draftId so the client can update in place.
        draft.text = replacement.text;
        draft.type = replacement.type;
        draft.difficulty = replacement.difficulty;
        draft.options = replacement.options;
        draft.correctOptionIds = replacement.correctOptionIds;
        draft.modelAnswer = replacement.modelAnswer || "";
        draft.explanation = replacement.explanation || "";
        draft.sourceQuote = replacement.sourceQuote || "";
        draft.instructorState = "regenerated";

        // Refresh audit fields.
        if (result.tokensInput != null) job.aiTokensInput = result.tokensInput;
        if (result.tokensOutput != null) job.aiTokensOutput = result.tokensOutput;
        if (result.model) job.aiModel = result.model;
        if (result.provider) job.aiProvider = result.provider;

        job.status = "succeeded";
        job.completedAt = new Date();
        await job.save();

        return { ok: true, status: "succeeded" };
    } catch (error) {
        console.error("[SINGLE_REGEN] Error:", {
            jobId,
            draftId,
            code: error?.code,
            message: error?.message
        });
        await GenerationJob.updateOne(
            { _id: job._id, status: "running" },
            {
                $set: {
                    status: "failed",
                    failureReason: humanizeFailureReason(error),
                    completedAt: new Date()
                }
            }
        );
        return { ok: false, status: "failed", failureReason: humanizeFailureReason(error) };
    }
}

/**
 * Build a single-question mix matching the target draft's type + difficulty
 * (so the regenerated question fills the same slot in the quiz structure).
 *
 * @param {{ type: string, difficulty: string }} draft
 * @returns {{ totalQuestions: number, mcqCount: number, trueFalseCount: number, easyCount: number, mediumCount: number, hardCount: number }}
 */
function buildSingleQuestionParams(draft) {
    const params = {
        totalQuestions: 1,
        mcqCount: 0,
        trueFalseCount: 0,
        easyCount: 0,
        mediumCount: 0,
        hardCount: 0
    };
    if (draft.type === "single") params.mcqCount = 1;
    else if (draft.type === "true_false") params.trueFalseCount = 1;
    if (draft.difficulty === "easy") params.easyCount = 1;
    else if (draft.difficulty === "medium") params.mediumCount = 1;
    else if (draft.difficulty === "hard") params.hardCount = 1;
    return params;
}

function humanizeFailureReason(error) {
    if (!error) return "Unknown error";
    if (error.code === "GEMINI_NOT_CONFIGURED") {
        return "AI provider is not configured. Contact an administrator.";
    }
    if (error.code === "GEMINI_QUOTA_EXCEEDED") {
        return "Gemini API quota exceeded. Check your API plan/billing or try again later.";
    }
    if (error.code === "GEMINI_UNAVAILABLE") {
        return "Gemini is temporarily overloaded. Please try again in a few minutes.";
    }
    if (error.code === "AI_MODEL_NOT_FOUND") {
        return "The configured Gemini model is unavailable. Set GEMINI_QUIZ_MODEL to gemini-2.5-flash in .env.";
    }
    if (error.code === "AI_GENERATION_FAILED") {
        return "The AI provider rejected the request or returned an invalid response.";
    }
    if (error.code === "EMPTY_DOCUMENT") {
        return "The document contains no extractable text.";
    }
    if (error.code === "DOCX_PARSE_FAILED") {
        return "Could not read the .docx file. It may be corrupt or password-protected.";
    }
    if (error.code === "SOURCE_TEXT_UNAVAILABLE") {
        return "The source text is no longer available. Please re-upload the document to regenerate.";
    }
    if (error.code === "MCQ_INVALID_STRUCTURE") {
        return "The regenerated MCQ did not pass structural validation. Try regenerating again.";
    }
    return error.message || "Generation failed.";
}
