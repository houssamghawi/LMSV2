import { getAdminUser } from "@/lib/admin-utils";
import { unstable_cache } from "next/cache";
import EnrollmentsTable from "./_components/enrollments-table";
import { dbConnect } from "@/service/mongo";
import { Enrollment } from "@/model/enrollment-model";
import { replaceMongoIdInArray } from "@/lib/convertData";
import mongoose from "mongoose";

const getCachedEnrollments = unstable_cache(
    async () => {
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
    },
    ['admin-enrollments'],
    { revalidate: 120 }
);

// Sanitize function to handle ObjectId, Buffer, and Date serialization
function sanitizeEnrollmentsData(data) {
    return JSON.parse(
        JSON.stringify(data, (key, value) => {
            if (value instanceof mongoose.Types.ObjectId) {
                return value.toString();
            }
            if (Buffer.isBuffer(value)) {
                return value.toString("base64");
            }
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value;
        })
    );
}

export const metadata = {
    title: "Enrollments Management - Admin",
    description: "Manage all course enrollments"
};

export default async function EnrollmentsPage() {
    await getAdminUser();
    
    const enrollments = await getCachedEnrollments();
    const sanitizedEnrollments = sanitizeEnrollmentsData(enrollments || []);
    
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Enrollments Management</h1>
                <p className="text-gray-600 mt-2">View and manage all course enrollments</p>
            </div>

            <EnrollmentsTable enrollments={sanitizedEnrollments} />
        </div>
    );
}

