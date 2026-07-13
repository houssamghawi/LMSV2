import mongoose from "mongoose";

import { dbConnect } from "@/service/mongo";
import { Lesson } from "@/model/lesson.model";
import { Module } from "@/model/module.model";
import { Course } from "@/model/course-model";
import { Enrollment } from "@/model/enrollment-model";
import { ROLES } from "@/lib/permissions";

/**
 * Verify instructor or admin can modify lesson content.
 * @param {string} lessonId
 * @param {string} userId
 * @param {string} userRole
 */
export async function verifyInstructorLessonAccess(lessonId, userId, userRole) {
    await dbConnect();

    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson) {
        return { allowed: false, error: "Lesson not found", code: "LESSON_NOT_FOUND" };
    }

    const module = await Module.findOne({ lessonIds: lessonId }).lean();
    if (!module) {
        return { allowed: false, error: "Module not found", code: "LESSON_NOT_FOUND" };
    }

    const course = await Course.findById(module.course).lean();
    if (!course) {
        return { allowed: false, error: "Course not found", code: "LESSON_NOT_FOUND" };
    }

    if (userRole === ROLES.ADMIN) {
        return { allowed: true, lesson, module, course };
    }

    if (userRole === ROLES.INSTRUCTOR && course.instructor.toString() === userId) {
        return { allowed: true, lesson, module, course };
    }

    return {
        allowed: false,
        error: "You do not have permission to modify this lesson.",
        code: "FORBIDDEN"
    };
}

/**
 * Verify user can view lesson content (enrolled student, instructor, or admin).
 * @param {string} lessonId
 * @param {string} userId
 * @param {string} userRole
 */
export async function verifyLessonContentAccess(lessonId, userId, userRole) {
    await dbConnect();

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
        return { allowed: false, error: "Lesson not found", code: "LESSON_NOT_FOUND" };
    }

    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson) {
        return { allowed: false, error: "Lesson not found", code: "LESSON_NOT_FOUND" };
    }

    const module = await Module.findOne({ lessonIds: lessonId }).lean();
    if (!module) {
        return { allowed: false, error: "Module not found", code: "LESSON_NOT_FOUND" };
    }

    const course = await Course.findById(module.course).lean();
    if (!course) {
        return { allowed: false, error: "Course not found", code: "LESSON_NOT_FOUND" };
    }

    if (userRole === ROLES.ADMIN) {
        return { allowed: true, lesson, module, course };
    }

    if (userRole === ROLES.INSTRUCTOR && course.instructor.toString() === userId) {
        return { allowed: true, lesson, module, course };
    }

    if (userRole === ROLES.STUDENT) {
        const enrollment = await Enrollment.findOne({
            student: new mongoose.Types.ObjectId(userId),
            course: course._id
        }).lean();

        if (enrollment) {
            return { allowed: true, lesson, module, course };
        }
    }

    return {
        allowed: false,
        error: "You do not have permission to view this lesson content.",
        code: "FORBIDDEN"
    };
}
