import { NextResponse } from "next/server";
import {
  analyticsAuthErrorResponse,
  requireAdmin,
} from "@/lib/analytics/auth";
import { dateRangeSchema } from "@/lib/analytics/schemas";
import { getPerformanceMetrics } from "@/service/analytics/admin-analytics.service";

/**
 * GET /api/analytics/admin/performance
 * Application performance metrics for administrators (FR-005).
 * Default range: last 7 days when no dates provided (contract).
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") ?? undefined;
    const endDate = searchParams.get("endDate") ?? undefined;

    const parsed = dateRangeSchema.safeParse({ startDate, endDate });

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

    const { data, dateRange } = await getPerformanceMetrics({
      ...parsed.data,
      preset: startDate || endDate ? undefined : "7d",
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
