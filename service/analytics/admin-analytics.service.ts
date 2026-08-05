import "server-only";
import {
  getComparedDateRanges,
  resolveDateRange,
  toDateRangeResponse,
  type DateRangePreset,
} from "@/lib/analytics/date-ranges";
import { buildTrendIndicator } from "@/lib/analytics/trend-calculations";
import { detectAnomalies } from "@/service/analytics/anomaly-detection.service";
import type {
  AnomalyResult,
  Granularity,
  PlatformOverview,
} from "@/lib/analytics/schemas";
import {
  countActiveUsersToday,
  countUsersCreatedInRanges,
  getActiveUsersTrend,
  getRegistrationTrend,
  getRoleDistribution,
  getUserRoleTotals,
  getActivityByHour,
} from "@/queries/analytics/user-aggregations";
import {
  getLoginFrequencyDistribution,
  getPeakActivityHours,
} from "@/queries/analytics/activity-aggregations";
import {
  countCoursesCreatedInRanges,
  countEnrollmentsInRanges,
  getAdminCourseAnalyticsTotals,
  getCategoryDistribution,
  getCompletionTrend,
  getCourseTotals,
  getEnrollmentTotal,
  getEnrollmentTrend,
  getTopCoursesByPerformance,
} from "@/queries/analytics/course-aggregations";
import {
  getRevenueByCourse,
  getRevenueByInstructor,
  getRevenueByProvider,
  getRevenueInRanges,
  getRevenueTotals,
  getRevenueTrend,
  getTransactionStatusBreakdown,
} from "@/queries/analytics/revenue-aggregations";
import { buildEstimatedPerformanceMetrics } from "@/lib/analytics/performance-metrics";
import type { PerformanceMetricsPayload } from "@/lib/analytics/performance-metrics";
import { dbConnect } from "@/service/mongo";
import { Payment } from "@/model/payment-model";

export type PlatformOverviewResult = PlatformOverview & {
  anomalies: AnomalyResult[];
};

export interface UserAnalyticsData {
  totals: {
    students: number;
    instructors: number;
    admins: number;
  };
  registrationTrend: Array<{ date: string; value: number }>;
  activeUsersTrend: Array<{ date: string; value: number }>;
  roleDistribution: Array<{ role: string; count: number }>;
  activityByHour: Array<{ hour: number; count: number }>;
  peakHours: Array<{ hour: number; count: number }>;
  loginFrequency: Array<{
    minLogins: number;
    maxLogins: number | null;
    users: number;
  }>;
}

export async function getPlatformOverview(options: {
  preset?: DateRangePreset;
  startDate?: string;
  endDate?: string;
}): Promise<{
  data: PlatformOverviewResult;
  dateRange: { start: string; end: string };
}> {
  const { current, previous } = getComparedDateRanges(options);

  const [
    userTotals,
    courseTotals,
    totalEnrollments,
    userPeriod,
    coursePeriod,
    enrollmentPeriod,
    revenuePeriod,
    activeUsersToday,
  ] = await Promise.all([
    getUserRoleTotals(),
    getCourseTotals(),
    getEnrollmentTotal(),
    countUsersCreatedInRanges(current, previous),
    countCoursesCreatedInRanges(current, previous),
    countEnrollmentsInRanges(current, previous),
    getRevenueInRanges(current, previous),
    countActiveUsersToday(),
  ]);

  const trends = {
    courses: buildTrendIndicator(coursePeriod.current, coursePeriod.previous),
    users: buildTrendIndicator(userPeriod.current, userPeriod.previous),
    revenue: buildTrendIndicator(revenuePeriod.current, revenuePeriod.previous),
    enrollments: buildTrendIndicator(
      enrollmentPeriod.current,
      enrollmentPeriod.previous
    ),
  };

  const anomalies = detectAnomalies([
    {
      metric: "revenue",
      currentValue: revenuePeriod.current,
      expectedValue: revenuePeriod.previous,
    },
    {
      metric: "registrations",
      currentValue: userPeriod.current,
      expectedValue: userPeriod.previous,
    },
  ]);

  const data: PlatformOverviewResult = {
    totalCourses: courseTotals.totalCourses,
    activeCourses: courseTotals.activeCourses,
    totalUsers: userTotals.totalUsers,
    totalStudents: userTotals.totalStudents,
    totalInstructors: userTotals.totalInstructors,
    totalRevenue: revenuePeriod.current,
    totalEnrollments,
    activeUsersToday,
    trends,
    anomalies,
  };

  return {
    data,
    dateRange: toDateRangeResponse(current),
  };
}

export async function getUserAnalytics(options: {
  preset?: DateRangePreset;
  startDate?: string;
  endDate?: string;
  granularity?: Granularity;
}): Promise<{
  data: UserAnalyticsData;
  dateRange: { start: string; end: string };
}> {
  const range = resolveDateRange(options);
  const granularity = options.granularity ?? "day";

  const [
    roleTotals,
    roleDistribution,
    registrationTrend,
    activeUsersTrend,
    activityByHour,
    peakHours,
    loginFrequency,
  ] = await Promise.all([
    getUserRoleTotals(),
    getRoleDistribution(),
    getRegistrationTrend(range, granularity),
    getActiveUsersTrend(range, granularity),
    getActivityByHour(range),
    getPeakActivityHours(range),
    getLoginFrequencyDistribution(range),
  ]);

  return {
    data: {
      totals: {
        students: roleTotals.totalStudents,
        instructors: roleTotals.totalInstructors,
        admins: roleTotals.totalAdmins,
      },
      registrationTrend,
      activeUsersTrend,
      roleDistribution,
      activityByHour,
      peakHours,
      loginFrequency,
    },
    dateRange: toDateRangeResponse(range),
  };
}

