import { z } from "zod";

/**
 * Recursively converts Mongoose documents to plain, client-safe objects.
 * Converts ObjectIds to strings, Dates to ISO strings, strips _id in favor of id.
 */
function isObjectId(val) {
  if (val == null || typeof val !== "object") return false;
  if (val.constructor?.name === "ObjectId") return true;
  const s = typeof val.toString === "function" ? val.toString() : "";
  return /^[a-f0-9]{24}$/i.test(s);
}

export function deepSerialize(val) {
  if (val === null || val === undefined) return val;
  if (isObjectId(val)) return val.toString();
  if (val instanceof Date) return val.toISOString();
  if (Array.isArray(val)) return val.map(deepSerialize);
  if (typeof val === "object") {
    const out = {};
    for (const k of Object.keys(val)) {
      const v = val[k];
      if (k === "_id" && v != null) {
        out.id = typeof v === "object" && v.toString ? v.toString() : String(v);
      } else if (k !== "_id") {
        out[k] = deepSerialize(v);
      }
    }
    return out;
  }
  return val;
}

/**
 * Converts Mongoose ObjectId (or any value) to a plain string.
 * Handles ObjectId, string, null, undefined - ensures client-safe output.
 */
export const serializableId = z.preprocess((val) => {
  if (val == null) return null;
  if (typeof val === "string") return val;
  if (typeof val === "object" && typeof val.toString === "function") {
    return val.toString();
  }
  return String(val);
}, z.string().nullable());

/**
 * Same as serializableId but for required IDs (non-null).
 */
export const serializableIdRequired = z.preprocess((val) => {
  if (val == null) return null;
  if (typeof val === "string") return val;
  if (typeof val === "object" && typeof val.toString === "function") {
    return val.toString();
  }
  return String(val);
}, z.string().min(1).nullable());

/**
 * Converts JavaScript Date objects to ISO strings.
 * Handles Date, string (pass-through), null, undefined.
 */
export const serializableDate = z.preprocess((val) => {
  if (val == null) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") return val; // Already serialized
  return null;
}, z.string().nullable());

/**
 * Array of IDs - serializes each element.
 */
export const serializableIdArray = z.preprocess((val) => {
  if (!Array.isArray(val)) return [];
  return val
    .map((item) => {
      if (item == null) return null;
      if (typeof item === "string") return item;
      if (typeof item === "object" && typeof item.toString === "function") {
        return item.toString();
      }
      return String(item);
    })
    .filter(Boolean);
}, z.array(z.string()));
