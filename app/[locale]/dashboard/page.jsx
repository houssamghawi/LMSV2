import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/formatPrice";
import { getCourseDetailsByInstructor } from "@/queries/courses";
import { getUserByEmail } from "@/queries/users";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

// Disable caching to ensure fresh data from database
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DashboardPage = async () => {
  const t = await getTranslations("DashboardRoot");

  const session = await auth();
  if (!session?.user) redirect("/login");
  
  const instructor = await getUserByEmail(session.user.email);
  if (instructor?.role !== "instructor") redirect("/login");

  // Fetch fresh course statistics from database
  const courseStatus = await getCourseDetailsByInstructor(instructor?.id);


  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("dashboardOverview")}</h1>
        <form>
          <button 
            type="submit" 
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input hover:bg-accent hover:text-accent-foreground h-10 py-2 px-4"
            formAction={async () => {
              'use server';
              const { revalidatePath } = await import('next/cache');
              revalidatePath('/dashboard');
            }}
          >
            {t("refreshData")}
          </button>
        </form>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {/* total courses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("totalCourses")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{courseStatus?.courses}</div>
          </CardContent>
        </Card>
        {/* total enrollments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("totalEnrollments")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{courseStatus?.enrollments}</div>
          </CardContent>
        </Card>
        {/* total revinue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("totalRevenue")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" suppressHydrationWarning>{formatPrice(courseStatus?.revenue)}</div>
          </CardContent>
        </Card>
      </div>
      {/*  */}
    </div>
  );
};

export default DashboardPage;
