import { getLoggedInUser } from "@/lib/loggedin-user";
import { getCourseWithOwnershipCheck } from "@/lib/authorization";
import { getCourseDetails } from "@/queries/courses";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TutorInteractionsTable } from "../_components/tutor-interactions-table";

function collectLessons(course) {
    const lessons = [];
    const seen = new Set();

    for (const mod of course?.modules || []) {
        for (const lesson of mod?.lessonIds || []) {
            const id = lesson?.id ?? lesson?._id?.toString();
            if (!id || seen.has(id)) continue;
            seen.add(id);
            lessons.push({
                id,
                title: lesson.title || "Untitled lesson"
            });
        }
    }

    return lessons.sort((a, b) => a.title.localeCompare(b.title));
}

const TutorAnalyticsPage = async ({ params }) => {
    const t = await getTranslations("Tutor");
    const { courseId } = await params;

    const loggedInUser = await getLoggedInUser();
    if (!loggedInUser) {
        notFound();
    }

    const course = await getCourseWithOwnershipCheck(
        courseId,
        loggedInUser.id,
        loggedInUser
    );
    if (!course) {
        notFound();
    }

    const courseDetails = await getCourseDetails(courseId);
    const lessons = collectLessons(courseDetails);

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-700">{t("analyticsTitle")}</h1>
                <p className="text-muted-foreground mt-1">{course?.title}</p>
                <p className="text-sm text-muted-foreground mt-2">
                    {t("analyticsSubtitle")}
                </p>
            </div>

            <TutorInteractionsTable courseId={courseId} lessons={lessons} />
        </div>
    );
};

export default TutorAnalyticsPage;
