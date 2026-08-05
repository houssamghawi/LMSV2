import { NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { tutorFeedbackSchema } from "@/lib/validations/tutor-schemas";
import {
    getTutorInteraction,
    updateTutorInteractionFeedback
} from "@/queries/tutor-interactions";
import { extractZodFieldErrors } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/tutor/feedback — thumbs up/down on a tutor interaction.
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

        const parsed = tutorFeedbackSchema.safeParse(body);
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

        const { interactionId, feedback } = parsed.data;
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
                    error: "You can only provide feedback for your own interactions.",
                    code: "FORBIDDEN"
                },
                { status: 403 }
            );
        }

        const updated = await updateTutorInteractionFeedback(interactionId, feedback);

        return NextResponse.json({
            success: true,
            data: {
                interactionId: updated.id,
                feedback: updated.feedback
            }
        });
    } catch (error) {
        console.error("[TUTOR_FEEDBACK_POST] Error:", error);
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
