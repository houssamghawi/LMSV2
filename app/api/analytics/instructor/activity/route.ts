import { NextResponse } from "next/server";
import {
  analyticsAuthErrorResponse,
  assertCourseOwnership,
  requireInstructor,
} from "@/lib/analytics/auth";
import { dateRangeSchema } from "@/lib/analytics/schemas";
import { getStudentActivity } from "@/service/analytics/instructor-analytics.service";
import { isAdmin } from "@/lib/authorization";
import { dbConnect } from "@/service/mongo";
import { Course } from "@/model/course-model";

/**
 * GET /api/analytics/instructor/activity
 * Student activity patterns for instructor-owned courses (FR-011).
 */
export async function GET(request: Request) {
  try {
    const user = await requireInstructor();

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId") ?? undefined;

    if (courseId) {
      await assertCourseOwnership(courseId, user, { allowAdmin: true });
    }

    let instructorId = user.id;
    if (courseId && isAdmin(user)) {
      await dbConnect();
      const course = await Course.findById(courseId).select("instructor").lean();
      if (!course?.instructor) {
        return NextResponse.json(
          { success: false, error: "Course not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }
      instructorId = course.instructor.toString();
    }

    const parsed = dateRangeSchema.safeParse({
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.errors[0]?.message ?? "Invalid date range",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    const { data, dateRange } = await getStudentActivity({
      instructorId,
      courseId,
      ...parsed.data,
    });

    return NextResponse.json({
      success: true,
      data,
      dateRange,
    });
  } catch (error) {
    return analyticsAuthErrorResponse(error);
  }
}
