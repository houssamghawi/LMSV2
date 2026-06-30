// Per-file setup: ensure each test file starts with a fresh DB connection
// and that collections are cleared between tests.
import "dotenv/config";
import { afterEach, beforeEach, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { clearDatabase, setupTestDb } from "./test-db.js";

beforeAll(async () => {
  // Reset the cached mongoose connection so we don't reuse a stale promise
  // left over from a previous test file (dbConnect caches on global.mongoose).
  if (global.mongoose) {
    global.mongoose.conn = null;
    global.mongoose.promise = null;
  }
  await setupTestDb();
});

beforeEach(async () => {
  await clearDatabase();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  // Disconnect mongoose but do NOT stop the in-memory server here — the
  // global setup owns the server lifecycle and tears it down after all files.
  // Stopping it per-file breaks the next file's setup when running in a
  // single fork (fileParallelism: false).
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  // Clear the cached promise so the next file's dbConnect() opens a fresh
  // connection instead of reusing a resolved promise to a closed connection.
  if (global.mongoose) {
    global.mongoose.conn = null;
    global.mongoose.promise = null;
  }
});
