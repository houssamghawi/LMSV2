import { getLoggedInUser } from "@/lib/loggedin-user";
import { getCourseWithOwnershipCheck } from "@/lib/authorization";
import { notFound, redirect } from "next/navigation";
import { getCourseDetails } from "@/queries/courses";
import { QuizGenerator } from "../_components/quiz-generator";

export const dynamic = "force-dynamic";

export default async function GenerateQuizPage({ params, searchParams }) {
    const { courseId } = await params;
    const { lessonId: initialLessonId } = await searchParams;

    const user = await getLoggedInUser();
    if (!user) redirect("/login");

    const course = await getCourseWithOwnershipCheck(courseId, user.id, user);
    if (!course) notFound();

    const courseDetails = await getCourseDetails(courseId);
    const courseDetailsPlain = courseDetails ? JSON.parse(JSON.stringify(courseDetails)) : null;

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <QuizGenerator
                courseId={courseId}
                lessonId={typeof initialLessonId === "string" ? initialLessonId : undefined}
                course={courseDetailsPlain}
            />
        </div>
    );
}
