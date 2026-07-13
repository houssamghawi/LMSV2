import { NextResponse } from "next/server";
import { createReadStream } from "fs";
import { existsSync } from "fs";
import { stat } from "fs/promises";
import { join } from "path";
import { Readable } from "stream";
import { auth } from "@/auth";

import { LESSON_IMAGES_DIR } from "@/lib/constants";
import { createErrorResponse, ERROR_CODES } from "@/lib/errors";
import { logRoute } from "@/lib/logger";
import { verifyLessonContentAccess } from "@/lib/lesson-docx-access";

const IMAGE_MIME_TYPES = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp"
};

function nodeStreamToWeb(nodeStream) {
    if (typeof Readable.toWeb === "function") {
        return Readable.toWeb(nodeStream);
    }
    return new ReadableStream({
        start(controller) {
            nodeStream.on("data", (chunk) => controller.enqueue(chunk));
            nodeStream.on("end", () => controller.close());
            nodeStream.on("error", (err) => controller.error(err));
        },
        cancel() {
            nodeStream.destroy();
        }
    });
}

/**
 * GET /api/lesson-images/{lessonId}/{filename}
 * Serve an extracted image from a lesson's .docx file.
 */
export async function GET(request, { params }) {
    const logger = logRoute("/api/lesson-images/[lessonId]/[filename]", "GET");
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

        const { lessonId, filename } = await params;

        if (
            !filename ||
            filename.includes("..") ||
            filename.includes("/") ||
            filename.includes("\\")
        ) {
            return NextResponse.json(
                createErrorResponse("Invalid filename.", ERROR_CODES.VALIDATION_ERROR),
                { status: 400 }
            );
        }

        const access = await verifyLessonContentAccess(
            lessonId,
            session.user.id,
            session.user.role
        );
        if (!access.allowed) {
            const status = access.code === "FORBIDDEN" ? 403 : 404;
            return NextResponse.json(
                createErrorResponse(access.error, access.code || ERROR_CODES.FORBIDDEN),
                { status }
            );
        }

        const imagesDir = join(process.cwd(), LESSON_IMAGES_DIR, lessonId);
        const filepath = join(imagesDir, filename);

        if (!filepath.startsWith(imagesDir)) {
            return NextResponse.json(
                createErrorResponse("Invalid file path.", ERROR_CODES.VALIDATION_ERROR),
                { status: 400 }
            );
        }

        if (!existsSync(filepath)) {
            return NextResponse.json(
                createErrorResponse("Image not found.", "IMAGE_NOT_FOUND"),
                { status: 404 }
            );
        }

        const ext = filename.split(".").pop()?.toLowerCase() || "png";
        const contentType = IMAGE_MIME_TYPES[ext] || "application/octet-stream";
        const stats = await stat(filepath);
        const nodeStream = createReadStream(filepath);
        const webStream = nodeStreamToWeb(nodeStream);

        logger.success();
        return new Response(webStream, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Length": stats.size.toString(),
                "Cache-Control": "public, max-age=31536000, immutable"
            }
        });
    } catch (error) {
        console.error("[LESSON_IMAGES] Error:", error);
        logger.failure(error instanceof Error ? error : new Error(String(error)));
        return NextResponse.json(
            createErrorResponse("Failed to serve image.", ERROR_CODES.INTERNAL_ERROR),
            { status: 500 }
        );
    }
}
