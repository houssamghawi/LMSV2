import { NextResponse } from "next/server";
import { z } from "zod";
import {
  analyticsAuthErrorResponse,
  requireAnalyticsUser,
} from "@/lib/analytics/auth";
import { isAdmin, isInstructor } from "@/lib/authorization";
import {
  getDashboardPreferences,
  upsertDashboardPreferences,
} from "@/service/analytics/dashboard-preference.service";

const roleSchema = z.enum(["admin", "instructor"]);

const widgetSchema = z.object({
  id: z.string().min(1),
  position: z.number().int().min(0),
  size: z.enum(["small", "medium", "large"]).optional().default("medium"),
  visible: z.boolean(),
});

const putBodySchema = z.object({
  role: roleSchema,
  layout: z.array(widgetSchema).optional(),
  defaultDateRange: z.enum(["7d", "30d", "90d", "custom"]).optional(),
  customDateRange: z
    .object({
      start: z.string().min(1),
      end: z.string().min(1),
    })
    .nullable()
    .optional(),
  hiddenWidgets: z.array(z.string()).optional(),
});

/**
 * GET /api/analytics/preferences?role=admin|instructor
 */
export async function GET(request: Request) {
  try {
    const user = await requireAnalyticsUser();
    const { searchParams } = new URL(request.url);
    const parsed = roleSchema.safeParse(searchParams.get("role"));

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "role query param is required (admin|instructor)",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    const role = parsed.data;
    if (role === "admin" && !isAdmin(user)) {
      return NextResponse.json(
        { success: false, error: "Forbidden", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const data = await getDashboardPreferences(user.id, role);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return analyticsAuthErrorResponse(error);
  }
}

/**
 * PUT /api/analytics/preferences
 */
export async function PUT(request: Request) {
  try {
    const user = await requireAnalyticsUser();
    const body = await request.json();
    const parsed = putBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.errors[0]?.message ?? "Invalid body",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    const { role, ...input } = parsed.data;

    if (role === "admin" && !isAdmin(user)) {
      return NextResponse.json(
        { success: false, error: "Forbidden", code: "FORBIDDEN" },
        { status: 403 }
      );
    }
    if (role === "instructor" && !isInstructor(user) && !isAdmin(user)) {
      return NextResponse.json(
        { success: false, error: "Forbidden", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const data = await upsertDashboardPreferences(user.id, role, input);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return analyticsAuthErrorResponse(error);
  }
}
