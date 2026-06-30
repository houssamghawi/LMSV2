import { getAdminUser } from "@/lib/admin-utils";
import { getCourseList } from "@/queries/courses";
import { unstable_cache } from "next/cache";
import CoursesTable from "./_components/courses-table";

// Cache courses for 2 minutes
const getCachedCourses = unstable_cache(
    async () => await getCourseList(),
    ['admin-courses'],
    { revalidate: 120 }
);

export const metadata = {
    title: "Courses Management - Admin",
    description: "Manage all courses in the platform"
};

export default async function CoursesPage() {
    await getAdminUser();
    
    const courses = await getCachedCourses();
    
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Courses Management</h1>
                <p className="text-gray-600 mt-2">Manage all courses, publish/unpublish, and view details</p>
            </div>

            <CoursesTable courses={courses || []} />
        </div>
    );
}

