import { getAdminStats } from "@/queries/admin";
import { getAdminUser } from "@/lib/admin-utils";
import { unstable_cache } from "next/cache";
import { Users, BookOpen, ShoppingCart, DollarSign, TrendingUp, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";
import AdminLoading from "./loading";

// Cache stats for 5 minutes
const getCachedStats = unstable_cache(
    async () => await getAdminStats(),
    ['admin-stats'],
    { revalidate: 300 }
);

export default async function AdminDashboard() {
    await getAdminUser(); // Ensure user is admin
    
    let stats;
    try {
        stats = await getCachedStats();
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
            title: "Total Users",
            value: stats.users.total,
            change: `+${stats.users.recent} this week`,
            icon: Users,
            href: "/admin/users",
            color: "text-blue-600"
        },
        {
            title: "Total Courses",
            value: stats.courses.total,
            change: `${stats.courses.published} published`,
            icon: BookOpen,
            href: "/admin/courses",
            color: "text-green-600"
        },
        {
            title: "Total Enrollments",
            value: stats.enrollments.total,
            change: `+${stats.enrollments.recent} this week`,
            icon: ShoppingCart,
            href: "/admin/enrollments",
            color: "text-purple-600"
        },
        {
            title: "Total Revenue",
            value: `$${stats.revenue.total.toLocaleString()}`,
            change: "All time",
            icon: DollarSign,
            href: "/admin/analytics",
            color: "text-yellow-600"
        },
        {
            title: "Active Users",
            value: stats.users.active,
            change: stats.users.total > 0 
                ? `${Math.round((stats.users.active / stats.users.total) * 100)}% active`
                : '0% active',
            icon: TrendingUp,
            href: "/admin/users?status=active",
            color: "text-indigo-600"
        },
        {
            title: "Categories",
            value: stats.categories.total,
            change: `${stats.reviews.total} reviews`,
            icon: Award,
            href: "/admin/categories",
            color: "text-pink-600"
        }
    ];

    return (
        <Suspense fallback={<AdminLoading />}>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
                    <p className="text-gray-600 mt-2">Welcome to the admin dashboard</p>
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
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Link href="/admin/users">
                            <Button variant="outline" className="w-full justify-start">
                                Manage Users
                            </Button>
                        </Link>
                        <Link href="/admin/courses">
                            <Button variant="outline" className="w-full justify-start">
                                Manage Courses
                            </Button>
                        </Link>
                        <Link href="/admin/analytics">
                            <Button variant="outline" className="w-full justify-start">
                                View Analytics
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">New users this week</span>
                                <span className="font-semibold">{stats.users.recent}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">New courses this week</span>
                                <span className="font-semibold">{stats.courses.recent}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">New enrollments this week</span>
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

