// Shared test utilities for integration tests.
//
// Exposes:
//   - setupTestDb(): spin up an in-memory MongoDB replica set (required for
//     multi-document transactions used by the save-draft-as-quiz flow), point
//     Mongoose at it, return cleanup helpers.
//   - teardownTestDb(): drop + close + stop the memory server
//   - clearDatabase(): wipe all collections between tests within a file
//
// Tests load mongoose models via the project's model files. Because mongoose
// caches connections on the default connection, we use `dbConnect()` which
// reads MONGODB_CONNECTION_STRING from env — the global setup sets this before
// any test runs.

import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

let memoryServer = null;

export async function setupTestDb() {
  if (!process.env.MONGODB_CONNECTION_STRING) {
    // A single-node replica set supports transactions (standalone servers do
    // not). The save-draft-as-quiz route wraps Quiz + Question creation in a
    // transaction, so the test DB must support them.
    memoryServer = await MongoMemoryReplSet.create({ replSetCount: 1, args: ["--bind_ip_all"] });
    const uri = memoryServer.getUri();
    process.env.MONGODB_CONNECTION_STRING = uri;
  }
  // Ensure a clean connection state for the file.
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  // Lazy import to avoid pulling DB connection logic at module load.
  const { dbConnect } = await import("../../service/mongo.js");
  await dbConnect();
  return {
    uri: process.env.MONGODB_CONNECTION_STRING,
    cleanup: async () => {
      const collections = Object.keys(mongoose.connection.collections);
      for (const name of collections) {
        await mongoose.connection.collections[name].deleteMany({});
      }
    },
  };
}

export async function clearDatabase() {
  if (mongoose.connection.readyState !== 1) return;
  const collections = Object.keys(mongoose.connection.collections);
  for (const name of collections) {
    await mongoose.connection.collections[name].deleteMany({});
  }
}

export async function teardownTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
    delete process.env.MONGODB_CONNECTION_STRING;
  }
}
