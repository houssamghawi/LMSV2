import { getAdminStats } from "@/queries/admin";
import { getAdminUser } from "@/lib/admin-utils";
import { Users, BookOpen, ShoppingCart, DollarSign, TrendingUp, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";
import AdminLoading from "./loading";
import { getTranslations } from "next-intl/server";

// Disable caching to ensure fresh data from database
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminDashboard() {
    await getAdminUser(); // Ensure user is admin
    const t = await getTranslations("Admin");

    let stats;
    try {
        // Fetch fresh data directly from database
        stats = await getAdminStats();
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        // Return default stats structure to prevent crashes
        stats = {
            users: { total: 0, recent: 0, active: 0 },
            courses: { total: 0, published: 0, recent: 0 },
            enrollments: { total: 0, recent: 0 },
            revenue: { total: 0 },
            categories: { total: 0 },
            reviews: { total: 0 }
        };
    }

    const statCards = [
        {
            title: t("totalUsers"),
            value: stats.users.total,
            change: t("thisWeek", { n: stats.users.recent }),
            icon: Users,
            href: "/admin/users",
            color: "text-blue-600"
        },
        {
            title: t("totalCourses"),
            value: stats.courses.total,
            change: `${stats.courses.published} ${t("published")}`,
            icon: BookOpen,
            href: "/admin/courses",
            color: "text-green-600"
        },
        {
            title: t("totalEnrollments"),
            value: stats.enrollments.total,
            change: t("thisWeek", { n: stats.enrollments.recent }),
            icon: ShoppingCart,
            href: "/admin/enrollments",
            color: "text-purple-600"
        },
        {
            title: t("totalRevenue"),
            value: `$${stats.revenue.total.toLocaleString()}`,
            change: t("allTime"),
            icon: DollarSign,
            href: "/admin/analytics",
            color: "text-yellow-600"
        },
        {
            title: t("activeUsers"),
            value: stats.users.active,
            change: stats.users.total > 0
                ? t("percentActive", { n: Math.round((stats.users.active / stats.users.total) * 100) })
                : t("percentActive", { n: 0 }),
            icon: TrendingUp,
            href: "/admin/users?status=active",
            color: "text-indigo-600"
        },
        {
            title: t("categories"),
            value: stats.categories.total,
            change: `${stats.reviews.total} ${t("reviews")}`,
            icon: Award,
            href: "/admin/categories",
            color: "text-pink-600"
        }
    ];

    return (
        <Suspense fallback={<AdminLoading />}>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{t("dashboardOverview")}</h1>
                        <p className="text-gray-600 mt-2">{t("welcomeAdmin")}</p>
                    </div>
                    <form>
                        <Button 
                            type="submit" 
                            variant="outline"
                            formAction={async () => {
                                'use server';
                                const { revalidatePath } = await import('next/cache');
                                revalidatePath('/admin');
                            }}
                        >
                            {t("refreshData")}
                        </Button>
                    </form>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {statCards.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <Link key={index} href={stat.href}>
                            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-600">
                                        {stat.title}
                                    </CardTitle>
                                    <Icon className={`h-5 w-5 ${stat.color}`} />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stat.value}</div>
                                    <p className="text-xs text-gray-500 mt-1">{stat.change}</p>
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>{t("quickActions")}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Link href="/admin/users">
                            <Button variant="outline" className="w-full justify-start">
                                {t("manageUsers")}
                            </Button>
                        </Link>
                        <Link href="/admin/courses">
                            <Button variant="outline" className="w-full justify-start">
                                {t("manageCourses")}
                            </Button>
                        </Link>
                        <Link href="/admin/analytics">
                            <Button variant="outline" className="w-full justify-start">
                                {t("viewAnalytics")}
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t("recentActivity")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">{t("newUsersThisWeek")}</span>
                                <span className="font-semibold">{stats.users.recent}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">{t("newCoursesThisWeek")}</span>
                                <span className="font-semibold">{stats.courses.recent}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">{t("newEnrollmentsThisWeek")}</span>
                                <span className="font-semibold">{stats.enrollments.recent}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
            </div>
        </Suspense>
    );
}

