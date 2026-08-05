import mongoose from "mongoose";
import { dbConnect } from "@/service/mongo";
import { TutorInteraction } from "@/model/tutor-interaction-model";
import { TutorConfiguration } from "@/model/tutor-config-model";
import { TutorReport } from "@/model/tutor-report-model";
import { replaceMongoIdInObject, replaceMongoIdInArray } from "@/lib/convertData";
import { DEFAULT_TUTOR_CONFIG } from "@/lib/constants";

function toObjectId(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    return new mongoose.Types.ObjectId(id);
}

/**
 * Create a new tutor interaction record.
 *
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function createTutorInteraction(data) {
    await dbConnect();
    const interaction = await TutorInteraction.create(data);
    return replaceMongoIdInObject(interaction.toObject());
}

/**
 * Find a tutor interaction by ID.
 * @param {string} interactionId
 */
export async function getTutorInteraction(interactionId) {
    const oid = toObjectId(interactionId);
    if (!oid) return null;

    await dbConnect();
    const interaction = await TutorInteraction.findById(oid).lean();
    return replaceMongoIdInObject(interaction);
}

/**
 * Load a student's own interaction when it belongs to the given lesson.
 *
 * @param {string} interactionId
 * @param {string} studentId
 * @param {string} lessonId
 */
export async function getStudentLessonInteraction(interactionId, studentId, lessonId) {
    const interactionOid = toObjectId(interactionId);
    const studentOid = toObjectId(studentId);
    const lessonOid = toObjectId(lessonId);
    if (!interactionOid || !studentOid || !lessonOid) return null;

    await dbConnect();
    const interaction = await TutorInteraction.findOne({
        _id: interactionOid,
        studentId: studentOid,
        lessonId: lessonOid
    }).lean();

    return replaceMongoIdInObject(interaction);
}

/**
 * Recent tutor interactions for a student on a lesson, oldest first.
 *
 * @param {string} studentId
 * @param {string} lessonId
 * @param {number} [limit]
 */
export async function getRecentLessonTutorInteractions(studentId, lessonId, limit = 4) {
    const studentOid = toObjectId(studentId);
    const lessonOid = toObjectId(lessonId);
    if (!studentOid || !lessonOid) return [];

    await dbConnect();
    const safeLimit = Math.min(10, Math.max(1, limit));
    const interactions = await TutorInteraction.find({
        studentId: studentOid,
        lessonId: lessonOid
    })
        .sort({ createdAt: -1 })
        .limit(safeLimit)
        .lean();

    return replaceMongoIdInArray(interactions.reverse());
}

/**
 * Most recent answered interaction for a student on a lesson.
 *
 * @param {string} studentId
 * @param {string} lessonId
 */
export async function getLastAnsweredTutorInteraction(studentId, lessonId) {
    const studentOid = toObjectId(studentId);
    const lessonOid = toObjectId(lessonId);
    if (!studentOid || !lessonOid) return null;

    await dbConnect();
    const interaction = await TutorInteraction.findOne({
        studentId: studentOid,
        lessonId: lessonOid,
        contextStatus: "answered"
    })
        .sort({ createdAt: -1 })
        .lean();

    return replaceMongoIdInObject(interaction);
}

/**
 * Update feedback on an interaction.
 *
 * @param {string} interactionId
 * @param {"helpful" | "not_helpful"} feedback
 */
export async function updateTutorInteractionFeedback(interactionId, feedback) {
    const oid = toObjectId(interactionId);
    if (!oid) return null;

    await dbConnect();
    const interaction = await TutorInteraction.findByIdAndUpdate(
        oid,
        { $set: { feedback } },
        { new: true }
    ).lean();

    return replaceMongoIdInObject(interaction);
}

/**
 * Count interactions by a student in a course within the last hour (rate limiting).
 *
 * @param {string} studentId
 * @param {string} courseId
 */
