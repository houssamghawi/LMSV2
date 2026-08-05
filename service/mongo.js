import mongoose from "mongoose";

// Cache the connection to prevent multiple connections
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function dbConnect() {
  // Check if already connected (readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting)
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // If connecting, wait for the existing promise
  if (mongoose.connection.readyState === 2 && cached.promise) {
    try {
      cached.conn = await cached.promise;
      // Wait for connection to be fully ready
      if (mongoose.connection.readyState !== 1) {
        await new Promise((resolve) => {
          if (mongoose.connection.readyState === 1) {
            resolve();
          } else {
            mongoose.connection.once('connected', resolve);
          }
        });
      }
      return mongoose.connection;
    } catch (e) {
      cached.promise = null;
      throw e;
    }
  }

  // Create new connection promise if not already creating one
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    };

    cached.promise = mongoose
      .connect(String(process.env.MONGODB_CONNECTION_STRING), opts)
      .then(async () => {
        // Wait for connection to be fully established
        if (mongoose.connection.readyState !== 1) {
          await new Promise((resolve) => {
            if (mongoose.connection.readyState === 1) {
              resolve();
            } else {
              mongoose.connection.once('connected', resolve);
            }
          });
        }
        return mongoose.connection;
      })
      .catch((error) => {
        cached.promise = null;
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
}

/**
 * True when MongoDB rejected a multi-document transaction (standalone instance).
 */
export function isTransactionNotSupportedError(error) {
  const message = String(error?.message || "");
  return (
    error?.code === 20 ||
    error?.codeName === "IllegalOperation" ||
    message.includes("replica set") ||
    message.includes("mongos")
  );
}

/**
 * Run work inside a MongoDB transaction when the deployment supports it.
 * Falls back to running without a session on standalone dev MongoDB.
 *
 * @param {(session: import("mongoose").ClientSession | null) => Promise<void>} work
 */
export async function runWithOptionalTransaction(work) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await work(session);
    });
  } catch (error) {
    if (!isTransactionNotSupportedError(error)) {
      throw error;
    }
    console.warn(
      "[mongo] Transactions unavailable (standalone MongoDB). Running without transaction."
    );
    await work(null);
  } finally {
    await session.endSession();
  }
}