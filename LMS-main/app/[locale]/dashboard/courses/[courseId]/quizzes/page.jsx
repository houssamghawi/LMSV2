import { getLoggedInUser } from "@/lib/loggedin-user";
import { getCourseWithOwnershipCheck } from "@/lib/authorization";
import { getCourseQuizzes } from "@/queries/quizv2";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Eye, EyeOff, FileQuestion } from "lucide-react";
import { deleteQuiz, publishQuiz } from "@/app/actions/quizv2";
import { QuizActions } from "./_components/quiz-actions";

export default async function QuizzesPage({ params }) {
    const { courseId } = await params;
    const t = await getTranslations("Quiz");

    const user = await getLoggedInUser();
    if (!user) {
        redirect("/login");
    }

    const course = await getCourseWithOwnershipCheck(courseId, user.id, user);
    if (!course) {
        notFound();
    }

    const quizzes = await getCourseQuizzes(courseId, {
        includeUnpublished: true
    });

    // Serialize data to plain objects before passing to client components
    const coursePlain = JSON.parse(JSON.stringify(course));
    const quizzesPlain = JSON.parse(JSON.stringify(quizzes));

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">{t("quizzes")}</h1>
                    <p className="text-slate-600" dir="auto">{coursePlain.title}</p>
                </div>
                <Link href={`/dashboard/courses/${courseId}/quizzes/new`}>
                    <Button>
                        <Plus className="w-4 h-4 me-2" />
                        {t("newQuiz")}
                    </Button>
                </Link>
            </div>

            {quizzesPlain.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <FileQuestion className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                    <p className="text-slate-500 mb-4">{t("noQuizzesYet")}</p>
                    <Link href={`/dashboard/courses/${courseId}/quizzes/new`}>
                        <Button>
                            <Plus className="w-4 h-4 me-2" />
                            {t("createFirstQuiz")}
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {quizzesPlain.map((quiz) => (
                        <div key={quiz.id} className="border rounded-lg p-6 bg-white">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="text-lg font-medium" dir="auto">{quiz.title}</h3>
                                        {quiz.published ? (
                                            <Badge variant="default" className="bg-emerald-100 text-emerald-800">
                                                <Eye className="w-3 h-3 me-1 rtl:rotate-180" />
                                                {t("published")}
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary">
                                                <EyeOff className="w-3 h-3 me-1 rtl:rotate-180" />
                                                {t("draft")}
                                            </Badge>
                                        )}
                                        {quiz.required && (
                                            <Badge variant="outline">{t("required")}</Badge>
                                        )}
                                        {quiz.lessonId && (
                                            <Badge variant="outline">{t("lessonQuiz")}</Badge>
                                        )}
                                    </div>
                                    {quiz.description && (
                                        <p className="text-slate-600 mb-3" dir="auto">{quiz.description}</p>
                                    )}
                                    <div className="flex items-center gap-4 text-sm text-slate-500">
                                        <span>{t("pass")}: {quiz.passPercent}%</span>
                                        {quiz.timeLimitSec && (
                                            <span>{t("time")}: {Math.floor(quiz.timeLimitSec / 60)} min</span>
                                        )}
                                        {quiz.maxAttempts !== null && (
                                            <span>{t("maxAttempts")}: {quiz.maxAttempts}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2 ms-4">
                                    <QuizActions quiz={quiz} courseId={courseId} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
