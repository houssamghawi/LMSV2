import { getLoggedInUser } from "@/lib/loggedin-user";
import { Watch } from "@/model/watch-model";
import { getLesson } from "@/queries/lessons";
import { getModuleBySlug } from "@/queries/modules";
import { createWatchReport } from "@/queries/reports";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { dbConnect } from "@/service/mongo";
import { hasEnrollmentForCourse } from "@/queries/enrollments";
import { getCourseDetails } from "@/queries/courses";
import { lessonWatchBodySchema } from "@/lib/validations";
import mongoose from "mongoose";

const STARTED = "started";
const COMPLETED = "completed";

async function updateReport(userId, courseId, moduleId, lessonId) {
    try {
        await createWatchReport({ userId, courseId, moduleId, lessonId });
    } catch (error) {
        throw new Error(error);
    }
}

export async function POST(request) {
    await dbConnect();

    try {
        const body = await request.json();
        const parsed = lessonWatchBodySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid or missing fields: courseId, lessonId, moduleSlug, state required' },
                { status: 400 }
            );
        }
        const { courseId, lessonId, moduleSlug, state, lastTime } = parsed.data;

        if (!mongoose.Types.ObjectId.isValid(courseId) || !mongoose.Types.ObjectId.isValid(lessonId)) {
            return NextResponse.json(
                { error: 'Invalid courseId or lessonId format' },
                { status: 400 }
            );
        }

        const loggedinUser = await getLoggedInUser();
        if (!loggedinUser) {
            return NextResponse.json(
                { error: 'You are not authenticated' },
                { status: 401 }
            );
        }

        // Get lesson and module
        const lesson = await getLesson(lessonId);
        if (!lesson) {
            return NextResponse.json(
                { error: 'Lesson not found' },
                { status: 404 }
            );
        }

        const module = await getModuleBySlug(moduleSlug);
        if (!module) {
            return NextResponse.json(
                { error: 'Module not found' },
                { status: 404 }
            );
        }

        // Verify lesson belongs to module
        const lessonBelongsToModule = module.lessonIds?.some(
            id => id.toString() === lessonId.toString()
        );
        if (!lessonBelongsToModule) {
            return NextResponse.json(
                { error: 'Lesson does not belong to this module' },
                { status: 403 }
            );
        }

        // Check enrollment (unless user is admin or instructor of the course)
        const course = await getCourseDetails(courseId);
        if (!course) {
            return NextResponse.json(
                { error: 'Course not found' },
                { status: 404 }
            );
        }

        const isInstructor = course.instructor?.toString() === loggedinUser.id.toString();
        const isAdmin = loggedinUser.role === 'admin';
        
        if (!isAdmin && !isInstructor) {
            const isEnrolled = await hasEnrollmentForCourse(courseId, loggedinUser.id);
            if (!isEnrolled) {
                return NextResponse.json(
                    { error: 'You must be enrolled in this course' },
                    { status: 403 }
                );
            }
        }

        const watchEntry = {
            lastTime: lastTime || 0,
            lesson: lesson.id,  
            module: module.id, 
            user: loggedinUser.id,
            state,  
        }

        const found = await Watch.findOne({
            lesson: lessonId,
            module: module.id,
            user: loggedinUser.id
        }).lean();

        if (state === STARTED) {
            if (!found) {
                watchEntry["created_at"] = new Date();
                await Watch.create(watchEntry);
            } 
        } else if (state === COMPLETED) {
            if (!found) {
                watchEntry["created_at"] = new Date();
                await Watch.create(watchEntry);
                await updateReport(loggedinUser.id, courseId, module.id, lessonId);
            } else {
                if (found.state === STARTED) {
                    watchEntry["modified_at"] = new Date();
                    await Watch.findByIdAndUpdate(found._id, {
                        state: COMPLETED,
                        modified_at: new Date(),
                    });
                    await updateReport(loggedinUser.id, courseId, module.id, lessonId);
                }
            }
            // Aggressive cache revalidation: lesson layout + course page for both locales
            revalidatePath(`/en/courses/${courseId}/lesson`, "layout");
            revalidatePath(`/ar/courses/${courseId}/lesson`, "layout");
            revalidatePath(`/en/courses/${courseId}`, "page");
            revalidatePath(`/ar/courses/${courseId}`, "page");
        }

        return NextResponse.json(
            { message: 'Watch record added successfully' },
            { status: 200 }
        );
        
    } catch (error) {
        console.error('[LESSON-WATCH] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
