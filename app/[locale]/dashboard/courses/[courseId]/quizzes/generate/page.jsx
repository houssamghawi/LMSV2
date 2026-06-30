import { getLoggedInUser } from "@/lib/loggedin-user";
import { getCourseWithOwnershipCheck } from "@/lib/authorization";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { QuizGenerator } from "../_components/quiz-generator";

export const dynamic = "force-dynamic";

export default async function GenerateQuizPage({ params }) {
    const { courseId } = await params;
    const t = await getTranslations("QuizGeneration");

    const user = await getLoggedInUser();
    if (!user) redirect("/login");

    const course = await getCourseWithOwnershipCheck(courseId, user.id, user);
    if (!course) notFound();

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <QuizGenerator courseId={courseId} />
        </div>
    );
}