export interface RevenueAnalyticsData {
  totals: {
    revenue: number;
    transactions: number;
    avgTransaction: number;
    successRate: number;
  };
  revenueTrend: Array<{ date: string; value: number }>;
  revenueByProvider: Array<{ provider: string; amount: number }>;
  revenueByCourse: Array<{ courseId: string; title: string; amount: number }>;
  revenueByInstructor: Array<{
    instructorId: string;
    name: string;
    amount: number;
  }>;
  transactionStatusBreakdown: Array<{ status: string; count: number }>;
}

export async function getRevenueAnalytics(options: {
  preset?: DateRangePreset;
  startDate?: string;
  endDate?: string;
  granularity?: Granularity;
  limit?: number;
}): Promise<{
  data: RevenueAnalyticsData;
  dateRange: { start: string; end: string };
}> {
  const range = resolveDateRange(options);
  const granularity = options.granularity ?? "day";
  const limit = options.limit ?? 10;

  const [
    totals,
    revenueTrend,
    revenueByProvider,
    revenueByCourse,
    revenueByInstructor,
    transactionStatusBreakdown,
  ] = await Promise.all([
    getRevenueTotals(range),
    getRevenueTrend(range, granularity),
    getRevenueByProvider(range),
    getRevenueByCourse(range, limit),
    getRevenueByInstructor(range, limit),
    getTransactionStatusBreakdown(range),
  ]);

  return {
    data: {
      totals,
      revenueTrend,
      revenueByProvider,
      revenueByCourse,
      revenueByInstructor,
      transactionStatusBreakdown,
    },
    dateRange: toDateRangeResponse(range),
  };
}

export interface CourseAnalyticsData {
  totals: {
    courses: number;
    published: number;
    draft: number;
    avgEnrollments: number;
    avgCompletionRate: number;
  };
  enrollmentTrend: Array<{ date: string; value: number }>;
  completionTrend: Array<{ date: string; value: number }>;
  topCourses: Array<{
    courseId: string;
    title: string;
    instructor: string;
    enrollments: number;
    completions: number;
    completionRate: number;
    revenue: number;
  }>;
  categoryDistribution: Array<{ category: string; count: number }>;
}

export async function getCourseAnalytics(options: {
  preset?: DateRangePreset;
  startDate?: string;
  endDate?: string;
  granularity?: Granularity;
  limit?: number;
}): Promise<{
  data: CourseAnalyticsData;
  dateRange: { start: string; end: string };
}> {
  const range = resolveDateRange(options);
  const granularity = options.granularity ?? "day";
  const limit = options.limit ?? 10;

  const [
    totals,
    enrollmentTrend,
    completionTrend,
    topCourses,
    categoryDistribution,
  ] = await Promise.all([
    getAdminCourseAnalyticsTotals(),
    getEnrollmentTrend(range, granularity),
    getCompletionTrend(range, granularity),
    getTopCoursesByPerformance(range, limit),
    getCategoryDistribution(),
  ]);

  return {
    data: {
      totals,
      enrollmentTrend,
      completionTrend,
      topCourses,
      categoryDistribution,
    },
    dateRange: toDateRangeResponse(range),
  };
}

export type PerformanceMetricsData = PerformanceMetricsPayload;

/**
 * Application performance metrics (FR-005).
 *
 * Uses the estimated metrics adapter until an APM or request-log store exists.
 * Payment failure counts from Mongo are merged into errorsByType when present.
 * See `lib/analytics/performance-metrics.ts` for source documentation.
 */
export async function getPerformanceMetrics(options: {
  preset?: DateRangePreset;
  startDate?: string;
  endDate?: string;
}): Promise<{
  data: PerformanceMetricsData;
  dateRange: { start: string; end: string };
}> {
  const range = resolveDateRange({
    preset: options.preset ?? "7d",
    startDate: options.startDate,
    endDate: options.endDate,
  });

  let paymentFailureRate = 0;
  let paymentFailedCount = 0;

  try {
    await dbConnect();
    const statusRows = await Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const total = (
      statusRows as Array<{ _id: string; count: number }>
    ).reduce((sum, row) => sum + row.count, 0);
    const nonSucceeded = (
      statusRows as Array<{ _id: string; count: number }>
    )
      .filter((r) => r._id !== "succeeded")
      .reduce((sum, row) => sum + row.count, 0);
    paymentFailedCount = nonSucceeded;
    paymentFailureRate = total > 0 ? nonSucceeded / total : 0;
  } catch {
    // Payments unavailable — continue with pure estimates
  }

  const data = buildEstimatedPerformanceMetrics(range, {
    paymentFailureRate,
    paymentFailedCount,
  });

  return {
    data,
    dateRange: toDateRangeResponse(range),
  };
}
