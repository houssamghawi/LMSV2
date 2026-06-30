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
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function QuizForm({ courseId, course }) {
    const t = useTranslations("Quiz");
    const router = useRouter();
    const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
        defaultValues: {
            title: "",
            description: "",
            published: false,
            required: false,
            passPercent: 70,
            timeLimitSec: "",
            maxAttempts: "",
            shuffleQuestions: false,
            shuffleOptions: false,
            showAnswersPolicy: "after_submit",
            lessonId: ""
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
                toast.success(t("quizCreated"));
                router.push(`/dashboard/courses/${courseId}/quizzes/${result.quizId}/questions`);
            } else {
                toast.error(result.error || t("failedCreateQuiz"));
            }
        } catch (error) {
            toast.error(t("failedCreateQuiz"));
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
                    <ArrowLeft className="w-4 h-4 me-2 rtl:rotate-180" />
                    {t("backToQuizzes")}
                </Button>
            </Link>

            <h1 className="text-2xl font-bold mb-6">{t("createNewQuiz")}</h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Title */}
                <div>
                    <Label htmlFor="title">{t("titleLabel")}</Label>
                    <Input
                        id="title"
                        {...register("title", { required: t("titleRequired") })}
                        className="mt-1"
                    />
                    {errors.title && (
                        <p className="text-sm text-red-600 mt-1">{errors.title.message}</p>
                    )}
                </div>

                {/* Description */}
                <div>
                    <Label htmlFor="description">{t("descriptionLabel")}</Label>
                    <Textarea
                        id="description"
                        {...register("description")}
                        className="mt-1"
                        rows={3}
                    />
                </div>

                {/* Lesson (optional) */}
                <div>
                    <Label htmlFor="lessonId">{t("attachToLesson")}</Label>
                    <Select onValueChange={(value) => setValue("lessonId", value === "none" ? null : value)}>
                        <SelectTrigger className="mt-1">
                            <SelectValue placeholder={t("selectLessonPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">{t("courseLevelQuiz")}</SelectItem>
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
                    <Label htmlFor="passPercent">{t("passPercentage")}</Label>
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
                    <Label htmlFor="timeLimitSec">{t("timeLimit")}</Label>
                    <Input
                        id="timeLimitSec"
                        type="number"
                        min="1"
                        {...register("timeLimitSec")}
                        className="mt-1"
                        placeholder={t("noTimeLimitPlaceholder")}
                    />
                </div>

                {/* Max Attempts */}
                <div>
                    <Label htmlFor="maxAttempts">{t("maxAttemptsLabel")}</Label>
                    <Input
                        id="maxAttempts"
                        type="number"
                        min="1"
                        {...register("maxAttempts")}
                        className="mt-1"
                        placeholder={t("unlimitedPlaceholder")}
                    />
                </div>

                {/* Show Answers Policy */}
                <div>
                    <Label htmlFor="showAnswersPolicy">{t("showAnswersPolicy")}</Label>
                    <Select
                        defaultValue="after_submit"
                        onValueChange={(value) => setValue("showAnswersPolicy", value)}
                    >
                        <SelectTrigger className="mt-1">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="never">{t("never")}</SelectItem>
                            <SelectItem value="after_submit">{t("afterSubmit")}</SelectItem>
                            <SelectItem value="after_pass">{t("afterPass")}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Options */}
                <div className="space-y-3">
                    <div className="flex items-center gap-x-2">
                        <Checkbox
                            id="published"
                            checked={watch("published")}
                            onCheckedChange={(checked) => setValue("published", checked)}
                        />
                        <Label htmlFor="published" className="cursor-pointer">
                            {t("publishImmediately")}
                        </Label>
                    </div>

                    <div className="flex items-center gap-x-2">
                        <Checkbox
                            id="required"
                            checked={watch("required")}
                            onCheckedChange={(checked) => setValue("required", checked)}
                        />
                        <Label htmlFor="required" className="cursor-pointer">
                            {t("requiredBlocksCompletion")}
                        </Label>
                    </div>

                    <div className="flex items-center gap-x-2">
                        <Checkbox
                            id="shuffleQuestions"
                            checked={watch("shuffleQuestions")}
                            onCheckedChange={(checked) => setValue("shuffleQuestions", checked)}
                        />
                        <Label htmlFor="shuffleQuestions" className="cursor-pointer">
                            {t("shuffleQuestions")}
                        </Label>
                    </div>

                    <div className="flex items-center gap-x-2">
                        <Checkbox
                            id="shuffleOptions"
                            checked={watch("shuffleOptions")}
                            onCheckedChange={(checked) => setValue("shuffleOptions", checked)}
                        />
                        <Label htmlFor="shuffleOptions" className="cursor-pointer">
                            {t("shuffleOptions")}
                        </Label>
                    </div>
                </div>

                {/* Submit */}
                <div className="flex gap-2">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? t("creating") : t("createQuiz")}
                    </Button>
                    <Link href={`/dashboard/courses/${courseId}/quizzes`}>
                        <Button type="button" variant="outline">{t("cancel")}</Button>
                    </Link>
                </div>
            </form>
        </div>
    );
}
