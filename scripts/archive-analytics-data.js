/**
 * Soft-archive analytics source documents older than 24 months (FR-022).
 *
 * Usage:
 *   npm run archive-analytics-data
 *   npm run archive-analytics-data -- --dry-run
 *
 * Sets `archivedAt` on Payment, Enrollment, and UserActivityLog rows whose
 * primary date field is older than the retention cutoff. Does not delete data.
 * Standard dashboard queries exclude archivedAt != null (see lib/analytics/archival.ts).
 */

import { config } from "dotenv";
import mongoose from "mongoose";
import { dbConnect } from "../service/mongo.js";

config({ path: ".env.local" });
config({ path: ".env" });

const RETENTION_MONTHS = 24;

function getCutoff(now = new Date()) {
  const d = new Date(now);
  d.setMonth(d.getMonth() - RETENTION_MONTHS);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function softArchiveCollection({
  collection,
  dateField,
  cutoff,
  dryRun,
  now,
}) {
  const db = mongoose.connection.db;
  const coll = db.collection(collection);
  const filter = {
    [dateField]: { $lt: cutoff },
    $or: [{ archivedAt: { $exists: false } }, { archivedAt: null }],
  };

  const count = await coll.countDocuments(filter);
  if (dryRun) {
    console.info(
      `[dry-run] ${collection}: would archive ${count} docs where ${dateField} < ${cutoff.toISOString()}`
    );
    return { collection, count, modified: 0 };
  }

  const result = await coll.updateMany(filter, {
    $set: { archivedAt: now },
  });
  console.info(
    `OK  ${collection}: archived ${result.modifiedCount} / matched ${result.matchedCount}`
  );
  return {
    collection,
    count: result.matchedCount,
    modified: result.modifiedCount,
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const uri = process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING;
  if (!uri) {
    console.error("MONGODB_URI is not configured.");
    process.exit(1);
  }

  const now = new Date();
  const cutoff = getCutoff(now);
  console.info(
    `Analytics soft-archive (retention ${RETENTION_MONTHS} months)`
  );
  console.info(`Cutoff: ${cutoff.toISOString()}${dryRun ? " [DRY RUN]" : ""}`);

  await dbConnect();

  const jobs = [
    { collection: "payments", dateField: "paidAt" },
    { collection: "enrollments", dateField: "enrollment_date" },
    { collection: "useractivitylogs", dateField: "timestamp" },
  ];

  const results = [];
  for (const job of jobs) {
    results.push(await softArchiveCollection({ ...job, cutoff, dryRun, now }));
  }

  const total = results.reduce((s, r) => s + (r.modified || r.count), 0);
  console.info(
    dryRun
      ? `Dry run complete. ${total} documents would be archived.`
      : `Done. ${total} documents soft-archived.`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
