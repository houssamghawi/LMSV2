import "server-only";
import { dbConnect } from "@/service/mongo";
import { Report } from "@/model/report-model";
import { Enrollment } from "@/model/enrollment-model";
import mongoose from "mongoose";
import { getCourseDetails } from "@/queries/courses";
import { getCourseQuizzes, getStudentQuizStatusMap } from "@/queries/quizv2";
import { getOrderedLessons, toLessonIdString } from "@/lib/course-progress";

/**
 * Check if user has completed the course (100% of published lessons + required quizzes).
 * Certificate is only allowed when completedPublishedLessonsCount === totalPublishedLessonsCount.
 * Returns: { completed: boolean, progress: number, completionDate: Date | null }
 */
export async function checkCourseCompletion(courseId, userId) {
    await dbConnect();

    try {
        // 1. Get course with modules and lessons (for published lesson list)
        const course = await getCourseDetails(courseId);
        if (!course) {
            return { completed: false, progress: 0, completionDate: null, error: "Course not found" };
        }

        // 2. Get enrollment
        const enrollment = await Enrollment.findOne({
            course: new mongoose.Types.ObjectId(courseId),
            student: new mongoose.Types.ObjectId(userId),
        }).lean();

        if (!enrollment) {
            return { completed: false, progress: 0, completionDate: null, error: "Not enrolled" };
        }

        // 3. Get report (totalCompletedLessons = lessons with watch completed + required quiz passed)
        const report = await Report.findOne({
            course: new mongoose.Types.ObjectId(courseId),
            student: new mongoose.Types.ObjectId(userId),
        }).lean();

        if (!report) {
            return { completed: false, progress: 0, completionDate: null };
        }

        // 4. Lesson-based progress: all active lessons must be in totalCompletedLessons
        const orderedLessons = getOrderedLessons(course?.modules || []);
        const completedLessonIds = new Set(
            (report.totalCompletedLessons || []).map((id) => id.toString())
        );
        const totalPublishedCount = orderedLessons.length;
        const completedPublishedCount = orderedLessons.filter((lesson) => {
            return completedLessonIds.has(toLessonIdString(lesson));
        }).length;
        const progress =
            totalPublishedCount > 0
                ? (completedPublishedCount / totalPublishedCount) * 100
                : 0;

        // 5. Check course-level required quizzes
        const allQuizzes = await getCourseQuizzes(courseId, {
            forStudent: false,
            includeUnpublished: false,
        });
        const courseRequiredQuizzes = allQuizzes.filter((q) => !q.lessonId && q.required);
        const quizStatusMap = await getStudentQuizStatusMap(courseId, userId);
        const allRequiredQuizzesPassed = courseRequiredQuizzes.every((q) => {
            const qId = q.id || q._id?.toString();
            const status = quizStatusMap[qId];
            return status && status.passed;
        });

        // 6. Complete only when 100% published lessons done AND all required course quizzes passed
        const isComplete =
            totalPublishedCount > 0 &&
            completedPublishedCount === totalPublishedCount &&
            (courseRequiredQuizzes.length === 0 || allRequiredQuizzesPassed);

        return {
            completed: isComplete,
            progress: Math.round(progress),
            completionDate: report.completion_date || null,
            totalPublishedLessons: totalPublishedCount,
            completedPublishedLessons: completedPublishedCount,
            requiredQuizzes: {
                total: courseRequiredQuizzes.length,
                passed: courseRequiredQuizzes.filter((q) => {
                    const status = quizStatusMap[q.id];
                    return status && status.passed;
                }).length,
            },
        };
    } catch (error) {
        console.error("[CERTIFICATE] Error checking completion:", error);
        return { completed: false, progress: 0, completionDate: null, error: error.message };
    }
}

/**
 * Verify user can access certificate for course
 * Returns: { allowed: boolean, error?: string }
 */
export async function verifyCertificateAccess(courseId, userId) {
    await dbConnect();
    
    try {
        // 1. Check enrollment
        const enrollment = await Enrollment.findOne({
            course: new mongoose.Types.ObjectId(courseId),
            student: new mongoose.Types.ObjectId(userId)
        }).lean();
        
        if (!enrollment) {
            return { allowed: false, error: 'You are not enrolled in this course' };
        }
        
        // 2. Check completion
        const completionCheck = await checkCourseCompletion(courseId, userId);
        
        if (!completionCheck.completed) {
            const missingQuizzes = completionCheck.requiredQuizzes?.total - completionCheck.requiredQuizzes?.passed;
            if (missingQuizzes > 0) {
                return {
                    allowed: false,
                    error: `Complete ${missingQuizzes} required quiz${missingQuizzes > 1 ? 'zes' : ''} to unlock certificate.`
                };
            }
            return { 
                allowed: false, 
                error: `Course not completed. Progress: ${completionCheck.progress}%` 
            };
        }
        
        return { allowed: true, completionDate: completionCheck.completionDate };
        
    } catch (error) {
        console.error('[CERTIFICATE] Error verifying access:', error);
        return { allowed: false, error: 'Failed to verify certificate access' };
    }
}

