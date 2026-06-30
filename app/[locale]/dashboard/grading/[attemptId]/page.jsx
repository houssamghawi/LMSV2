import { getLoggedInUser } from "@/lib/loggedin-user";
import { getAttemptById, getQuizWithQuestions } from "@/queries/quizv2";
import { verifyInstructorOwnsCourse, isAdmin } from "@/lib/authorization";
import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { GradeResponseForm } from "../_components/grade-response-form";

export const dynamic = "force-dynamic";

export default async function GradeAttemptPage({ params }) {
    const t = await getTranslations("Grading");
    const { attemptId } = await params;
    const user = await getLoggedInUser();
    if (!user) redirect("/login");

    const attempt = await getAttemptById(attemptId);
    if (!attempt) notFound();

    // Authorization: instructor must own the course the quiz belongs to, or be admin.
    const quizCourseId = attempt.quizId?.courseId?._id?.toString?.()
        || attempt.quizId?.courseId?.toString?.()
        || attempt.quizId?.courseId;
    if (!isAdmin(user)) {
        const owns = await verifyInstructorOwnsCourse(quizCourseId, user.id, user);
        if (!owns) notFound();
    }

    if (attempt.status !== "pending_grading") {
        return (
            <div className="p-6" dir="auto">
                <Badge>{t("badgeFinalized")}</Badge>
                <p className="mt-3 text-slate-600">{t("formAttemptNotPending")}</p>
            </div>
        );
    }

    const quizId = attempt.quizId?._id?.toString?.() || attempt.quizId?.id || attempt.quizId;
    const quizWithQuestions = await getQuizWithQuestions(quizId);
    const questions = quizWithQuestions?.questions || [];
    const saQuestions = questions.filter((q) => q.type === "short_answer");

    // Map questionId -> answer for quick lookup
    const answerMap = new Map();
    for (const a of attempt.answers || []) {
        answerMap.set(a.questionId?.toString?.() || String(a.questionId), a);
    }

    return (
        <div className="p-6 space-y-4">
            <div>
                <h1 className="text-2xl font-bold" dir="auto">{t("formTitle")}</h1>
                <p className="text-slate-600" dir="auto">
                    {attempt.quizId?.title} — {attempt.studentId?.firstName} {attempt.studentId?.lastName}
                </p>
                <Badge variant="secondary" className="mt-2">
                    {attempt.pendingGradingCount} {t("pendingCountSuffix")}
                </Badge>
            </div>
            <div className="space-y-4">
                {saQuestions.map((q) => {
                    const answer = answerMap.get(q.id || q._id?.toString());
                    return (
                        <GradeResponseForm
                            key={q.id || q._id?.toString()}
                            attemptId={attempt.id}
                            questionId={q.id || q._id?.toString()}
                            maxPoints={q.points || 1}
                            studentResponse={answer?.textResponse || ""}
                            modelAnswer={q.modelAnswer || ""}
                            sourceQuote={q.sourceQuote || ""}
                            alreadyGraded={answer?.graded}
                        />
                    );
                })}
            </div>
        </div>
    );
}
