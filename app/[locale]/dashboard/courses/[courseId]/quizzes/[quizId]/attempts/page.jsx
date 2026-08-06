import { getLoggedInUser } from "@/lib/loggedin-user";
import { getCourseWithOwnershipCheck } from "@/lib/authorization";
import { getQuizWithQuestions } from "@/queries/quizv2";
import { getAttemptsForQuiz } from "@/queries/quizv2";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, ArrowLeft } from "lucide-react";

export default async function AttemptsPage({ params }) {
    const { courseId, quizId } = await params;
    const t = await getTranslations("Quiz");

    const user = await getLoggedInUser();
    if (!user) {
        redirect("/login");
    }

    const course = await getCourseWithOwnershipCheck(courseId, user.id, user);
    if (!course) {
        notFound();
    }

    const quiz = await getQuizWithQuestions(quizId);
    if (!quiz) {
        notFound();
    }

    // Verify ownership
    if (quiz.courseId.toString() !== courseId) {
        notFound();
    }

    const attempts = await getAttemptsForQuiz(quizId);

    // Serialize data to plain objects
    const quizPlain = JSON.parse(JSON.stringify(quiz));
    const attemptsPlain = JSON.parse(JSON.stringify(attempts));

    return (
        <div className="p-6">
            <Link href={`/dashboard/courses/${courseId}/quizzes`}>
                <Button variant="ghost" className="mb-6">
                    <ArrowLeft className="w-4 h-4 me-2 rtl:rotate-180" />
                    {t("backToQuizzes")}
                </Button>
            </Link>

            <div className="mb-6">
                <h1 className="text-2xl font-bold">{quizPlain.title}</h1>
                <p className="text-slate-600">{t("attemptHistory")}</p>
            </div>

            {attemptsPlain.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <p className="text-slate-500">{t("noAttemptsYet")}</p>
                </div>
            ) : (
                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-start text-sm font-medium text-slate-700">{t("student")}</th>
                                <th className="px-4 py-3 text-start text-sm font-medium text-slate-700">{t("status")}</th>
                                <th className="px-4 py-3 text-start text-sm font-medium text-slate-700">{t("score")}</th>
                                <th className="px-4 py-3 text-start text-sm font-medium text-slate-700">{t("result")}</th>
                                <th className="px-4 py-3 text-start text-sm font-medium text-slate-700">{t("submitted")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {attemptsPlain.map((attempt) => (
                                <tr key={attempt.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3">
                                        {attempt.studentId?.firstName} {attempt.studentId?.lastName}
                                        <p className="text-xs text-slate-500">{attempt.studentId?.email}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge variant={attempt.status === "submitted" ? "default" : "secondary"}>
                                            {attempt.status === "submitted" ? t("submitted") : attempt.status}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                        {attempt.scorePercent?.toFixed(1) || 0}%
                                    </td>
                                    <td className="px-4 py-3">
                                        {attempt.passed ? (
                                            <Badge variant="default" className="bg-emerald-100 text-emerald-800">
                                                <CheckCircle className="w-3 h-3 me-1" />
                                                {t("passed")}
                                            </Badge>
                                        ) : (
                                            <Badge variant="destructive">
                                                <XCircle className="w-3 h-3 me-1" />
                                                {t("notPassed")}
                                            </Badge>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600">
                                        {attempt.submittedAt
                                            ? new Date(attempt.submittedAt).toLocaleString()
                                            : "-"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
