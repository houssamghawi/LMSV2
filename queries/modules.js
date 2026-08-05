import { replaceMongoIdInObject } from "@/lib/convertData";
import { LESSON_EDITOR_FIELDS } from "@/lib/lesson-query-fields";
import { Lesson } from "@/model/lesson.model";
import { Module } from "@/model/module.model";
import { dbConnect } from "@/service/mongo";

export async function create(mdouleData) {
    await dbConnect();
    try {
        const module = await Module.create(mdouleData);
        return JSON.parse(JSON.stringify(module));
    } catch (error) {
        throw new Error(error);
    }
}

export async function getModule(moduleId){
    await dbConnect();
    try {
        const module = await Module.findById(moduleId).
        populate({
            path: "lessonIds",
            model: Lesson,
            select: LESSON_EDITOR_FIELDS
        }).lean();
        return replaceMongoIdInObject(module);
    } catch (error) {
        throw new Error(error);
    }
}

export async function getModulesForCourse(courseId) {
    await dbConnect();
    try {
        return Module.find({ course: courseId }).sort({ order: 1 }).lean();
    } catch (error) {
        throw new Error(error);
    }
}

export async function getModuleBySlug(moduleSlug) {
    await dbConnect();
    try {
        const module = await Module.findOne({slug: moduleSlug }).lean();
        return replaceMongoIdInObject(module);
    } catch (error) {
        throw new Error(error);
    }
}