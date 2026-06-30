import { replaceMongoIdInArray, replaceMongoIdInObject } from "@/lib/convertData"; 
import { Testimonial } from "@/model/testimonial-model";
import { User } from "@/model/user-model";
import { dbConnect } from "@/service/mongo";

export async function getTestimonialsForCourse(courseId){
    await dbConnect();
    const testimonials = await Testimonial.find({courseId: courseId})
        .populate({
            path: "user",
            model: User,
            select: "firstName lastName profilePicture"
        })
        .lean();
    return replaceMongoIdInArray(testimonials);
}

// Get featured testimonials (highest rated)
export async function getFeaturedTestimonials(limit = 6) {
    await dbConnect();
    try {
        const Course = (await import("@/model/course-model")).Course;
        const testimonials = await Testimonial.find({})
            .populate({
                path: "user",
                model: User,
                select: "firstName lastName profilePicture"
            })
            .populate({
                path: "courseId",
                model: Course,
                select: "title"
            })
            .sort({ rating: -1, createdAt: -1 })
            .limit(limit)
            .lean();
        return replaceMongoIdInArray(testimonials);
    } catch (error) {
        console.error('Error getting featured testimonials:', error);
        return [];
    }
}
