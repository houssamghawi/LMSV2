import { NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { hasEnrollmentForCourse } from "@/queries/enrollments";
import { TUTOR_QUESTION_MAX_LENGTH } from "@/lib/constants";
import { tutorAskSchema } from "@/lib/validations/tutor-schemas";
import {
    countRecentInteractions,
    resolveTutorConfig
} from "@/queries/tutor-interactions";
import { askTutorQuestion, TutorServiceError } from "@/service/ai-tutor";
import { extractZodFieldErrors } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function tutorErrorResponse(error, status, code, extra = {}) {
    return NextResponse.json(
        {
            success: false,
            error,
            code,
            ...extra
        },
        { status }
    );
}

/**
 * POST /api/tutor/ask — submit a question to the context-bound AI tutor.
 */
export async function POST(request) {
    try {
        const user = await getLoggedInUser();
        if (!user) {
            return tutorErrorResponse("Unauthorized", 401, "AUTH_REQUIRED");
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return tutorErrorResponse("Invalid JSON body", 400, "VALIDATION_ERROR");
        }

        const parsed = tutorAskSchema.safeParse(body);
        if (!parsed.success) {
            const questionTooLong = parsed.error.issues.some(
                (issue) =>
                    issue.path[0] === "question" &&
                    issue.code === "too_big"
            );

            if (questionTooLong) {
                return tutorErrorResponse(
                    `Your question is too long. Please keep it under ${TUTOR_QUESTION_MAX_LENGTH} characters.`,
                    400,
                    "QUESTION_TOO_LONG"
                );
            }

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

        const { lessonId, courseId, question, conversationHistory } = parsed.data;

        const enrolled = await hasEnrollmentForCourse(courseId, user.id);
        if (!enrolled) {
            return tutorErrorResponse(
                "You must be enrolled in this course to use the AI tutor.",
                403,
                "NOT_ENROLLED"
            );
        }

        const config = await resolveTutorConfig(courseId);
        const used = await countRecentInteractions(user.id, courseId);
        const remaining = Math.max(0, config.rateLimitPerHour - used);
        const resetAt = Math.floor(Date.now() / 1000) + 3600;

        const rateHeaders = {
            "X-RateLimit-Limit": String(config.rateLimitPerHour),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(resetAt)
        };

        if (used >= config.rateLimitPerHour) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Too many requests. Please wait a moment before asking again.",
                    code: "RATE_LIMIT_EXCEEDED",
                    retryAfter: 120
                },
                {
                    status: 429,
                    headers: {
                        ...rateHeaders,
                        "Retry-After": "120"
                    }
                }
            );
        }

        const result = await askTutorQuestion({
            question,
            lessonId,
            courseId,
            studentId: user.id,
            conversationHistory: conversationHistory ?? []
        });

        return NextResponse.json(
            {
                success: true,
                data: result
            },
            {
                status: 200,
                headers: {
                    ...rateHeaders,
                    "X-RateLimit-Remaining": String(Math.max(0, remaining - 1))
                }
            }
        );
    } catch (error) {
        if (error instanceof TutorServiceError) {
            if (error.logCode && error.logCode !== error.code) {
                console.error("[TUTOR_ASK_POST]", error.logCode, {
                    code: error.code,
                    message: error.message
                });
            }
            return tutorErrorResponse(error.message, error.status, error.code);
        }

        console.error("[TUTOR_ASK_POST] SERVICE_UNAVAILABLE", {
            logCode: error?.logCode || "INTERNAL_ERROR",
            message: error?.message
        });
        return tutorErrorResponse(
            "AI tutor is temporarily unavailable. Please try again later.",
            503,
            "SERVICE_UNAVAILABLE"
        );
    }
}
