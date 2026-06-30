import { replaceMongoIdInObject } from "@/lib/convertData";
import { Category } from "@/model/category-model";
import { Course } from "@/model/course-model";
import { Module } from "@/model/module.model";
import { Testimonial } from "@/model/testimonial-model";
import { User } from "@/model/user-model";
import { serializeCourse, serializeCourseList } from "@/lib/schemas/course-schema";
import { getEnrollmentsForCourse } from "./enrollments";
import { getTestimonialsForCourse } from "./testimonials";
import { Lesson } from "@/model/lesson.model";
import mongoose from "mongoose";
import { dbConnect } from "@/service/mongo";

export async function getCourseList() {
    await dbConnect();
    const courses = await Course.find({active:true}).select(["title","subtitle","thumbnail","modules","price","category","instructor"]).populate({
        path: "category",
        model: Category
    }).populate({
        path: "instructor",
        model: User
    }).populate({
        path: "testimonials",
        model: Testimonial
    }).populate({
        path: "modules",
        model: Module
    }).lean();
    return serializeCourseList(courses);
}

// Get ALL courses (including drafts) - for admin panel
export async function getAllCourses() {
    await dbConnect();
    const courses = await Course.find({}).select(["title","subtitle","thumbnail","modules","price","category","instructor","active"]).populate({
        path: "category",
        model: Category
    }).populate({
        path: "instructor",
        model: User
    }).populate({
        path: "testimonials",
        model: Testimonial
    }).populate({
        path: "modules",
        model: Module
    }).lean();
    return serializeCourseList(courses);
}

// Get featured courses (most popular by enrollments or highest rated)
export async function getFeaturedCourses(limit = 8) {
    await dbConnect();
    const courses = await Course.find({active: true})
        .select(["title","subtitle","thumbnail","modules","price","category","instructor","testimonials"])
        .populate({
            path: "category",
            model: Category
        })
        .populate({
            path: "instructor",
            model: User,
            select: "firstName lastName profilePicture"
        })
        .populate({
            path: "testimonials",
            model: Testimonial
        })
        .populate({
            path: "modules",
            model: Module
        })
        .sort({ createdAt: -1 }) // Newest first, can be changed to popularity
        .limit(limit)
        .lean();
    return serializeCourseList(courses);
}

// Get course statistics
export async function getCourseStats() {
    await dbConnect();
    try {
        const totalCourses = await Course.countDocuments({ active: true });
        const totalCategories = await Category.countDocuments();
        const totalInstructors = await User.countDocuments({ role: 'instructor' });
        
        // Get total enrollments
        const Enrollment = (await import("@/model/enrollment-model")).Enrollment;
        const totalEnrollments = await Enrollment.countDocuments();
        
        return {
            totalCourses,
            totalCategories,
            totalInstructors,
            totalEnrollments
        };
    } catch (error) {
        console.error('Error getting course stats:', error);
        return {
            totalCourses: 0,
            totalCategories: 0,
            totalInstructors: 0,
            totalEnrollments: 0
        };
    }
}  


export async function getCourseDetails(id) {
    await dbConnect();
    
    // Validate id parameter
    if (!id || id === 'undefined' || id === 'null') {
        return null;
    }
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return null;
    }
    
    const course = await Course.findById(id)
    .populate({
        path: "category",
        model: Category 
    }).populate({
        path: "instructor",
        model: User
    }).populate({
        path: "testimonials",
        model: Testimonial,
        populate: {
            path: "user",
            model: User
        }
    }).populate({
        path: "modules",
        model: Module,
        populate:{
            path: "lessonIds",
            model: Lesson,
        }
    }).lean();
    return serializeCourse(course);
}


function groupBy(array, keyFn){
    return array.reduce((acc, item) => {
        const key = keyFn(item);
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(item);
        return acc
    },{});
}


export async function getCourseDetailsByInstructor(instructorId,expand){
    await dbConnect();
    const publishCourses = await Course.find({instructor: instructorId, active:true })
    .populate({path: "category", model: Category })
    .populate({path: "testimonials", model: Testimonial })
    .populate({ path: "instructor", model: User})
    .lean();

    const enrollments = await Promise.all(
        publishCourses.map(async (course) => {
            const enrollment = await getEnrollmentsForCourse(course.
                _id.toString());
                return enrollment;
        })
    );

   

    // Group enrollments by course
    const groupByCourses = groupBy(enrollments.flat(), (item) => item.course);

    /// Calculate total revenue 
    const totalRevenue = publishCourses.reduce((acc, course) => {
        const enrollmentsForCourse = groupByCourses[course._id] || [];
        return acc + enrollmentsForCourse.length * course.price; 
    },0);

    //console.log(totalRevenue);

    const totalEnrollments = enrollments.reduce(( acc, obj )=> {
        return acc + obj.length;
    },0);
    
    const tesimonials = await Promise.all(
        publishCourses.map(async (course) => {
            const tesimonial = await getTestimonialsForCourse(course.
                _id.toString());
                return tesimonial;
        })
    );

    const totalTestimonials = tesimonials.flat();
    const avgRating = (totalTestimonials.reduce(function (acc, obj) {
        return acc + obj.rating;
    },0)) / totalTestimonials.length; 

    const firstName = publishCourses.length > 0 ? publishCourses[0]?.instructor?.
    firstName : "Unknown";
    const lastName = publishCourses.length > 0 ? publishCourses[0]?.instructor?.
    lastName : "Unknown";
    const fullInsName = `${firstName} ${lastName}`;

    const Designation = publishCourses.length > 0 ? publishCourses[0]?.instructor?.
    designation : "Unknown"; 

    const insImage = publishCourses.length > 0 ? publishCourses[0]?.instructor?.
    profilePicture : "Unknown"; 

    if (expand) {
        const allCourses = await Course.find({ instructor: instructorId }).lean();
        return {
            courses: serializeCourseList(allCourses?.flat() || []),
            enrollments: enrollments?.flat(),
            reviews: totalTestimonials,
        };
    }

    return {
        courses: publishCourses.length,
        enrollments: totalEnrollments,
        reviews: totalTestimonials.length,
        ratings: avgRating.toPrecision(2),
        inscourses: serializeCourseList(publishCourses),
        "revenue": totalRevenue,
        fullInsName,
        Designation,
        insImage
    } 
}


export async function create(courseData) {
    try {
        const course = await Course.create(courseData);
        return JSON.parse(JSON.stringify(course));
    } catch (error) {
        throw new Error(error);
    }
}


export async function getCoursesByCategory(categoryId){

    try {
        const courses = await Course.find({ category: categoryId }).populate("category").lean();
        return serializeCourseList(courses);
    } catch (error) {
        throw new Error(error);
    }

}

export const getCategoryById = async (categoryId) => {

    try {
        const category = await Category.findById(categoryId).lean();
        return category ? replaceMongoIdInObject(category) : null;
    } catch (error) {
        throw new Error(error);
    }

}

export async function getRelatedCourses(currentCourseId,categoryId){

    try {
        const currentCourseObjectId = new mongoose.Types.ObjectId(currentCourseId);
        const categoryObjectId = new mongoose.Types.ObjectId(categoryId);
        // console.log("course id", currentCourseObjectId);
        // console.log("category id",categoryObjectId );
        const relatedCourses = await Course.find({
            category: categoryObjectId,
            _id: { $ne: currentCourseObjectId }, // Exclude current course
            active: true,
        })
        .select("title thumbnail price").lean();
        return serializeCourseList(relatedCourses);
    } catch (error) {
        throw new Error(error);
    }

}