import { dbConnect } from "@/service/mongo";
import { GenerationJob } from "@/model/generation-job-model";
import { AIProcessingConsent } from "@/model/ai-consent-model";
import { AdminQuizConfig } from "@/model/admin-quiz-config-model";
import { AI_CONSENT_VERSION, DEFAULT_ADMIN_QUIZ_CONFIG } from "@/lib/constants";
import { Question } from "@/model/questionv2-model";
import mongoose from "mongoose";

/**
 * Get a single GenerationJob by id (lean). Returns null if not found or the id
 * is not a valid ObjectId.
 */
export async function getGenerationJob(jobId) {
    if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) return null;
    await dbConnect();
    const job = await GenerationJob.findById(jobId).lean();
    return job ? JSON.parse(JSON.stringify(job)) : null;
}

/**
 * List GenerationJobs for a user, newest first. Used for history / audit views.
 */
export async function getGenerationJobs({ userId, page = 1, limit = 20 } = {}) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return [];
    await dbConnect();
    const skip = Math.max(0, (page - 1) * limit);
    const jobs = await GenerationJob.find({ userId: new mongoose.Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
    return JSON.parse(JSON.stringify(jobs));
}

/**
 * Count today's successful/attempted generations for a user (quota enforcement,
 * data-model.md §1 index { userId: 1, createdAt: -1 }). We count all jobs
 * created today regardless of status — a failed attempt still consumes the
 * daily slot per the spec's quota semantics. The one exception is a
 * `quota_exceeded` audit record: those record the fact that an upload was
 * blocked by this very check, so counting them would make a single blocked
 * attempt cascade into a permanent block. They are excluded from the count.
 */
export async function checkQuota(userId, dailyQuotaPerInstructor) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return { allowed: false, used: 0, limit: dailyQuotaPerInstructor, retryAfter: null };
    }
    await dbConnect();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const used = await GenerationJob.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: start, $lte: end },
        failureReason: { $ne: "quota_exceeded" }
    });
    const allowed = used < dailyQuotaPerInstructor;
    return {
        allowed,
        used,
        limit: dailyQuotaPerInstructor,
        // Quota resets at the start of the next day (server-local time).
        retryAfter: allowed ? null : new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString()
    };
}

/**
 * Look for a prior succeeded GenerationJob for the same course + content hash.
 * Used for the duplicate-upload detection (contracts §2 step 8).
 *
 * @param {string} sourceContentHash
 * @param {{ totalQuestions?: number, mcqCount?: number, trueFalseCount?: number } | null} [params]
 *   When provided, a prior job is only considered a duplicate when its stored
 *   params match — re-uploading the same document with a different question
 *   count must trigger fresh generation.
 * @returns {{ isDuplicate: boolean, existingJobId: string|null }}
 */
export async function checkDuplicate(courseId, sourceContentHash, params = null) {
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
        return { isDuplicate: false, existingJobId: null };
    }
    if (!sourceContentHash) return { isDuplicate: false, existingJobId: null };
    await dbConnect();
    const existing = await GenerationJob.findOne({
        courseId: new mongoose.Types.ObjectId(courseId),
        sourceContentHash,
        status: "succeeded"
    })
        .sort({ createdAt: -1 })
        .lean();
    if (!existing) return { isDuplicate: false, existingJobId: null };

    if (params && existing.params) {
        const sameMix =
            existing.params.totalQuestions === params.totalQuestions &&
            existing.params.mcqCount === params.mcqCount &&
            existing.params.trueFalseCount === params.trueFalseCount;
        if (!sameMix) {
            return { isDuplicate: false, existingJobId: null };
        }
    }

    return { isDuplicate: true, existingJobId: existing._id.toString() };
}

/**
 * Check whether the user has acknowledged the current consent version.
 */
export async function getUserConsent(userId, consentVersion = AI_CONSENT_VERSION) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return { hasConsented: false, consentVersion };
    }
    await dbConnect();
    const record = await AIProcessingConsent.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        consentVersion
    }).lean();
    return {
        hasConsented: !!record,
        consentVersion,
        acknowledgedAt: record?.acknowledgedAt ?? null
    };
}

