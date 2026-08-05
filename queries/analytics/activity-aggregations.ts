import "server-only";
import mongoose from "mongoose";
import { subDays } from "date-fns";
import { dbConnect } from "@/service/mongo";
import { UserActivityLog } from "@/model/user-activity-log-model";
import { Enrollment } from "@/model/enrollment-model";
import { User } from "@/model/user-model";
import type { DateRange } from "@/lib/analytics/date-ranges";
import { getInstructorCourseIds } from "@/queries/analytics/course-aggregations";
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

export interface HourlyActivity {
  hour: number;
  count: number;
}

export interface DayActivity {
  day: string;
  count: number;
}

export interface LoginFrequencyBucket {
  /** Inclusive lower bound of login count in the period. */
  minLogins: number;
  /** Exclusive upper bound (null = open-ended). */
  maxLogins: number | null;
  users: number;
}

export interface InactiveStudentSummary {
  studentId: string;
  name: string;
  lastLoginAt: string | null;
}

/** Monday-first order for instructor activity charts. */
const DAY_ORDER = [
  { name: "Monday", mongoDow: 2 },
  { name: "Tuesday", mongoDow: 3 },
  { name: "Wednesday", mongoDow: 4 },
  { name: "Thursday", mongoDow: 5 },
  { name: "Friday", mongoDow: 6 },
  { name: "Saturday", mongoDow: 7 },
  { name: "Sunday", mongoDow: 1 },
];

/**
 * Login events by hour of day (0–23) within the range.
 * Optional `userIds` scopes to enrolled students (instructor analytics).
 */
export async function getActivityByHour(
  range: DateRange,
  userIds?: mongoose.Types.ObjectId[],
  options?: ArchiveQueryOptions
): Promise<HourlyActivity[]> {
  await dbConnect();

  if (userIds && userIds.length === 0) {
    return Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  }

  const match: Record<string, unknown> = {
    action: "login",
    ...archiveClause(options?.includeArchived),
    timestamp: { $gte: range.start, $lte: range.end },
  };
  if (userIds) {
    match.user = { $in: userIds };
  }

  const rows = await UserActivityLog.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $hour: "$timestamp" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const byHour = new Map<number, number>(
    rows.map((r: { _id: number; count: number }) => [r._id, r.count])
  );

  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: byHour.get(hour) ?? 0,
  }));
}

/** Top N peak hours by login count. */
export async function getPeakActivityHours(
  range: DateRange,
  limit = 5
): Promise<HourlyActivity[]> {
  const hours = await getActivityByHour(range);
  return [...hours].sort((a, b) => b.count - a.count).slice(0, limit);
}

/**
 * Distribution of users by how many times they logged in during the range.
 * Buckets: 1, 2–5, 6–20, 21+.
 */
export async function getLoginFrequencyDistribution(
  range: DateRange
): Promise<LoginFrequencyBucket[]> {
  await dbConnect();

  const perUser = await UserActivityLog.aggregate([
    {
      $match: {
        action: "login",
        ...notArchivedMatch(),
        timestamp: { $gte: range.start, $lte: range.end },
      },
    },
    {
      $group: {
        _id: "$user",
        logins: { $sum: 1 },
      },
    },
  ]);

  const buckets: LoginFrequencyBucket[] = [
    { minLogins: 1, maxLogins: 2, users: 0 },
    { minLogins: 2, maxLogins: 6, users: 0 },
    { minLogins: 6, maxLogins: 21, users: 0 },
    { minLogins: 21, maxLogins: null, users: 0 },
  ];

  for (const row of perUser as Array<{ logins: number }>) {
    const n = row.logins;
    if (n < 2) buckets[0].users += 1;
    else if (n < 6) buckets[1].users += 1;
    else if (n < 21) buckets[2].users += 1;
    else buckets[3].users += 1;
  }

  return buckets;
}

async function getEnrolledStudentIds(
  instructorId: string,
  courseId?: string
): Promise<mongoose.Types.ObjectId[]> {
  const courseIds = await getInstructorCourseIds(instructorId, courseId);
  if (courseIds.length === 0) return [];

  const students = await Enrollment.distinct("student", {
    course: { $in: courseIds },
  });
  return students as mongoose.Types.ObjectId[];
}

