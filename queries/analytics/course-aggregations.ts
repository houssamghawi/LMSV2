import "server-only";
import mongoose from "mongoose";
import { dbConnect } from "@/service/mongo";
import { Course } from "@/model/course-model";
import { Enrollment } from "@/model/enrollment-model";
import { Payment } from "@/model/payment-model";
import type { DateRange } from "@/lib/analytics/date-ranges";
import type { Granularity } from "@/lib/analytics/schemas";
import {
  dateBucketExpression,
  mapBucketRows,
  type TimeSeriesPoint,
} from "@/lib/analytics/date-buckets";
import {
  archiveClause,
  notArchivedMatch,
  type ArchiveQueryOptions,
} from "@/lib/analytics/archival";

export interface CourseTotals {
  totalCourses: number;
  activeCourses: number;
  draftCourses: number;
}

export async function getCourseTotals(): Promise<CourseTotals> {
  await dbConnect();

  const [totalCourses, activeCourses, draftCourses] = await Promise.all([
    Course.countDocuments(),
    Course.countDocuments({ active: true }),
    Course.countDocuments({ active: false }),
  ]);

  return { totalCourses, activeCourses, draftCourses };
}

/** Courses created within [start, end] (inclusive). */
export async function countCoursesCreatedInRange(
  range: DateRange
): Promise<number> {
  await dbConnect();
  return Course.countDocuments({
    createdOn: { $gte: range.start, $lte: range.end },
  });
}

export async function countCoursesCreatedInRanges(
  current: DateRange,
  previous: DateRange
): Promise<{ current: number; previous: number }> {
  const [currentCount, previousCount] = await Promise.all([
    countCoursesCreatedInRange(current),
    countCoursesCreatedInRange(previous),
  ]);
  return { current: currentCount, previous: previousCount };
}

export async function getEnrollmentTotal(): Promise<number> {
  await dbConnect();
  return Enrollment.countDocuments();
}

/** Enrollments created within [start, end] (inclusive). */
export async function countEnrollmentsInRange(
  range: DateRange
): Promise<number> {
  await dbConnect();
  return Enrollment.countDocuments({
    ...notArchivedMatch(),
    enrollment_date: { $gte: range.start, $lte: range.end },
  });
}

export async function countEnrollmentsInRanges(
  current: DateRange,
  previous: DateRange
): Promise<{ current: number; previous: number }> {
  const [currentCount, previousCount] = await Promise.all([
    countEnrollmentsInRange(current),
    countEnrollmentsInRange(previous),
  ]);
  return { current: currentCount, previous: previousCount };
}

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

/** Course IDs owned by the instructor (optionally narrowed to one course). */
export async function getInstructorCourseIds(
  instructorId: string,
  courseId?: string
): Promise<mongoose.Types.ObjectId[]> {
  await dbConnect();

  const filter: Record<string, unknown> = {
    instructor: toObjectId(instructorId),
  };
  if (courseId) {
    filter._id = toObjectId(courseId);
  }

  const courses = await Course.find(filter).select("_id").lean();
  return courses.map((c) => c._id as mongoose.Types.ObjectId);
}

export interface InstructorCourseMetric {
  courseId: string;
  title: string;
  enrollments: number;
  activeStudents: number;
  completionRate: number;
  revenue: number;
  avgProgress: number;
}

export interface InstructorOverviewAggregates {
  totalCourses: number;
  totalEnrollments: number;
  activeStudents: number;
  totalRevenue: number;
  avgCompletionRate: number;
  courses: InstructorCourseMetric[];
  periodEnrollments: number;
  periodRevenue: number;
  periodCompletions: number;
}

/**
 * Instructor-scoped overview: only courses where `course.instructor === instructorId`.
 */
