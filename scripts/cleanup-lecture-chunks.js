/**
 * CLI: remove legacy MongoDB lecture chunk metadata (ChromaDB is the RAG source of truth).
 *
 * Usage:
 *   npm run cleanup-lecture-chunks
 *   npm run cleanup-lecture-chunks -- --dry-run
 *
 * Requires MONGODB_URI (or MONGODB_CONNECTION_STRING) in .env.local or .env.
 * Does not modify ChromaDB — run reembed-lessons afterward if vectors are missing.
 */

import { config } from "dotenv";
import mongoose from "mongoose";
import { dbConnect } from "../service/mongo.js";

config({ path: ".env.local" });
config({ path: ".env" });

function hasFlag(name) {
    return process.argv.includes(`--${name}`);
}

async function main() {
    const dryRun = hasFlag("dry-run");
    const uri = process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING;
    if (!uri) {
        console.error("MONGODB_URI is not configured.");
        process.exit(1);
    }

    try {
        await dbConnect();
        const collection = mongoose.connection.collection("lecturechunks");
        const count = await collection.countDocuments();

        if (count === 0) {
            console.info("No legacy lecturechunks documents found. Nothing to do.");
            process.exit(0);
        }

        if (dryRun) {
            console.info(`[dry-run] Would delete ${count} document(s) from lecturechunks.`);
            process.exit(0);
        }

        const result = await collection.deleteMany({});
        console.info(`Deleted ${result.deletedCount} legacy lecturechunks document(s).`);
        console.info(
            "ChromaDB vectors were not changed. Run `npm run reembed-lessons` to rebuild indexes if needed."
        );
        process.exit(0);
    } catch (error) {
        console.error("Cleanup failed:", error?.message || error);
        process.exit(1);
    }
}

main();
