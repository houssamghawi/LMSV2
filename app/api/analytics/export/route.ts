import { NextResponse } from "next/server";
import {
  analyticsAuthErrorResponse,
  assertCourseOwnership,
  requireAnalyticsUser,
} from "@/lib/analytics/auth";
import { isAdmin } from "@/lib/authorization";
import { exportRequestSchema } from "@/lib/analytics/schemas";
import { dbConnect } from "@/service/mongo";
import { Course } from "@/model/course-model";
import {
  buildAnalyticsExport,
  csvToReadableStream,
  ExportError,
  resolveExportScope,
  type ExportSection,
} from "@/service/analytics/export.service";

/**
 * POST /api/analytics/export
 * Streams analytics CSV with Content-Disposition attachment (FR-014).
 */
export async function POST(request: Request) {
  try {
    const user = await requireAnalyticsUser();
    const body = await request.json();
    const parsed = exportRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.errors[0]?.message ?? "Invalid request",
          },
        },
        { status: 400 }
      );
    }

    const { section, startDate, endDate, courseId, includeArchived } =
      parsed.data;
    const exportSection = section as ExportSection;

    let scope: "admin" | "instructor";
    try {
      scope = resolveExportScope(user, exportSection, courseId);
    } catch (error) {
      if (error instanceof ExportError) {
        return NextResponse.json(
          {
            success: false,
            error: { code: error.code, message: error.message },
          },
          { status: error.status }
        );
      }
      throw error;
    }

    let instructorId = user.id;
    if (scope === "instructor" && courseId) {
      await assertCourseOwnership(courseId, user, { allowAdmin: true });
      if (isAdmin(user)) {
        await dbConnect();
        const course = await Course.findById(courseId)
          .select("instructor")
          .lean();
        if (!course?.instructor) {
          return NextResponse.json(
            {
              success: false,
              error: { code: "NOT_FOUND", message: "Course not found" },
            },
            { status: 404 }
          );
        }
        instructorId = course.instructor.toString();
      }
    }

    const result = await buildAnalyticsExport({
      user,
      instructorId,
      section: exportSection,
      startDate,
      endDate,
      courseId,
      includeArchived,
    });

    const stream = csvToReadableStream(result.csv);

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
        "X-Export-Row-Count": String(result.rowCount),
      },
    });
  } catch (error) {
    if (error instanceof ExportError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: error.code, message: error.message },
        },
        { status: error.status }
      );
    }
    return analyticsAuthErrorResponse(error);
  }
}
