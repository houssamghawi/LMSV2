import { replaceMongoIdInObject } from "@/lib/convertData";
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
            model: Lesson
        }).lean();
        return replaceMongoIdInObject(module);
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