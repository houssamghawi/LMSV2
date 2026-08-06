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
import { updateQuiz, deleteQuiz } from "@/app/actions/quizv2";
import { Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export function QuizEditForm({ quiz, courseId, course }) {
    const router = useRouter();
    const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
        defaultValues: {
            title: quiz.title || "",
            description: quiz.description || "",
            published: quiz.published || false,
            required: quiz.required || false,
            passPercent: quiz.passPercent || 70,
            timeLimitSec: quiz.timeLimitSec ? Math.floor(quiz.timeLimitSec / 60) : null,
            maxAttempts: quiz.maxAttempts || null,
            shuffleQuestions: quiz.shuffleQuestions || false,
            shuffleOptions: quiz.shuffleOptions || false,
            showAnswersPolicy: quiz.showAnswersPolicy || "after_submit",
            lessonId: quiz.lessonId || null
        }
    });

    const [isDeleting, setIsDeleting] = useState(false);

    const onSubmit = async (data) => {
        try {
            const result = await updateQuiz(quiz.id, {
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
            });

            if (result.ok) {
                toast.success("Quiz updated successfully");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to update quiz");
            }
        } catch (error) {
            toast.error("Failed to update quiz");
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete "${quiz.title}"? This cannot be undone.`)) {
            return;
        }

        setIsDeleting(true);
        try {
            const result = await deleteQuiz(quiz.id);
            if (result.ok) {
                toast.success("Quiz deleted");
                router.push(`/dashboard/courses/${courseId}/quizzes`);
            } else {
                toast.error(result.error || "Failed to delete quiz");
            }
        } catch (error) {
            toast.error("Failed to delete quiz");
        } finally {
            setIsDeleting(false);
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

            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Edit Quiz</h1>
                <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isDeleting ? "Deleting..." : "Delete Quiz"}
                </Button>
            </div>

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

                {/* Lesson (read-only if already set) */}
                <div>
                    <Label htmlFor="lessonId">Attached to Lesson</Label>
                    <Input
                        id="lessonId"
                        value={quiz.lessonId ? allLessons.find(l => l.id === quiz.lessonId)?.title || "Unknown" : "Course-level Quiz"}
                        disabled
                        className="mt-1 bg-slate-50"
                    />
                    <p className="text-xs text-slate-500 mt-1">Lesson cannot be changed after quiz creation</p>
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
                        defaultValue={watch("showAnswersPolicy")}
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
                            Published
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
                        {isSubmitting ? "Saving..." : "Save Changes"}
                    </Button>
                    <Link href={`/dashboard/courses/${courseId}/quizzes`}>
                        <Button type="button" variant="outline">Cancel</Button>
                    </Link>
                </div>
            </form>
        </div>
    );
}
