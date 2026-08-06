/**
 * CLI: manually embed lecture content for a lesson.
 *
 * Usage:
 *   npm run embed-lesson -- --lessonId=<mongo_id> [--courseId=<mongo_id>]
 *
 * Requires MONGODB_URI and GEMINI_API_KEY in .env.local or .env.
 * ChromaDB must be running at CHROMA_URL (default http://localhost:8000).
 */

import { config } from "dotenv";
import mongoose from "mongoose";
import { dbConnect } from "../service/mongo.js";
import { syncLessonEmbeddings } from "../service/lecture-embedder.js";

config({ path: ".env.local" });
config({ path: ".env" });

function getArg(name) {
    const prefix = `--${name}=`;
    const match = process.argv.find((arg) => arg.startsWith(prefix));
    return match ? match.slice(prefix.length) : null;
}

async function main() {
    const lessonId = getArg("lessonId");
    const courseId = getArg("courseId");

    if (!lessonId) {
        console.error("Usage: npm run embed-lesson -- --lessonId=<mongo_id> [--courseId=<mongo_id>]");
        process.exit(1);
    }

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
        console.error(`Invalid lessonId: ${lessonId}`);
        process.exit(1);
    }

    if (courseId && !mongoose.Types.ObjectId.isValid(courseId)) {
        console.error(`Invalid courseId: ${courseId}`);
        process.exit(1);
    }

    const uri = process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING;
    if (!uri) {
        console.error("MONGODB_URI is not configured.");
        process.exit(1);
    }

    try {
        await dbConnect();
        console.info(`Embedding lesson ${lessonId}...`);
        const result = await syncLessonEmbeddings(lessonId, courseId);
        console.info("Done:", result);
        process.exit(0);
    } catch (error) {
        console.error("Embedding failed:", error?.message || error);
        process.exit(1);
    }
}

main();
