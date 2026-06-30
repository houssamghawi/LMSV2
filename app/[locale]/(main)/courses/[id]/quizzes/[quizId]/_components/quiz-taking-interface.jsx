"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { startOrResumeAttempt, autosaveAttempt, submitAttempt } from "@/app/actions/quizv2";
import { Clock, ChevronLeft, ChevronRight, Send, Save } from "lucide-react";

export function QuizTakingInterface({ quiz, courseId, existingAttemptId, isPreview }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(!existingAttemptId);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [attemptId, setAttemptId] = useState(existingAttemptId);
    const [questions, setQuestions] = useState(quiz.questions || []);
    const [shuffledQuestions, setShuffledQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [timeRemaining, setTimeRemaining] = useState(null);
    const [expiresAt, setExpiresAt] = useState(null);

    // Initialize attempt and load questions
    useEffect(() => {
        async function init() {
            if (existingAttemptId) {
                // Load existing attempt
                try {
                    const res = await fetch(`/api/quizv2/attempts/${existingAttemptId}`);
                    const data = await res.json();
                    if (data.ok) {
                        const attempt = data.attempt;
                        setExpiresAt(attempt.expiresAt ? new Date(attempt.expiresAt) : null);
                        
                        // Restore answers
                        const answerMap = {};
                        attempt.answers?.forEach(a => {
                            answerMap[a.questionId] = a.selectedOptionIds;
                        });
                        setAnswers(answerMap);
                        
                        // Calculate time remaining
                        if (attempt.expiresAt) {
                            const remaining = Math.max(0, Math.floor((new Date(attempt.expiresAt) - new Date()) / 1000));
                            setTimeRemaining(remaining);
                        }
                    }
                } catch (error) {
                    toast.error("Failed to load attempt");
                }
                setIsLoading(false);
                return;
            }

            // Start new attempt
            try {
                const result = await startOrResumeAttempt(quiz.id);
                if (result.ok) {
                    setAttemptId(result.attemptId);
                    
                    // Load attempt to get expiresAt
                    const res = await fetch(`/api/quizv2/attempts/${result.attemptId}`);
                    const data = await res.json();
                    if (data.ok && data.attempt.expiresAt) {
                        const expires = new Date(data.attempt.expiresAt);
                        setExpiresAt(expires);
                        const remaining = Math.max(0, Math.floor((expires - new Date()) / 1000));
                        setTimeRemaining(remaining);
                    }
                } else {
                    toast.error(result.error || "Failed to start quiz");
                    router.push(`/courses/${courseId}/quizzes`);
                }
            } catch (error) {
                toast.error("Failed to start quiz");
                router.push(`/courses/${courseId}/quizzes`);
            } finally {
                setIsLoading(false);
            }
        }
        init();
    }, [existingAttemptId, quiz.id, courseId, router]);

    // Shuffle questions if needed
    useEffect(() => {
        if (questions.length === 0) return;
        
        let ordered = [...questions];
        if (quiz.shuffleQuestions) {
            // Simple shuffle (could use seeded shuffle for consistency)
            ordered = ordered.sort(() => Math.random() - 0.5);
        }
        
        // Shuffle options if needed
        if (quiz.shuffleOptions) {
            ordered = ordered.map(q => ({
                ...q,
                options: [...q.options].sort(() => Math.random() - 0.5)
            }));
        }
        
        setShuffledQuestions(ordered);
    }, [questions, quiz.shuffleQuestions, quiz.shuffleOptions]);

    // Timer countdown
    useEffect(() => {
        if (timeRemaining === null || timeRemaining <= 0 || !attemptId) return;

        const interval = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev === null || prev <= 1) {
                    clearInterval(interval);
                    handleSubmit(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [timeRemaining, attemptId]);

    // Autosave
    useEffect(() => {
        if (!attemptId || Object.keys(answers).length === 0 || isPreview) return;
        
        const autosaveTimer = setTimeout(() => {
            autosaveAttempt(attemptId, answers).catch(err => console.error("Autosave failed:", err));
        }, 5000);

        return () => clearTimeout(autosaveTimer);
    }, [answers, attemptId, isPreview]);

    const formatTime = useCallback((seconds) => {
        if (seconds === null) return null;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }, []);

    const currentQuestion = useMemo(
        () => shuffledQuestions[currentIndex],
        [shuffledQuestions, currentIndex]
    );

    const handleAnswerChange = useCallback((questionId, value, isMultiple = false) => {
        setAnswers((prev) => {
            if (isMultiple) {
                const current = prev[questionId] || [];
                const valueSet = new Set(current);
                if (valueSet.has(value)) {
                    valueSet.delete(value);
                } else {
                    valueSet.add(value);
                }
                return { ...prev, [questionId]: Array.from(valueSet) };
            } else {
                return { ...prev, [questionId]: value };
            }
        });
    }, []);

    const handleSubmit = useCallback(async (autoSubmit = false) => {
        if (isSubmitting || !attemptId) return;

        if (!autoSubmit) {
            const unanswered = shuffledQuestions.filter(q => !answers[q.id]);
            if (unanswered.length > 0) {
                const proceed = window.confirm(
                    `You have ${unanswered.length} unanswered question(s). Submit anyway?`
                );
                if (!proceed) return;
            }
        }

        setIsSubmitting(true);

        try {
            const result = await submitAttempt(attemptId, answers);

            if (result.ok) {
                toast.success(result.attempt.passed ? "Quiz passed!" : "Quiz submitted");
                router.push(
                    `/courses/${courseId}/quizzes/${quiz.id}/result?attemptId=${attemptId}`
                );
            } else {
                toast.error(result.error || "Failed to submit quiz");
            }
        } catch (error) {
            toast.error("Failed to submit quiz");
        } finally {
            setIsSubmitting(false);
        }
    }, [attemptId, answers, courseId, isSubmitting, shuffledQuestions, quiz.id, router]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading quiz...</p>
                </div>
            </div>
        );
    }

    if (shuffledQuestions.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-600">No questions found in this quiz.</p>
                <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => router.push(`/courses/${courseId}/quizzes`)}
                >
                    Back to Quizzes
                </Button>
            </div>
        );
    }

    const renderQuestion = () => {
        const questionId = currentQuestion.id;
        const currentAnswer = answers[questionId];
        const isMultiple = currentQuestion.type === "multi";

        if (currentQuestion.type === "true_false") {
            // For true/false, use the actual option IDs from the question
            const trueOption = currentQuestion.options.find(opt => opt.text.toLowerCase() === "true" || opt.id.toLowerCase() === "true");
            const falseOption = currentQuestion.options.find(opt => opt.text.toLowerCase() === "false" || opt.id.toLowerCase() === "false");
            
            return (
                <RadioGroup
                    value={currentAnswer || ""}
                    onValueChange={(value) => handleAnswerChange(questionId, value)}
                >
                    {trueOption && (
                        <div className="flex items-center gap-x-3 p-3 border rounded-lg hover:bg-slate-50">
                            <RadioGroupItem value={trueOption.id} id="true" />
                            <Label htmlFor="true" className="flex-1 cursor-pointer">{trueOption.text || "True"}</Label>
                        </div>
                    )}
                    {falseOption && (
                        <div className="flex items-center gap-x-3 p-3 border rounded-lg hover:bg-slate-50">
                            <RadioGroupItem value={falseOption.id} id="false" />
                            <Label htmlFor="false" className="flex-1 cursor-pointer">{falseOption.text || "False"}</Label>
                        </div>
                    )}
                </RadioGroup>
            );
        }

        return (
            <div className="space-y-2">
                {isMultiple && (
                    <p className="text-sm text-slate-500 mb-2">Select all that apply</p>
                )}
                {isMultiple ? (
                    currentQuestion.options.map((option, idx) => (
                        <div key={idx} className="flex items-center gap-x-3 p-3 border rounded-lg hover:bg-slate-50">
                            <Checkbox
                                id={`opt-${idx}`}
                                checked={(currentAnswer || []).includes(option.id)}
                                onCheckedChange={() => handleAnswerChange(questionId, option.id, true)}
                            />
                            <Label htmlFor={`opt-${idx}`} className="flex-1 cursor-pointer">
                                {option.text}
                            </Label>
                        </div>
                    ))
                ) : (
                    <RadioGroup
                        value={currentAnswer || ""}
                        onValueChange={(value) => handleAnswerChange(questionId, value)}
                    >
                        {currentQuestion.options.map((option, idx) => (
                            <div key={idx} className="flex items-center gap-x-3 p-3 border rounded-lg hover:bg-slate-50">
                                <RadioGroupItem value={option.id} id={`opt-${idx}`} />
                                <Label htmlFor={`opt-${idx}`} className="flex-1 cursor-pointer">
                                    {option.text}
                                </Label>
                            </div>
                        ))}
                    </RadioGroup>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4">
                <div>
                    <h1 className="text-xl font-bold">{quiz.title}</h1>
                    {isPreview && (
                        <Badge variant="secondary" className="mt-1">
                            Preview Mode
                        </Badge>
                    )}
                </div>
                {timeRemaining !== null && (
                    <div className="flex items-center gap-2 text-lg font-semibold">
                        <Clock className="w-5 h-5" />
                        {formatTime(timeRemaining)}
                    </div>
                )}
            </div>

            {/* Progress */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">
                    Question {currentIndex + 1} of {shuffledQuestions.length}
                </span>
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${((currentIndex + 1) / shuffledQuestions.length) * 100}%` }}
                    />
                </div>
            </div>

            {/* Question */}
            <div className="border rounded-lg p-6 bg-white">
                <div className="flex items-start justify-between mb-4">
                    <h2 className="text-lg font-medium">{currentQuestion.text}</h2>
                    <Badge variant="outline">{currentQuestion.points} pts</Badge>
                </div>

                {renderQuestion()}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
                <Button
                    variant="outline"
                    onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                    disabled={currentIndex === 0}
                >
                    <ChevronLeft className="w-4 h-4 me-2 rtl:rotate-180" />
                    Previous
                </Button>

                <div className="flex gap-2">
                    {!isPreview && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                autosaveAttempt(attemptId, answers).then(() => toast.success("Saved"));
                            }}
                        >
                            <Save className="w-4 h-4 me-2" />
                            Save
                        </Button>
                    )}

                    {currentIndex === shuffledQuestions.length - 1 ? (
                        <Button
                            onClick={() => handleSubmit(false)}
                            disabled={isSubmitting || isPreview}
                        >
                            <Send className="w-4 h-4 me-2 rtl:rotate-180" />
                            {isSubmitting ? "Submitting..." : "Submit Quiz"}
                        </Button>
                    ) : (
                        <Button
                            onClick={() => setCurrentIndex(Math.min(shuffledQuestions.length - 1, currentIndex + 1))}
                        >
                            Next
                            <ChevronRight className="w-4 h-4 ms-2 rtl:rotate-180" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
