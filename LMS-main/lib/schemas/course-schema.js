import { z } from "zod";
import { sanitizeForClient } from "@/lib/utils/serialize";

/** Minimal user/public profile for nested populated refs */
const serializableUserRefSchema = z
  .object({
    id: z.string(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    profilePicture: z.string().nullable().optional(),
  })
  .passthrough();

/** Minimal category for nested populated refs */
const serializableCategoryRefSchema = z
  .object({
    id: z.string(),
    title: z.string().optional(),
  })
  .passthrough();

/** Course document schema for server → client serialization */
const courseSerializableSchema = z
  .object({
    id: z.string(),
    title: z.string().optional().default(""),
    subtitle: z.string().optional().nullable(),
    description: z.string().optional().default(""),
    thumbnail: z.string().optional().nullable(),
    price: z.number().optional().default(0),
    active: z.boolean().optional().default(false),
    learning: z.array(z.string()).optional().nullable(),
    modules: z.array(z.union([z.string(), z.any()])).optional().default([]),
    category: z
      .union([z.string(), serializableCategoryRefSchema])
      .optional()
      .nullable(),
    instructor: z
      .union([z.string(), serializableUserRefSchema])
      .optional()
      .nullable(),
    testimonials: z.array(z.any()).optional().default([]),
    createdOn: z.string().nullable().optional(),
    modifiedOn: z.string().nullable().optional(),
  })
  .passthrough();

function withId(plain) {
  if (plain && typeof plain === "object" && !Array.isArray(plain) && "_id" in plain && !("id" in plain)) {
    const { _id, ...rest } = plain;
    return { id: _id, ...rest };
  }
  return plain;
}

/** Recursively apply withId to nested objects (category, instructor, testimonials, etc.) */
function deepWithId(val) {
  if (val == null) return val;
  if (Array.isArray(val)) return val.map(deepWithId);
  if (typeof val === "object") {
    const obj = withId(val);
    for (const k of Object.keys(obj)) {
      if (obj[k] != null && typeof obj[k] === "object") {
        obj[k] = deepWithId(obj[k]);
      }
    }
    return obj;
  }
  return val;
}

/**
 * Parse and return serialized course - use after .lean().
 * Brute-force JSON round-trip strips Mongoose/BSON - fixes RSC serialization error.
 */
export function serializeCourse(course) {
  if (!course) return null;
  const serialized = deepWithId(sanitizeForClient(course));
  return courseSerializableSchema.parse(serialized);
}

/** Parse array of courses */
export function serializeCourseList(courses) {
  if (!courses || !Array.isArray(courses)) return [];
  return courses.map((c) => serializeCourse(c)).filter(Boolean);
}
