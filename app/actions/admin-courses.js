"use server";

import { requireAdminPermission } from "@/lib/admin-utils";
import { getCourseList, getCourseDetails } from "@/queries/courses";
import { deleteCourse } from "@/app/actions/course";
import { updateCourseStatusSchema, deleteCourseSchema } from "@/lib/validations";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { dbConnect } from "@/service/mongo";
import { Course } from "@/model/course-model";

/**
 * Get all courses (admin only)
 */
export async function adminGetCourses() {
    try {
        await requireAdminPermission('courses:view_all');
        return await getCourseList();
    } catch (error) {
        console.error('Admin get courses error:', error);
        throw new Error(error?.message || 'Failed to fetch courses');
    }
}

/**
 * Get course by ID (admin only)
 */
export async function adminGetCourse(courseId) {
    try {
        await requireAdminPermission('courses:view_all');
        return await getCourseDetails(courseId);
    } catch (error) {
        console.error('Admin get course error:', error);
        throw new Error(error?.message || 'Failed to fetch course');
    }
}

/**
 * Update course publish status (admin only)
 */
export async function adminUpdateCourseStatus(courseId, active) {
    try {
        await requireAdminPermission('courses:publish_all');
        
        const validation = updateCourseStatusSchema.parse({ courseId, active });
        
        // Admin can directly set the active status
        await dbConnect();
        
        const course = await Course.findByIdAndUpdate(
            validation.courseId,
            { active: validation.active },
            { new: true, lean: true }
        );
        
        if (!course) {
            throw new Error('Course not found');
        }
        
        revalidatePath('/admin/courses');
        return { success: true, active: course.active };
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(error.errors.map(e => e.message).join(', '));
        }
        console.error('Admin update course status error:', error);
        throw new Error(error?.message || 'Failed to update course status');
    }
}

/**
 * Delete course (admin only)
 */
export async function adminDeleteCourse(courseId) {
    try {
        await requireAdminPermission('courses:delete_all');
        
        const validation = deleteCourseSchema.parse({ courseId, confirm: true });
        
        await deleteCourse(validation.courseId);
        
        revalidatePath('/admin/courses');
        return { success: true };
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(error.errors.map(e => e.message).join(', '));
        }
        console.error('Admin delete course error:', error);
        throw new Error(error?.message || 'Failed to delete course');
    }
}

