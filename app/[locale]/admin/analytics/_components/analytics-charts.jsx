"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, DollarSign, Award } from "lucide-react";
import { useTranslations } from "next-intl";

export default function AnalyticsCharts({ enrollmentData, revenueData, topCourses }) {
    const t = useTranslations("Admin");
    const safeEnrollmentData = useMemo(
        () => (Array.isArray(enrollmentData) ? enrollmentData : []),
        [enrollmentData]
    );
    const safeRevenueData = useMemo(
        () => (Array.isArray(revenueData) ? revenueData : []),
        [revenueData]
    );
    const safeTopCourses = useMemo(
        () => (Array.isArray(topCourses) ? topCourses : []),
        [topCourses]
    );

    const maxEnrollments = useMemo(
        () => (safeEnrollmentData.length > 0
            ? Math.max(...safeEnrollmentData.map((d) => d.count || 0), 1)
            : 1),
        [safeEnrollmentData]
    );
    const maxRevenue = useMemo(
        () => (safeRevenueData.length > 0
            ? Math.max(...safeRevenueData.map((d) => d.revenue || 0), 1)
            : 1),
        [safeRevenueData]
    );

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">{t("totalEnrollmentsCard")}</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {safeEnrollmentData.reduce((sum, d) => sum + (d.count || 0), 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">{t("last30Days")}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">{t("totalRevenueCard")}</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold" suppressHydrationWarning>
                            ${safeRevenueData.reduce((sum, d) => sum + (d.revenue || 0), 0).toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">{t("last30Days")}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">{t("avgDailyEnrollments")}</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {safeEnrollmentData.length > 0
                                ? Math.round(safeEnrollmentData.reduce((sum, d) => sum + (d.count || 0), 0) / 30)
                                : 0
                            }
                        </div>
                        <p className="text-xs text-muted-foreground">{t("perDayAverage")}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">{t("topCourses")}</CardTitle>
                        <Award className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{safeTopCourses.length}</div>
                        <p className="text-xs text-muted-foreground">{t("tracked")}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <Tabs defaultValue="enrollments" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="enrollments">{t("enrollments")}</TabsTrigger>
                    <TabsTrigger value="revenue">{t("revenue")}</TabsTrigger>
                    <TabsTrigger value="courses">{t("topCourses")}</TabsTrigger>
                </TabsList>

                <TabsContent value="enrollments" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("enrollmentsOverTime")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {safeEnrollmentData.length === 0 ? (
                                    <p className="text-center text-gray-500 py-8">{t("noEnrollmentData")}</p>
                                ) : (
                                    <div className="space-y-1">
                                        {safeEnrollmentData.map((item, index) => (
                                            <div key={index} className="flex items-center gap-4">
                                                <div className="w-24 text-xs text-gray-600">{item.date}</div>
                                                <div className="flex-1 flex items-center gap-2">
                                                    <div
                                                        className="bg-blue-500 h-6 rounded"
                                                        style={{
                                                            width: `${((item.count || 0) / maxEnrollments) * 100}%`,
                                                            minWidth: (item.count || 0) > 0 ? '4px' : '0'
                                                        }}
                                                    />
                                                    <span className="text-sm font-medium w-12">{item.count || 0}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="revenue" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("revenueOverTime")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {safeRevenueData.length === 0 ? (
                                    <p className="text-center text-gray-500 py-8">{t("noRevenueData")}</p>
                                ) : (
                                    <div className="space-y-1">
                                        {safeRevenueData.map((item, index) => (
                                            <div key={index} className="flex items-center gap-4">
                                                <div className="w-24 text-xs text-gray-600">{item.date}</div>
                                                <div className="flex-1 flex items-center gap-2">
                                                    <div
                                                        className="bg-green-500 h-6 rounded"
                                                        style={{
                                                            width: `${((item.revenue || 0) / maxRevenue) * 100}%`,
                                                            minWidth: (item.revenue || 0) > 0 ? '4px' : '0'
                                                        }}
                                                    />
                                                    <span className="text-sm font-medium w-20" suppressHydrationWarning>
                                                        ${(item.revenue || 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="courses" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("topCoursesByEnrollments")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {safeTopCourses.length === 0 ? (
                                    <p className="text-center text-gray-500 py-8">{t("noCourseData")}</p>
                                ) : (
                                    <div className="space-y-3">
                                        {safeTopCourses.map((course, index) => (
                                            <div key={course.courseId} className="flex items-center justify-between p-3 border rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                                                        {index + 1}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium" dir="auto">{course.title || t("unknownCourse")}</div>
                                                        <div className="text-sm text-gray-500">
                                                            {t("enrollmentsCount", { n: course.enrollmentCount || 0 })}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-end">
                                                    <div className="font-bold" suppressHydrationWarning>${(course.revenue || 0).toLocaleString()}</div>
                                                    <div className="text-xs text-gray-500">{t("revenue")}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

