"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { addQuestion, updateQuestion, deleteQuestion, reorderQuestions } from "@/app/actions/quizv2";
import { Plus, Edit, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { QuestionFormDialog } from "./question-form-dialog";
import Link from "next/link";
function QuestionItem({ question, onEdit, onDelete, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) {
    return (
        <div className="border rounded-lg p-4 bg-white flex items-start gap-3">
            <div className="flex flex-col gap-1 mt-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onMoveUp}
                    disabled={!canMoveUp}
                    className="h-6 w-6 p-0"
                >
                    <ArrowUp className="w-3 h-3" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onMoveDown}
                    disabled={!canMoveDown}
                    className="h-6 w-6 p-0"
                >
                    <ArrowDown className="w-3 h-3" />
                </Button>
            </div>
            <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{question.text}</h4>
                            <Badge variant="outline">{question.type}</Badge>
                            <Badge variant="outline">{question.points} pts</Badge>
                        </div>
                        <p className="text-sm text-slate-600">
                            {question.options.length} options
                            {question.explanation && " • Has explanation"}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(question)}
                        >
                            <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onDelete(question.id)}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function QuestionsManager({ quiz, courseId }) {
    const router = useRouter();
    const [questions, setQuestions] = useState(quiz.questions || []);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [isReordering, setIsReordering] = useState(false);


    const handleAdd = () => {
        setEditingQuestion(null);
        setIsFormOpen(true);
    };

    const handleEdit = (question) => {
        setEditingQuestion(question);
        setIsFormOpen(true);
    };

    const handleDelete = async (questionId) => {
        if (!confirm("Are you sure you want to delete this question?")) {
            return;
        }

        try {
            const result = await deleteQuestion(questionId);
            if (result.ok) {
                toast.success("Question deleted");
                setQuestions(questions.filter(q => q.id !== questionId));
                router.refresh();
            } else {
                toast.error(result.error || "Failed to delete question");
            }
        } catch (error) {
            toast.error("Failed to delete question");
        }
    };

    const handleSave = async (questionData) => {
        try {
            let result;
            if (editingQuestion) {
                result = await updateQuestion(editingQuestion.id, questionData);
                if (result.ok) {
                    toast.success("Question updated");
                    setQuestions(questions.map(q => q.id === editingQuestion.id ? { ...q, ...questionData } : q));
                }
            } else {
                result = await addQuestion(quiz.id, questionData);
                if (result.ok) {
                    toast.success("Question added");
                    router.refresh();
                }
            }

            if (result.ok) {
                setIsFormOpen(false);
                setEditingQuestion(null);
            } else {
                toast.error(result.error || "Failed to save question");
            }
        } catch (error) {
            toast.error("Failed to save question");
        }
    };

    const handleMoveUp = async (questionId) => {
        const index = questions.findIndex(q => q.id === questionId);
        if (index <= 0) return;

        const newQuestions = [...questions];
        [newQuestions[index - 1], newQuestions[index]] = [newQuestions[index], newQuestions[index - 1]];
        setQuestions(newQuestions);

        setIsReordering(true);
        try {
            const result = await reorderQuestions(quiz.id, newQuestions.map(q => q.id));
            if (result.ok) {
                toast.success("Question moved up");
            } else {
                toast.error("Failed to save order");
                setQuestions(questions);
            }
        } catch (error) {
            toast.error("Failed to save order");
            setQuestions(questions);
        } finally {
            setIsReordering(false);
        }
    };

    const handleMoveDown = async (questionId) => {
        const index = questions.findIndex(q => q.id === questionId);
        if (index < 0 || index >= questions.length - 1) return;

        const newQuestions = [...questions];
        [newQuestions[index], newQuestions[index + 1]] = [newQuestions[index + 1], newQuestions[index]];
        setQuestions(newQuestions);

        setIsReordering(true);
        try {
            const result = await reorderQuestions(quiz.id, newQuestions.map(q => q.id));
            if (result.ok) {
                toast.success("Question moved down");
            } else {
                toast.error("Failed to save order");
                setQuestions(questions);
            }
        } catch (error) {
            toast.error("Failed to save order");
            setQuestions(questions);
        } finally {
            setIsReordering(false);
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <Link href={`/dashboard/courses/${courseId}/quizzes/${quiz.id}`}>
                        <Button variant="ghost" className="mb-2">
                            ← Back to Quizzes
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">{quiz.title}</h1>
                    <p className="text-slate-600">Manage Questions</p>
                </div>
                <Button onClick={handleAdd}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Question
                </Button>
            </div>

            {questions.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <p className="text-slate-500 mb-4">No questions yet</p>
                    <Button onClick={handleAdd}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Your First Question
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {questions.map((question, index) => (
                        <QuestionItem
                            key={question.id}
                            question={question}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onMoveUp={() => handleMoveUp(question.id)}
                            onMoveDown={() => handleMoveDown(question.id)}
                            canMoveUp={index > 0}
                            canMoveDown={index < questions.length - 1}
                        />
                    ))}
                </div>
            )}

            <QuestionFormDialog
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                question={editingQuestion}
                onSave={handleSave}
            />
        </div>
    );
}
