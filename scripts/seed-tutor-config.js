/**
 * CLI: seed the global default TutorConfiguration document.
 *
 * Usage:
 *   npm run seed-tutor-config
 *   npm run seed-tutor-config -- --force
 *
 * Requires MONGODB_URI (or MONGODB_CONNECTION_STRING) in .env.local or .env.
 * Idempotent: skips when a global config (courseId: null) already exists,
 * unless --force is passed (upserts defaults).
 */

import { config } from "dotenv";
import mongoose from "mongoose";
import { dbConnect } from "../service/mongo.js";
import { TutorConfiguration } from "../model/tutor-config-model.js";
import { DEFAULT_TUTOR_CONFIG } from "../lib/constants.js";

config({ path: ".env.local" });
config({ path: ".env" });

function hasFlag(name) {
    return process.argv.includes(`--${name}`);
}

async function main() {
    const uri = process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING;
    if (!uri) {
        console.error("MONGODB_URI is not configured.");
        process.exit(1);
    }

    const force = hasFlag("force");

    try {
        await dbConnect();

        const existing = await TutorConfiguration.findOne({ courseId: null }).lean();
        if (existing && !force) {
            console.info(
                `Global tutor configuration already exists (${existing._id}). Use --force to upsert defaults.`
            );
            process.exit(0);
        }

        const doc = await TutorConfiguration.findOneAndUpdate(
            { courseId: null },
            {
                $set: {
                    outOfContextMessage: DEFAULT_TUTOR_CONFIG.outOfContextMessage,
                    enabled: DEFAULT_TUTOR_CONFIG.enabled,
                    rateLimitPerHour: DEFAULT_TUTOR_CONFIG.rateLimitPerHour,
                    relevanceThreshold: DEFAULT_TUTOR_CONFIG.relevanceThreshold,
                    maxContextChunks: DEFAULT_TUTOR_CONFIG.maxContextChunks,
                    updatedAt: new Date()
                },
                $setOnInsert: { courseId: null }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.info(
            force && existing ? "Updated" : existing ? "Skipped" : "Created",
            "global tutor configuration:",
            doc._id.toString()
        );
        process.exit(0);
    } catch (error) {
        console.error("Seed failed:", error?.message || error);
        process.exit(1);
    } finally {
        await mongoose.disconnect().catch(() => {});
    }
}

main();
