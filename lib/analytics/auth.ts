import "server-only";
import { NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/loggedin-user";
import {
  AuthorizationError,
  assertInstructorOwnsCourse,
  isAdmin,
  isInstructor,
} from "@/lib/authorization";

export type AnalyticsUser = {
  id: string;
  role: string;
  email?: string;
  [key: string]: unknown;
};

export class AnalyticsAuthError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AnalyticsAuthError";
    this.status = status;
    this.code = code;
  }
}

export function analyticsAuthErrorResponse(error: unknown): NextResponse {
  if (error instanceof AnalyticsAuthError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status: error.status }
    );
  }
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      { success: false, error: error.message, code: "FORBIDDEN" },
      { status: 403 }
    );
  }
  console.error("Analytics auth error:", error);
  return NextResponse.json(
    { success: false, error: "Internal server error", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}

export async function requireAdmin(): Promise<AnalyticsUser> {
  const user = await getLoggedInUser();
  if (!user) {
    throw new AnalyticsAuthError(401, "AUTH_REQUIRED", "Unauthorized");
  }
  if (!isAdmin(user)) {
    throw new AnalyticsAuthError(403, "FORBIDDEN", "Forbidden");
  }
  return user as AnalyticsUser;
}

export async function requireInstructor(): Promise<AnalyticsUser> {
  const user = await getLoggedInUser();
  if (!user) {
    throw new AnalyticsAuthError(401, "AUTH_REQUIRED", "Unauthorized");
  }
  if (!isInstructor(user) && !isAdmin(user)) {
    throw new AnalyticsAuthError(403, "FORBIDDEN", "Forbidden");
  }
  return user as AnalyticsUser;
}

/** Admin or instructor (for shared analytics features like preferences/export). */
export async function requireAnalyticsUser(): Promise<AnalyticsUser> {
  const user = await getLoggedInUser();
  if (!user) {
    throw new AnalyticsAuthError(401, "AUTH_REQUIRED", "Unauthorized");
  }
  if (!isAdmin(user) && !isInstructor(user)) {
    throw new AnalyticsAuthError(403, "FORBIDDEN", "Forbidden");
  }
  return user as AnalyticsUser;
}

/**
 * Assert the instructor owns the course.
 * Admins are denied unless `allowAdmin` is true (default false for instructor isolation).
 */
export async function assertCourseOwnership(
  courseId: string,
  user: AnalyticsUser,
  options: { allowAdmin?: boolean } = {}
): Promise<void> {
  const { allowAdmin = false } = options;

  if (allowAdmin && isAdmin(user)) {
    return;
  }

  if (!isInstructor(user) && !isAdmin(user)) {
    throw new AnalyticsAuthError(403, "FORBIDDEN", "Forbidden");
  }

  try {
    await assertInstructorOwnsCourse(courseId, user.id, {
      allowAdmin: false,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw new AnalyticsAuthError(
        403,
        "FORBIDDEN",
        "You can only view analytics for your own courses"
      );
    }
    if (error instanceof Error && error.message === "Course not found") {
      throw new AnalyticsAuthError(404, "NOT_FOUND", "Course not found");
    }
    throw error;
  }
}
