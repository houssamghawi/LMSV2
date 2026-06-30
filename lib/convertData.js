import { sanitizeForClient } from "@/lib/utils/serialize";

function withId(plain) {
  if (plain && typeof plain === "object" && !Array.isArray(plain) && "_id" in plain && !("id" in plain)) {
    const { _id, ...rest } = plain;
    return { id: _id, ...rest };
  }
  return plain;
}

/**
 * Converts array of Mongoose docs to plain, client-safe objects.
 * Brute-force JSON round-trip strips toJSON, ObjectIds, Dates - fixes RSC serialization error.
 */
export const replaceMongoIdInArray = (array) => {
  if (!array || !Array.isArray(array)) return [];
  return array.filter((item) => item != null).map((item) => withId(sanitizeForClient(item)));
}

/**
 * Converts Mongoose doc to plain, client-safe object.
 * Brute-force JSON round-trip strips toJSON, ObjectIds, Dates - fixes RSC serialization error.
 */
export const replaceMongoIdInObject = (obj) => {
  if (obj == null) return null;
  return withId(sanitizeForClient(obj));
}

  export const getSlug = (title) => {
    if (!title) return null;

    // Robust slugify: lowercase, trim, replace whitespace with '-', 
    // collapse multiple '-', remove non-word chars (except '-')
    const slug = title
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')        // Replace whitespace with single dash
      .replace(/[^\w-]+/g, '')     // Remove non-word chars except dash
      .replace(/-+/g, '-')         // Collapse multiple dashes
      .replace(/^-+|-+$/g, '');    // Remove leading/trailing dashes

    return slug;
  }