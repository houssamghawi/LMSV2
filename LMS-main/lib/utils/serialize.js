/**
 * Bulletproof serialization for Server → Client Component props.
 * Strips all Mongoose/BSON methods, converts ObjectIds and Dates to strings.
 * Use before passing any data to Client Components.
 *
 * @param {T} data - Any value (object, array, primitive)
 * @returns {T} Deep clone with only plain JSON-serializable values
 */
export function sanitizeForClient(data) {
  if (data === null || data === undefined) return data;
  return JSON.parse(JSON.stringify(data));
}
