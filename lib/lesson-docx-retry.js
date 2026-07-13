import { readFile } from "fs/promises";
import { existsSync } from "fs";

import { dbConnect } from "@/service/mongo";
import { Lesson } from "@/model/lesson.model";
import { getLessonDocxPath } from "@/lib/lesson-docx-files";
import { validateDocxBuffer } from "@/service/docx-validator";
import { extractDocxText, extractDocxHtml } from "@/service/docx-extractor";
import {
    getCourseIdForLesson,
    syncLessonEmbeddings
} from "@/service/lecture-embedder";

/**
 * Re-attempt extraction and embedding for a failed lesson .docx upload.
 *
 * @param {string} lessonId
 * @param {string} userId
 * @param {object} user
 * @returns {Promise<{ lessonId: string, embeddingStatus: string }>}
 */
export async function retryLessonDocxEmbedding(lessonId, userId, user) {
    const { assertInstructorOwnsLesson } = await import("@/lib/authorization");
    await assertInstructorOwnsLesson(lessonId, userId, user);

    await dbConnect();
    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson) {
        const err = new Error("Lesson not found");
        err.code = "LESSON_NOT_FOUND";
        throw err;
    }

    if (!lesson.docxFilename) {
        const err = new Error("No uploaded file found for this lesson. Upload a file first.");
        err.code = "NO_FILE_UPLOADED";
        throw err;
    }

    if (lesson.tutorEmbeddingStatus !== "failed") {
        const err = new Error(
            `Embedding is not in a failed state. Current status: ${lesson.tutorEmbeddingStatus || "none"}.`
        );
        err.code = "NOT_FAILED";
        throw err;
    }

    const docxPath = getLessonDocxPath(lessonId);
    if (!existsSync(docxPath)) {
        const err = new Error("No uploaded file found for this lesson. Upload a file first.");
        err.code = "NO_FILE_UPLOADED";
        throw err;
    }

    const rawBuffer = await readFile(docxPath);
    const sanitizedBuffer = await validateDocxBuffer(rawBuffer);
    const textExtraction = await extractDocxText(sanitizedBuffer);

    if (!textExtraction.text) {
        const err = new Error(
            "No text content could be extracted from the file. The document may contain only images or be empty."
        );
        err.code = "NO_EXTRACTABLE_TEXT";
        throw err;
    }

    const htmlExtraction = await extractDocxHtml(sanitizedBuffer, lessonId);

    await Lesson.findByIdAndUpdate(lessonId, {
        $set: {
            extractedHtml: htmlExtraction.html,
            extractedText: textExtraction.text,
            tutorEmbeddingStatus: "pending",
            tutorEmbeddingError: null
        }
    });

    const courseId = await getCourseIdForLesson(lessonId);
    syncLessonEmbeddings(lessonId, courseId).catch((embedError) => {
        console.error("[LESSON_DOCX] Retry embedding sync failed:", embedError);
    });

    return { lessonId, embeddingStatus: "pending" };
}
