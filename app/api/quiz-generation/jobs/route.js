import { NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { isAdmin, isAdminOrInstructor, assertInstructorOwnsCourse } from "@/lib/authorization";
import { dbConnect } from "@/service/mongo";
import { GenerationJob } from "@/model/generation-job-model";
import { Quiz } from "@/model/quizv2-model";
import { extractDocxText, computeContentHash } from "@/service/docx-extractor";
import { runGenerationJob, rememberExtractedText } from "@/service/generation-orchestrator";
import { verifyInstructorLessonAccess } from "@/lib/lesson-docx-access";
import {
    getAdminQuizConfig,
    getUserConsent,
    checkQuota,
    checkDuplicate
} from "@/queries/quiz-generation";
import { quizGenerationParamsSchema, mcqComplementParamsSchema } from "@/lib/validations";
import {
    AI_CONSENT_VERSION,
    DEFAULT_GENERATION_PARAMS,
    DEFAULT_MCQ_COMPLEMENT_PARAMS,
    DOCX_MIME_TYPE
} from "@/lib/constants";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DOCX_EXTENSION = ".docx";

/**
 * Coerce a multipart field value (string | File | null) into a number.
 * Returns `undefined` when the field is absent or not parseable.
 */
function toNumber(value) {
    if (value == null || value === "") return undefined;
    if (typeof value === "number") return value;
    const n = Number(String(value));
    return Number.isFinite(n) ? n : undefined;
}

function toObjectIdString(value) {
    if (!value) return null;
    const s = String(value);
    return mongoose.Types.ObjectId.isValid(s) ? s : null;
}

function getNumberField(formData, camelName, snakeName) {
    const camelValue = toNumber(formData.get(camelName));
    if (camelValue !== undefined) return camelValue;
    return toNumber(formData.get(snakeName));
}

/**
 * Build the effective generation params: defaults merged with caller-provided
 * counts, then validated against the strict Zod schema.
 *
 * @param {object} rawCounts - caller-provided counts (already stripped of undefined)
 * @param {number} [maxQuestions] - admin cap on totalQuestions
 * @param {boolean} [isMcqComplement] - when true, merge DEFAULT_MCQ_COMPLEMENT_PARAMS
 *   and validate against the stricter MCQ-only schema (trueFalseCount=0,
 *   mcqCount=totalQuestions).
 */
function buildParams(rawCounts, maxQuestions, isMcqComplement = false) {
    const defaults = isMcqComplement
        ? DEFAULT_MCQ_COMPLEMENT_PARAMS
        : DEFAULT_GENERATION_PARAMS;
    const merged = {
        ...defaults,
        ...rawCounts
    };
    // Clamp totalQuestions against admin max if the caller did not specify a
    // custom total but provided type counts that exceed the cap.
    if (maxQuestions && merged.totalQuestions > maxQuestions) {
        merged.totalQuestions = maxQuestions;
    }
    const schema = isMcqComplement ? mcqComplementParamsSchema : quizGenerationParamsSchema;
    const parsed = schema.safeParse(merged);
    return parsed.success ? { ok: true, params: parsed.data } : { ok: false, error: parsed.error };
}

function serializeGenerationJob(job, extra = {}) {
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
        failureReason: plain?.failureReason || null,
        isDuplicate: false,
        ...extra
    };
}

/**
 * POST /api/quiz-generation/jobs (contracts §2).
 *
 * Multipart/form-data: optional file (.docx), courseId, optional lessonId,
 * optional per-type/per-difficulty counts.
 *
 * When lessonId is provided and the lesson has stored extractedText, the file
 * upload is optional — quiz generation uses the lesson's uploaded lecture.
 */
