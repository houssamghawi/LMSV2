"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { deleteQuestion, updateQuestion } from "@/app/actions/quizzes";
import { ChevronUp, ChevronDown, Trash2, Edit2, GripVertical } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EditQuestionModal } from "./edit-question-modal";

const questionTypeLabels = {
  multiple_choice_single: "Single Choice",
  multiple_choice_multiple: "Multiple Choice",
  true_false: "True/False",
  short_text: "Short Text",
};

export function QuestionList({ quizId, questions: initialQuestions }) {
  const router = useRouter();
  const [questions, setQuestions] = useState(initialQuestions);
  const [isReordering, setIsReordering] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);

  const handleDelete = async (questionId) => {
    try {
      const result = await deleteQuestion(questionId);
      if (result.ok) {
        setQuestions((prev) => prev.filter((q) => q.id !== questionId));
        toast.success("Question deleted");
      } else {
        toast.error(result.error || "Failed to delete question");
      }
    } catch (error) {
      toast.error("Failed to delete question");
    }
  };

  const handleMoveUp = async (index) => {
    if (index === 0) return;
    setIsReordering(true);

    const newQuestions = [...questions];
    const currentQuestion = newQuestions[index];
    const prevQuestion = newQuestions[index - 1];

    // Swap orders
    const tempOrder = currentQuestion.order;
    currentQuestion.order = prevQuestion.order;
    prevQuestion.order = tempOrder;

    // Swap positions in array
    [newQuestions[index], newQuestions[index - 1]] = [
      newQuestions[index - 1],
      newQuestions[index],
    ];

    setQuestions(newQuestions);

    try {
      await Promise.all([
        updateQuestion(currentQuestion.id, { order: currentQuestion.order }),
        updateQuestion(prevQuestion.id, { order: prevQuestion.order }),
      ]);
      router.refresh();
    } catch (error) {
      toast.error("Failed to reorder questions");
      setQuestions(initialQuestions);
    } finally {
      setIsReordering(false);
    }
  };

  const handleMoveDown = async (index) => {
    if (index === questions.length - 1) return;
    setIsReordering(true);

    const newQuestions = [...questions];
    const currentQuestion = newQuestions[index];
    const nextQuestion = newQuestions[index + 1];

    // Swap orders
    const tempOrder = currentQuestion.order;
    currentQuestion.order = nextQuestion.order;
    nextQuestion.order = tempOrder;

    // Swap positions in array
    [newQuestions[index], newQuestions[index + 1]] = [
      newQuestions[index + 1],
      newQuestions[index],
    ];

    setQuestions(newQuestions);

    try {
      await Promise.all([
        updateQuestion(currentQuestion.id, { order: currentQuestion.order }),
        updateQuestion(nextQuestion.id, { order: nextQuestion.order }),
      ]);
      router.refresh();
    } catch (error) {
      toast.error("Failed to reorder questions");
      setQuestions(initialQuestions);
    } finally {
      setIsReordering(false);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="border-2 border-dashed rounded-lg p-8 text-center">
        <p className="text-slate-500">No questions yet. Add your first question using the form.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Questions ({questions.length})</h2>
      </div>

      {questions.map((question, index) => (
        <div
          key={question.id}
          className="border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow"
        >
          <div className="flex items-start gap-3">
            {/* Reorder controls */}
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleMoveUp(index)}
                disabled={index === 0 || isReordering}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <GripVertical className="h-4 w-4 text-slate-400 mx-auto" />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleMoveDown(index)}
                disabled={index === questions.length - 1 || isReordering}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>

            {/* Question content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-slate-500">Q{index + 1}</span>
                <Badge variant="outline" className="text-xs">
                  {questionTypeLabels[question.questionType] || question.questionType}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {question.points} pts
                </Badge>
              </div>

              <p className="font-medium mb-2 line-clamp-2">{question.questionText}</p>

              {/* Options preview */}
              {question.options && question.options.length > 0 && (
                <div className="text-sm text-slate-600 space-y-1">
                  {question.options.slice(0, 4).map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-2">
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center text-xs ${
                          opt.isCorrect
                            ? "bg-green-100 border-green-500 text-green-700"
                            : "border-slate-300"
                        }`}
                      >
                        {opt.isCorrect && "✓"}
                      </span>
                      <span className="truncate">{opt.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditingQuestion(question)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Question?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this question. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(question.id)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      ))}

      {editingQuestion && (
        <EditQuestionModal
          question={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSave={() => {
            setEditingQuestion(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

