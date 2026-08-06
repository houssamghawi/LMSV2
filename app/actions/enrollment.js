"use server"
import { auth } from "@/auth";
import { getCourseDetails } from "@/queries/courses";
import { hasEnrollmentForCourse, enrollForCourse } from "@/queries/enrollments";
import { createErrorResponse, createSuccessResponse, ERROR_CODES } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { logAction } from "@/lib/logger";
import { headers } from "next/headers";
import { z } from "zod";

const enrollFreeSchema = z.object({
    courseId: z.string().min(1, 'Course ID is required')
});

/**
 * Enroll user in a free course (server action)
 * This is used for courses with price = 0
 */
export async function enrollInFreeCourse(data) {
    const logger = logAction('enrollInFreeCourse');
    logger.start();
    
    try {
        // 1. Authentication check
        const session = await auth();
        if (!session?.user?.id) {
            logger.failure(new Error('Unauthorized'));
            return createErrorResponse(
                'You must be logged in to enroll in a course.',
                ERROR_CODES.AUTH_REQUIRED
            );
        }
        
        const userId = session.user.id;
        
        // 2. Rate limiting
        const ip = (await headers()).get('x-forwarded-for') || 
                   (await headers()).get('x-real-ip') || 
                   'unknown';
        const rateLimitResult = rateLimit(`enroll:${userId}:${ip}`, 20, 60000); // 20 per minute
        
        if (!rateLimitResult.success) {
            logger.failure(new Error('Rate limited'));
            return createErrorResponse(
                'Too many enrollment attempts. Please try again later.',
                ERROR_CODES.RATE_LIMITED
            );
        }
        
        // 3. Validation
        const courseId = data.get("courseId");
        const validationResult = enrollFreeSchema.safeParse({ courseId });
        
        if (!validationResult.success) {
            logger.failure(new Error('Validation failed'));
            return createErrorResponse(
                'Invalid course ID.',
                ERROR_CODES.VALIDATION_ERROR
            );
        }
        
        // 4. Get course details
        const course = await getCourseDetails(courseId);
        
        if (!course) {
            logger.failure(new Error('Course not found'));
            return createErrorResponse(
                'Course not found.',
                ERROR_CODES.NOT_FOUND
            );
        }
        
        // 5. Check if course is free
        const coursePrice = course?.price || 0;
        if (coursePrice > 0) {
            logger.failure(new Error('Course is not free'));
            return createErrorResponse(
                'This course requires payment. Please use the checkout process.',
                ERROR_CODES.OPERATION_FAILED
            );
        }
        
        // 6. Check if course is active
        if (!course.active) {
            logger.failure(new Error('Course not active'));
            return createErrorResponse(
                'This course is not available for enrollment.',
                ERROR_CODES.OPERATION_FAILED
            );
        }
        
        // 7. Check if already enrolled
        const alreadyEnrolled = await hasEnrollmentForCourse(courseId, userId);
        if (alreadyEnrolled) {
            logger.info('User already enrolled');
            return createSuccessResponse(
                { enrolled: true },
                'You are already enrolled in this course.'
            );
        }
        
        // 8. Create enrollment (free course, no payment)
        await enrollForCourse(courseId, userId, 'free', null);
        
        logger.success();
        return createSuccessResponse(
            { enrolled: true },
            'Successfully enrolled in the course!'
        );
        
    } catch (error) {
        logger.failure(error instanceof Error ? error : new Error(String(error)));
        
        // Handle duplicate enrollment error (unique constraint)
        if (error instanceof Error && error.message.includes('duplicate')) {
            return createSuccessResponse(
                { enrolled: true },
                'You are already enrolled in this course.'
            );
        }
        
        return createErrorResponse(
            'Failed to enroll in course. Please try again.',
            ERROR_CODES.INTERNAL_ERROR
        );
    }
}

