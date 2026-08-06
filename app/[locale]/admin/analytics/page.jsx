import dynamicImport from "next/dynamic";
import { getAdminUser } from "@/lib/admin-utils";
import {
    getEnrollmentAnalytics,
    getRevenueAnalytics,
    getTopCourses
} from "@/queries/admin";
import { getTranslations } from "next-intl/server";

// Lazy load analytics (tabs, cards, bar UI) — only on admin analytics route
const AnalyticsCharts = dynamicImport(
  () => import("./_components/analytics-charts"),
  {
    loading: () => (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-lg bg-muted" />
          ))}
        </div>
        <div className="h-80 rounded-lg bg-muted" />
      </div>
    ),
  }
);

export const metadata = {
    title: "Analytics - Admin",
    description: "Platform analytics and insights"
};

// Disable caching to ensure fresh data from database
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AnalyticsPage() {
    await getAdminUser();
    const t = await getTranslations("Admin");

    // Fetch fresh analytics data directly from database
    const [enrollmentData, revenueData, topCourses] = await Promise.all([
        getEnrollmentAnalytics(30),
        getRevenueAnalytics(30),
        getTopCourses(10)
    ]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t("analyticsInsights")}</h1>
                    <p className="text-gray-600 mt-2">{t("platformMetricsSub")}</p>
                </div>
                <form>
                    <button 
                        type="submit" 
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input hover:bg-accent hover:text-accent-foreground h-10 py-2 px-4"
                        formAction={async () => {
                            'use server';
                            const { revalidatePath } = await import('next/cache');
                            revalidatePath('/admin/analytics');
                        }}
                    >
                        {t("refreshData")}
                    </button>
                </form>
            </div>

            <AnalyticsCharts
                enrollmentData={enrollmentData}
                revenueData={revenueData}
                topCourses={topCourses}
            />
        </div>
    );
}

