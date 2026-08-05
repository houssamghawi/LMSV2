import "server-only";
import { startOfDay, endOfDay } from "date-fns";
import { dbConnect } from "@/service/mongo";
import { User } from "@/model/user-model";
import { UserActivityLog } from "@/model/user-activity-log-model";
import type { DateRange } from "@/lib/analytics/date-ranges";
import type { Granularity } from "@/lib/analytics/schemas";
import {
  dateBucketExpression,
  mapBucketRows,
  type TimeSeriesPoint,
} from "@/lib/analytics/date-buckets";
import { getActivityByHour } from "@/queries/analytics/activity-aggregations";

export interface UserTotals {
  totalUsers: number;
  totalStudents: number;
  totalInstructors: number;
  totalAdmins: number;
}

export interface RoleDistributionItem {
  role: string;
  count: number;
}

export async function getUserRoleTotals(): Promise<UserTotals> {
  await dbConnect();

  const [totalUsers, totalStudents, totalInstructors, totalAdmins] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "instructor" }),
      User.countDocuments({ role: "admin" }),
    ]);

  return { totalUsers, totalStudents, totalInstructors, totalAdmins };
}

export async function getRoleDistribution(): Promise<RoleDistributionItem[]> {
  await dbConnect();

  const rows = await User.aggregate([
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
      },
    },
  ]);

  const order = ["student", "instructor", "admin"];
  const byRole = new Map(
    rows.map((r: { _id: string; count: number }) => [
      r._id || "unknown",
      r.count,
    ])
  );

  return order.map((role) => ({
    role,
    count: byRole.get(role) ?? 0,
  }));
}

/** Users registered within [start, end] (inclusive). */
export async function countUsersCreatedInRange(
  range: DateRange
): Promise<number> {
  await dbConnect();
  return User.countDocuments({
    createdAt: { $gte: range.start, $lte: range.end },
  });
}

/**
 * Distinct users with a login activity today.
 * Falls back to User.lastLogin when activity logs are empty.
 */
export async function countActiveUsersToday(
  now: Date = new Date()
): Promise<number> {
  await dbConnect();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const fromLogs = await UserActivityLog.distinct("user", {
    action: "login",
    timestamp: { $gte: dayStart, $lte: dayEnd },
  });

  if (fromLogs.length > 0) {
    return fromLogs.length;
  }

  return User.countDocuments({
    lastLogin: { $gte: dayStart, $lte: dayEnd },
  });
}

export async function countUsersCreatedInRanges(
  current: DateRange,
  previous: DateRange
): Promise<{ current: number; previous: number }> {
  const [currentCount, previousCount] = await Promise.all([
    countUsersCreatedInRange(current),
    countUsersCreatedInRange(previous),
  ]);
  return { current: currentCount, previous: previousCount };
}

/** New registrations over time (bucketed by granularity). */
export async function getRegistrationTrend(
  range: DateRange,
  granularity: Granularity = "day"
): Promise<TimeSeriesPoint[]> {
  await dbConnect();

  const rows = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: range.start, $lte: range.end },
      },
    },
    {
      $group: {
        _id: dateBucketExpression("createdAt", granularity),
        value: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return mapBucketRows(rows);
}

/**
 * Distinct active users over time from login activity logs.
 * Falls back to User.lastLogin when no activity logs exist in range.
 */
export async function getActiveUsersTrend(
  range: DateRange,
  granularity: Granularity = "day"
): Promise<TimeSeriesPoint[]> {
  await dbConnect();

  const fromLogs = await UserActivityLog.aggregate([
    {
      $match: {
        action: "login",
        timestamp: { $gte: range.start, $lte: range.end },
      },
    },
    {
      $group: {
        _id: {
          bucket: dateBucketExpression("timestamp", granularity),
          user: "$user",
        },
      },
    },
    {
      $group: {
        _id: "$_id.bucket",
        value: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  if (fromLogs.length > 0) {
    return mapBucketRows(fromLogs);
  }

  const fromLastLogin = await User.aggregate([
    {
      $match: {
        lastLogin: { $gte: range.start, $lte: range.end },
      },
    },
    {
      $group: {
        _id: dateBucketExpression("lastLogin", granularity),
        value: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return mapBucketRows(fromLastLogin);
}

/** Re-export hour activity for user analytics convenience. */
export { getActivityByHour };
