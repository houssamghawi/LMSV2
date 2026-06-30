"use server"

import { replaceMongoIdInObject } from "@/lib/convertData";
import { Course } from "@/model/course-model";
import { Module } from "@/model/module.model";
import { create } from "@/queries/modules";
import { moduleSchema } from "@/lib/validations";
import mongoose from "mongoose";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { dbConnect } from "@/service/mongo";

export async function createModule(data){
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            throw new Error('Unauthorized: Please log in');
        }
        
        const title = data.get("title");
        let slug = data.get("slug");
        const courseId = data.get("courseId");
        const order = data.get("order");

        if (!title || !courseId) {
            throw new Error('Title and course ID are required');
        }

        // Ensure slug is set - generate from title if missing or empty
        if (!slug || (typeof slug === 'string' && slug.trim() === '')) {
            const { getSlug } = await import('@/lib/convertData');
            slug = getSlug(title) || `module-${Date.now()}`;
        }

        const course = await Course.findById(courseId);
        if (!course) {
            throw new Error('Course not found');
        }
        
        // Verify user owns the course
        if (course.instructor.toString() !== user.id) {
            throw new Error('Forbidden: You do not have permission to modify this course');
        }

        const createdModule = await create({title,slug, course: courseId,order});
        course.modules.push(createdModule._id);
        await course.save();

        return replaceMongoIdInObject(createdModule);
        
    } catch (error) {
        throw new Error(error?.message || 'Failed to create module');
    }
}

export async function reOrderModules(data){
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            throw new Error('Unauthorized: Please log in');
        }
        
        // Verify ownership of all modules being reordered
        const { verifyOwnsAllModules } = await import('@/lib/authorization');
        const moduleIds = data.map(element => element.id);
        await verifyOwnsAllModules(moduleIds, user.id, user);
        
        await Promise.all(data.map(async(element) => {
            await Module.findByIdAndUpdate(element.id, {order: element.position});
        }));
    } catch (error) {
        throw new Error(error?.message || 'Failed to reorder modules');
    }
}

/** BOLA: ownership via assertInstructorOwnsModule. Mass assignment: only title, slug, order. */
export async function updateModule(moduleId, data) {
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            throw new Error('Unauthorized: Please log in');
        }
        const { assertInstructorOwnsModule } = await import('@/lib/authorization');
        await assertInstructorOwnsModule(moduleId, user.id, user);
        const updateSchema = moduleSchema.partial().strict();
        const parsed = updateSchema.safeParse(data);
        if (!parsed.success) {
            throw new Error('Validation failed for module update');
        }
        const allowed = parsed.data;
        if (Object.keys(allowed).length === 0) return;
        await Module.findByIdAndUpdate(moduleId, { $set: allowed }, { runValidators: true });
    } catch (error) {
        throw new Error(error?.message || 'Failed to update module');
    }
}



export async function changeModulePublishState(moduleId) {
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            throw new Error('Unauthorized: Please log in');
        }
        
        // Verify ownership via module -> course chain
        const { assertInstructorOwnsModule } = await import('@/lib/authorization');
        await assertInstructorOwnsModule(moduleId, user.id, user);
        
        const module = await Module.findById(moduleId);
        if (!module) {
            throw new Error('Module not found');
        }
        
        const res = await Module.findByIdAndUpdate(
            moduleId, 
            [{ $set: { active: { $not: "$active" } } }],
            { new: true, lean: true }
        );
        return res?.active ?? false;

    } catch (error) {
        throw new Error(error?.message || 'Failed to change module publish state');
    }
}

/** BOLA: user must own course; module must belong to that course (prevent IDOR with cross-course moduleId). */
export async function deleteModule(moduleId, courseId) {
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            throw new Error('Unauthorized: Please log in');
        }
        const course = await Course.findById(courseId).select('instructor modules').lean();
        if (!course) {
            throw new Error('Course not found');
        }
        if (course.instructor.toString() !== user.id) {
            throw new Error('Forbidden: You do not have permission to modify this course');
        }
        const module = await Module.findById(moduleId).select('course').lean();
        if (!module) {
            throw new Error('Module not found');
        }
        if (module.course.toString() !== courseId.toString()) {
            throw new Error('Forbidden: Module does not belong to this course');
        }
        await Course.findByIdAndUpdate(courseId, { $pull: { modules: new mongoose.Types.ObjectId(moduleId) } });
        await Module.findByIdAndDelete(moduleId);
    } catch (error) {
        throw new Error(error?.message || 'Failed to delete module');
    }
}
