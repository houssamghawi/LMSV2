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
