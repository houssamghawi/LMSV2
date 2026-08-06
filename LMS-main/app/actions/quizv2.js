"use server";

import { dbConnect } from "@/service/mongo";
import { Quiz } from "@/model/quizv2-model";
import { Question } from "@/model/questionv2-model";
import { Attempt } from "@/model/attemptv2-model";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { assertInstructorOwnsCourse, isAdmin } from "@/lib/authorization";
import { hasEnrollmentForCourse } from "@/queries/enrollments";
import { getQuizWithQuestions, getInProgressAttempt } from "@/queries/quizv2";
import { quizSchema, questionSchema } from "@/lib/validations";
import mongoose from "mongoose";
import { updateQuizCompletionInReport } from "./quizProgressv2";

/**
 * Helper: Grade a single question
 */
function gradeQuestion(question, selectedOptionIds) {
    const correctIds = new Set(question.correctOptionIds || []);
    const selectedIds = new Set(selectedOptionIds || []);
    
    // Check if sets are equal
    const isCorrect = correctIds.size === selectedIds.size && 
                     [...correctIds].every(id => selectedIds.has(id));
    
    return {
        correct: isCorrect,
        points: isCorrect ? question.points : 0
    };
}

/**
 * Helper: Grade entire attempt
 */
function gradeAttempt(quiz, questions, answers) {
    let totalScore = 0;
    let totalPoints = 0;
    
    // Create question map with both string ID and ObjectId keys for matching
    const questionMap = {};
    questions.forEach(q => {
        const qId = q.id || q._id?.toString();
        questionMap[qId] = q;
        questionMap[qId.toString()] = q; // Also index by string
        totalPoints += q.points || 1;
    });
    
    answers.forEach(answer => {
        // Handle both ObjectId and string questionId
        const answerQId = answer.questionId?.toString() || answer.questionId;
        const question = questionMap[answerQId];
        if (!question) {
            console.warn(`[GRADE_ATTEMPT] Question not found for ID: ${answerQId}`);
            return;
        }
        
        const result = gradeQuestion(question, answer.selectedOptionIds || []);
        totalScore += result.points;
    });
    
    const scorePercent = totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0;
    const passed = scorePercent >= quiz.passPercent;
    
    return {
        score: totalScore,
        scorePercent: Math.round(scorePercent * 100) / 100,
        passed,
        totalPoints
    };
}

// ============ INSTRUCTOR/ADMIN ACTIONS ============

/**
 * Create a new quiz. BOLA: instructor/admin only. Mass assignment: quizSchema.strict().
 */
export async function createQuiz(courseId, lessonId, data) {
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            return { ok: false, error: "Unauthorized" };
        }
        if (!isAdmin(user)) {
            await assertInstructorOwnsCourse(courseId, user.id, { allowAdmin: false });
        }
        const parsed = quizSchema.safeParse(data);
        if (!parsed.success) {
            return { ok: false, error: "Invalid quiz data" };
        }
        const p = parsed.data;
        const quiz = await Quiz.create({
            courseId: new mongoose.Types.ObjectId(courseId),
            lessonId: lessonId ? new mongoose.Types.ObjectId(lessonId) : null,
            title: p.title,
            description: p.description ?? "",
            published: p.published ?? false,
            required: p.required ?? false,
            passPercent: p.passPercent ?? 70,
            timeLimitSec: p.timeLimitSec ?? null,
            maxAttempts: p.maxAttempts ?? null,
            shuffleQuestions: p.shuffleQuestions ?? false,
            shuffleOptions: p.shuffleOptions ?? false,
            showAnswersPolicy: p.showAnswersPolicy ?? "after_submit",
            createdBy: user.id
        });
        return { ok: true, quizId: quiz._id.toString() };
    } catch (error) {
        console.error("[CREATE_QUIZ] Error:", error);
        return { ok: false, error: error.message || "Failed to create quiz" };
    }
}

/**
 * Update quiz. BOLA: ownership via course. Mass assignment: quizSchema.strict().
 */
