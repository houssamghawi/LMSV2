import { getAdminUser } from "@/lib/admin-utils";
import { getAllCourses } from "@/queries/courses";
import CoursesTable from "./_components/courses-table";
import { getTranslations } from "next-intl/server";

export const metadata = {
    title: "Courses Management - Admin",
    description: "Manage all courses in the platform"
};

// Ensure fresh data from database on every request
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CoursesPage() {
    await getAdminUser();
    const t = await getTranslations("Admin");
    
    // Fetch ALL courses (including drafts) directly from database
    const courses = await getAllCourses();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">{t("coursesManagement")}</h1>
                <p className="text-gray-600 mt-2">{t("manageCoursesSub")}</p>
            </div>

            <CoursesTable courses={courses || []} />
        </div>
    );
}

