import { getLoggedInUser } from "@/lib/loggedin-user";
import { hasEnrollmentForCourse } from "@/queries/enrollments";
import { getQuizWithQuestions } from "@/queries/quizv2";
import { getInProgressAttempt } from "@/queries/quizv2";
import { getCourseDetails } from "@/queries/courses";
import { notFound, redirect } from "next/navigation";
import { QuizTakingInterfaceWrapper } from "./_components/quiz-taking-interface-wrapper";

export default async function TakeQuizPage({ params, searchParams }) {
    const { id: courseId, quizId } = await params;
    const resolvedSearchParams = await searchParams;
    const attemptId = resolvedSearchParams.attemptId;

    const user = await getLoggedInUser();
    if (!user) {
        redirect("/login");
    }

    const course = await getCourseDetails(courseId);
    if (!course) {
        notFound();
    }

    // Check enrollment (instructor/admin can preview)
    const isInstructorOrAdmin = user.role === "admin" || user.role === "instructor";
    const isEnrolled = await hasEnrollmentForCourse(courseId, user.id);

    if (!isEnrolled && !isInstructorOrAdmin) {
        redirect(`/courses/${courseId}`);
    }

    // Get quiz with questions
    const quiz = await getQuizWithQuestions(quizId);
    if (!quiz) {
        notFound();
    }

    // Check published (unless instructor/admin)
    if (!isInstructorOrAdmin && !quiz.published) {
        notFound();
    }

    // Check for in-progress attempt
    let existingAttemptId = attemptId;
    if (!existingAttemptId) {
        const inProgress = await getInProgressAttempt(quizId, user.id);
        existingAttemptId = inProgress?.id;
    }

    // Convert to plain object
    const quizPlain = JSON.parse(JSON.stringify(quiz));

    return (
        <div className="max-w-4xl mx-auto p-6">
            <QuizTakingInterfaceWrapper
                quiz={quizPlain}
                courseId={courseId}
                existingAttemptId={existingAttemptId}
                isPreview={isInstructorOrAdmin && !isEnrolled}
            />
        </div>
    );
}
