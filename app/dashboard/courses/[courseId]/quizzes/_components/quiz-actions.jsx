"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2, Eye, EyeOff, FileQuestion, Users } from "lucide-react";
import { deleteQuiz, publishQuiz } from "@/app/actions/quizv2";
import { toast } from "sonner";
import Link from "next/link";

export function QuizActions({ quiz, courseId }) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete "${quiz.title}"? This cannot be undone.`)) {
            return;
        }

        setIsDeleting(true);
        try {
            const result = await deleteQuiz(quiz.id);
            if (result.ok) {
                toast.success("Quiz deleted");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to delete quiz");
            }
        } catch (error) {
            toast.error("Failed to delete quiz");
        } finally {
            setIsDeleting(false);
        }
    };

    const handlePublish = async () => {
        setIsPublishing(true);
        try {
            const result = await publishQuiz(quiz.id, !quiz.published);
            if (result.ok) {
                toast.success(quiz.published ? "Quiz unpublished" : "Quiz published");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to update quiz");
            }
        } catch (error) {
            toast.error("Failed to update quiz");
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <div className="flex gap-2">
            <Link href={`/dashboard/courses/${courseId}/quizzes/${quiz.id}/questions`}>
                <Button variant="outline" size="sm">
                    <FileQuestion className="w-4 h-4 mr-2" />
                    Questions
                </Button>
            </Link>
            <Link href={`/dashboard/courses/${courseId}/quizzes/${quiz.id}/attempts`}>
                <Button variant="outline" size="sm">
                    <Users className="w-4 h-4 mr-2" />
                    Attempts
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
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                        </DropdownMenuItem>
                    </Link>
                    <DropdownMenuItem onClick={handlePublish} disabled={isPublishing}>
                        {quiz.published ? (
                            <>
                                <EyeOff className="w-4 h-4 mr-2" />
                                Unpublish
                            </>
                        ) : (
                            <>
                                <Eye className="w-4 h-4 mr-2" />
                                Publish
                            </>
                        )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDelete} disabled={isDeleting} className="text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
