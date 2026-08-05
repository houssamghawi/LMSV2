import "server-only";
import mongoose from "mongoose";
import { dbConnect } from "@/service/mongo";
import { Payment } from "@/model/payment-model";
import { Enrollment } from "@/model/enrollment-model";
import { Course } from "@/model/course-model";
import type { DateRange } from "@/lib/analytics/date-ranges";
import type { Granularity } from "@/lib/analytics/schemas";
import {
  dateBucketExpression,
  mapBucketRows,
  type TimeSeriesPoint,
} from "@/lib/analytics/date-buckets";
import { getInstructorCourseIds } from "@/queries/analytics/course-aggregations";
import {
  archiveClause,
  notArchivedMatch,
  type ArchiveQueryOptions,
} from "@/lib/analytics/archival";

async function sumSucceededRevenue(
  match: Record<string, unknown>,
  options?: ArchiveQueryOptions
): Promise<number> {
  await dbConnect();
  const result = await Payment.aggregate([
    {
      $match: {
        status: "succeeded",
        ...archiveClause(options?.includeArchived),
        ...match,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ]);
  return result[0]?.total ?? 0;
}

/** Lifetime succeeded payment revenue. */
export async function getLifetimeRevenueTotal(): Promise<number> {
  return sumSucceededRevenue({});
}

/** Succeeded payment revenue within [start, end] (uses paidAt). */
export async function getRevenueInRange(range: DateRange): Promise<number> {
  return sumSucceededRevenue({
    paidAt: { $gte: range.start, $lte: range.end },
  });
}

export async function getRevenueInRanges(
  current: DateRange,
  previous: DateRange
): Promise<{ current: number; previous: number; lifetime: number }> {
  const [currentRevenue, previousRevenue, lifetime] = await Promise.all([
    getRevenueInRange(current),
    getRevenueInRange(previous),
    getLifetimeRevenueTotal(),
  ]);
  return {
    current: currentRevenue,
    previous: previousRevenue,
    lifetime,
  };
}

export interface RevenueTotals {
  revenue: number;
  transactions: number;
  avgTransaction: number;
  successRate: number;
}

/**
 * Period totals: revenue from succeeded payments (paidAt),
 * transaction counts / success rate from all payments (createdAt).
 */
export async function getRevenueTotals(range: DateRange): Promise<RevenueTotals> {
  await dbConnect();

  const [succeeded, statusCounts] = await Promise.all([
    Payment.aggregate([
      {
        $match: {
          status: "succeeded",
          ...notArchivedMatch(),
          paidAt: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$amount" },
          transactions: { $sum: 1 },
        },
      },
    ]),
    Payment.aggregate([
      {
        $match: {
          ...notArchivedMatch(),
          createdAt: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const revenue = succeeded[0]?.revenue ?? 0;
  const succeededTx = succeeded[0]?.transactions ?? 0;
  const totalTx = (statusCounts as Array<{ count: number }>).reduce(
    (sum, row) => sum + row.count,
    0
  );
  const successCount =
    (statusCounts as Array<{ _id: string; count: number }>).find(
      (r) => r._id === "succeeded"
    )?.count ?? 0;

  return {
    revenue,
    transactions: totalTx,
    avgTransaction: succeededTx > 0 ? revenue / succeededTx : 0,
    successRate: totalTx > 0 ? successCount / totalTx : 0,
  };
}

export async function getRevenueTrend(
  range: DateRange,
  granularity: Granularity = "day",
  options?: ArchiveQueryOptions
): Promise<TimeSeriesPoint[]> {
  await dbConnect();

  const rows = await Payment.aggregate([
    {
      $match: {
        status: "succeeded",
        ...archiveClause(options?.includeArchived),
        paidAt: { $gte: range.start, $lte: range.end },
      },
    },
    {
      $group: {
        _id: dateBucketExpression("paidAt", granularity),
        value: { $sum: "$amount" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return mapBucketRows(rows);
}

export async function getRevenueByProvider(
  range: DateRange
): Promise<Array<{ provider: string; amount: number }>> {
  await dbConnect();

  const rows = await Payment.aggregate([
    {
      $match: {
        status: "succeeded",
        ...notArchivedMatch(),
        paidAt: { $gte: range.start, $lte: range.end },
      },
    },
    {
      $group: {
        _id: "$provider",
        amount: { $sum: "$amount" },
      },
    },
    { $sort: { amount: -1 } },
  ]);

  return rows.map((r: { _id: string; amount: number }) => ({
    provider: r._id || "unknown",
    amount: r.amount,
  }));
}

export async function getRevenueByCourse(
  range: DateRange,
  limit = 10
): Promise<Array<{ courseId: string; title: string; amount: number }>> {
  await dbConnect();

  const rows = await Payment.aggregate([
    {
      $match: {
        status: "succeeded",
        ...notArchivedMatch(),
        paidAt: { $gte: range.start, $lte: range.end },
      },
    },
    {
      $group: {
        _id: "$course",
        amount: { $sum: "$amount" },
      },
    },
    { $sort: { amount: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "courses",
        localField: "_id",
        foreignField: "_id",
        as: "course",
      },
    },
    {
      $unwind: {
        path: "$course",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        courseId: { $toString: "$_id" },
        title: { $ifNull: ["$course.title", "Unknown course"] },
        amount: 1,
      },
    },
  ]);

  return rows.map(
    (r: { courseId: string; title: string; amount: number }) => ({
      courseId: r.courseId,
      title: r.title,
      amount: r.amount,
    })
  );
}

export async function getRevenueByInstructor(
  range: DateRange,
  limit = 10
): Promise<Array<{ instructorId: string; name: string; amount: number }>> {
  await dbConnect();

  const rows = await Payment.aggregate([
    {
      $match: {
        status: "succeeded",
        ...notArchivedMatch(),
        paidAt: { $gte: range.start, $lte: range.end },
      },
    },
    {
      $lookup: {
        from: "courses",
        localField: "course",
        foreignField: "_id",
        as: "course",
      },
    },
    { $unwind: "$course" },
    {
      $group: {
        _id: "$course.instructor",
        amount: { $sum: "$amount" },
      },
    },
    { $sort: { amount: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "instructor",
      },
    },
    {
      $unwind: {
        path: "$instructor",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        instructorId: { $toString: "$_id" },
        name: {
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
        amount: 1,
      },
    },
  ]);

  return rows.map(
    (r: { instructorId: string; name: string; amount: number }) => ({
      instructorId: r.instructorId,
      name: r.name?.trim() || "Unknown instructor",
      amount: r.amount,
    })
  );
}

export async function getTransactionStatusBreakdown(
  range: DateRange
): Promise<Array<{ status: string; count: number }>> {
  await dbConnect();

  const rows = await Payment.aggregate([
    {
      $match: {
        ...notArchivedMatch(),
        createdAt: { $gte: range.start, $lte: range.end },
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return rows.map((r: { _id: string; count: number }) => ({
    status: r._id || "unknown",
    count: r.count,
  }));
}

export async function getPaymentSuccessRate(range: DateRange): Promise<number> {
  const totals = await getRevenueTotals(range);
  return totals.successRate;
}

// --- Instructor-scoped earnings (US9 / FR-010, FR-011) ---

export interface InstructorEarningsTotals {
  earnings: number;
  enrollments: number;
  avgPerStudent: number;
}

export interface InstructorEarningsByCourse {
  courseId: string;
  title: string;
  amount: number;
  enrollments: number;
}

export async function getInstructorEarningsTotals(
  instructorId: string,
  range: DateRange,
  courseId?: string
): Promise<InstructorEarningsTotals> {
  const courseIds = await getInstructorCourseIds(instructorId, courseId);
  if (courseIds.length === 0) {
    return { earnings: 0, enrollments: 0, avgPerStudent: 0 };
  }

  await dbConnect();

  const [earningsAgg, enrollments] = await Promise.all([
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
      enrollment_date: { $gte: range.start, $lte: range.end },
    }),
  ]);

  const earnings = earningsAgg[0]?.total ?? 0;
  return {
    earnings,
    enrollments,
    avgPerStudent: enrollments > 0 ? earnings / enrollments : 0,
  };
}

export async function getInstructorEarningsTrend(
  instructorId: string,
  range: DateRange,
  granularity: Granularity = "day",
  courseId?: string
): Promise<TimeSeriesPoint[]> {
  const courseIds = await getInstructorCourseIds(instructorId, courseId);
  if (courseIds.length === 0) return [];

  await dbConnect();

  const rows = await Payment.aggregate([
    {
      $match: {
        status: "succeeded",
        ...notArchivedMatch(),
        course: { $in: courseIds },
        paidAt: { $gte: range.start, $lte: range.end },
      },
    },
    {
      $group: {
        _id: dateBucketExpression("paidAt", granularity),
        value: { $sum: "$amount" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return mapBucketRows(rows);
}

export async function getInstructorEarningsByCourse(
  instructorId: string,
  range: DateRange,
  courseId?: string
): Promise<InstructorEarningsByCourse[]> {
  const courseIds = await getInstructorCourseIds(instructorId, courseId);
  if (courseIds.length === 0) return [];

  await dbConnect();

  const [revenueRows, enrollmentRows, courses] = await Promise.all([
    Payment.aggregate([
      {
        $match: {
          status: "succeeded",
          ...notArchivedMatch(),
          course: { $in: courseIds },
          paidAt: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: "$course",
          amount: { $sum: "$amount" },
        },
      },
    ]),
    Enrollment.aggregate([
      {
        $match: {
          ...notArchivedMatch(),
          course: { $in: courseIds },
          enrollment_date: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: "$course",
          enrollments: { $sum: 1 },
        },
      },
    ]),
    Course.find({ _id: { $in: courseIds } }).select("_id title").lean(),
  ]);

  const titleMap = new Map(
    (
      courses as Array<{ _id: mongoose.Types.ObjectId; title?: string }>
    ).map((c) => [c._id.toString(), c.title || "Untitled course"])
  );
  const amountMap = new Map(
    (
      revenueRows as Array<{ _id: mongoose.Types.ObjectId; amount: number }>
    ).map((r) => [r._id.toString(), r.amount])
  );
  const enrollmentMap = new Map(
    (
      enrollmentRows as Array<{
        _id: mongoose.Types.ObjectId;
        enrollments: number;
      }>
    ).map((r) => [r._id.toString(), r.enrollments])
  );

  const ids = new Set([
    ...amountMap.keys(),
    ...enrollmentMap.keys(),
  ]);

  return [...ids]
    .map((id) => ({
      courseId: id,
      title: titleMap.get(id) || "Untitled course",
      amount: amountMap.get(id) ?? 0,
      enrollments: enrollmentMap.get(id) ?? 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export async function getInstructorEarningsAnalytics(
  instructorId: string,
  current: DateRange,
  previous: DateRange,
  granularity: Granularity = "day",
  courseId?: string
): Promise<{
  totals: InstructorEarningsTotals;
  earningsTrend: TimeSeriesPoint[];
  earningsByCourse: InstructorEarningsByCourse[];
  comparison: {
    current: number;
    previous: number;
    changePercent: number;
  };
}> {
  const [totals, earningsTrend, earningsByCourse, previousEarnings] =
    await Promise.all([
      getInstructorEarningsTotals(instructorId, current, courseId),
      getInstructorEarningsTrend(
        instructorId,
        current,
        granularity,
        courseId
      ),
      getInstructorEarningsByCourse(instructorId, current, courseId),
      getInstructorEarningsTotals(instructorId, previous, courseId),
    ]);

  const currentAmt = totals.earnings;
  const previousAmt = previousEarnings.earnings;
  const changePercent =
    previousAmt === 0
      ? currentAmt > 0
        ? 100
        : 0
      : ((currentAmt - previousAmt) / previousAmt) * 100;

  return {
    totals,
    earningsTrend,
    earningsByCourse,
    comparison: {
      current: currentAmt,
      previous: previousAmt,
      changePercent: Number(changePercent.toFixed(1)),
    },
  };
}