export async function updateQuiz(quizId, data) {
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            return { ok: false, error: "Unauthorized" };
        }
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return { ok: false, error: "Quiz not found" };
        }
        if (!isAdmin(user)) {
            await assertInstructorOwnsCourse(quiz.courseId.toString(), user.id, { allowAdmin: false });
        }
        const parsed = quizSchema.partial().strict().safeParse(data);
        if (!parsed.success) {
            return { ok: false, error: "Invalid quiz data" };
        }
        const p = parsed.data;
        if (p.title !== undefined) quiz.title = p.title;
        if (p.description !== undefined) quiz.description = p.description;
        if (p.published !== undefined) quiz.published = p.published;
        if (p.required !== undefined) quiz.required = p.required;
        if (p.passPercent !== undefined) quiz.passPercent = p.passPercent;
        if (p.timeLimitSec !== undefined) quiz.timeLimitSec = p.timeLimitSec;
        if (p.maxAttempts !== undefined) quiz.maxAttempts = p.maxAttempts;
        if (p.shuffleQuestions !== undefined) quiz.shuffleQuestions = p.shuffleQuestions;
        if (p.shuffleOptions !== undefined) quiz.shuffleOptions = p.shuffleOptions;
        if (p.showAnswersPolicy !== undefined) quiz.showAnswersPolicy = p.showAnswersPolicy;
        await quiz.save();
        return { ok: true };
    } catch (error) {
        console.error("[UPDATE_QUIZ] Error:", error);
        return { ok: false, error: error.message || "Failed to update quiz" };
    }
}

/**
 * Delete quiz
 */
export async function deleteQuiz(quizId) {
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            return { ok: false, error: "Unauthorized" };
        }
        
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return { ok: false, error: "Quiz not found" };
        }
        
        // Verify ownership
        if (!isAdmin(user)) {
            await assertInstructorOwnsCourse(quiz.courseId.toString(), user.id, { allowAdmin: false });
        }
        
        // Delete questions and attempts
        await Question.deleteMany({ quizId: new mongoose.Types.ObjectId(quizId) });
        await Attempt.deleteMany({ quizId: new mongoose.Types.ObjectId(quizId) });
        await Quiz.findByIdAndDelete(quizId);
        
        return { ok: true };
    } catch (error) {
        console.error("[DELETE_QUIZ] Error:", error);
        return { ok: false, error: error.message || "Failed to delete quiz" };
    }
}

/**
 * Publish/unpublish quiz
 */
export async function publishQuiz(quizId, published) {
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            return { ok: false, error: "Unauthorized" };
        }
        
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return { ok: false, error: "Quiz not found" };
        }
        
        // Verify ownership
        if (!isAdmin(user)) {
            await assertInstructorOwnsCourse(quiz.courseId.toString(), user.id, { allowAdmin: false });
        }
        
        quiz.published = published;
        await quiz.save();
        
        return { ok: true };
    } catch (error) {
        console.error("[PUBLISH_QUIZ] Error:", error);
        return { ok: false, error: error.message || "Failed to publish quiz" };
    }
}

/**
 * Add question to quiz. BOLA: ownership via quiz->course. Mass assignment: questionSchema.strict().
 */
export async function addQuestion(quizId, questionData) {
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            return { ok: false, error: "Unauthorized" };
        }
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return { ok: false, error: "Quiz not found" };
        }
        if (!isAdmin(user)) {
            await assertInstructorOwnsCourse(quiz.courseId.toString(), user.id, { allowAdmin: false });
        }
        const parsed = questionSchema.safeParse(questionData);
        if (!parsed.success) {
            return { ok: false, error: "Invalid question data" };
        }
        const p = parsed.data;
        const maxQuestion = await Question.findOne({ quizId: new mongoose.Types.ObjectId(quizId) })
            .sort({ order: -1 })
            .lean();
        const order = maxQuestion ? maxQuestion.order + 1 : 0;
        const question = await Question.create({
            quizId: new mongoose.Types.ObjectId(quizId),
            type: p.type,
            text: p.text,
            options: p.options,
            correctOptionIds: p.correctOptionIds ?? [],
            explanation: p.explanation ?? "",
            points: p.points ?? 1,
            order
        });
        return { ok: true, questionId: question._id.toString() };
    } catch (error) {
        console.error("[ADD_QUESTION] Error:", error);
        return { ok: false, error: error.message || "Failed to add question" };
    }
}

