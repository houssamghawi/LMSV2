import { NextResponse } from "next/server";
import { auth } from "@/auth";

import { dbConnect } from "@/service/mongo";
import { Lesson } from "@/model/lesson.model";
import { ROLES } from "@/lib/permissions";
import { createErrorResponse, createSuccessResponse, ERROR_CODES } from "@/lib/errors";
import { logRoute } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import {
    DOCX_MIME_TYPE,
    MAX_LESSON_DOCX_SIZE
} from "@/lib/constants";
import { lessonDocxUploadSchema } from "@/lib/validations";
import { verifyInstructorLessonAccess } from "@/lib/lesson-docx-access";
import {
    cleanupLessonDocxFiles,
    saveLessonDocxFile
} from "@/lib/lesson-docx-files";
import { validateDocxBuffer } from "@/service/docx-validator";
import { extractDocxText, extractDocxHtml } from "@/service/docx-extractor";
import {
    removeLessonEmbeddings,
    syncLessonEmbeddings
} from "@/service/lecture-embedder";

function isDocxFile(file) {
    if (!(file instanceof File)) return false;
    const name = file.name?.toLowerCase() ?? "";
    return file.type === DOCX_MIME_TYPE || name.endsWith(".docx");
}

/**
 * POST /api/upload/lesson-docx
 * Upload or replace a .docx file for a lesson.
 */