export async function getInstructorCourseOverviewAggregates(
  instructorId: string,
  range: DateRange,
  options: { courseId?: string } = {}
): Promise<InstructorOverviewAggregates> {
  await dbConnect();

  const courseIds = await getInstructorCourseIds(
    instructorId,
    options.courseId
  );

  if (courseIds.length === 0) {
    return {
      totalCourses: 0,
      totalEnrollments: 0,
      activeStudents: 0,
      totalRevenue: 0,
      avgCompletionRate: 0,
      courses: [],
      periodEnrollments: 0,
      periodRevenue: 0,
      periodCompletions: 0,
    };
  }

  const courses = await Course.find({ _id: { $in: courseIds } })
    .select("_id title")
    .lean();

  const [
    enrollmentStats,
    revenueByCourse,
    periodEnrollments,
    periodRevenue,
    periodCompletions,
  ] = await Promise.all([
    Enrollment.aggregate([
      { $match: { ...notArchivedMatch(), course: { $in: courseIds } } },
      {
        $group: {
          _id: "$course",
          enrollments: { $sum: 1 },
          activeStudents: {
            $sum: {
              $cond: [{ $eq: ["$status", "in-progress"] }, 1, 0],
            },
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
            },
          },
          progressSum: {
            $sum: {
              $switch: {
                branches: [
                  { case: { $eq: ["$status", "completed"] }, then: 1 },
                  { case: { $eq: ["$status", "in-progress"] }, then: 0.5 },
                ],
                default: 0,
              },
            },
          },
        },
      },
    ]),
    Payment.aggregate([
      {
        $match: {
          status: "succeeded",
          ...notArchivedMatch(),
          course: { $in: courseIds },
        },
      },
      {
        $group: {
          _id: "$course",
          amount: { $sum: "$amount" },
        },
      },
    ]),
    Enrollment.countDocuments({
      ...notArchivedMatch(),
      course: { $in: courseIds },
      enrollment_date: { $gte: range.start, $lte: range.end },
    }),
    Payment.aggregate([
      {
        $match: {
          status: "succeeded",
          ...notArchivedMatch(),
          course: { $in: courseIds },
          paidAt: { $gte: range.start, $lte: range.end },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Enrollment.countDocuments({
      ...notArchivedMatch(),
      course: { $in: courseIds },
      status: "completed",
      completion_date: { $gte: range.start, $lte: range.end },
    }),
  ]);

  const enrollMap = new Map(
    (
      enrollmentStats as Array<{
        _id: mongoose.Types.ObjectId;
        enrollments: number;
        activeStudents: number;
        completed: number;
        progressSum: number;
      }>
    ).map((r) => [r._id.toString(), r])
  );
  const revenueMap = new Map(
    (
      revenueByCourse as Array<{ _id: mongoose.Types.ObjectId; amount: number }>
    ).map((r) => [r._id.toString(), r.amount])
  );

  const courseMetrics: InstructorCourseMetric[] = courses.map((course) => {
    const id = course._id.toString();
    const stats = enrollMap.get(id);
    const enrollments = stats?.enrollments ?? 0;
    const completed = stats?.completed ?? 0;
    const progressSum = stats?.progressSum ?? 0;
    return {
      courseId: id,
      title: course.title,
      enrollments,
      activeStudents: stats?.activeStudents ?? 0,
      completionRate: enrollments > 0 ? completed / enrollments : 0,
      revenue: revenueMap.get(id) ?? 0,
      avgProgress: enrollments > 0 ? progressSum / enrollments : 0,
    };
  });

  const totalEnrollments = courseMetrics.reduce(
    (sum, c) => sum + c.enrollments,
    0
  );
  const activeStudents = courseMetrics.reduce(
    (sum, c) => sum + c.activeStudents,
    0
  );
  const totalRevenue = courseMetrics.reduce((sum, c) => sum + c.revenue, 0);
  const totalCompleted = (
    enrollmentStats as Array<{ completed: number }>
  ).reduce((sum, r) => sum + r.completed, 0);

  return {
    totalCourses: courseMetrics.length,
    totalEnrollments,
    activeStudents,
    totalRevenue,
    avgCompletionRate:
      totalEnrollments > 0 ? totalCompleted / totalEnrollments : 0,
    courses: courseMetrics.sort((a, b) => b.enrollments - a.enrollments),
    periodEnrollments,
    periodRevenue: periodRevenue[0]?.total ?? 0,
    periodCompletions,
  };
}

export async function countInstructorEnrollmentsInRange(
  instructorId: string,
  range: DateRange,
  courseId?: string
): Promise<number> {
  const courseIds = await getInstructorCourseIds(instructorId, courseId);
  if (courseIds.length === 0) return 0;
  return Enrollment.countDocuments({
    ...notArchivedMatch(),
    course: { $in: courseIds },
    enrollment_date: { $gte: range.start, $lte: range.end },
  });
}

export async function getInstructorRevenueInRange(
  instructorId: string,
  range: DateRange,
  courseId?: string
): Promise<number> {
  const courseIds = await getInstructorCourseIds(instructorId, courseId);
  if (courseIds.length === 0) return 0;
  await dbConnect();
  const result = await Payment.aggregate([
    {
      $match: {
        status: "succeeded",
        ...notArchivedMatch(),
        course: { $in: courseIds },
        paidAt: { $gte: range.start, $lte: range.end },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return result[0]?.total ?? 0;
}

export async function countInstructorCompletionsInRange(
  instructorId: string,
  range: DateRange,
  courseId?: string
): Promise<number> {
  const courseIds = await getInstructorCourseIds(instructorId, courseId);
  if (courseIds.length === 0) return 0;
  return Enrollment.countDocuments({
    ...notArchivedMatch(),
    course: { $in: courseIds },
    status: "completed",
    completion_date: { $gte: range.start, $lte: range.end },
  });
}

// --- Admin platform course analytics (US5) ---

export interface AdminCourseTotals {
  courses: number;
  published: number;
  draft: number;
  avgEnrollments: number;
  avgCompletionRate: number;
}

export async function getAdminCourseAnalyticsTotals(): Promise<AdminCourseTotals> {
  await dbConnect();

  const [courseTotals, enrollmentAgg, completionAgg] = await Promise.all([
    getCourseTotals(),
    Enrollment.aggregate([
      {
        $group: {
          _id: "$course",
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          courseCount: { $sum: 1 },
          totalEnrollments: { $sum: "$count" },
        },
      },
    ]),
    Enrollment.aggregate([
      {
        $group: {
          _id: "$course",
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
        },
      },
      {
        $group: {
          _id: null,
          avgRate: {
            $avg: {
              $cond: [
                { $gt: ["$total", 0] },
                { $divide: ["$completed", "$total"] },
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const coursesWithEnrollments = enrollmentAgg[0]?.courseCount ?? 0;
  const totalEnrollments = enrollmentAgg[0]?.totalEnrollments ?? 0;

  return {
    courses: courseTotals.totalCourses,
    published: courseTotals.activeCourses,
    draft: courseTotals.draftCourses,
    avgEnrollments:
      coursesWithEnrollments > 0
        ? totalEnrollments / coursesWithEnrollments
        : 0,
    avgCompletionRate: completionAgg[0]?.avgRate ?? 0,
  };
}

export async function getEnrollmentTrend(
  range: DateRange,
  granularity: Granularity = "day",
  options?: ArchiveQueryOptions
): Promise<TimeSeriesPoint[]> {
  await dbConnect();
  const rows = await Enrollment.aggregate([
    {
      $match: {
        ...archiveClause(options?.includeArchived),
        enrollment_date: { $gte: range.start, $lte: range.end },
      },
    },
    {
      $group: {
        _id: dateBucketExpression("enrollment_date", granularity),
        value: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return mapBucketRows(rows);
}

export async function getCompletionTrend(
  range: DateRange,
  granularity: Granularity = "day"
): Promise<TimeSeriesPoint[]> {
  await dbConnect();
  const rows = await Enrollment.aggregate([
    {
      $match: {
        ...notArchivedMatch(),
        status: "completed",
        completion_date: { $gte: range.start, $lte: range.end },
      },
    },
    {
      $group: {
        _id: dateBucketExpression("completion_date", granularity),
        value: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return mapBucketRows(rows);
}

export interface TopCourseRow {
  courseId: string;
  title: string;
  instructor: string;
  enrollments: number;
  completions: number;
  completionRate: number;
  revenue: number;
}

export async function getTopCoursesByPerformance(
  range: DateRange,
  limit = 10
): Promise<TopCourseRow[]> {
  await dbConnect();

  const rows = await Enrollment.aggregate([
    {
      $match: {
        ...notArchivedMatch(),
        enrollment_date: { $gte: range.start, $lte: range.end },
      },
    },
    {
      $group: {
        _id: "$course",
        enrollments: { $sum: 1 },
        completions: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
      },
    },
    { $sort: { enrollments: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "courses",
        localField: "_id",
        foreignField: "_id",
        as: "course",
      },
    },
    { $unwind: { path: "$course", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "users",
        localField: "course.instructor",
        foreignField: "_id",
        as: "instructor",
      },
    },
    {
      $unwind: { path: "$instructor", preserveNullAndEmptyArrays: true },
    },
    {
      $lookup: {
        from: "payments",
        let: { courseId: "$_id" },
        pipeline: [
          {
            $match: {
              ...notArchivedMatch(),
              $expr: {
                $and: [
                  { $eq: ["$course", "$$courseId"] },
                  { $eq: ["$status", "succeeded"] },
                  { $gte: ["$paidAt", range.start] },
                  { $lte: ["$paidAt", range.end] },
                ],
              },
            },
          },
          { $group: { _id: null, amount: { $sum: "$amount" } } },
        ],
        as: "revenue",
      },
    },
    {
      $project: {
        courseId: { $toString: "$_id" },
        title: { $ifNull: ["$course.title", "Unknown course"] },
        instructor: {
          $trim: {
            input: {
              $concat: [
                { $ifNull: ["$instructor.firstName", ""] },
                " ",
                { $ifNull: ["$instructor.lastName", ""] },
              ],
            },
          },
        },
        enrollments: 1,
        completions: 1,
        revenue: {
          $ifNull: [{ $arrayElemAt: ["$revenue.amount", 0] }, 0],
        },
      },
    },
  ]);

  return rows.map(
    (r: {
      courseId: string;
      title: string;
      instructor: string;
      enrollments: number;
      completions: number;
      revenue: number;
    }) => ({
      courseId: r.courseId,
      title: r.title,
      instructor: r.instructor?.trim() || "Unknown instructor",
      enrollments: r.enrollments,
      completions: r.completions,
      completionRate:
        r.enrollments > 0 ? r.completions / r.enrollments : 0,
      revenue: r.revenue,
    })
  );
}

export async function getCategoryDistribution(): Promise<
  Array<{ category: string; count: number }>
> {
  await dbConnect();

  const rows = await Course.aggregate([
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $unwind: { path: "$category", preserveNullAndEmptyArrays: true },
    },
    {
      $project: {
        category: { $ifNull: ["$category.title", "Uncategorized"] },
        count: 1,
      },
    },
    { $sort: { count: -1 } },
  ]);

  return rows.map((r: { category: string; count: number }) => ({
    category: r.category,
    count: r.count,
  }));
}