/**
 * Update question. BOLA: ownership via quiz->course. Mass assignment: questionSchema.partial().strict().
 */
export async function updateQuestion(questionId, questionData) {
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            return { ok: false, error: "Unauthorized" };
        }
        const question = await Question.findById(questionId);
        if (!question) {
            return { ok: false, error: "Question not found" };
        }
        const quiz = await Quiz.findById(question.quizId);
        if (!quiz) {
            return { ok: false, error: "Quiz not found" };
        }
        if (!isAdmin(user)) {
            await assertInstructorOwnsCourse(quiz.courseId.toString(), user.id, { allowAdmin: false });
        }
        const parsed = questionSchema.partial().strict().safeParse(questionData);
        if (!parsed.success) {
            return { ok: false, error: "Invalid question data" };
        }
        const p = parsed.data;
        if (p.type !== undefined) question.type = p.type;
        if (p.text !== undefined) question.text = p.text;
        if (p.options !== undefined) question.options = p.options;
        if (p.correctOptionIds !== undefined) question.correctOptionIds = p.correctOptionIds;
        if (p.explanation !== undefined) question.explanation = p.explanation;
        if (p.points !== undefined) question.points = p.points;
        await question.save();
        return { ok: true };
    } catch (error) {
        console.error("[UPDATE_QUESTION] Error:", error);
        return { ok: false, error: error.message || "Failed to update question" };
    }
}

/**
 * Delete question
 */
export async function deleteQuestion(questionId) {
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            return { ok: false, error: "Unauthorized" };
        }
        
        const question = await Question.findById(questionId);
        if (!question) {
            return { ok: false, error: "Question not found" };
        }
        
        const quiz = await Quiz.findById(question.quizId);
        if (!quiz) {
            return { ok: false, error: "Quiz not found" };
        }
        
        // Verify ownership
        if (!isAdmin(user)) {
            await assertInstructorOwnsCourse(quiz.courseId.toString(), user.id, { allowAdmin: false });
        }
        
        await Question.findByIdAndDelete(questionId);
        
        return { ok: true };
    } catch (error) {
        console.error("[DELETE_QUESTION] Error:", error);
        return { ok: false, error: error.message || "Failed to delete question" };
    }
}

/**
 * Reorder questions
 */
export async function reorderQuestions(quizId, orderedQuestionIds) {
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            return { ok: false, error: "Unauthorized" };
        }
        
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return { ok: false, error: "Quiz not found" };
        }
        
        // Verify ownership
        if (!isAdmin(user)) {
            await assertInstructorOwnsCourse(quiz.courseId.toString(), user.id, { allowAdmin: false });
        }
        
        // Update order for each question
        await Promise.all(
            orderedQuestionIds.map((questionId, index) =>
                Question.updateOne(
                    { _id: new mongoose.Types.ObjectId(questionId), quizId: new mongoose.Types.ObjectId(quizId) },
                    { order: index }
                )
            )
        );
        
        return { ok: true };
    } catch (error) {
        console.error("[REORDER_QUESTIONS] Error:", error);
        return { ok: false, error: error.message || "Failed to reorder questions" };
    }
}

// ============ STUDENT ACTIONS ============

/**
 * Start or resume quiz attempt
 */
