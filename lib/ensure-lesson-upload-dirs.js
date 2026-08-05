import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

import { LESSON_UPLOAD_DIR, LESSON_IMAGES_DIR } from "./constants.js";

/**
 * Ensure base lesson upload directories exist (uploads/lessons, uploads/lesson-images).
 * Mirrors ensureUploadDir() in app/api/upload/video/route.js.
 */
export async function ensureLessonUploadDirs() {
    const root = process.cwd();

    for (const dir of [LESSON_UPLOAD_DIR, LESSON_IMAGES_DIR]) {
        const fullPath = join(root, dir);
        if (!existsSync(fullPath)) {
            await mkdir(fullPath, { recursive: true });
        }
    }
}

/**
 * Ensure the per-lesson image extraction directory exists.
 *
 * @param {string} lessonId
 * @returns {Promise<string>} absolute path to uploads/lesson-images/{lessonId}
 */
export async function ensureLessonImagesDir(lessonId) {
    await ensureLessonUploadDirs();
    const dir = join(process.cwd(), LESSON_IMAGES_DIR, lessonId);
    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
    }
    return dir;
}
