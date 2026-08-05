import "server-only";
import { dbConnect } from "@/service/mongo";
import { UserActivityLog } from "@/model/user-activity-log-model";

export type ActivityAction = "login" | "logout";

/**
 * Record a login/logout event for analytics. Never throws — failures are logged only
 * so auth flows are never blocked by activity tracking.
 */
export async function recordUserActivity(options: {
  userId: string;
  action: ActivityAction;
  sessionDuration?: number;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: Date;
}): Promise<void> {
  try {
    await dbConnect();
    await UserActivityLog.create({
      user: options.userId,
      action: options.action,
      timestamp: options.timestamp ?? new Date(),
      sessionDuration: options.sessionDuration,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    });
  } catch (error) {
    console.error("Failed to record user activity:", error);
  }
}
