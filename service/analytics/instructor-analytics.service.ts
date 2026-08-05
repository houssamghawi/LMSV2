import "server-only";
import {
  getComparedDateRanges,
  toDateRangeResponse,
  type DateRangePreset,
} from "@/lib/analytics/date-ranges";
import { buildTrendIndicator } from "@/lib/analytics/trend-calculations";
import type { Granularity, TrendIndicator } from "@/lib/analytics/schemas";
import {
  countInstructorCompletionsInRange,
  countInstructorEnrollmentsInRange,
  getInstructorCourseOverviewAggregates,
  getInstructorRevenueInRange,
  type InstructorCourseMetric,
} from "@/queries/analytics/course-aggregations";
import {
  getCourseStudentProgress,
  type ProgressStatus,
  type StudentProgressAggregates,
  type StudentProgressRow,
} from "@/queries/analytics/progress-aggregations";
import {
  getInstructorStudentActivity,
  type DayActivity,
  type HourlyActivity,
  type InactiveStudentSummary,
} from "@/queries/analytics/activity-aggregations";
import {
  getInstructorEarningsAnalytics,
  type InstructorEarningsByCourse,
  type InstructorEarningsTotals,
} from "@/queries/analytics/revenue-aggregations";
import type { TimeSeriesPoint } from "@/lib/analytics/date-buckets";

export interface InstructorOverviewData {
  totalCourses: number;
  totalEnrollments: number;
  activeStudents: number;
  totalRevenue: number;
  avgCompletionRate: number;
  courses: InstructorCourseMetric[];
  trends: {
    enrollments: TrendIndicator;
    revenue: TrendIndicator;
    completions: TrendIndicator;
  };
}

/**
 * Instructor course overview with strict data isolation (FR-011).
 * Metrics are always scoped to `instructorId`'s owned courses.
 */
export async function getInstructorOverview(options: {
  instructorId: string;
  courseId?: string;
  preset?: DateRangePreset;
  startDate?: string;
  endDate?: string;
}): Promise<{
  data: InstructorOverviewData;
  dateRange: { start: string; end: string };
}> {
  const { current, previous } = getComparedDateRanges(options);
  const { instructorId, courseId } = options;

  const [currentAgg, prevEnrollments, prevRevenue, prevCompletions] =
    await Promise.all([
      getInstructorCourseOverviewAggregates(instructorId, current, {
        courseId,
      }),
      countInstructorEnrollmentsInRange(instructorId, previous, courseId),
      getInstructorRevenueInRange(instructorId, previous, courseId),
      countInstructorCompletionsInRange(instructorId, previous, courseId),
    ]);

  return {
    data: {
      totalCourses: currentAgg.totalCourses,
      totalEnrollments: currentAgg.totalEnrollments,
      activeStudents: currentAgg.activeStudents,
      totalRevenue: currentAgg.totalRevenue,
      avgCompletionRate: currentAgg.avgCompletionRate,
      courses: currentAgg.courses,
      trends: {
        enrollments: buildTrendIndicator(
          currentAgg.periodEnrollments,
          prevEnrollments
        ),
        revenue: buildTrendIndicator(currentAgg.periodRevenue, prevRevenue),
        completions: buildTrendIndicator(
          currentAgg.periodCompletions,
          prevCompletions
        ),
      },
    },
    dateRange: toDateRangeResponse(current),
  };
}

export interface StudentProgressData {
  courseId: string;
  students: StudentProgressRow[];
  pagination: { page: number; pageSize: number; total: number };
  aggregates: StudentProgressAggregates;
}

/**
 * Student progress for an instructor-owned course.
 * Ownership must be verified by the caller before invoking.
 * Response is privacy-projected (FR-008).
 */
export async function getStudentProgress(options: {
  courseId: string;
  page?: number;
  pageSize?: number;
  status?: ProgressStatus | string;
  sortBy?: "name" | "progress" | "lastActivity" | "enrollmentDate";
  sortOrder?: "asc" | "desc";
}): Promise<{ data: StudentProgressData }> {
  const result = await getCourseStudentProgress({
    courseId: options.courseId,
    page: options.page,
    pageSize: options.pageSize,
    status: options.status,
    sortBy: options.sortBy,
    sortOrder: options.sortOrder,
  });

  return { data: result };
}

export interface StudentActivityData {
  activityTrend: TimeSeriesPoint[];
  activityByHour: HourlyActivity[];
  activityByDay: DayActivity[];
  avgSessionDuration: number;
  inactiveStudents: {
    last7Days: number;
    last30Days: number;
    list7Days: InactiveStudentSummary[];
    list30Days: InactiveStudentSummary[];
  };
}

/**
 * Login/session activity for students enrolled in the instructor's courses.
 * Scoped via enrollment on owned courses (FR-011). Privacy: names only on lists (FR-008).
 */
export async function getStudentActivity(options: {
  instructorId: string;
  courseId?: string;
  preset?: DateRangePreset;
  startDate?: string;
  endDate?: string;
}): Promise<{
  data: StudentActivityData;
  dateRange: { start: string; end: string };
}> {
  const { current } = getComparedDateRanges(options);
  const data = await getInstructorStudentActivity(
    options.instructorId,
    current,
    options.courseId
  );

  return {
    data,
    dateRange: toDateRangeResponse(current),
  };
}

export interface InstructorRevenueData {
  totals: InstructorEarningsTotals;
  earningsTrend: TimeSeriesPoint[];
  earningsByCourse: InstructorEarningsByCourse[];
  comparison: {
    current: number;
    previous: number;
    changePercent: number;
  };
}

/**
 * Instructor course earnings (FR-010), scoped to owned courses only (FR-011).
 */
export async function getInstructorRevenue(options: {
  instructorId: string;
  courseId?: string;
  preset?: DateRangePreset;
  startDate?: string;
  endDate?: string;
  granularity?: Granularity;
}): Promise<{
  data: InstructorRevenueData;
  dateRange: { start: string; end: string };
}> {
  const { current, previous } = getComparedDateRanges(options);
  const data = await getInstructorEarningsAnalytics(
    options.instructorId,
    current,
    previous,
    options.granularity ?? "day",
    options.courseId
  );

  return {
    data,
    dateRange: toDateRangeResponse(current),
  };
}
