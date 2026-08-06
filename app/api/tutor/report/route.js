import { NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { tutorReportSchema } from "@/lib/validations/tutor-schemas";
import {
    createTutorReport,
    getTutorInteraction,
    getTutorReportForInteraction
} from "@/queries/tutor-interactions";
import { extractZodFieldErrors } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/tutor/report — report an issue with an AI tutor response.
 */
export async function POST(request) {
    try {
        const user = await getLoggedInUser();
        if (!user) {
            return NextResponse.json(
                { success: false, error: "Unauthorized", code: "AUTH_REQUIRED" },
                { status: 401 }
            );
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

        const parsed = tutorReportSchema.safeParse(body);
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

        const { interactionId, reason, details } = parsed.data;
        const interaction = await getTutorInteraction(interactionId);

        if (!interaction) {
            return NextResponse.json(
                { success: false, error: "Interaction not found", code: "NOT_FOUND" },
                { status: 404 }
            );
        }

        if (interaction.studentId !== user.id) {
            return NextResponse.json(
                {
                    success: false,
                    error: "You can only report issues for your own interactions.",
                    code: "FORBIDDEN"
                },
                { status: 403 }
            );
        }

        const existing = await getTutorReportForInteraction(interactionId, user.id);
        if (existing) {
            return NextResponse.json({
                success: true,
                data: {
                    reportId: existing.id,
                    message: "Thank you for your feedback. The issue has been reported."
                }
            });
        }

        const report = await createTutorReport({
            interactionId,
            studentId: user.id,
            reason,
            details
        });

        if (!report) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Something went wrong. Please try again.",
                    code: "INTERNAL_ERROR"
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                data: {
                    reportId: report.id,
                    message: "Thank you for your feedback. The issue has been reported."
                }
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("[TUTOR_REPORT_POST] Error:", error);
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