export async function POST(request) {
    const logger = logRoute("/api/upload/lesson-docx", "POST");
    logger.start();

    try {
        const session = await auth();
        if (!session?.user?.id) {
            logger.failure(new Error("Unauthorized"));
            return NextResponse.json(
                createErrorResponse("You must be logged in to upload files.", ERROR_CODES.AUTH_REQUIRED),
                { status: 401 }
            );
        }

        const userId = session.user.id;
        const userRole = session.user.role;

        if (userRole !== ROLES.INSTRUCTOR && userRole !== ROLES.ADMIN) {
            logger.failure(new Error("Forbidden"));
            return NextResponse.json(
                createErrorResponse(
                    "Only instructors and admins can upload lesson files.",
                    ERROR_CODES.FORBIDDEN
                ),
                { status: 403 }
            );
        }

        const rate = rateLimit(`lesson-docx-upload:${userId}`, 10, 60000);
        if (!rate.success) {
            return NextResponse.json(
                createErrorResponse("Too many upload requests. Please try again later.", ERROR_CODES.RATE_LIMITED),
                { status: 429 }
            );
        }

        const formData = await request.formData();
        const file = formData.get("file");
        const lessonId = String(formData.get("lessonId") || "");

        const parsed = lessonDocxUploadSchema.safeParse({ lessonId });
        if (!parsed.success) {
            return NextResponse.json(
                createErrorResponse("Invalid lesson ID.", ERROR_CODES.VALIDATION_ERROR),
                { status: 400 }
            );
        }

        if (!file) {
            return NextResponse.json(
                createErrorResponse("File and lesson ID are required.", ERROR_CODES.VALIDATION_ERROR),
                { status: 400 }
            );
        }

        const access = await verifyInstructorLessonAccess(lessonId, userId, userRole);
        if (!access.allowed) {
            const status = access.code === "FORBIDDEN" ? 403 : 404;
            return NextResponse.json(
                createErrorResponse(access.error, access.code || ERROR_CODES.NOT_FOUND),
                { status }
            );
        }

        if (!isDocxFile(file)) {
            return NextResponse.json(
                createErrorResponse(
                    "Invalid file type. Only .docx files are accepted.",
                    "INVALID_FILE_TYPE"
                ),
                { status: 400 }
            );
        }

        if (file.size > MAX_LESSON_DOCX_SIZE) {
            return NextResponse.json(
                createErrorResponse(
                    `File exceeds maximum size of ${MAX_LESSON_DOCX_SIZE / 1024 / 1024} MB.`,
                    "FILE_TOO_LARGE"
                ),
                { status: 400 }
            );
        }

        const rawBuffer = Buffer.from(await file.arrayBuffer());

        let sanitizedBuffer;
        try {
            sanitizedBuffer = await validateDocxBuffer(rawBuffer);
        } catch (error) {
            const code = error?.code || "INVALID_OOXML";
            const message =
                code === "INVALID_OOXML"
                    ? "The file is not a valid Word document."
                    : "The file could not be processed. It may be corrupt or password-protected.";
            return NextResponse.json(
                createErrorResponse(message, code),
                { status: 400 }
            );
        }

        let textExtraction;
        try {
            textExtraction = await extractDocxText(sanitizedBuffer);
        } catch (error) {
            return NextResponse.json(
                createErrorResponse(
                    "The file could not be processed. It may be corrupt or password-protected.",
                    "DOCX_PARSE_FAILED"
                ),
                { status: 400 }
            );
        }

        if (!textExtraction.text) {
            return NextResponse.json(
                createErrorResponse(
                    "No text content could be extracted from the file. The document may contain only images or be empty.",
                    "NO_EXTRACTABLE_TEXT"
                ),
                { status: 400 }
            );
        }

        const courseId = access.course._id.toString();

        if (access.lesson.docxFilename) {
            await cleanupLessonDocxFiles(lessonId);
            try {
                await removeLessonEmbeddings(lessonId, courseId);
            } catch (embedError) {
                console.error("[LESSON_DOCX] Failed to remove old embeddings:", embedError);
            }
        }

        let htmlExtraction;
        try {
            htmlExtraction = await extractDocxHtml(sanitizedBuffer, lessonId);
        } catch (error) {
            return NextResponse.json(
                createErrorResponse(
                    "The file could not be processed. It may be corrupt or password-protected.",
                    "DOCX_PARSE_FAILED"
                ),
                { status: 400 }
            );
        }

        const filename = await saveLessonDocxFile(lessonId, sanitizedBuffer);
        const warnings = [
            ...new Set([...(textExtraction.warnings || []), ...(htmlExtraction.warnings || [])])
        ];

        await dbConnect();
        await Lesson.findByIdAndUpdate(lessonId, {
            $set: {
                docxFilename: filename,
                docxOriginalName: file.name,
                docxSize: file.size,
                docxUploadedAt: new Date(),
                extractedHtml: htmlExtraction.html,
                extractedText: textExtraction.text,
                tutorEmbeddingStatus: "pending",
                tutorEmbeddingError: null
            }
        });

        syncLessonEmbeddings(lessonId, courseId).catch((embedError) => {
            console.error("[LESSON_DOCX] Background embedding sync failed:", embedError);
        });

        logger.success();
        return NextResponse.json(
            createSuccessResponse(
                {
                    lessonId,
                    filename,
                    originalName: file.name,
                    size: file.size,
                    extractedTextLength: textExtraction.text.length,
                    imageCount: htmlExtraction.imageCount,
                    embeddingStatus: "pending",
                    warnings
                },
                "Lecture file uploaded successfully."
            )
        );
    } catch (error) {
        console.error("[LESSON_DOCX] Upload error:", error);
        logger.failure(error instanceof Error ? error : new Error(String(error)));
        return NextResponse.json(
            createErrorResponse("Failed to upload file. Please try again.", ERROR_CODES.INTERNAL_ERROR),
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/upload/lesson-docx?lessonId=...
 * Remove the uploaded .docx file from a lesson.
 */
export async function DELETE(request) {
    const logger = logRoute("/api/upload/lesson-docx", "DELETE");
    logger.start();

    try {
        const session = await auth();
        if (!session?.user?.id) {
            logger.failure(new Error("Unauthorized"));
            return NextResponse.json(
                createErrorResponse("You must be logged in to delete files.", ERROR_CODES.AUTH_REQUIRED),
                { status: 401 }
            );
        }

        const userId = session.user.id;
        const userRole = session.user.role;

        if (userRole !== ROLES.INSTRUCTOR && userRole !== ROLES.ADMIN) {
            return NextResponse.json(
                createErrorResponse(
                    "Only instructors and admins can delete lesson files.",
                    ERROR_CODES.FORBIDDEN
                ),
                { status: 403 }
            );
        }

        const rate = rateLimit(`lesson-docx-delete:${userId}`, 10, 60000);
        if (!rate.success) {
            return NextResponse.json(
                createErrorResponse("Too many requests. Please try again later.", ERROR_CODES.RATE_LIMITED),
                { status: 429 }
            );
        }

        const { searchParams } = new URL(request.url);
        const lessonId = searchParams.get("lessonId") || "";

        const parsed = lessonDocxUploadSchema.safeParse({ lessonId });
        if (!parsed.success) {
            return NextResponse.json(
                createErrorResponse("Invalid lesson ID.", ERROR_CODES.VALIDATION_ERROR),
                { status: 400 }
            );
        }

        const access = await verifyInstructorLessonAccess(lessonId, userId, userRole);
        if (!access.allowed) {
            const status = access.code === "FORBIDDEN" ? 403 : 404;
            return NextResponse.json(
                createErrorResponse(access.error, access.code || ERROR_CODES.NOT_FOUND),
                { status }
            );
        }

        if (!access.lesson.docxFilename) {
            return NextResponse.json(
                createErrorResponse("No file uploaded for this lesson.", "NO_FILE_UPLOADED"),
                { status: 404 }
            );
        }

        const courseId = access.course._id.toString();

        await cleanupLessonDocxFiles(lessonId);

        try {
            await removeLessonEmbeddings(lessonId, courseId);
        } catch (embedError) {
            console.error("[LESSON_DOCX] Failed to remove embeddings:", embedError);
        }

        await dbConnect();
        await Lesson.findByIdAndUpdate(lessonId, {
            $set: {
                docxFilename: null,
                docxOriginalName: null,
                docxSize: null,
                docxUploadedAt: null,
                extractedHtml: null,
                extractedText: null,
                tutorEmbeddingStatus: "none",
                tutorContentHash: null,
                tutorEmbeddedAt: null,
                tutorEmbeddingError: null
            }
        });

        logger.success();
        return NextResponse.json(
            createSuccessResponse(
                { lessonId, embeddingStatus: "none" },
                "Lecture file deleted successfully."
            )
        );
    } catch (error) {
        console.error("[LESSON_DOCX] Delete error:", error);
        logger.failure(error instanceof Error ? error : new Error(String(error)));
        return NextResponse.json(
            createErrorResponse("Failed to delete file. Please try again.", ERROR_CODES.INTERNAL_ERROR),
            { status: 500 }
        );
    }
}