export async function countRecentInteractions(studentId, courseId) {
    const studentOid = toObjectId(studentId);
    const courseOid = toObjectId(courseId);
    if (!studentOid || !courseOid) return 0;

    await dbConnect();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    return TutorInteraction.countDocuments({
        studentId: studentOid,
        courseId: courseOid,
        createdAt: { $gte: oneHourAgo }
    });
}

/**
 * Paginated interaction history with optional filters.
 *
 * @param {object} params
 * @param {string} params.courseId
 * @param {string} [params.studentId] - When set, scope to this student only
 * @param {string} [params.lessonId]
 * @param {string} [params.contextStatus]
 * @param {Date | string} [params.dateFrom]
 * @param {Date | string} [params.dateTo]
 * @param {number} [params.page]
 * @param {number} [params.limit]
 */
export async function getTutorInteractions({
    courseId,
    studentId = null,
    lessonId = null,
    contextStatus = null,
    dateFrom = null,
    dateTo = null,
    page = 1,
    limit = 20
}) {
    const courseOid = toObjectId(courseId);
    if (!courseOid) {
        return { interactions: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }

    await dbConnect();

    const filter = { courseId: courseOid };

    const studentOid = toObjectId(studentId);
    if (studentOid) filter.studentId = studentOid;

    const lessonOid = toObjectId(lessonId);
    if (lessonOid) filter.lessonId = lessonOid;

    if (contextStatus) filter.contextStatus = contextStatus;

    if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) {
            filter.createdAt.$gte = new Date(dateFrom);
        }
        if (dateTo) {
            const end = new Date(dateTo);
            end.setHours(23, 59, 59, 999);
            filter.createdAt.$lte = end;
        }
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [interactions, total] = await Promise.all([
        TutorInteraction.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(safeLimit)
            .populate("lessonId", "title")
            .populate("studentId", "firstName lastName email")
            .lean(),
        TutorInteraction.countDocuments(filter)
    ]);

    const mapped = interactions.map((row) => {
        const plain = replaceMongoIdInObject(row);
        const lesson = row.lessonId;
        const student = row.studentId;

        if (lesson && typeof lesson === "object") {
            plain.lessonTitle = lesson.title;
            plain.lessonId = lesson._id?.toString() ?? plain.lessonId;
        }

        if (student && typeof student === "object") {
            plain.studentName = [student.firstName, student.lastName]
                .filter(Boolean)
                .join(" ")
                .trim();
            plain.studentEmail = student.email;
            plain.studentId = student._id?.toString() ?? plain.studentId;
        }

        return plain;
    });

    return {
        interactions: replaceMongoIdInArray(mapped),
        pagination: {
            page: safePage,
            limit: safeLimit,
            total,
            totalPages: Math.ceil(total / safeLimit) || 0
        }
    };
}

/**
 * Instructor/admin view: all student interactions for a course (no student scope).
 *
 * @param {object} params
 */
export async function getInstructorTutorInteractions(params) {
    return getTutorInteractions({ ...params, studentId: null });
}

/**
 * Student view: interactions scoped to the enrolled student for a course.
 *
 * @param {object} params
 * @param {string} params.studentId
 * @param {string} params.courseId
 */
export async function getStudentTutorInteractions({ studentId, courseId, ...filters }) {
    return getTutorInteractions({ ...filters, courseId, studentId });
}

/**
 * Resolve tutor configuration: course-specific → global → defaults.
 *
 * @param {string | null} [courseId]
 */
