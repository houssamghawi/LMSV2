import { getLoggedInUser } from "@/lib/loggedin-user";
import { getCourseWithOwnershipCheck } from "@/lib/authorization";
import { getQuizWithQuestions } from "@/queries/quizv2";
import { notFound, redirect } from "next/navigation";
import { QuizEditForm } from "./_components/quiz-edit-form";
import { getCourseDetails } from "@/queries/courses";

export default async function EditQuizPage({ params }) {
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

    const courseDetails = await getCourseDetails(courseId);

    // Serialize data to plain objects before passing to client components
    const quizPlain = JSON.parse(JSON.stringify(quiz));
    const courseDetailsPlain = courseDetails ? JSON.parse(JSON.stringify(courseDetails)) : null;

    return (
        <div className="p-6">
            <QuizEditForm quiz={quizPlain} courseId={courseId} course={courseDetailsPlain} />
        </div>
    );
}
