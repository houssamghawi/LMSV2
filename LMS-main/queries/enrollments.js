import { replaceMongoIdInArray, replaceMongoIdInObject } from "@/lib/convertData";
import { Course } from "@/model/course-model";
import { Enrollment } from "@/model/enrollment-model"; 
import { dbConnect } from "@/service/mongo";
import mongoose from "mongoose";

export async function getEnrollmentsForCourse(courseId){
    await dbConnect();
    const enrollments = await Enrollment.find({course: courseId}).lean();
    return replaceMongoIdInArray(enrollments);
}

export async function enrollForCourse(courseId, userId, paymentMethod, paymentId = null){
    await dbConnect();
    
    // Convert to ObjectIds if strings
    const courseObjectId = mongoose.Types.ObjectId.isValid(courseId) 
        ? (courseId instanceof mongoose.Types.ObjectId ? courseId : new mongoose.Types.ObjectId(courseId))
        : courseId;
    const userObjectId = mongoose.Types.ObjectId.isValid(userId)
        ? (userId instanceof mongoose.Types.ObjectId ? userId : new mongoose.Types.ObjectId(userId))
        : userId;
    
    // Check if enrollment already exists (idempotency) - use direct query, no populate
    const existingEnrollment = await Enrollment.findOne({
        course: courseObjectId,
        student: userObjectId
    }).lean();
    
    if (existingEnrollment) {
        return existingEnrollment;
    }
    
    const newEnrollment = {
        course: courseObjectId,
        student: userObjectId,
        method: paymentMethod,
        enrollment_date: new Date(),
        status: 'not-started'
    };
    
    if (paymentId) {
        const paymentObjectId = mongoose.Types.ObjectId.isValid(paymentId)
            ? (paymentId instanceof mongoose.Types.ObjectId ? paymentId : new mongoose.Types.ObjectId(paymentId))
            : paymentId;
        newEnrollment.payment = paymentObjectId;
    }
    
    try {
        const response = await Enrollment.create(newEnrollment);
        return response;
    } catch (error) {
        // Handle duplicate key error (unique constraint)
        if (error.code === 11000) {
            // Enrollment already exists, return existing one
            return await Enrollment.findOne({
                course: courseObjectId,
                student: userObjectId
            }).lean();
        }
        throw new Error(`Failed to create enrollment: ${error.message}`);
    }
}

export async function getEnrollmentsForUser(userId){
    await dbConnect();
    try {
        const enrollments = await Enrollment.find({ student: userId})
        .populate({
            path: "course",
            model: Course,
        }).lean();
        return replaceMongoIdInArray(enrollments);
    } catch (err) {
        throw new Error(err);
    }

}

/**
 * Check if user is enrolled in course (optimized - uses exists() instead of findOne with populate)
 */
export async function hasEnrollmentForCourse(courseId, studentId){
    await dbConnect();
    try {
        // Convert to ObjectIds if strings
        const courseObjectId = mongoose.Types.ObjectId.isValid(courseId)
            ? (courseId instanceof mongoose.Types.ObjectId ? courseId : new mongoose.Types.ObjectId(courseId))
            : courseId;
        const studentObjectId = mongoose.Types.ObjectId.isValid(studentId)
            ? (studentId instanceof mongoose.Types.ObjectId ? studentId : new mongoose.Types.ObjectId(studentId))
            : studentId;

        // Use exists() for fast existence check (no populate needed)
        const enrollmentExists = await Enrollment.exists({
            course: courseObjectId,
            student: studentObjectId
        });

        return !!enrollmentExists;
    } catch (error) {
        throw new Error(`Failed to check enrollment: ${error.message}`);
    }
}