export async function resolveTutorConfig(courseId = null) {
    await dbConnect();

    const courseOid = toObjectId(courseId);
    let config = null;

    if (courseOid) {
        config = await TutorConfiguration.findOne({ courseId: courseOid }).lean();
    }

    if (!config) {
        config = await TutorConfiguration.findOne({ courseId: null }).lean();
    }

    if (!config) {
        return { ...DEFAULT_TUTOR_CONFIG, courseId: courseId ?? null };
    }

    const plain = replaceMongoIdInObject(config);
    return {
        courseId: plain.courseId ?? null,
        outOfContextMessage: plain.outOfContextMessage,
        enabled: plain.enabled,
        rateLimitPerHour: plain.rateLimitPerHour,
        relevanceThreshold: plain.relevanceThreshold,
        maxContextChunks: plain.maxContextChunks,
        updatedAt: plain.updatedAt,
        updatedBy: plain.updatedBy ?? null
    };
}

/**
 * Admin view of tutor config with populated updatedBy metadata.
 *
 * @param {string | null | undefined} [courseId]
 */
export async function getAdminTutorConfig(courseId = null) {
    const resolved = await resolveTutorConfig(courseId);
    await dbConnect();

    const courseOid = toObjectId(courseId);
    let doc = null;

    if (courseOid) {
        doc = await TutorConfiguration.findOne({ courseId: courseOid })
            .populate("updatedBy", "firstName lastName")
            .lean();
    }

    if (!doc) {
        doc = await TutorConfiguration.findOne({ courseId: null })
            .populate("updatedBy", "firstName lastName")
            .lean();
    }

    const updatedByUser = doc?.updatedBy;
    const updatedBy =
        updatedByUser && typeof updatedByUser === "object"
            ? {
                  id: updatedByUser._id?.toString(),
                  name: [updatedByUser.firstName, updatedByUser.lastName]
                      .filter(Boolean)
                      .join(" ")
                      .trim()
              }
            : null;

    return {
        courseId: resolved.courseId,
        outOfContextMessage: resolved.outOfContextMessage,
        enabled: resolved.enabled,
        rateLimitPerHour: resolved.rateLimitPerHour,
        relevanceThreshold: resolved.relevanceThreshold,
        maxContextChunks: resolved.maxContextChunks,
        updatedAt: doc?.updatedAt
            ? new Date(doc.updatedAt).toISOString()
            : resolved.updatedAt
              ? new Date(resolved.updatedAt).toISOString()
              : null,
        updatedBy
    };
}

/**
 * Upsert tutor configuration (admin).
 *
 * @param {object} params
 * @param {string | null} params.courseId
 * @param {object} params.updates
 * @param {string} params.updatedBy
 */
export async function upsertTutorConfig({ courseId = null, updates, updatedBy }) {
    await dbConnect();

    const filter = { courseId: toObjectId(courseId) ?? null };
    const $set = { ...updates, updatedBy: toObjectId(updatedBy), updatedAt: new Date() };

    const config = await TutorConfiguration.findOneAndUpdate(
        filter,
        { $set },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return replaceMongoIdInObject(config);
}

/**
 * Create an issue report for a tutor interaction.
 *
 * @param {object} data
 * @param {string} data.interactionId
 * @param {string} data.studentId
 * @param {"incorrect" | "inappropriate" | "other"} data.reason
 * @param {string | null | undefined} [data.details]
 */
export async function createTutorReport({ interactionId, studentId, reason, details = null }) {
    const interactionOid = toObjectId(interactionId);
    const studentOid = toObjectId(studentId);
    if (!interactionOid || !studentOid) return null;

    await dbConnect();
    const report = await TutorReport.create({
        interactionId: interactionOid,
        studentId: studentOid,
        reason,
        details: details?.trim() || null
    });

    return replaceMongoIdInObject(report.toObject());
}

/**
 * Find an existing report for an interaction by a student.
 *
 * @param {string} interactionId
 * @param {string} studentId
 */
export async function getTutorReportForInteraction(interactionId, studentId) {
    const interactionOid = toObjectId(interactionId);
    const studentOid = toObjectId(studentId);
    if (!interactionOid || !studentOid) return null;

    await dbConnect();
    const report = await TutorReport.findOne({
        interactionId: interactionOid,
        studentId: studentOid
    }).lean();

    return replaceMongoIdInObject(report);
}
