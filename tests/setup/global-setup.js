// Global setup runs once before all test files.
// Pre-spawn an in-memory MongoDB replica set so the connection string is
// stable across forks AND multi-document transactions are supported (the
// save-draft-as-quiz flow wraps Quiz + Question creation in a transaction).
import { MongoMemoryReplSet } from "mongodb-memory-server";

let memoryServer = null;

export async function setup() {
  memoryServer = await MongoMemoryReplSet.create({ replSetCount: 1, args: ["--bind_ip_all"] });
  process.env.MONGODB_CONNECTION_STRING = memoryServer.getUri();
  // Mark environment so tests know auth/integration context applies.
  process.env.NODE_ENV = "test";
  // Avoid accidental writes to real services during tests.
  if (!process.env.AUTH_SECRET) process.env.AUTH_SECRET = "test-auth-secret";
  if (!process.env.NEXTAUTH_SECRET) process.env.NEXTAUTH_SECRET = "test-nextauth-secret";
}

export async function teardown() {
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
