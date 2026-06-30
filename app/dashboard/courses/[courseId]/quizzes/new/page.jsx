import { getLoggedInUser } from "@/lib/loggedin-user";
import { getCourseWithOwnershipCheck } from "@/lib/authorization";
import { getCourseDetails } from "@/queries/courses";
import { notFound, redirect } from "next/navigation";
import { QuizForm } from "./_components/quiz-form";

export default async function NewQuizPage({ params }) {
    const { courseId } = await params;

    const user = await getLoggedInUser();
    if (!user) {
        redirect("/login");
    }

    const course = await getCourseWithOwnershipCheck(courseId, user.id, user);
    if (!course) {
        notFound();
    }

    // Get course details with modules for lesson selection
    const courseDetails = await getCourseDetails(courseId);

    // Serialize course data to plain object before passing to client component
    const courseDetailsPlain = courseDetails ? JSON.parse(JSON.stringify(courseDetails)) : null;

    return (
        <div className="p-6">
            <QuizForm courseId={courseId} course={courseDetailsPlain} />
        </div>
    );
}
