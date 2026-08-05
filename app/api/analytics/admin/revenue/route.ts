import { NextResponse } from "next/server";
import { z } from "zod";
import {
  analyticsAuthErrorResponse,
  requireAdmin,
} from "@/lib/analytics/auth";
import { dateRangeSchema, granularitySchema } from "@/lib/analytics/schemas";
import { getRevenueAnalytics } from "@/service/analytics/admin-analytics.service";

const revenueQuerySchema = dateRangeSchema.and(
  z.object({
    granularity: granularitySchema.optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  })
);

/**
 * GET /api/analytics/admin/revenue
 * Financial analytics for administrators.
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const parsed = revenueQuerySchema.safeParse({
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
      granularity: searchParams.get("granularity") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
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

    const { data, dateRange } = await getRevenueAnalytics(parsed.data);

    return NextResponse.json({
      success: true,
      data,
      dateRange,
    });
  } catch (error) {
    return analyticsAuthErrorResponse(error);
  }
}
