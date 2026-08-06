import { NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { hasEnrollmentForCourse } from "@/queries/enrollments";
import { tutorHistoryQuerySchema } from "@/lib/validations/tutor-schemas";
import {
    getStudentTutorInteractions,
    getInstructorTutorInteractions
} from "@/queries/tutor-interactions";
import { verifyInstructorOwnsCourse, isAdmin } from "@/lib/authorization";
import { extractZodFieldErrors } from "@/lib/errors";
import { ROLES } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function mapInteraction(row, includeStudent = false) {
    const createdAt =
        row.createdAt instanceof Date
            ? row.createdAt.toISOString()
            : row.createdAt;

    const item = {
        id: row.id,
        question: row.question,
        response: row.response,
        citation: row.citation ?? null,
        contextStatus: row.contextStatus,
        detectedLanguage: row.detectedLanguage,
        feedback: row.feedback ?? null,
        lessonId: row.lessonId,
        lessonTitle: row.lessonTitle ?? "",
        createdAt
    };

    if (includeStudent) {
        item.studentName = row.studentName ?? null;
        item.studentEmail = row.studentEmail ?? null;
    }

    return item;
}

/**
 * GET /api/tutor/history — paginated interaction history for a course.
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

        const { searchParams } = new URL(request.url);
        const queryInput = Object.fromEntries(searchParams.entries());
        const parsed = tutorHistoryQuerySchema.safeParse(queryInput);

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

        const {
            courseId,
            lessonId,
            contextStatus,
            dateFrom,
            dateTo,
            page,
            limit
        } = parsed.data;

        const queryParams = {
            courseId,
            lessonId,
            contextStatus,
            dateFrom,
            dateTo,
            page,
            limit
        };

        let result;
        let includeStudent = false;

        if (user.role === ROLES.STUDENT) {
            const enrolled = await hasEnrollmentForCourse(courseId, user.id);
            if (!enrolled) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "You must be enrolled in this course to view tutor history.",
                        code: "NOT_ENROLLED"
                    },
                    { status: 403 }
                );
            }

            result = await getStudentTutorInteractions({
                ...queryParams,
                studentId: user.id
            });
        } else if (user.role === ROLES.INSTRUCTOR) {
            const ownsCourse = await verifyInstructorOwnsCourse(
                courseId,
                user.id,
                user
            );
            if (!ownsCourse) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "You do not have permission to view interactions for this course.",
                        code: "FORBIDDEN"
                    },
                    { status: 403 }
                );
            }

            result = await getInstructorTutorInteractions(queryParams);
            includeStudent = true;
        } else if (isAdmin(user)) {
            result = await getInstructorTutorInteractions(queryParams);
            includeStudent = true;
        } else {
            return NextResponse.json(
                {
                    success: false,
                    error: "You do not have permission to view tutor history.",
                    code: "FORBIDDEN"
                },
                { status: 403 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                interactions: result.interactions.map((row) =>
                    mapInteraction(row, includeStudent)
                ),
                pagination: result.pagination
            }
        });
    } catch (error) {
        console.error("[TUTOR_HISTORY_GET] Error:", error);
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
