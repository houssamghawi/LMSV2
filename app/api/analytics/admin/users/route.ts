import { NextResponse } from "next/server";
import { z } from "zod";
import {
  analyticsAuthErrorResponse,
  requireAdmin,
} from "@/lib/analytics/auth";
import { dateRangeSchema, granularitySchema } from "@/lib/analytics/schemas";
import { getUserAnalytics } from "@/service/analytics/admin-analytics.service";

const usersQuerySchema = dateRangeSchema.and(
  z.object({
    granularity: granularitySchema.optional(),
  })
);

/**
 * GET /api/analytics/admin/users
 * User registration, activity, and role distribution analytics.
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const parsed = usersQuerySchema.safeParse({
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
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

    const { data, dateRange } = await getUserAnalytics(parsed.data);

    return NextResponse.json({
      success: true,
      data,
      dateRange,
    });
  } catch (error) {
    return analyticsAuthErrorResponse(error);
  }
}
