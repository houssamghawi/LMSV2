import { NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { isAdmin } from "@/lib/authorization";
import {
    tutorConfigQuerySchema,
    tutorConfigUpdateSchema
} from "@/lib/validations/tutor-schemas";
import {
    getAdminTutorConfig,
    resolveTutorConfig,
    upsertTutorConfig
} from "@/queries/tutor-interactions";
import { extractZodFieldErrors } from "@/lib/errors";

export const dynamic = "force-dynamic";

function forbiddenResponse() {
    return NextResponse.json(
        {
            success: false,
            error: "Admin access required.",
            code: "FORBIDDEN"
        },
        { status: 403 }
    );
}

/**
 * GET /api/tutor/config — retrieve AI tutor configuration (admin only).
 */
export async function GET(request) {
    try {
        const user = await getLoggedInUser();
        if (!user) {
            return NextResponse.json(
                { success: false, error: "Unauthorized", code: "AUTH_REQUIRED" },
                { status: 401 }
            );
        }

        if (!isAdmin(user)) {
            return forbiddenResponse();
        }

        const { searchParams } = new URL(request.url);
        const parsed = tutorConfigQuerySchema.safeParse(
            Object.fromEntries(searchParams.entries())
        );

        if (!parsed.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Validation failed",
                    code: "VALIDATION_ERROR",
                    fieldErrors: extractZodFieldErrors(parsed.error)
                },
                { status: 400 }
            );
        }

        const config = await getAdminTutorConfig(parsed.data.courseId ?? null);

        return NextResponse.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error("[TUTOR_CONFIG_GET] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Something went wrong. Please try again.",
                code: "INTERNAL_ERROR"
            },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/tutor/config — update AI tutor configuration (admin only).
 */
export async function PUT(request) {
    try {
        const user = await getLoggedInUser();
        if (!user) {
            return NextResponse.json(
                { success: false, error: "Unauthorized", code: "AUTH_REQUIRED" },
                { status: 401 }
            );
        }

        if (!isAdmin(user)) {
            return forbiddenResponse();
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { success: false, error: "Invalid JSON body", code: "VALIDATION_ERROR" },
                { status: 400 }
            );
        }

        const parsed = tutorConfigUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Validation failed",
                    code: "VALIDATION_ERROR",
                    fieldErrors: extractZodFieldErrors(parsed.error)
                },
                { status: 400 }
            );
        }

        const { courseId = null, outOfContextMessage, ...rest } = parsed.data;
        const existing = await resolveTutorConfig(courseId ?? null);

        const updates = { ...rest };
        if (outOfContextMessage) {
            updates.outOfContextMessage = {
                en: outOfContextMessage.en ?? existing.outOfContextMessage.en,
                ar: outOfContextMessage.ar ?? existing.outOfContextMessage.ar
            };
        }

        await upsertTutorConfig({
            courseId: courseId ?? null,
            updates,
            updatedBy: user.id
        });

        const config = await getAdminTutorConfig(courseId ?? null);

        return NextResponse.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error("[TUTOR_CONFIG_PUT] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Something went wrong. Please try again.",
                code: "INTERNAL_ERROR"
            },
            { status: 500 }
        );
    }
}
