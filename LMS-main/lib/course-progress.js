/**
 * Course progress, sequential unlock, and certificate logic for enrolled students.
 *
 * KEY INSIGHT from the Lesson schema:
 *   - `active` (Boolean, default false) = published vs draft
 *   - `access` ("private"|"public", default "private") = enrolled-only vs free-preview
 *
 * For enrolled students the `access` field is IRRELEVANT — enrollment is checked
 * at the layout level. Only `active: true` matters for unlock order and progress.
 */

/**
 * Normalize any lesson identifier to a plain 24-char hex string.
 * Handles: plain string, Mongoose ObjectId, SchemaObjectId, serialized {id}/{_id}.
 */
export function toLessonIdString(lesson) {
  if (!lesson) return "";
  const raw = lesson.id ?? lesson._id;
  if (raw == null) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw.toString === "function") return raw.toString();
  return String(raw);
}

/**
 * Build a flat, chronologically ordered list of ALL published (active) lessons
 * across every module. Modules sorted by `order`, lessons sorted by `order`.
 *
 * Used for: sequential unlock, progress calculation, and certificate eligibility.
 */
export function getOrderedLessons(modules) {
  if (!modules || !Array.isArray(modules)) return [];

  const sorted = [...modules].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const list = [];

  for (const mod of sorted) {
    const lessons = mod.lessonIds || [];
    const sortedLessons = [...lessons].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (const lesson of sortedLessons) {
      if (lesson && lesson.active === true) {
        list.push(lesson);
      }
    }
  }

  return list;
}

/**
 * Determine which lessons are unlocked for an enrolled student.
 *
 * Rule:
 *   - Lesson 0 (first active lesson in course order) is ALWAYS unlocked.
 *   - Lesson N is unlocked if Lesson N-1's ID is in `completedLessonIds`.
 *
 * This naturally crosses module boundaries because the list is flat.
 *
 * @param {Array}      orderedLessons     - from getOrderedLessons()
 * @param {Set<string>} completedLessonIds - lesson IDs with state:"completed" in Watch
 * @returns {Set<string>} unlocked lesson IDs
 */
export function getUnlockedLessonIds(orderedLessons, completedLessonIds) {
  const unlocked = new Set();
  const ids = orderedLessons.map(toLessonIdString);

  console.log("[course-progress] ordered lesson IDs:", ids);
  console.log("[course-progress] completed lesson IDs:", [...completedLessonIds]);

  for (let i = 0; i < ids.length; i++) {
    if (!ids[i]) continue;

    if (i === 0) {
      // First lesson is always unlocked
      unlocked.add(ids[i]);
    } else if (completedLessonIds.has(ids[i - 1])) {
      // Previous lesson is completed → this one unlocks
      unlocked.add(ids[i]);
    }
  }

  console.log("[course-progress] unlocked lesson IDs:", [...unlocked]);
  return unlocked;
}

/**
 * Calculate lesson-based progress percentage.
 * Used for progress bar and certificate eligibility.
 *
 * @returns {{ progress: number, completedCount: number, totalCount: number }}
 */
export function getLessonBasedProgress(orderedLessons, completedLessonIds) {
  const totalCount = orderedLessons.length;
  if (totalCount === 0) return { progress: 0, completedCount: 0, totalCount: 0 };

  let completedCount = 0;
  for (const lesson of orderedLessons) {
    if (completedLessonIds.has(toLessonIdString(lesson))) {
      completedCount++;
    }
  }

  return {
    progress: (completedCount / totalCount) * 100,
    completedCount,
    totalCount,
  };
}