/**
 * Record the user's acknowledgement of the current consent version. Idempotent
 * via the unique compound index { userId: 1, consentVersion: 1 }.
 */
export async function acknowledgeConsent(userId, consentVersion = AI_CONSENT_VERSION, userAgent = null) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("Invalid user id");
    }
    await dbConnect();
    await AIProcessingConsent.findOneAndUpdate(
        {
            userId: new mongoose.Types.ObjectId(userId),
            consentVersion
        },
        {
            $setOnInsert: { acknowledgedAt: new Date(), userAgent }
        },
        { upsert: true }
    );
    return { acknowledged: true, consentVersion };
}

/**
 * Get the question text (stems) for all questions on a quiz, used by the
 * MCQ complement flow for duplicate detection
 * (specs/002-ai-mcq-complement/contracts/mcq-complement-api.md §7).
 *
 * Uses the existing { quizId: 1, type: 1 } index with a { text: 1, _id: 0 }
 * projection. Typical quiz has ≤ 30 questions — single indexed query.
 *
 * @param {string} quizId
 * @returns {Promise<string[]>} array of question text values
 */
export async function getExistingQuestionStems(quizId) {
    if (!quizId || !mongoose.Types.ObjectId.isValid(quizId)) return [];
    await dbConnect();
    const docs = await Question.find(
        { quizId: new mongoose.Types.ObjectId(quizId) },
        { text: 1, _id: 0 }
    ).lean();
    return docs.map((d) => d.text).filter(Boolean);
}

/**
 * Read the AdminQuizConfig singleton, falling back to defaults if no document
 * has been created yet. Always returns a plain object (no mongoose doc).
 */
export async function getAdminQuizConfig() {
    await dbConnect();
    const cfg = await AdminQuizConfig.findOne({}).lean();
    if (!cfg) {
        return { ...DEFAULT_ADMIN_QUIZ_CONFIG, updatedBy: null };
    }
    return JSON.parse(JSON.stringify(cfg));
}

/**
 * List GenerationJobs across the platform for the admin audit view
 * (FR-013, quickstart §5). Optional filters: status, courseId, userId.
 * Returns plain objects with the audit fields the admin UI needs.
 */
export async function getAdminGenerationJobs({
    status,
    courseId,
    userId,
    page = 1,
    limit = 20
} = {}) {
    await dbConnect();
    const filter = {};
    if (status) filter.status = status;
    if (courseId && mongoose.Types.ObjectId.isValid(courseId)) {
        filter.courseId = new mongoose.Types.ObjectId(courseId);
    }
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        filter.userId = new mongoose.Types.ObjectId(userId);
    }
    const skip = Math.max(0, (page - 1) * limit);
    const [total, jobs] = await Promise.all([
        GenerationJob.countDocuments(filter),
        GenerationJob.find(filter)
            .populate("userId", "firstName lastName email")
            .populate("courseId", "title")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean()
    ]);
    const items = jobs.map((j) => {
        const plain = JSON.parse(JSON.stringify(j));
        const user = j.userId && typeof j.userId === "object"
            ? {
                id: j.userId._id?.toString?.(),
                name: [j.userId.firstName, j.userId.lastName].filter(Boolean).join(" ") || j.userId.email,
                email: j.userId.email
            }
            : { id: plain.userId };
        const course = j.courseId && typeof j.courseId === "object"
            ? { id: j.courseId._id?.toString?.(), title: j.courseId.title }
            : { id: plain.courseId };
        return {
            id: plain.id,
            status: plain.status,
            failureReason: plain.failureReason,
            sourceFilename: plain.sourceFilename,
            sourceByteSize: plain.sourceByteSize,
            sourceContentHash: plain.sourceContentHash,
            params: plain.params,
            aiProvider: plain.aiProvider,
            aiModel: plain.aiModel,
            consentVersion: plain.consentVersion,
            createdAt: plain.createdAt,
            completedAt: plain.completedAt,
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            courseId: course.id,
            courseTitle: course.title
        };
    });
    return { items, total, page, limit };
}
