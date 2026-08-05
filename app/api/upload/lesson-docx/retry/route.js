import { NextResponse } from "next/server";
import { auth } from "@/auth";

import { ROLES } from "@/lib/permissions";
import { createErrorResponse, createSuccessResponse, ERROR_CODES } from "@/lib/errors";
import { logRoute } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { lessonDocxUploadSchema } from "@/lib/validations";
import { verifyInstructorLessonAccess } from "@/lib/lesson-docx-access";
import { retryLessonDocxEmbedding } from "@/lib/lesson-docx-retry";

/**
 * POST /api/upload/lesson-docx/retry
 * Re-attempt extraction and embedding for a failed upload.
 */
export async function POST(request) {
    const logger = logRoute("/api/upload/lesson-docx/retry", "POST");
    logger.start();

    try {
        const session = await auth();
        if (!session?.user?.id) {
            logger.failure(new Error("Unauthorized"));
            return NextResponse.json(
                createErrorResponse("You must be logged in.", ERROR_CODES.AUTH_REQUIRED),
                { status: 401 }
            );
        }

        const userId = session.user.id;
        const userRole = session.user.role;

        if (userRole !== ROLES.INSTRUCTOR && userRole !== ROLES.ADMIN) {
            return NextResponse.json(
                createErrorResponse(
                    "Only instructors and admins can retry embedding.",
                    ERROR_CODES.FORBIDDEN
                ),
                { status: 403 }
            );
        }

        const rate = rateLimit(`lesson-docx-retry:${userId}`, 5, 60000);
        if (!rate.success) {
            return NextResponse.json(
                createErrorResponse("Too many requests. Please try again later.", ERROR_CODES.RATE_LIMITED),
                { status: 429 }
            );
        }

        const body = await request.json();
        const parsed = lessonDocxUploadSchema.safeParse({ lessonId: body?.lessonId });
        if (!parsed.success) {
            return NextResponse.json(
                createErrorResponse("Invalid lesson ID.", ERROR_CODES.VALIDATION_ERROR),
                { status: 400 }
            );
        }

        const lessonId = parsed.data.lessonId;
        const access = await verifyInstructorLessonAccess(lessonId, userId, userRole);
        if (!access.allowed) {
            const status = access.code === "FORBIDDEN" ? 403 : 404;
            return NextResponse.json(
                createErrorResponse(access.error, access.code || ERROR_CODES.NOT_FOUND),
                { status }
            );
        }

        const result = await retryLessonDocxEmbedding(lessonId, userId, session.user);

        logger.success();
        return NextResponse.json(
            createSuccessResponse(result, "Embedding retry started.")
        );
    } catch (error) {
        const code = error?.code;
        if (code === "NO_FILE_UPLOADED") {
            return NextResponse.json(
                createErrorResponse(error.message, code),
                { status: 400 }
            );
        }
        if (code === "NOT_FAILED") {
            return NextResponse.json(
                createErrorResponse(error.message, code),
                { status: 409 }
            );
        }
        if (code === "NO_EXTRACTABLE_TEXT") {
            return NextResponse.json(
                createErrorResponse(error.message, code),
                { status: 400 }
            );
        }

        console.error("[LESSON_DOCX] Retry error:", error);
        logger.failure(error instanceof Error ? error : new Error(String(error)));
        return NextResponse.json(
            createErrorResponse("Failed to retry embedding. Please try again.", ERROR_CODES.INTERNAL_ERROR),
            { status: 500 }
        );
    }
}
