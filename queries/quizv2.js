import { dbConnect } from "@/service/mongo";
import { Quiz } from "@/model/quizv2-model";
import { Question } from "@/model/questionv2-model";
import { Attempt } from "@/model/attemptv2-model";
import { replaceMongoIdInArray, replaceMongoIdInObject } from "@/lib/convertData";
import mongoose from "mongoose";

/**
 * Get all quizzes for a course
 */
export async function getCourseQuizzes(courseId, options = {}) {
    await dbConnect();
    try {
        const { forStudent = false, includeUnpublished = false } = options;
        
        const query = { courseId: new mongoose.Types.ObjectId(courseId) };
        
        if (forStudent && !includeUnpublished) {
            query.published = true;
        }
        
        const quizzes = await Quiz.find(query)
            .sort({ createdAt: -1 })
            .lean();
        
        return replaceMongoIdInArray(quizzes || []);
    } catch (error) {
        console.error("[GET_COURSE_QUIZZES] Error:", error);
        return [];
    }
}

/**
 * Get quiz for a specific lesson
 */
export async function getLessonQuiz(lessonId, options = {}) {
    await dbConnect();
    try {
        const { forStudent = false } = options;
        
        const query = { lessonId: new mongoose.Types.ObjectId(lessonId) };
        
        if (forStudent) {
            query.published = true;
        }
        
        const quiz = await Quiz.findOne(query).lean();
        
        return quiz ? replaceMongoIdInObject(quiz) : null;
    } catch (error) {
        console.error("[GET_LESSON_QUIZ] Error:", error);
        return null;
    }
}

/**
 * Get quiz with all questions
 */
export async function getQuizWithQuestions(quizId) {
    await dbConnect();
    try {
        const quiz = await Quiz.findById(quizId).lean();
        if (!quiz) return null;
        
        const questions = await Question.find({ quizId: new mongoose.Types.ObjectId(quizId) })
            .sort({ order: 1 })
            .lean();
        
        const quizObj = replaceMongoIdInObject(quiz);
        quizObj.questions = replaceMongoIdInArray(questions || []);
        
        return quizObj;
    } catch (error) {
        console.error("[GET_QUIZ_WITH_QUESTIONS] Error:", error);
        return null;
    }
}

/**
 * Get student's quiz status map for a course
 * Returns: { [quizId]: { status, passed, attemptsUsed, inProgressAttemptId, lastScore } }
 */
export async function getStudentQuizStatusMap(courseId, studentId) {
    await dbConnect();
    try {
        const quizzes = await getCourseQuizzes(courseId, { includeUnpublished: false });
        
        const quizIds = quizzes.map(q => new mongoose.Types.ObjectId(q.id));
        
        // Get all attempts for these quizzes by this student
        const attempts = await Attempt.find({
            quizId: { $in: quizIds },
            studentId: new mongoose.Types.ObjectId(studentId)
        })
            .sort({ submittedAt: -1, createdAt: -1 })
            .lean();
        
        const statusMap = {};
        
        for (const quiz of quizzes) {
            // Match attempts by quizId (handle both ObjectId and string)
            const quizIdStr = quiz.id || quiz._id?.toString();
            const quizAttempts = attempts.filter(a => {
                const attemptQuizId = a.quizId?.toString() || a.quizId;
                return attemptQuizId === quizIdStr;
            });
            const submittedAttempts = quizAttempts.filter(a => a.status === "submitted");
            const inProgress = quizAttempts.find(a => a.status === "in_progress");
            const latestSubmitted = submittedAttempts[0];
            
            statusMap[quizIdStr] = {
                status: inProgress ? "in_progress" : (latestSubmitted ? "submitted" : "not_started"),
                passed: latestSubmitted ? latestSubmitted.passed : false,
                attemptsUsed: submittedAttempts.length,
                inProgressAttemptId: inProgress ? (inProgress.id ?? inProgress._id?.toString?.()) : null,
                latestAttemptId: latestSubmitted ? (latestSubmitted.id ?? latestSubmitted._id?.toString?.()) : (inProgress ? (inProgress.id ?? inProgress._id?.toString?.()) : null),
                lastScore: latestSubmitted ? latestSubmitted.scorePercent : null
            };
        }
        
        return statusMap;
    } catch (error) {
        console.error("[GET_STUDENT_QUIZ_STATUS_MAP] Error:", error);
        return {};
    }
}

/**
 * Get attempts for a quiz (instructor/admin)
 */
export async function getAttemptsForQuiz(quizId) {
    await dbConnect();
    try {
        const attempts = await Attempt.find({ quizId: new mongoose.Types.ObjectId(quizId) })
            .populate("studentId", "firstName lastName email")
            .sort({ submittedAt: -1, createdAt: -1 })
            .lean();
        
        return replaceMongoIdInArray(attempts || []);
    } catch (error) {
        console.error("[GET_ATTEMPTS_FOR_QUIZ] Error:", error);
        return [];
    }
}

