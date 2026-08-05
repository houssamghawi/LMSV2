import { getLoggedInUser } from "@/lib/loggedin-user";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isInstructor, isAdmin } from "@/lib/authorization";
import { InstructorAnalyticsDashboard } from "./_components/instructor-analytics-dashboard";

export const metadata = {
  title: "Analytics - Instructor",
  description: "Course analytics for instructors",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InstructorAnalyticsPage() {
  const user = await getLoggedInUser();

  if (!user) {
    redirect("/login");
  }

  if (!isInstructor(user) && !isAdmin(user)) {
    redirect("/login");
  }

  const t = await getTranslations("Analytics");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {t("instructorTitle")}
        </h1>
        <p className="mt-2 text-gray-600">{t("subtitle")}</p>
      </div>

      <InstructorAnalyticsDashboard />
    </div>
  );
}
