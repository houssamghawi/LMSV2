import { NextResponse } from "next/server";
import {
  analyticsAuthErrorResponse,
  requireAdmin,
} from "@/lib/analytics/auth";
import { dateRangeSchema } from "@/lib/analytics/schemas";
import { getPlatformOverview } from "@/service/analytics/admin-analytics.service";

/**
 * GET /api/analytics/admin/overview
 * Platform-wide overview metrics for administrators.
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
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

    const { data, dateRange } = await getPlatformOverview(parsed.data);

    return NextResponse.json({
      success: true,
      data,
      dateRange,
    });
  } catch (error) {
    return analyticsAuthErrorResponse(error);
  }
}
