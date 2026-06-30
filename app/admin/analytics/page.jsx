import { getAdminUser } from "@/lib/admin-utils";
import { unstable_cache } from "next/cache";
import {
    getEnrollmentAnalytics,
    getRevenueAnalytics,
    getTopCourses
} from "@/queries/admin";
import AnalyticsCharts from "./_components/analytics-charts";

export const metadata = {
    title: "Analytics - Admin",
    description: "Platform analytics and insights"
};

export default async function AnalyticsPage() {
    await getAdminUser();
    
    // Fetch analytics data directly (caching handled in queries)
    const [enrollmentData, revenueData, topCourses] = await Promise.all([
        getEnrollmentAnalytics(30),
        getRevenueAnalytics(30),
        getTopCourses(10)
    ]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Analytics & Insights</h1>
                <p className="text-gray-600 mt-2">Platform performance metrics and trends</p>
            </div>

            <AnalyticsCharts
                enrollmentData={enrollmentData}
                revenueData={revenueData}
                topCourses={topCourses}
            />
        </div>
    );
}