/**
 * Get latest attempt for a student and quiz
 */
export async function getLatestStudentAttempt(quizId, studentId) {
    await dbConnect();
    try {
        const attempt = await Attempt.findOne({
            quizId: new mongoose.Types.ObjectId(quizId),
            studentId: new mongoose.Types.ObjectId(studentId)
        })
            .sort({ createdAt: -1 })
            .lean();
        
        return attempt ? replaceMongoIdInObject(attempt) : null;
    } catch (error) {
        console.error("[GET_LATEST_STUDENT_ATTEMPT] Error:", error);
        return null;
    }
}

/**
 * Get in-progress attempt
 */
export async function getInProgressAttempt(quizId, studentId) {
    await dbConnect();
    try {
        const attempt = await Attempt.findOne({
            quizId: new mongoose.Types.ObjectId(quizId),
            studentId: new mongoose.Types.ObjectId(studentId),
            status: "in_progress"
        }).lean();
        
        return attempt ? replaceMongoIdInObject(attempt) : null;
    } catch (error) {
        console.error("[GET_IN_PROGRESS_ATTEMPT] Error:", error);
        return null;
    }
}

/**
 * Get attempt by ID with ownership check helper
 */
export async function getAttemptById(attemptId) {
    await dbConnect();
    try {
        const attempt = await Attempt.findById(attemptId)
            .populate("quizId")
            .populate("studentId", "firstName lastName email")
            .lean();
        
        return attempt ? replaceMongoIdInObject(attempt) : null;
    } catch (error) {
        console.error("[GET_ATTEMPT_BY_ID] Error:", error);
        return null;
    }
}

/**
 * Fetch attempts awaiting grading, scoped by role (FR-020, contracts §8).
 *
 * - Instructor: filtered to quizzes they own (via Quiz.courseId -> Course.instructor).
 *   Optional `courseId`/`quizId` further narrow the scope.
 * - Admin: all pending_grading attempts; optional filters by course/quiz/instructor.
 *
 * Returns a paginated result: { items, total, page, limit }.
 */
