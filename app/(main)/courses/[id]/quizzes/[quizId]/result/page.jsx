import { getLoggedInUser } from "@/lib/loggedin-user";
import { getAttemptById } from "@/queries/quizv2";
import { getQuizWithQuestions } from "@/queries/quizv2";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function QuizResultPage({ params, searchParams }) {
    const { id: courseId, quizId } = await params;
    const resolvedSearchParams = await searchParams;
    const attemptId = resolvedSearchParams.attemptId;

    const user = await getLoggedInUser();
    if (!user) {
        redirect("/login");
    }

    // Get attempt
    let attempt = null;
    if (attemptId) {
        attempt = await getAttemptById(attemptId);
        // Security: Verify ownership - handle both string ID and populated object
        if (attempt) {
            const attemptStudentId = typeof attempt.studentId === 'object' && attempt.studentId !== null
                ? (attempt.studentId.id || attempt.studentId._id || attempt.studentId).toString()
                : attempt.studentId.toString();
            if (attemptStudentId !== user.id) {
                redirect(`/courses/${courseId}/quizzes`);
            }
        }
    } else {
        // Get latest attempt
        const { getLatestStudentAttempt } = await import("@/queries/quizv2");
        attempt = await getLatestStudentAttempt(quizId, user.id);
    }

    if (!attempt || attempt.status === "in_progress") {
        redirect(`/courses/${courseId}/quizzes/${quizId}`);
    }

    // Get quiz with questions
    const quiz = await getQuizWithQuestions(quizId);
    if (!quiz) {
        notFound();
    }

    // Convert to plain objects
    const quizPlain = JSON.parse(JSON.stringify(quiz));
    const attemptPlain = JSON.parse(JSON.stringify(attempt));

    // Determine if answers should be shown
    const canShowAnswers = (() => {
        if (quizPlain.showAnswersPolicy === "never") return false;
        if (quizPlain.showAnswersPolicy === "after_submit") return attemptPlain.status === "submitted";
        if (quizPlain.showAnswersPolicy === "after_pass") return attemptPlain.passed;
        return false;
    })();

    // Create question map
    const questionMap = {};
    quizPlain.questions.forEach(q => {
        questionMap[q.id] = q;
    });

    // Create answer map - handle both ObjectId and string questionId
    const answerMap = {};
    attemptPlain.answers.forEach(a => {
        const qId = a.questionId?.toString() || a.questionId;
        answerMap[qId] = a.selectedOptionIds || [];
    });

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">{quizPlain.title}</h1>
                <p className="text-slate-600">Quiz Results</p>
            </div>

            {/* Score Summary */}
            <div className="border rounded-lg p-6 bg-white mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold">Your Score</h2>
                        <p className="text-3xl font-bold mt-2">
                            {attemptPlain.scorePercent?.toFixed(1) || 0}%
                        </p>
                    </div>
                    {attemptPlain.passed ? (
                        <Badge variant="default" className="bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Passed
                        </Badge>
                    ) : (
                        <Badge variant="destructive">
                            <XCircle className="w-4 h-4 mr-2" />
                            Not Passed
                        </Badge>
                    )}
                </div>
                <div className="text-sm text-slate-600">
                    Pass requirement: {quizPlain.passPercent}%
                </div>
            </div>

            {/* Questions Review */}
            {canShowAnswers && (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Question Review</h2>
                    {quizPlain.questions.map((question, index) => {
                        const selectedIds = new Set(answerMap[question.id] || []);
                        const correctIds = new Set(question.correctOptionIds || []);
                        const isCorrect = correctIds.size === selectedIds.size &&
                                         [...correctIds].every(id => selectedIds.has(id));

                        return (
                            <div key={question.id} className="border rounded-lg p-6 bg-white">
                                <div className="flex items-start justify-between mb-4">
                                    <h3 className="font-medium">
                                        Question {index + 1}: {question.text}
                                    </h3>
                                    {isCorrect ? (
                                        <Badge variant="default" className="bg-emerald-100 text-emerald-800">
                                            Correct
                                        </Badge>
                                    ) : (
                                        <Badge variant="destructive">Incorrect</Badge>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {question.options.map((option, optIdx) => {
                                        const isSelected = selectedIds.has(option.id);
                                        const isCorrectOption = correctIds.has(option.id);
                                        
                                        let className = "p-2 rounded border";
                                        if (isCorrectOption) {
                                            className += " bg-emerald-50 border-emerald-200";
                                        } else if (isSelected && !isCorrectOption) {
                                            className += " bg-red-50 border-red-200";
                                        }

                                        return (
                                            <div key={optIdx} className={className}>
                                                <div className="flex items-center gap-2">
                                                    {isCorrectOption && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                                                    {isSelected && !isCorrectOption && <XCircle className="w-4 h-4 text-red-600" />}
                                                    <span>{option.text}</span>
                                                    {isSelected && <span className="text-xs text-slate-500">(Your answer)</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {question.explanation && (
                                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                                        <p className="text-sm text-blue-900">{question.explanation}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="mt-6">
                <Link href={`/courses/${courseId}/quizzes`}>
                    <Button variant="outline">Back to Quizzes</Button>
                </Link>
            </div>
        </div>
    );
}