export async function startOrResumeAttempt(quizId) {
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            return { ok: false, error: "Unauthorized" };
        }
        
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return { ok: false, error: "Quiz not found" };
        }
        
        // Check if published (unless instructor/admin)
        const isInstructorOrAdmin = user.role === "instructor" || user.role === "admin";
        if (!isInstructorOrAdmin && !quiz.published) {
            return { ok: false, error: "Quiz not available" };
        }
        
        // Check enrollment
        if (!isInstructorOrAdmin) {
            const enrolled = await hasEnrollmentForCourse(quiz.courseId.toString(), user.id);
            if (!enrolled) {
                return { ok: false, error: "You must be enrolled in this course" };
            }
        }
        
        // Check max attempts
        if (quiz.maxAttempts !== null) {
            const submittedCount = await Attempt.countDocuments({
                quizId: new mongoose.Types.ObjectId(quizId),
                studentId: user.id,
                status: "submitted"
            });
            
            if (submittedCount >= quiz.maxAttempts) {
                return { ok: false, error: "Maximum attempts reached" };
            }
        }
        
        // Check for in-progress attempt
        const inProgress = await getInProgressAttempt(quizId, user.id);
        if (inProgress) {
            // Check if attempt has expired
            if (inProgress.expiresAt && new Date() > new Date(inProgress.expiresAt)) {
                // Mark as expired
                await Attempt.findByIdAndUpdate(inProgress.id, { status: "expired" });
                // Create new attempt if max attempts allows
                if (quiz.maxAttempts === null || submittedCount < quiz.maxAttempts) {
                    let expiresAt = null;
                    if (quiz.timeLimitSec) {
                        expiresAt = new Date(Date.now() + quiz.timeLimitSec * 1000);
                    }
                    const newAttempt = await Attempt.create({
                        quizId: new mongoose.Types.ObjectId(quizId),
                        studentId: user.id,
                        expiresAt,
                        status: "in_progress"
                    });
                    return { ok: true, attemptId: newAttempt._id.toString(), resumed: false };
                } else {
                    return { ok: false, error: "Previous attempt expired and maximum attempts reached" };
                }
            }
            return { ok: true, attemptId: inProgress.id, resumed: true };
        }
        
        // Create new attempt
        let expiresAt = null;
        if (quiz.timeLimitSec) {
            expiresAt = new Date(Date.now() + quiz.timeLimitSec * 1000);
        }
        
        const attempt = await Attempt.create({
            quizId: new mongoose.Types.ObjectId(quizId),
            studentId: user.id,
            expiresAt,
            status: "in_progress"
        });
        
        return { ok: true, attemptId: attempt._id.toString(), resumed: false };
    } catch (error) {
        console.error("[START_ATTEMPT] Error:", error);
        return { ok: false, error: error.message || "Failed to start attempt" };
    }
}

/**
 * Autosave attempt answers
 */
export async function autosaveAttempt(attemptId, answers) {
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            return { ok: false, error: "Unauthorized" };
        }
        
        const attempt = await Attempt.findById(attemptId);
        if (!attempt) {
            return { ok: false, error: "Attempt not found" };
        }
        
        // Verify ownership - handle both string ID and ObjectId
        const attemptStudentId = attempt.studentId.toString();
        if (attemptStudentId !== user.id) {
            return { ok: false, error: "Unauthorized" };
        }
        
        if (attempt.status !== "in_progress") {
            return { ok: false, error: "Attempt already submitted" };
        }
        
        // Convert answers to proper format
        const answerArray = Object.entries(answers).map(([questionId, selectedOptionIds]) => ({
            questionId: new mongoose.Types.ObjectId(questionId),
            selectedOptionIds: Array.isArray(selectedOptionIds) ? selectedOptionIds : [selectedOptionIds]
        }));
        
        attempt.answers = answerArray;
        await attempt.save();
        
        return { ok: true };
    } catch (error) {
        console.error("[AUTOSAVE_ATTEMPT] Error:", error);
        return { ok: false, error: error.message || "Failed to autosave" };
    }
}

/**
 * Submit attempt
 */