export async function getInstructorActivityTrend(
  instructorId: string,
  range: DateRange,
  courseId?: string
): Promise<TimeSeriesPoint[]> {
  await dbConnect();
  const studentIds = await getEnrolledStudentIds(instructorId, courseId);
  if (studentIds.length === 0) return [];

  const rows = await UserActivityLog.aggregate([
    {
      $match: {
        action: "login",
        ...notArchivedMatch(),
        user: { $in: studentIds },
        timestamp: { $gte: range.start, $lte: range.end },
      },
    },
    {
      $group: {
        _id: dateBucketExpression("timestamp", "day"),
        value: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return mapBucketRows(rows);
}

export async function getInstructorActivityByHour(
  instructorId: string,
  range: DateRange,
  courseId?: string
): Promise<HourlyActivity[]> {
  const studentIds = await getEnrolledStudentIds(instructorId, courseId);
  return getActivityByHour(range, studentIds);
}

export async function getInstructorActivityByDay(
  instructorId: string,
  range: DateRange,
  courseId?: string
): Promise<DayActivity[]> {
  await dbConnect();
  const studentIds = await getEnrolledStudentIds(instructorId, courseId);
  if (studentIds.length === 0) {
    return DAY_ORDER.map(({ name }) => ({ day: name, count: 0 }));
  }

  const rows = await UserActivityLog.aggregate([
    {
      $match: {
        action: "login",
        ...notArchivedMatch(),
        user: { $in: studentIds },
        timestamp: { $gte: range.start, $lte: range.end },
      },
    },
    {
      $group: {
        _id: { $dayOfWeek: "$timestamp" }, // 1=Sunday … 7=Saturday
        count: { $sum: 1 },
      },
    },
  ]);

  const byDow = new Map<number, number>(
    rows.map((r: { _id: number; count: number }) => [r._id, r.count])
  );

  return DAY_ORDER.map(({ name, mongoDow }) => ({
    day: name,
    count: byDow.get(mongoDow) ?? 0,
  }));
}

/** Average session duration in seconds from logout records with sessionDuration. */
export async function getInstructorAvgSessionDuration(
  instructorId: string,
  range: DateRange,
  courseId?: string
): Promise<number> {
  await dbConnect();
  const studentIds = await getEnrolledStudentIds(instructorId, courseId);
  if (studentIds.length === 0) return 0;

  const result = await UserActivityLog.aggregate([
    {
      $match: {
        action: "logout",
        ...notArchivedMatch(),
        user: { $in: studentIds },
        timestamp: { $gte: range.start, $lte: range.end },
        sessionDuration: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        avg: { $avg: "$sessionDuration" },
      },
    },
  ]);

  return Math.round(result[0]?.avg ?? 0);
}

/**
 * Inactive enrolled students (no login within window).
 * Names only — FR-008 privacy projection.
 */
export async function getInstructorInactiveStudents(
  instructorId: string,
  options: { courseId?: string; withinDays: number; now?: Date }
): Promise<{ count: number; students: InactiveStudentSummary[] }> {
  await dbConnect();
  const now = options.now ?? new Date();
  const since = subDays(now, options.withinDays);
  const studentIds = await getEnrolledStudentIds(
    instructorId,
    options.courseId
  );
  if (studentIds.length === 0) {
    return { count: 0, students: [] };
  }

  const activeLogins = await UserActivityLog.distinct("user", {
    action: "login",
    user: { $in: studentIds },
    timestamp: { $gte: since, $lte: now },
  });
  const activeSet = new Set(
    (activeLogins as mongoose.Types.ObjectId[]).map((id) => id.toString())
  );
  const inactiveIds = studentIds.filter((id) => !activeSet.has(id.toString()));

  if (inactiveIds.length === 0) {
    return { count: 0, students: [] };
  }

  const lastLogins = await UserActivityLog.aggregate([
    {
      $match: {
        action: "login",
        ...notArchivedMatch(),
        user: { $in: inactiveIds },
      },
    },
    { $sort: { timestamp: -1 } },
    {
      $group: {
        _id: "$user",
        lastLoginAt: { $first: "$timestamp" },
      },
    },
  ]);
  const lastLoginMap = new Map(
    (
      lastLogins as Array<{ _id: mongoose.Types.ObjectId; lastLoginAt: Date }>
    ).map((r) => [r._id.toString(), r.lastLoginAt])
  );

  const users = await User.find({ _id: { $in: inactiveIds } })
    .select("firstName lastName")
    .lean();

  const students: InactiveStudentSummary[] = users.map(
    (u: {
      _id: mongoose.Types.ObjectId;
      firstName?: string;
      lastName?: string;
    }) => {
      const id = u._id.toString();
      const last = lastLoginMap.get(id);
      return {
        studentId: id,
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || "Student",
        lastLoginAt: last ? new Date(last).toISOString() : null,
      };
    }
  );

  students.sort((a, b) => a.name.localeCompare(b.name));

  return { count: students.length, students };
}

export async function getInstructorStudentActivity(
  instructorId: string,
  range: DateRange,
  courseId?: string
): Promise<{
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
}> {
  const [
    activityTrend,
    activityByHour,
    activityByDay,
    avgSessionDuration,
    inactive7,
    inactive30,
  ] = await Promise.all([
    getInstructorActivityTrend(instructorId, range, courseId),
    getInstructorActivityByHour(instructorId, range, courseId),
    getInstructorActivityByDay(instructorId, range, courseId),
    getInstructorAvgSessionDuration(instructorId, range, courseId),
    getInstructorInactiveStudents(instructorId, {
      courseId,
      withinDays: 7,
    }),
    getInstructorInactiveStudents(instructorId, {
      courseId,
      withinDays: 30,
    }),
  ]);

  return {
    activityTrend,
    activityByHour,
    activityByDay,
    avgSessionDuration,
    inactiveStudents: {
      last7Days: inactive7.count,
      last30Days: inactive30.count,
      list7Days: inactive7.students.slice(0, 50),
      list30Days: inactive30.students.slice(0, 50),
    },
  };
}
