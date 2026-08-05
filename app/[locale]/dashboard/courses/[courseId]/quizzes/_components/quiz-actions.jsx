"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2, Eye, EyeOff, FileQuestion, Users } from "lucide-react";
import { deleteQuiz, publishQuiz } from "@/app/actions/quizv2";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function QuizActions({ quiz, courseId }) {
    const t = useTranslations("Quiz");
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    const handleDelete = async () => {
        if (!confirm(t("deleteConfirm", { title: quiz.title }))) {
            return;
        }

        setIsDeleting(true);
        try {
            const result = await deleteQuiz(quiz.id);
            if (result.ok) {
                toast.success(t("quizDeleted"));
                router.refresh();
            } else {
                toast.error(result.error || t("failedDeleteQuiz"));
            }
        } catch (error) {
            toast.error(t("failedDeleteQuiz"));
        } finally {
            setIsDeleting(false);
        }
    };

    const handlePublish = async () => {
        setIsPublishing(true);
        try {
            const result = await publishQuiz(quiz.id, !quiz.published);
            if (result.ok) {
                toast.success(quiz.published ? t("quizUnpublished") : t("quizPublished"));
                router.refresh();
            } else {
                toast.error(result.error || t("failedUpdateQuiz"));
            }
        } catch (error) {
            toast.error(t("failedUpdateQuiz"));
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <div className="flex gap-2">
            <Link href={`/dashboard/courses/${courseId}/quizzes/${quiz.id}/questions`}>
                <Button variant="outline" size="sm">
                    <FileQuestion className="w-4 h-4 me-2" />
                    {t("questions")}
                </Button>
            </Link>
            <Link href={`/dashboard/courses/${courseId}/quizzes/${quiz.id}/attempts`}>
                <Button variant="outline" size="sm">
                    <Users className="w-4 h-4 me-2" />
                    {t("attempts")}
                </Button>
            </Link>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                        <MoreVertical className="w-4 h-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <Link href={`/dashboard/courses/${courseId}/quizzes/${quiz.id}`}>
                        <DropdownMenuItem>
                            <Edit className="w-4 h-4 me-2" />
                            {t("edit")}
                        </DropdownMenuItem>
                    </Link>
                    <DropdownMenuItem onClick={handlePublish} disabled={isPublishing}>
                        {quiz.published ? (
                            <>
                                <EyeOff className="w-4 h-4 me-2 rtl:rotate-180" />
                                {t("unpublish")}
                            </>
                        ) : (
                            <>
                                <Eye className="w-4 h-4 me-2 rtl:rotate-180" />
                                {t("publish")}
                            </>
                        )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDelete} disabled={isDeleting} className="text-red-600">
                        <Trash2 className="w-4 h-4 me-2" />
                        {t("delete")}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
