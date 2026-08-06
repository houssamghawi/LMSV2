"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { createQuiz } from "@/app/actions/quizv2";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function QuizForm({ courseId, course }) {
    const router = useRouter();
    const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
        defaultValues: {
            title: "",
            description: "",
            published: false,
            required: false,
            passPercent: 70,
            timeLimitSec: null,
            maxAttempts: null,
            shuffleQuestions: false,
            shuffleOptions: false,
            showAnswersPolicy: "after_submit",
            lessonId: null
        }
    });

    const onSubmit = async (data) => {
        try {
            const result = await createQuiz(
                courseId,
                data.lessonId || null,
                {
                    title: data.title,
                    description: data.description || "",
                    published: data.published || false,
                    required: data.required || false,
                    passPercent: Number(data.passPercent) || 70,
                    timeLimitSec: data.timeLimitSec ? Number(data.timeLimitSec) * 60 : null,
                    maxAttempts: data.maxAttempts ? Number(data.maxAttempts) : null,
                    shuffleQuestions: data.shuffleQuestions || false,
                    shuffleOptions: data.shuffleOptions || false,
                    showAnswersPolicy: data.showAnswersPolicy || "after_submit"
                }
            );

            if (result.ok) {
                toast.success("Quiz created successfully");
                router.push(`/dashboard/courses/${courseId}/quizzes/${result.quizId}/questions`);
            } else {
                toast.error(result.error || "Failed to create quiz");
            }
        } catch (error) {
            toast.error("Failed to create quiz");
        }
    };

    // Get all lessons from all modules
    const allLessons = [];
    course?.modules?.forEach(module => {
        module.lessonIds?.forEach(lesson => {
            allLessons.push({ ...lesson, moduleTitle: module.title });
        });
    });

    return (
        <div className="max-w-2xl">
            <Link href={`/dashboard/courses/${courseId}/quizzes`}>
                <Button variant="ghost" className="mb-6">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Quizzes
                </Button>
            </Link>

            <h1 className="text-2xl font-bold mb-6">Create New Quiz</h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Title */}
                <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                        id="title"
                        {...register("title", { required: "Title is required" })}
                        className="mt-1"
                    />
                    {errors.title && (
                        <p className="text-sm text-red-600 mt-1">{errors.title.message}</p>
                    )}
                </div>

                {/* Description */}
                <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        {...register("description")}
                        className="mt-1"
                        rows={3}
                    />
                </div>

                {/* Lesson (optional) */}
                <div>
                    <Label htmlFor="lessonId">Attach to Lesson (optional)</Label>
                    <Select onValueChange={(value) => setValue("lessonId", value === "none" ? null : value)}>
                        <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select a lesson (or leave for course-level quiz)" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Course-level Quiz</SelectItem>
                            {allLessons.map((lesson) => (
                                <SelectItem key={lesson.id} value={lesson.id}>
                                    {lesson.title} ({lesson.moduleTitle})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Pass Percent */}
                <div>
                    <Label htmlFor="passPercent">Pass Percentage (%)</Label>
                    <Input
                        id="passPercent"
                        type="number"
                        min="0"
                        max="100"
                        {...register("passPercent", { min: 0, max: 100 })}
                        className="mt-1"
                    />
                </div>

                {/* Time Limit */}
                <div>
                    <Label htmlFor="timeLimitSec">Time Limit (minutes, optional)</Label>
                    <Input
                        id="timeLimitSec"
                        type="number"
                        min="1"
                        {...register("timeLimitSec")}
                        className="mt-1"
                        placeholder="Leave empty for no time limit"
                    />
                </div>

                {/* Max Attempts */}
                <div>
                    <Label htmlFor="maxAttempts">Max Attempts (optional)</Label>
                    <Input
                        id="maxAttempts"
                        type="number"
                        min="1"
                        {...register("maxAttempts")}
                        className="mt-1"
                        placeholder="Leave empty for unlimited"
                    />
                </div>

                {/* Show Answers Policy */}
                <div>
                    <Label htmlFor="showAnswersPolicy">Show Answers Policy</Label>
                    <Select
                        defaultValue="after_submit"
                        onValueChange={(value) => setValue("showAnswersPolicy", value)}
                    >
                        <SelectTrigger className="mt-1">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="never">Never</SelectItem>
                            <SelectItem value="after_submit">After Submit</SelectItem>
                            <SelectItem value="after_pass">After Pass</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Options */}
                <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="published"
                            checked={watch("published")}
                            onCheckedChange={(checked) => setValue("published", checked)}
                        />
                        <Label htmlFor="published" className="cursor-pointer">
                            Publish immediately
                        </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="required"
                            checked={watch("required")}
                            onCheckedChange={(checked) => setValue("required", checked)}
                        />
                        <Label htmlFor="required" className="cursor-pointer">
                            Required (blocks course completion until passed)
                        </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="shuffleQuestions"
                            checked={watch("shuffleQuestions")}
                            onCheckedChange={(checked) => setValue("shuffleQuestions", checked)}
                        />
                        <Label htmlFor="shuffleQuestions" className="cursor-pointer">
                            Shuffle questions
                        </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="shuffleOptions"
                            checked={watch("shuffleOptions")}
                            onCheckedChange={(checked) => setValue("shuffleOptions", checked)}
                        />
                        <Label htmlFor="shuffleOptions" className="cursor-pointer">
                            Shuffle options
                        </Label>
                    </div>
                </div>

                {/* Submit */}
                <div className="flex gap-2">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Creating..." : "Create Quiz"}
                    </Button>
                    <Link href={`/dashboard/courses/${courseId}/quizzes`}>
                        <Button type="button" variant="outline">Cancel</Button>
                    </Link>
                </div>
            </form>
        </div>
    );
}
