// MCQ structural validation and duplicate detection
// (specs/002-ai-mcq-complement/research.md §2, §3).
//
// Pure functions — no I/O, no side effects. The orchestrator runs these
// after generateQuizDraft() returns and before storing the draft on the job.
//
// validateMcqStructure(q):
//   Enforces spec 002's MCQ structural rules. Returns true if the question
//   is structurally valid, false otherwise. Invalid questions are silently
//   dropped by the caller and counted in the validation summary.
//
// filterDuplicateStems(newQuestions, existingStems):
//   Splits newQuestions into { kept, dropped } where dropped are those whose
//   normalized stem has Dice coefficient ≥ 0.8 against any existing stem.

const OPTION_DUPLICATE_THRESHOLD = 0.9; // near-identical option detection
const STEM_DUPLICATE_THRESHOLD = 0.8; // existing-question overlap detection

/**
 * Normalize a string for similarity comparison: lowercase, strip punctuation,
 * collapse whitespace.
 * @param {string} s
 * @returns {string}
 */
function normalize(s) {
    if (!s) return "";
    return String(s)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Compute the Dice coefficient (bigram overlap) between two normalized
 * strings. Returns a number in [0, 1]. Short strings (fewer than 2 bigrams)
 * fall back to exact-match (1.0 if equal, 0.0 otherwise) to avoid false
 * positives on very short stems like "What is X?".
 *
 * @param {string} a - normalized string
 * @param {string} b - normalized string
 * @returns {number}
 */
function diceCoefficient(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const bigramsA = bigrams(a);
    const bigramsB = bigrams(b);
    if (bigramsA.length < 2 || bigramsB.length < 2) {
        return a === b ? 1 : 0;
    }
    const setB = new Map();
    for (const bg of bigramsB) {
        setB.set(bg, (setB.get(bg) || 0) + 1);
    }
    let intersection = 0;
    for (const bg of bigramsA) {
        const count = setB.get(bg);
        if (count && count > 0) {
            intersection += 1;
            setB.set(bg, count - 1);
        }
    }
    return (2 * intersection) / (bigramsA.length + bigramsB.length);
}

/**
 * Extract character bigrams from a normalized string.
 * @param {string} s
 * @returns {string[]}
 */
function bigrams(s) {
    if (!s || s.length < 2) return [];
    const out = [];
    for (let i = 0; i < s.length - 1; i += 1) {
        out.push(s.slice(i, i + 2));
    }
    return out;
}

/**
 * Count sentences in a string. A sentence ends at ., !, or ? followed by
 * whitespace or end-of-string. Used to enforce the "≤ 2 sentences" rule
 * on MCQ justifications.
 * @param {string} s
 * @returns {number}
 */
function countSentences(s) {
    if (!s) return 0;
    const trimmed = String(s).trim();
    if (trimmed === "") return 0;
    // Strip trailing terminal punctuation so "One sentence." counts as 1.
    const matches = trimmed.match(/[^.!?]+[.!?]+(?:\s|$)/g);
    if (matches) return matches.length;
    // No terminal punctuation — treat the whole string as one sentence.
    return 1;
}

/**
 * Validate the structural integrity of a single MCQ draft question per
 * spec 002 research.md §3:
 *   1. Exactly 4 options.
 *   2. All 4 option texts are distinct (case-insensitive, whitespace-
 *      normalized). Near-identical option pairs (Dice ≥ 0.9) are rejected.
 *   3. correctOptionIds has exactly one entry that maps to one of the
 *      option ids.
 *   4. Justification (explanation) is present and ≤ 2 sentences.
 *
 * @param {object} q - DraftQuestion-shaped object
 * @returns {boolean}
 */
export function validateMcqStructure(q) {
    if (!q || typeof q !== "object") return false;
    if (q.type !== "single") return false;

    const options = Array.isArray(q.options) ? q.options : [];
    if (options.length !== 4) return false;

    // Every option must have a non-empty id and text.
    for (const opt of options) {
        if (!opt || !opt.id || !opt.text || !String(opt.text).trim()) return false;
    }

    // Distinct option texts (normalized). Near-identical pairs are rejected.
    const normalizedTexts = options.map((o) => normalize(o.text));
    for (let i = 0; i < normalizedTexts.length; i += 1) {
        for (let j = i + 1; j < normalizedTexts.length; j += 1) {
            if (normalizedTexts[i] === normalizedTexts[j]) return false;
            if (diceCoefficient(normalizedTexts[i], normalizedTexts[j]) >= OPTION_DUPLICATE_THRESHOLD) {
                return false;
            }
        }
    }

    // Correct answer: exactly one id, and it must match an option id.
    const correctIds = Array.isArray(q.correctOptionIds) ? q.correctOptionIds : [];
    if (correctIds.length !== 1) return false;
    const optionIds = options.map((o) => o.id);
    if (!optionIds.includes(correctIds[0])) return false;

    // Justification present and ≤ 2 sentences.
    const explanation = q.explanation ? String(q.explanation).trim() : "";
    if (!explanation) return false;
    if (countSentences(explanation) > 2) return false;

    return true;
}

/**
 * Filter new MCQ drafts whose stems are near-duplicates of existing question
 * stems. A draft is dropped when its normalized stem has Dice coefficient
 * ≥ 0.8 against any existing stem (research.md §2).
 *
 * @param {Array} newQuestions - DraftQuestion-shaped objects
 * @param {string[]} existingStems - question text already on the target quiz
 * @returns {{ kept: Array, dropped: Array }}
 */
export function filterDuplicateStems(newQuestions, existingStems) {
    const normalizedExisting = (Array.isArray(existingStems) ? existingStems : [])
        .map(normalize)
        .filter(Boolean);

    const kept = [];
    const dropped = [];

    if (normalizedExisting.length === 0) {
        return { kept: [...(newQuestions || [])], dropped: [] };
    }

    for (const q of newQuestions || []) {
        const stem = normalize(q?.text || "");
        let isDuplicate = false;
        if (stem) {
            for (const existing of normalizedExisting) {
                if (diceCoefficient(stem, existing) >= STEM_DUPLICATE_THRESHOLD) {
                    isDuplicate = true;
                    break;
                }
            }
        }
        if (isDuplicate) {
            dropped.push(q);
        } else {
            kept.push(q);
        }
    }

    return { kept, dropped };
}

// Exported for unit tests.
export {
    normalize,
    diceCoefficient,
    countSentences,
    OPTION_DUPLICATE_THRESHOLD,
    STEM_DUPLICATE_THRESHOLD
};