export async function POST(request) {
    try {
        const user = await getLoggedInUser();
        if (!user) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        if (!isAdminOrInstructor(user)) {
            return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
        }

        let formData;
        try {
            formData = await request.formData();
        } catch {
            return NextResponse.json({ ok: false, error: "Expected multipart/form-data" }, { status: 400 });
        }

        const courseId = toObjectIdString(formData.get("courseId"));
        if (!courseId) {
            return NextResponse.json({ ok: false, error: "Invalid courseId" }, { status: 400 });
        }
        const lessonId = toObjectIdString(formData.get("lessonId"));

        const fileField = formData.get("file");
        const hasFile = fileField instanceof Blob || (fileField && typeof fileField.arrayBuffer === "function");

        // Course ownership (BOLA). Admin bypasses.
        if (!isAdmin(user)) {
            try {
                await assertInstructorOwnsCourse(courseId, user.id, { allowAdmin: false });
            } catch {
                return NextResponse.json({ ok: false, error: "You do not own this course." }, { status: 403 });
            }
        }

        let lessonExtractedText = null;
        let lessonSourceFilename = null;
        let lessonSourceByteSize = null;

        if (lessonId) {
            const access = await verifyInstructorLessonAccess(lessonId, user.id, user.role);
            if (!access.allowed) {
                const status = access.code === "FORBIDDEN" ? 403 : 404;
                return NextResponse.json({ ok: false, error: access.error }, { status });
            }
            if (access.course?._id?.toString() !== courseId) {
                return NextResponse.json(
                    { ok: false, error: "Lesson does not belong to this course." },
                    { status: 400 }
                );
            }
            const text = access.lesson?.extractedText?.trim();
            if (text) {
                lessonExtractedText = text;
                lessonSourceFilename = access.lesson.docxOriginalName || `${lessonId}.docx`;
                lessonSourceByteSize = access.lesson.docxSize || Buffer.byteLength(text, "utf8");
            }
        }

        if (!lessonExtractedText && !hasFile) {
            if (lessonId) {
                return NextResponse.json(
                    { ok: false, error: "Lecture content must be uploaded first." },
                    { status: 400 }
                );
            }
            return NextResponse.json({ ok: false, error: "Missing file upload" }, { status: 400 });
        }

        let filename = lessonSourceFilename || "upload.docx";
        let fileBuffer = null;

        if (!lessonExtractedText) {
            const file = fileField;
            filename = file.name || "upload.docx";
            const lowerName = filename.toLowerCase();
            const declaredType = file.type || "";
            const isDocxByName = lowerName.endsWith(DOCX_EXTENSION);
            const isDocxByMime = declaredType === DOCX_MIME_TYPE;
            if (!isDocxByName && !isDocxByMime) {
                return NextResponse.json({ ok: false, error: "Only .docx files are supported." }, { status: 400 });
            }

            fileBuffer = Buffer.from(await file.arrayBuffer());
            if (fileBuffer.byteLength === 0) {
                return NextResponse.json({ ok: false, error: "The uploaded file is empty." }, { status: 400 });
            }
        }

        const targetQuizId = toObjectIdString(formData.get("targetQuizId"));
        const isMcqComplement = Boolean(targetQuizId);

        // MCQ complement: validate the target quiz exists on this course and
        // is owned by the instructor (or admin). Done before the admin config
        // fetch so a 404/403 doesn't waste a config read.
        if (isMcqComplement) {
            await dbConnect();
            const targetQuiz = await Quiz.findById(targetQuizId).lean();
            if (!targetQuiz) {
                return NextResponse.json(
                    { ok: false, error: "The target quiz could not be found." },
                    { status: 404 }
                );
            }
            if (targetQuiz.courseId.toString() !== courseId) {
                return NextResponse.json(
                    { ok: false, error: "You do not own this quiz." },
                    { status: 403 }
                );
            }
            if (!isAdmin(user) && targetQuiz.createdBy?.toString?.() !== user.id) {
                return NextResponse.json(
                    { ok: false, error: "You do not own this quiz." },
                    { status: 403 }
                );
            }
            // Concurrent running complement job on the same quiz (data-model.md
            // §"Concurrent Request Detection", contracts §1 409 Conflict).
            const running = await GenerationJob.findOne({
                targetQuizId: new mongoose.Types.ObjectId(targetQuizId),
                status: { $in: ["queued", "running"] }
            })
                .sort({ createdAt: -1 })
                .lean();
            if (running) {
                return NextResponse.json(
                    {
                        ok: false,
                        error: "An MCQ complement job is already running for this quiz. Wait for it to finish before starting another."
                    },
                    { status: 409 }
                );
            }
        }

        // Admin config (size limit, quota, max questions).
        const config = await getAdminQuizConfig();

        if (fileBuffer && fileBuffer.byteLength > config.maxDocumentSizeBytes) {
            const maxMB = Math.round(config.maxDocumentSizeBytes / (1024 * 1024));
            return NextResponse.json(
                { ok: false, error: `File exceeds the maximum size of ${maxMB} MB.` },
                { status: 413 }
            );
        }

        const sourceByteSize = lessonSourceByteSize ?? fileBuffer?.byteLength ?? 0;

        // Consent check
        const consent = await getUserConsent(user.id, AI_CONSENT_VERSION);
        if (!consent.hasConsented) {
            return NextResponse.json(
                { ok: false, error: "You must acknowledge the AI processing consent before generating a quiz." },
                { status: 403 }
            );
        }

        // Build + validate params (do this before the quota check so a blocked
        // attempt's audit record can capture the requested params).
        const rawCounts = {
            totalQuestions: getNumberField(formData, "totalQuestions", "total_questions"),
            mcqCount: getNumberField(formData, "mcqCount", "mcq_count"),
            trueFalseCount: getNumberField(formData, "trueFalseCount", "tf_count"),
            easyCount: getNumberField(formData, "easyCount", "easy_count"),
            mediumCount: getNumberField(formData, "mediumCount", "medium_count"),
            hardCount: getNumberField(formData, "hardCount", "hard_count")
        };
        // Drop undefined keys so the merge with defaults works cleanly.
        Object.keys(rawCounts).forEach((k) => rawCounts[k] === undefined && delete rawCounts[k]);
        const paramsResult = buildParams(rawCounts, config.maxQuestionsPerGeneration, isMcqComplement);
        if (!paramsResult.ok) {
            return NextResponse.json(
                { ok: false, error: "Type counts must sum to the total. Difficulty counts must sum to the total." },
                { status: 400 }
            );
        }

        // Quota check
        const quota = await checkQuota(user.id, config.dailyQuotaPerInstructor);
        if (!quota.allowed) {
            // Record the blocked attempt in the audit log (FR-013, spec US3
            // acceptance scenario 1). The record is excluded from the quota
            // count itself (see checkQuota) so it doesn't cascade.
            try {
                await dbConnect();
                await GenerationJob.create({
                    userId: new mongoose.Types.ObjectId(user.id),
                    courseId: new mongoose.Types.ObjectId(courseId),
                    lessonId: lessonId ? new mongoose.Types.ObjectId(lessonId) : null,
                    targetQuizId: targetQuizId ? new mongoose.Types.ObjectId(targetQuizId) : null,
                    jobType: isMcqComplement ? "mcq_complement" : "full_quiz",
                    status: "failed",
                    failureReason: "quota_exceeded",
                    sourceFilename: filename,
                    sourceByteSize: sourceByteSize,
                    sourceContentHash: null,
                    params: paramsResult.params,
                    consentVersion: AI_CONSENT_VERSION
                });
            } catch (auditError) {
                console.warn("[QUIZ_GENERATION_JOBS_POST] failed to log quota-blocked audit:", auditError?.message);
            }
            return NextResponse.json(
                {
                    ok: false,
                    error: `Daily generation limit reached. Try again after ${quota.retryAfter}.`,
                    retryAfter: quota.retryAfter
                },
                { status: 429 }
            );
        }

        // Resolve source text from lesson store or uploaded .docx.
        let extraction;
        const fromLessonStoredText = Boolean(lessonExtractedText);
        if (lessonExtractedText) {
            extraction = { text: lessonExtractedText, warnings: [] };
        } else {
            try {
                extraction = await extractDocxText(fileBuffer);
            } catch (error) {
                return NextResponse.json(
                    { ok: false, error: error?.message || "Could not read the .docx file." },
                    { status: 400 }
                );
            }
        }
        if (!extraction.text || !extraction.text.trim()) {
            return NextResponse.json(
                { ok: false, error: "The document contains no extractable text. Try a document with at least a few paragraphs of text." },
                { status: 400 }
            );
        }

        const contentHash = computeContentHash(extraction.text);

        // Duplicate check (courseId + hash with prior succeeded job). Skipped
        // for MCQ complement jobs: an instructor may legitimately upload the
        // same source document multiple times to complement different quizzes
        // (or the same quiz after a prior append). The complement draft is
        // specific to the target quiz's existing stems, so prior drafts are
        // not reusable.
        if (!isMcqComplement) {
            const dup = await checkDuplicate(courseId, contentHash, paramsResult.params);
            if (dup.isDuplicate) {
                const duplicateJob = await GenerationJob.findById(dup.existingJobId).lean();
                return NextResponse.json(
                    serializeGenerationJob(duplicateJob, {
                        isDuplicate: true,
                        message: "This document was previously processed for this course."
                    }),
                    { status: 200 }
                );
            }
        }

        await dbConnect();
        const job = await GenerationJob.create({
            userId: new mongoose.Types.ObjectId(user.id),
            courseId: new mongoose.Types.ObjectId(courseId),
            lessonId: lessonId ? new mongoose.Types.ObjectId(lessonId) : null,
            targetQuizId: targetQuizId ? new mongoose.Types.ObjectId(targetQuizId) : null,
            jobType: isMcqComplement ? "mcq_complement" : "full_quiz",
            status: "queued",
            sourceFilename: filename,
            sourceByteSize: sourceByteSize,
            sourceContentHash: contentHash,
            extractionWarnings: extraction.warnings,
            params: paramsResult.params,
            consentVersion: AI_CONSENT_VERSION
        });

        rememberExtractedText(job._id.toString(), extraction.text);

        const generationResult = await runGenerationJob(job._id.toString(), {
            extractedText: extraction.text,
            fromLessonStoredText
        });

        const completedJob = await GenerationJob.findById(job._id).lean();
        if (!generationResult.ok || completedJob?.status === "failed") {
            console.error("[QUIZ_GENERATION_JOBS_POST] Generation failed:", {
                jobId: job._id.toString(),
                status: completedJob?.status,
                failureReason: completedJob?.failureReason || generationResult.failureReason
            });
            return NextResponse.json(
                serializeGenerationJob(completedJob, {
                    ok: false,
                    error: completedJob?.failureReason || generationResult.failureReason || "Generation failed."
                }),
                { status: 500 }
            );
        }

        return NextResponse.json(serializeGenerationJob(completedJob), { status: 200 });
    } catch (error) {
        console.error("[QUIZ_GENERATION_JOBS_POST] Error:", error);
        return NextResponse.json(
            { ok: false, error: error?.message || "Failed to start generation job" },
            { status: 500 }
        );
    }
}
