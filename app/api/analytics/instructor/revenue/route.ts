import { NextResponse } from "next/server";
import { z } from "zod";
import {
  analyticsAuthErrorResponse,
  assertCourseOwnership,
  requireInstructor,
} from "@/lib/analytics/auth";
import { dateRangeSchema, granularitySchema } from "@/lib/analytics/schemas";
import { getInstructorRevenue } from "@/service/analytics/instructor-analytics.service";
import { isAdmin } from "@/lib/authorization";
import { dbConnect } from "@/service/mongo";
import { Course } from "@/model/course-model";

const revenueQuerySchema = dateRangeSchema.and(
  z.object({
    courseId: z.string().min(1).optional(),
    granularity: granularitySchema.optional(),
  })
);

/**
 * GET /api/analytics/instructor/revenue
 * Earnings analytics for instructor-owned courses (FR-010, FR-011).
 */
export async function GET(request: Request) {
  try {
    const user = await requireInstructor();

    const { searchParams } = new URL(request.url);
    const parsed = revenueQuerySchema.safeParse({
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
      courseId: searchParams.get("courseId") ?? undefined,
      granularity: searchParams.get("granularity") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.errors[0]?.message ?? "Invalid query",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    const { courseId, granularity, ...dateRange } = parsed.data;

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

    const { data, dateRange: resolved } = await getInstructorRevenue({
      instructorId,
      courseId,
      granularity,
      ...dateRange,
    });

    return NextResponse.json({
      success: true,
      data,
      dateRange: resolved,
    });
  } catch (error) {
    return analyticsAuthErrorResponse(error);
  }
}
