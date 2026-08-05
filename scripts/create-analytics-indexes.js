/**
 * CLI: create MongoDB indexes required for analytics aggregations.
 *
 * Usage:
 *   npm run create-analytics-indexes
 *
 * Requires MONGODB_URI (or MONGODB_CONNECTION_STRING) in .env.local or .env.
 * Idempotent: createIndex is a no-op when an equivalent index already exists.
 * Indexes are created in the background where supported to avoid blocking writes.
 *
 * Source of truth: specs/005-analytics-dashboard/data-model.md § Required Index Additions
 */

import { config } from "dotenv";
import mongoose from "mongoose";
import { dbConnect } from "../service/mongo.js";

config({ path: ".env.local" });
config({ path: ".env" });

/** @type {Array<{ collection: string; keys: Record<string, 1 | -1>; options?: object }>} */
const ANALYTICS_INDEXES = [
    // Payment analytics
    { collection: "payments", keys: { paidAt: 1, status: 1 } },
    { collection: "payments", keys: { course: 1, paidAt: -1 } },
    { collection: "payments", keys: { paidAt: 1, provider: 1 } },

    // Enrollment analytics
    { collection: "enrollments", keys: { enrollment_date: 1, status: 1 } },
    { collection: "enrollments", keys: { course: 1, enrollment_date: -1 } },
    { collection: "enrollments", keys: { student: 1, status: 1 } },

    // User analytics
    { collection: "users", keys: { createdAt: 1, role: 1 } },
    { collection: "users", keys: { lastLogin: -1, status: 1 } },
    { collection: "users", keys: { role: 1, status: 1 } },

    // Watch / progress analytics
    { collection: "watches", keys: { modified_at: -1 } },
    { collection: "watches", keys: { user: 1, module: 1, state: 1 } },
    { collection: "watches", keys: { module: 1, state: 1, modified_at: -1 } },

    // Course analytics
    { collection: "courses", keys: { instructor: 1, active: 1 } },
    { collection: "courses", keys: { createdOn: -1, active: 1 } },

    // Dashboard preferences
    {
        collection: "dashboardpreferences",
        keys: { user: 1, role: 1 },
        options: { unique: true },
    },
];

function formatKeys(keys) {
    return Object.entries(keys)
        .map(([field, dir]) => `${field}:${dir}`)
        .join(", ");
}

async function ensureIndex(db, { collection, keys, options = {} }) {
    const coll = db.collection(collection);
    const label = `${collection}({ ${formatKeys(keys)} })`;

    try {
        const name = await coll.createIndex(keys, {
            background: true,
            ...options,
        });
        console.info(`OK  ${label} → ${name}`);
        return { collection, keys, name, ok: true };
    } catch (error) {
        console.error(`FAIL ${label}:`, error?.message || error);
        return { collection, keys, ok: false, error };
    }
}

async function main() {
    const uri = process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING;
    if (!uri) {
        console.error("MONGODB_URI is not configured.");
        process.exit(1);
    }

    try {
        await dbConnect();
        const db = mongoose.connection.db;
        if (!db) {
            throw new Error("MongoDB connection is not ready.");
        }

        console.info(`Creating ${ANALYTICS_INDEXES.length} analytics indexes…`);

        const results = [];
        for (const spec of ANALYTICS_INDEXES) {
            results.push(await ensureIndex(db, spec));
        }

        const failed = results.filter((r) => !r.ok);
        if (failed.length > 0) {
            console.error(`${failed.length} index(es) failed.`);
            process.exit(1);
        }

        console.info("All analytics indexes are in place.");
        process.exit(0);
    } catch (error) {
        console.error("Index creation failed:", error?.message || error);
        process.exit(1);
    } finally {
        await mongoose.disconnect().catch(() => {});
    }
}

main();
