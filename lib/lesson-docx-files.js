import { existsSync } from "fs";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";

import { LESSON_UPLOAD_DIR, LESSON_IMAGES_DIR } from "@/lib/constants";
import { ensureLessonUploadDirs } from "@/lib/ensure-lesson-upload-dirs";

/**
 * Absolute path to the stored .docx for a lesson.
 * @param {string} lessonId
 */
export function getLessonDocxPath(lessonId) {
    return join(process.cwd(), LESSON_UPLOAD_DIR, `${lessonId}.docx`);
}

/**
 * Absolute path to extracted images directory for a lesson.
 * @param {string} lessonId
 */
export function getLessonImagesPath(lessonId) {
    return join(process.cwd(), LESSON_IMAGES_DIR, lessonId);
}

/**
 * Remove stored .docx and extracted images for a lesson.
 * @param {string} lessonId
 */
export async function cleanupLessonDocxFiles(lessonId) {
    const docxPath = getLessonDocxPath(lessonId);
    const imagesPath = getLessonImagesPath(lessonId);

    if (existsSync(docxPath)) {
        await rm(docxPath, { force: true });
    }
    if (existsSync(imagesPath)) {
        await rm(imagesPath, { recursive: true, force: true });
    }
}

/**
 * Persist a validated .docx buffer for a lesson.
 * @param {string} lessonId
 * @param {Buffer} buffer
 */
export async function saveLessonDocxFile(lessonId, buffer) {
    await ensureLessonUploadDirs();
    const filepath = getLessonDocxPath(lessonId);
    if (!filepath.startsWith(join(process.cwd(), LESSON_UPLOAD_DIR))) {
        throw new Error("Invalid file path");
    }
    await writeFile(filepath, buffer);
    return `${lessonId}.docx`;
}