export async function getPendingGradingAttempts({
    userId,
    role,
    courseId,
    quizId,
    instructorId,
    page = 1,
    limit = 20
} = {}) {
    await dbConnect();
    try {
        const filter = { status: "pending_grading" };

        // Resolve the set of quizIds the caller is allowed to see.
        let scopedQuizIds = null;
        if (role === "instructor") {
            const Quiz = (await import("@/model/quizv2-model")).Quiz;
            const Course = (await import("@/model/course-model")).Course;
            // Find courses owned by this instructor
            let courseFilter = { instructor: new mongoose.Types.ObjectId(userId) };
            if (courseId) {
                courseFilter._id = new mongoose.Types.ObjectId(courseId);
            }
            const courses = await Course.find(courseFilter).select("_id").lean();
            const courseIds = courses.map((c) => c._id);
            const quizFilter = { courseId: { $in: courseIds } };
            if (quizId) quizFilter._id = new mongoose.Types.ObjectId(quizId);
            const quizzes = await Quiz.find(quizFilter).select("_id").lean();
            scopedQuizIds = quizzes.map((q) => q._id);
            filter.quizId = { $in: scopedQuizIds };
        } else if (role === "admin") {
            if (quizId) filter.quizId = new mongoose.Types.ObjectId(quizId);
            if (courseId || instructorId) {
                const Quiz = (await import("@/model/quizv2-model")).Quiz;
                const Course = (await import("@/model/course-model")).Course;
                let courseFilter = {};
                if (courseId) courseFilter._id = new mongoose.Types.ObjectId(courseId);
                if (instructorId) courseFilter.instructor = new mongoose.Types.ObjectId(instructorId);
                const courses = await Course.find(courseFilter).select("_id").lean();
                const courseIds = courses.map((c) => c._id);
                const quizzes = await Quiz.find({ courseId: { $in: courseIds } }).select("_id").lean();
                filter.quizId = { $in: quizzes.map((q) => q._id) };
            }
        } else {
            // Students / other roles get nothing.
            return { items: [], total: 0, page, limit };
        }

        const skip = Math.max(0, (page - 1) * limit);
        const [total, attempts] = await Promise.all([
            Attempt.countDocuments(filter),
            Attempt.find(filter)
                .populate({
                    path: "quizId",
                    select: "title courseId",
                    populate: {
                        path: "courseId",
                        select: "title instructor",
                        populate: {
                            path: "instructor",
                            select: "firstName lastName email"
                        }
                    }
                })
                .populate("studentId", "firstName lastName email")
                .sort({ submittedAt: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        const items = attempts.map((a) => {
            const plain = replaceMongoIdInObject(a);
            const quiz = a.quizId && typeof a.quizId === "object"
                ? { id: a.quizId._id?.toString?.() || plain.quizId, title: a.quizId.title, courseId: a.quizId.courseId?._id?.toString?.() || a.quizId.courseId?.toString?.() }
                : { id: plain.quizId, title: null, courseId: null };
            const course = quiz.courseId && a.quizId?.courseId && typeof a.quizId.courseId === "object"
                ? {
                    id: a.quizId.courseId._id?.toString?.() || quiz.courseId,
                    title: a.quizId.courseId.title,
                    instructorId: a.quizId.courseId.instructor?._id?.toString?.() || a.quizId.courseId.instructor?.toString?.()
                }
                : { id: quiz.courseId, title: null, instructorId: null };
            const instructor = course.instructorId && a.quizId?.courseId?.instructor && typeof a.quizId.courseId.instructor === "object"
                ? {
                    id: a.quizId.courseId.instructor._id?.toString?.() || course.instructorId,
                    name: [a.quizId.courseId.instructor.firstName, a.quizId.courseId.instructor.lastName].filter(Boolean).join(" ") || a.quizId.courseId.instructor.email,
                    email: a.quizId.courseId.instructor.email
                }
                : { id: course.instructorId, name: null, email: null };
            const student = a.studentId && typeof a.studentId === "object"
                ? {
                    id: a.studentId._id?.toString?.() || plain.studentId,
                    firstName: a.studentId.firstName,
                    lastName: a.studentId.lastName,
                    email: a.studentId.email
                }
                : { id: plain.studentId };
            return {
                id: plain.id,
                quizId: quiz.id,
                quizTitle: quiz.title,
                courseId: course.id,
                courseTitle: course.title,
                instructorId: instructor.id,
                instructorName: instructor.name,
                instructorEmail: instructor.email,
                studentId: student.id,
                studentName: [student.firstName, student.lastName].filter(Boolean).join(" ") || student.email,
                studentEmail: student.email,
                submittedAt: plain.submittedAt,
                pendingGradingCount: plain.pendingGradingCount,
                hasShortAnswers: plain.hasShortAnswers,
                answers: plain.answers
            };
        });

        return { items, total, page, limit };
    } catch (error) {
        console.error("[GET_PENDING_GRADING_ATTEMPTS] Error:", error);
        return { items: [], total: 0, page, limit };
    }
}

/**
 * Badge counts for the instructor dashboard / sidebar (FR-019, contracts §9).
 *
 * - Instructor: count of pending_grading attempts across their quizzes,
 *   plus a per-quiz breakdown for the quiz-list badge.
 * - Admin: total across all quizzes (no per-quiz breakdown returned by default).
 *
 * Returns { total, byQuiz: [{ quizId, quizTitle, count }] }.
 */
export async function getPendingGradingCount(userId, role) {
    await dbConnect();
    try {
        if (role === "instructor") {
            const Quiz = (await import("@/model/quizv2-model")).Quiz;
            const Course = (await import("@/model/course-model")).Course;
            const courses = await Course.find({ instructor: new mongoose.Types.ObjectId(userId) })
                .select("_id")
                .lean();
            const courseIds = courses.map((c) => c._id);
            const quizzes = await Quiz.find({ courseId: { $in: courseIds } })
                .select("_id title")
                .lean();
            const quizIds = quizzes.map((q) => q._id);

            if (quizIds.length === 0) return { total: 0, byQuiz: [] };

            const [totalAgg, byQuizAgg] = await Promise.all([
                Attempt.countDocuments({
                    status: "pending_grading",
                    quizId: { $in: quizIds }
                }),
                Attempt.aggregate([
                    { $match: { status: "pending_grading", quizId: { $in: quizIds } } },
                    { $group: { _id: "$quizId", count: { $sum: 1 } } }
                ])
            ]);

            const quizTitleMap = new Map(quizzes.map((q) => [q._id.toString(), q.title]));
            const byQuiz = byQuizAgg
                .map((row) => ({
                    quizId: row._id.toString(),
                    quizTitle: quizTitleMap.get(row._id.toString()) || null,
                    count: row.count
                }))
                .sort((a, b) => b.count - a.count);

            return { total: totalAgg, byQuiz };
        }

        if (role === "admin") {
            const total = await Attempt.countDocuments({ status: "pending_grading" });
            return { total, byQuiz: [] };
        }

        return { total: 0, byQuiz: [] };
    } catch (error) {
        console.error("[GET_PENDING_GRADING_COUNT] Error:", error);
        return { total: 0, byQuiz: [] };
    }
}
