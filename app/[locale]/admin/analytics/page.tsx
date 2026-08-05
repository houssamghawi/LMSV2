import { getAdminUser } from "@/lib/admin-utils";
import { getTranslations } from "next-intl/server";
import { AnalyticsDashboard } from "./_components/analytics-dashboard";

export const metadata = {
  title: "Analytics - Admin",
  description: "Platform analytics and insights",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminAnalyticsPage() {
  await getAdminUser();
  const t = await getTranslations("Analytics");
  const tAdmin = await getTranslations("Admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {t("adminTitle")}
        </h1>
        <p className="mt-2 text-gray-600">{tAdmin("platformMetricsSub")}</p>
      </div>

      <AnalyticsDashboard />
    </div>
  );
}
