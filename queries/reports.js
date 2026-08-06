import { replaceMongoIdInObject } from "@/lib/convertData";
import { Assessment } from "@/model/assessment-model";
import { Module } from "@/model/module.model";
import { Report } from "@/model/report-model";
import mongoose from "mongoose";
import { getCourseDetails } from "./courses";
import { dbConnect } from "@/service/mongo";
import { getCourseQuizzes, getStudentQuizStatusMap } from "./quizv2";


export async function getReport(filter){
    await dbConnect();
    try {
        const report = await Report.findOne(filter)
        .populate({
            path: "quizAssessment",
            model: Assessment,
        }).lean();
        return replaceMongoIdInObject(report);
    } catch (error) {
        throw new Error(error);
    }
     
}

export async function createWatchReport(data){
    await dbConnect();
    try {
        let report = await Report.findOne({
            course: data.courseId,
            student: data.userId,
        });

        if (!report) {
            report = await Report.create({
                course: data.courseId,
                student: data.userId,
                totalCompletedLessons: [],
                totalCompletedModules: []
            });
        }

        // Ensure arrays are initialized
        if (!report.totalCompletedLessons) report.totalCompletedLessons = [];
        if (!report.totalCompletedModules) report.totalCompletedModules = [];

        // Check if lesson has required quiz that must be passed
        const allQuizzes = await getCourseQuizzes(data.courseId, {
            forStudent: false,
            includeUnpublished: false
        });
        const lessonRequiredQuizzes = allQuizzes.filter(
            q => q.lessonId && q.lessonId.toString() === data.lessonId.toString() && q.required
        );
        
        let allRequiredPassed = true;
        if (lessonRequiredQuizzes.length > 0) {
            const quizStatusMap = await getStudentQuizStatusMap(data.courseId, data.userId);
            allRequiredPassed = lessonRequiredQuizzes.every(q => {
                const status = quizStatusMap[q.id];
                return status && status.passed;
            });
        }

        // Lesson is complete when watch is completed AND all required quizzes are passed
        // Fix ObjectId comparison: use toString()
        const foundLesson = report.totalCompletedLessons.find((lessonId) => lessonId.toString() === data.lessonId.toString());

        if (!foundLesson && allRequiredPassed) {
            report.totalCompletedLessons.push(
                new mongoose.Types.ObjectId(data.lessonId)
            );
        }

        const module = await Module.findById(data.moduleId);
        if (!module) {
            throw new Error('Module not found');
        }
        
        const lessonIdsToCheck = module.lessonIds || [];
        const completedLessonsIds = report.totalCompletedLessons;

        // Fix ObjectId comparison: convert to strings for comparison
        const completedLessonStrings = new Set(completedLessonsIds.map(id => id.toString()));
        const isModuleComplete = lessonIdsToCheck.length > 0 && lessonIdsToCheck.every((lesson) => 
            completedLessonStrings.has(lesson.toString())
        );

        if (isModuleComplete) {
            const foundModule = report.totalCompletedModules.find((module) => module.toString() === data.moduleId.toString());
            if (!foundModule) {
                report.totalCompletedModules.push(
                    new mongoose.Types.ObjectId(data.moduleId)
                );
            }
        }

        /// Check if the course has completed
     
        const course = await getCourseDetails(data.courseId);
        const modulesInCourse = course?.modules;
        const moduleCount = modulesInCourse?.length ?? 0;
         
        const completedModule = report.totalCompletedModules;
        const completedModuleCount = completedModule?.length ?? 0;

        // Check if course has required quizzes that must be passed
        const courseRequiredQuizzes = allQuizzes.filter(
            q => !q.lessonId && q.required
        );
        let allCourseQuizzesPassed = true;
        if (courseRequiredQuizzes.length > 0) {
            const quizStatusMap = await getStudentQuizStatusMap(data.courseId, data.userId);
            allCourseQuizzesPassed = courseRequiredQuizzes.every(q => {
                const status = quizStatusMap[q.id];
                return status && status.passed;
            });
        }

        // Course is complete when all modules are completed AND all required course quizzes are passed
        if (moduleCount > 0 && completedModuleCount === moduleCount && allCourseQuizzesPassed) {
            report.completion_date = new Date();
        }
        
        await report.save();

    } catch (error) {
        throw new Error(error);
    }

}


export async function createAssessmentReport(data){
    await dbConnect();
    try {
        let report = await Report.findOne({ course:data.courseId, student: data.userId })
        if (!report) {
            report = await Report.create({ 
                course:data.courseId,
                student: data.userId, 
                quizAssessment: data.quizAssessment,
                totalCompletedLessons: [],
                totalCompletedModules: []
            });
        } else {
            if (!report.quizAssessment) {
                report.quizAssessment = data.quizAssessment;
                await report.save();
            }
        } 
    } catch (error) {
        throw new Error(error);
    }

}