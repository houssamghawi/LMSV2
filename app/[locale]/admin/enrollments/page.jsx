import { getAdminUser } from "@/lib/admin-utils";
import EnrollmentsTable from "./_components/enrollments-table";
import { getTranslations } from "next-intl/server";
import { dbConnect } from "@/service/mongo";
import { Enrollment } from "@/model/enrollment-model";
import { replaceMongoIdInArray } from "@/lib/convertData";

// Ensure fresh data from database on every request
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getEnrollments() {
    await dbConnect();
    const enrollments = await Enrollment.find()
        .populate({
            path: 'course',
            select: 'title thumbnail price'
        })
        .populate({
            path: 'student',
            select: 'firstName lastName email'
        })
        .sort({ enrollment_date: -1 })
        .limit(100)
        .lean();
    return replaceMongoIdInArray(enrollments);
}

export const metadata = {
    title: "Enrollments Management - Admin",
    description: "Manage all course enrollments"
};

export default async function EnrollmentsPage() {
    await getAdminUser();
    const t = await getTranslations("Admin");
    
    // Fetch fresh enrollments data directly from database
    const enrollments = await getEnrollments();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">{t("enrollmentsManagement")}</h1>
                <p className="text-gray-600 mt-2">{t("viewEnrollmentsSub")}</p>
            </div>

            <EnrollmentsTable enrollments={enrollments || []} />
        </div>
    );
}

