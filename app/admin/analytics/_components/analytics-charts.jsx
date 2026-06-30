"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, DollarSign, Award } from "lucide-react";

export default function AnalyticsCharts({ enrollmentData, revenueData, topCourses }) {
    // Ensure data is always an array
    const safeEnrollmentData = Array.isArray(enrollmentData) ? enrollmentData : [];
    const safeRevenueData = Array.isArray(revenueData) ? revenueData : [];
    const safeTopCourses = Array.isArray(topCourses) ? topCourses : [];
    
    // Simple chart representation (you can integrate Chart.js, Recharts, etc.)
    const maxEnrollments = safeEnrollmentData.length > 0 
        ? Math.max(...safeEnrollmentData.map(d => d.count || 0), 1)
        : 1;
    const maxRevenue = safeRevenueData.length > 0
        ? Math.max(...safeRevenueData.map(d => d.revenue || 0), 1)
        : 1;

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {safeEnrollmentData.reduce((sum, d) => sum + (d.count || 0), 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Last 30 days</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${safeRevenueData.reduce((sum, d) => sum + (d.revenue || 0), 0).toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">Last 30 days</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Avg Daily Enrollments</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {safeEnrollmentData.length > 0 
                                ? Math.round(safeEnrollmentData.reduce((sum, d) => sum + (d.count || 0), 0) / 30)
                                : 0
                            }
                        </div>
                        <p className="text-xs text-muted-foreground">Per day average</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Top Courses</CardTitle>
                        <Award className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{safeTopCourses.length}</div>
                        <p className="text-xs text-muted-foreground">Tracked</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <Tabs defaultValue="enrollments" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
                    <TabsTrigger value="revenue">Revenue</TabsTrigger>
                    <TabsTrigger value="courses">Top Courses</TabsTrigger>
                </TabsList>

                <TabsContent value="enrollments" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Enrollments Over Time (Last 30 Days)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {safeEnrollmentData.length === 0 ? (
                                    <p className="text-center text-gray-500 py-8">No enrollment data available</p>
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
                            <CardTitle>Revenue Over Time (Last 30 Days)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {safeRevenueData.length === 0 ? (
                                    <p className="text-center text-gray-500 py-8">No revenue data available</p>
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
                                                    <span className="text-sm font-medium w-20">
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
                            <CardTitle>Top Courses by Enrollments</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {safeTopCourses.length === 0 ? (
                                    <p className="text-center text-gray-500 py-8">No course data available</p>
                                ) : (
                                    <div className="space-y-3">
                                        {safeTopCourses.map((course, index) => (
                                            <div key={course.courseId} className="flex items-center justify-between p-3 border rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                                                        {index + 1}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium">{course.title || 'Unknown Course'}</div>
                                                        <div className="text-sm text-gray-500">
                                                            {course.enrollmentCount || 0} enrollments
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-bold">${(course.revenue || 0).toLocaleString()}</div>
                                                    <div className="text-xs text-gray-500">Revenue</div>
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

