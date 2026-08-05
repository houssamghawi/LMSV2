"use server"

import { replaceMongoIdInObject } from "@/lib/convertData";
import { Course } from "@/model/course-model";
import { Testimonial } from "@/model/testimonial-model";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { reviewSchema } from "@/lib/validations";
import { hasEnrollmentForCourse } from "@/queries/enrollments";
import mongoose from "mongoose";
import { dbConnect } from "@/service/mongo";

/**
 * Create a review for a course. BOLA: user must be self (loginid). State: user must be enrolled.
 */
export async function createReview(data, loginid, courseId) {
    await dbConnect();

    try {
        const loggedinUser = await getLoggedInUser();
        if (!loggedinUser) {
            throw new Error('Unauthorized: Please log in');
        }

        // BOLA: user can only create reviews as themselves (reject IDOR)
        if (loggedinUser.id !== loginid) {
            throw new Error('Forbidden: You can only create reviews as yourself');
        }

        // Mass assignment: only allow review + rating
        const parsed = reviewSchema.safeParse(data);
        if (!parsed.success) {
            throw new Error('Invalid review data. Rating must be between 1 and 5.');
        }
        const { review, rating } = parsed.data;

        // State transition: only enrolled students can leave a review
        const isEnrolled = await hasEnrollmentForCourse(courseId, loggedinUser.id);
        if (!isEnrolled) {
            throw new Error('You must be enrolled in this course to leave a review');
        }

        // Course must exist and be the one requested
        const course = await Course.findById(courseId).select('_id');
        if (!course) {
            throw new Error('Course not found');
        }

        // Create the testimonial
        const newTestimonial = await Testimonial.create({
            content: review,
            user: loginid,
            courseId,
            rating,
        });

        if (!newTestimonial) {
            throw new Error("Failed to create testimonial");
        }

        // Update the course with the new testimonial
        const updateCourse = await Course.findByIdAndUpdate(
            courseId,
            { $push: { testimonials: newTestimonial._id } },
            { new: true }
        );

        if (!updateCourse) {
            // If course update fails, delete the testimonial to maintain consistency
            await Testimonial.findByIdAndDelete(newTestimonial._id);
            throw new Error("Failed to update the course testimonial");
        }

        return replaceMongoIdInObject(newTestimonial && typeof newTestimonial.toObject === 'function' ? newTestimonial.toObject() : newTestimonial);
    } catch (error) {
        throw new Error(error?.message || 'Failed to create review');
    }
}