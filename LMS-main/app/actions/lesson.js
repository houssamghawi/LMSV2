"use server"

import { replaceMongoIdInObject } from "@/lib/convertData";
import { Lesson } from "@/model/lesson.model";
import { Module } from "@/model/module.model";
import { create } from "@/queries/lessons";
import { lessonSchema } from "@/lib/validations";
import mongoose from "mongoose";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { dbConnect } from "@/service/mongo";

export async function createLesson(data){
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            throw new Error('Unauthorized: Please log in');
        }
        
        const title = data.get("title");
        const slug = data.get("slug");
        const moduleId = data.get("moduleId");
        const order = data.get("order");

        if (!title || !moduleId) {
            throw new Error('Title and module ID are required');
        }

        // Verify ownership of the module before creating lesson
        const { assertInstructorOwnsModule } = await import('@/lib/authorization');
        await assertInstructorOwnsModule(moduleId, user.id, user);

        const createdLesson = await create({title,slug,order});

        const module = await Module.findById(moduleId);
        if (!module) {
            throw new Error('Module not found');
        }
        
        module.lessonIds.push(createdLesson._id);
        await module.save();

        return replaceMongoIdInObject(createdLesson);
        
    } catch (error) {
        throw new Error(error?.message || 'Failed to create lesson');
    }
}

export async function reOrderLesson(data){
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            throw new Error('Unauthorized: Please log in');
        }
        
        // Verify ownership of all lessons being reordered
        const { verifyOwnsAllLessons } = await import('@/lib/authorization');
        const lessonIds = data.map(element => element.id);
        await verifyOwnsAllLessons(lessonIds, user.id, user);
        
        await Promise.all(data.map(async(element) => {
            await Lesson.findByIdAndUpdate(element.id, {order: element.position});
        }));
    } catch (error) {
        throw new Error(error?.message || 'Failed to reorder lessons');
    }
}

/** BOLA: ownership via assertInstructorOwnsLesson. Mass assignment: only title, slug, order. */
export async function updateLesson(lessonId, data) {
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            throw new Error('Unauthorized: Please log in');
        }
        const { assertInstructorOwnsLesson } = await import('@/lib/authorization');
        await assertInstructorOwnsLesson(lessonId, user.id, user);
        const updateSchema = lessonSchema.partial().strict();
        const parsed = updateSchema.safeParse(data);
        if (!parsed.success) {
            throw new Error('Validation failed for lesson update');
        }
        const allowed = parsed.data;
        if (Object.keys(allowed).length === 0) return;
        await Lesson.findByIdAndUpdate(lessonId, { $set: allowed }, { runValidators: true });
    } catch (error) {
        throw new Error(error?.message || 'Failed to update lesson');
    }
}

export async function changeLessonPublishState(lessonId) {
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            throw new Error('Unauthorized: Please log in');
        }
        
        // Verify ownership via lesson -> module -> course chain
        const { assertInstructorOwnsLesson } = await import('@/lib/authorization');
        await assertInstructorOwnsLesson(lessonId, user.id, user);
        
        const lesson = await Lesson.findById(lessonId);
        if (!lesson) {
            throw new Error('Lesson not found');
        }
        
        const res = await Lesson.findByIdAndUpdate(
            lessonId, 
            [{ $set: { active: { $not: "$active" } } }],
            { new: true, lean: true }
        );
        return res?.active ?? false;

    } catch (error) {
        throw new Error(error?.message || 'Failed to change lesson publish state');
    }
}

export async function deleteLesson(lessonId, moduleId){
    await dbConnect();
    try {
        const user = await getLoggedInUser();
        if (!user) {
            throw new Error('Unauthorized: Please log in');
        }
        
        // Verify ownership via lesson -> module -> course chain
        const { assertInstructorOwnsLesson } = await import('@/lib/authorization');
        await assertInstructorOwnsLesson(lessonId, user.id, user);
        
        const module = await Module.findById(moduleId);
        if (!module) {
            throw new Error('Module not found');
        }
        
        module.lessonIds.pull(new mongoose.Types.ObjectId(lessonId));
        await Lesson.findByIdAndDelete(lessonId);
        await module.save();
    } catch (error) {
        throw new Error(error?.message || 'Failed to delete lesson');
    }
}



 