export async function submitAttempt(attemptId, answers) {
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            return { ok: false, error: "Unauthorized" };
        }
        
        const attempt = await Attempt.findById(attemptId);
        if (!attempt) {
            return { ok: false, error: "Attempt not found" };
        }
        
        // Verify ownership - handle both string ID and ObjectId
        const attemptStudentId = attempt.studentId.toString();
        if (attemptStudentId !== user.id) {
            return { ok: false, error: "Unauthorized" };
        }
        
        if (attempt.status !== "in_progress") {
            return { ok: false, error: "Attempt already submitted" };
        }
        
        // Check if expired
        if (attempt.expiresAt && new Date() > attempt.expiresAt) {
            attempt.status = "expired";
            await attempt.save();
            return { ok: false, error: "Time limit exceeded" };
        }
        
        // Get quiz and questions
        const quiz = await Quiz.findById(attempt.quizId);
        if (!quiz) {
            return { ok: false, error: "Quiz not found" };
        }
        
        const quizWithQuestions = await getQuizWithQuestions(attempt.quizId.toString());
        if (!quizWithQuestions || !quizWithQuestions.questions) {
            return { ok: false, error: "Quiz has no questions" };
        }
        
        // Validate answers: only accept answers for questions in the quiz
        const validQuestionIds = new Set(
            quizWithQuestions.questions.map(q => q.id || q._id?.toString())
        );
        
        // Convert answers to proper format and validate
        const answerArray = [];
        for (const [questionId, selectedOptionIds] of Object.entries(answers)) {
            const qIdStr = questionId.toString();
            if (!validQuestionIds.has(qIdStr)) {
                console.warn(`[SUBMIT_ATTEMPT] Rejecting answer for invalid questionId: ${qIdStr}`);
                continue; // Skip invalid question IDs
            }
            
            // Ensure selectedOptionIds is an array
            const optionIds = Array.isArray(selectedOptionIds) 
                ? selectedOptionIds.filter(id => id != null && id !== "")
                : (selectedOptionIds != null && selectedOptionIds !== "" ? [selectedOptionIds] : []);
            
            answerArray.push({
                questionId: new mongoose.Types.ObjectId(questionId),
                selectedOptionIds: optionIds
            });
        }
        
        // Grade attempt
        const gradeResult = gradeAttempt(quiz, quizWithQuestions.questions, answerArray);
        
        // Update attempt
        attempt.answers = answerArray;
        attempt.score = gradeResult.score;
        attempt.scorePercent = gradeResult.scorePercent;
        attempt.passed = gradeResult.passed;
        attempt.status = "submitted";
        attempt.submittedAt = new Date();
        await attempt.save();
        
        // Update progress if passed and required
        if (attempt.passed && quiz.required) {
            await updateQuizCompletionInReport(
                quiz.courseId.toString(),
                user.id,
                quiz._id?.toString() || attempt.quizId?.toString(),
                quiz.lessonId?.toString() || null
            );
        }
        
        return { ok: true, attempt: JSON.parse(JSON.stringify(attempt)) };
    } catch (error) {
        console.error("[SUBMIT_ATTEMPT] Error:", error);
        return { ok: false, error: error.message || "Failed to submit attempt" };
    }
}

/**
 * Get attempt result
 */
export async function getAttemptResult(attemptId) {
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            return { ok: false, error: "Unauthorized" };
        }
        
        const attempt = await Attempt.findById(attemptId)
            .populate("quizId")
            .lean();
        
        if (!attempt) {
            return { ok: false, error: "Attempt not found" };
        }
        
        // Verify ownership: student owns attempt OR instructor owns course OR admin
        const isInstructorOrAdmin = user.role === "instructor" || user.role === "admin";
        // Handle both string ID and ObjectId
        const attemptStudentId = attempt.studentId.toString();
        const isOwner = attemptStudentId === user.id;
        
        if (!isOwner && !isInstructorOrAdmin) {
            return { ok: false, error: "Unauthorized" };
        }
        
        if (isInstructorOrAdmin && !isOwner) {
            // Verify instructor owns the course
            // Handle both populated and non-populated quizId
            const quizCourseId = typeof attempt.quizId === 'object' && attempt.quizId !== null && attempt.quizId.courseId
                ? attempt.quizId.courseId.toString()
                : null;
            if (!quizCourseId) {
                return { ok: false, error: "Invalid quiz data" };
            }
            const { verifyInstructorOwnsCourse } = await import("@/lib/authorization");
            const ownsCourse = await verifyInstructorOwnsCourse(
                quizCourseId,
                user.id,
                user
            );
            
            if (!ownsCourse && !isAdmin(user)) {
                return { ok: false, error: "Unauthorized" };
            }
        }
        
        return { ok: true, attempt: JSON.parse(JSON.stringify(attempt)) };
    } catch (error) {
        console.error("[GET_ATTEMPT_RESULT] Error:", error);
        return { ok: false, error: error.message || "Failed to get attempt result" };
    }
}
