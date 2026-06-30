import { getLoggedInUser } from "@/lib/loggedin-user";
import { getCourseWithOwnershipCheck } from "@/lib/authorization";
import { getQuizWithQuestions } from "@/queries/quizv2";
import { notFound, redirect } from "next/navigation";
import { QuestionsManager } from "./_components/questions-manager";

export default async function QuestionsPage({ params }) {
    const { courseId, quizId } = await params;

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

    // Serialize quiz data to plain object before passing to client component
    const quizPlain = JSON.parse(JSON.stringify(quiz));

    return (
        <div className="p-6">
            <QuestionsManager quiz={quizPlain} courseId={courseId} />
        </div>
    );
}
