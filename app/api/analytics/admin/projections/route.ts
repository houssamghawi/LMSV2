import { NextResponse } from "next/server";
import { z } from "zod";
import {
  analyticsAuthErrorResponse,
  requireAdmin,
} from "@/lib/analytics/auth";
import {
  getProjection,
  InsufficientProjectionDataError,
  PROJECTION_HORIZONS,
} from "@/service/analytics/projection.service";

const projectionsQuerySchema = z.object({
  metric: z.enum(["users", "revenue", "enrollments"]),
  horizon: z.coerce
    .number()
    .int()
    .refine((n) => (PROJECTION_HORIZONS as readonly number[]).includes(n), {
      message: "horizon must be 30, 60, or 90",
    })
    .optional()
    .default(30),
});

/**
 * GET /api/analytics/admin/projections
 * Future projections from historical trends (FR-006).
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const parsed = projectionsQuerySchema.safeParse({
      metric: searchParams.get("metric") ?? undefined,
      horizon: searchParams.get("horizon") ?? undefined,
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

    const data = await getProjection(parsed.data);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    if (error instanceof InsufficientProjectionDataError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INSUFFICIENT_DATA",
            message: error.message,
            actualDays: error.actualDays,
          },
        },
        { status: 400 }
      );
    }
    return analyticsAuthErrorResponse(error);
  }
}
