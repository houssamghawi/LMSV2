/**
 * CLI: re-embed all lessons that have lecture content into ChromaDB.
 *
 * Usage:
 *   npm run reembed-lessons
 *   npm run reembed-lessons -- --lessonId=<mongo_id>
 *   npm run reembed-lessons -- --dry-run
 *
 * Requires MONGODB_URI, GEMINI_API_KEY, and a running ChromaDB (CHROMA_URL).
 * Uses syncLessonEmbeddings — respects content-hash skip unless content changed.
 */

import { config } from "dotenv";
import mongoose from "mongoose";
import { dbConnect } from "../service/mongo.js";
import { Lesson } from "../model/lesson.model.js";
import { Module } from "../model/module.model.js";
import {
    syncLessonEmbeddings,
    extractLessonContent
} from "../service/lecture-embedder.js";
import { isVectorStoreAvailable } from "../service/vector-store.js";

config({ path: ".env.local" });
config({ path: ".env" });

function getArg(name) {
    const prefix = `--${name}=`;
    const match = process.argv.find((arg) => arg.startsWith(prefix));
    return match ? match.slice(prefix.length) : null;
}

function hasFlag(name) {
    return process.argv.includes(`--${name}`);
}

async function resolveCourseId(lessonId) {
    const module = await Module.findOne({ lessonIds: lessonId }).select("course").lean();
    return module?.course?.toString() ?? null;
}

async function main() {
    const dryRun = hasFlag("dry-run");
    const singleLessonId = getArg("lessonId");

    const uri = process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING;
    if (!uri) {
        console.error("MONGODB_URI is not configured.");
        process.exit(1);
    }

    if (!process.env.GEMINI_API_KEY?.trim()) {
        console.error("GEMINI_API_KEY is not configured.");
        process.exit(1);
    }

    if (!dryRun) {
        const chromaOk = await isVectorStoreAvailable();
        if (!chromaOk) {
            console.error(
                "ChromaDB is not reachable. Start it with `npm run chroma` and set CHROMA_URL."
            );
            process.exit(1);
        }
    }

    if (singleLessonId && !mongoose.Types.ObjectId.isValid(singleLessonId)) {
        console.error(`Invalid lessonId: ${singleLessonId}`);
        process.exit(1);
    }

    try {
        await dbConnect();

        const query = singleLessonId
            ? { _id: singleLessonId }
            : {
                  $or: [
                      { extractedText: { $exists: true, $ne: "" } },
                      { docxFilename: { $exists: true, $ne: null } },
                      { description: { $exists: true, $ne: "" } }
                  ]
              };

        const lessons = await Lesson.find(query)
            .select("_id title extractedText docxFilename description")
            .lean();

        const withContent = lessons.filter((lesson) =>
            Boolean(extractLessonContent(lesson)?.trim())
        );

        if (withContent.length === 0) {
            console.info("No lessons with embeddable content found.");
            process.exit(0);
        }

        console.info(`Found ${withContent.length} lesson(s) with embeddable content.`);

        if (dryRun) {
            for (const lesson of withContent) {
                const courseId = await resolveCourseId(lesson._id);
                console.info(
                    `  [dry-run] ${lesson._id} "${lesson.title}" → course ${courseId ?? "UNKNOWN"}`
                );
            }
            process.exit(0);
        }

        let ok = 0;
        let failed = 0;
        let skipped = 0;

        for (const lesson of withContent) {
            const lessonId = lesson._id.toString();
            const courseId = await resolveCourseId(lesson._id);
            if (!courseId) {
                console.warn(`  SKIP ${lessonId} "${lesson.title}" — no parent module/course`);
                failed += 1;
                continue;
            }

            try {
                const result = await syncLessonEmbeddings(lessonId, courseId);
                if (result.skipped) {
                    skipped += 1;
                    console.info(`  SKIP ${lessonId} "${lesson.title}" — content unchanged (${result.chunkCount} chunks)`);
                } else {
                    ok += 1;
                    console.info(
                        `  OK   ${lessonId} "${lesson.title}" — ${result.chunkCount} chunk(s), status ${result.status}`
                    );
                }
            } catch (error) {
                failed += 1;
                console.error(`  FAIL ${lessonId} "${lesson.title}" — ${error?.message || error}`);
            }
        }

        console.info(`Done: ${ok} embedded, ${skipped} skipped, ${failed} failed.`);
        process.exit(failed > 0 ? 1 : 0);
    } catch (error) {
        console.error("Re-embed failed:", error?.message || error);
        process.exit(1);
    }
}

main();
