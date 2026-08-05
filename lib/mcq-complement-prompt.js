// Prompt template for AI MCQ complement generation
// (specs/002-ai-mcq-complement/research.md §1).
//
// Like lib/quiz-generation-prompt.js, this is a pure template module — no
// I/O, no Gemini client. The orchestrator (service/generation-orchestrator.js)
// composes these messages and passes them to generateQuizDraft(), which
// supplies the JSON response schema via Gemini responseJsonSchema in quiz-generator.js.
//
// Differences from the full-quiz prompt:
//   - MCQ-only: every question is type "single" with exactly 4 options A–D.
//   - Distractor quality: explicit instructions for plausible distractors
//     that test comprehension (not absurd fillers).
//   - Justification: 1 sentence (tighter than the full-quiz 1–2 sentences).
//   - Duplicate avoidance: existing question stems on the target quiz are
//     injected into the system prompt with an instruction to avoid overlap.

import { MCQ_OPTIONS_COUNT, SOURCE_QUOTE_MAX_WORDS, DEFAULT_MCQ_COMPLEMENT_PARAMS } from "./constants.js";

const OPTION_IDS = ["a", "b", "c", "d"];

/**
 * Resolve a balanced Easy/Medium/Hard distribution for `total` MCQs (US3 T022).
 * Used when the caller does not specify difficulty counts so the prompt always
 * carries a pedagogically sane mix instead of 0/0/0. Shape matches the spec
 * default (3/3/2 for 8): roughly equal thirds with Hard slightly lighter.
 *
 *   hard   = round(total * 0.25)
 *   easy   = round((total - hard) / 2)
 *   medium = total - hard - easy
 *
 * @param {number} total
 * @returns {{ easyCount: number, mediumCount: number, hardCount: number }}
 */
function balancedDistribution(total) {
    const n = Math.max(0, Math.floor(Number(total) || 0));
    const hard = Math.round(n * 0.25);
    const remaining = n - hard;
    const easy = Math.round(remaining / 2);
    const medium = n - hard - easy;
    return { easyCount: easy, mediumCount: medium, hardCount: hard };
}

/**
 * Normalize the params passed to the prompt builders. When the caller omits
 * the difficulty counts (or passes non-numbers), fall back to the balanced
 * default distribution derived from `totalQuestions`. This keeps the prompt
 * robust for direct callers (e.g. tests) and matches the spec 002 default
 * (3/3/2 for 8 MCQs).
 *
 * @param {{ totalQuestions: number, easyCount?: number, mediumCount?: number, hardCount?: number }} params
 * @returns {{ totalQuestions: number, easyCount: number, mediumCount: number, hardCount: number }}
 */
function resolveDifficultyParams(params) {
    const totalQuestions = Number(params?.totalQuestions) || DEFAULT_MCQ_COMPLEMENT_PARAMS.totalQuestions;
    const hasEasy = Number.isFinite(params?.easyCount);
    const hasMedium = Number.isFinite(params?.mediumCount);
    const hasHard = Number.isFinite(params?.hardCount);
    if (hasEasy && hasMedium && hasHard) {
        return {
            totalQuestions,
            easyCount: params.easyCount,
            mediumCount: params.mediumCount,
            hardCount: params.hardCount
        };
    }
    const dist = balancedDistribution(totalQuestions);
    return { totalQuestions, ...dist };
}

/**
 * Build the MCQ complement system prompt. Encodes MCQ-specific constraints
 * (4 options A–D, plausible distractors, 1-sentence justification, difficulty
 * distribution) and injects existing question stems for duplicate avoidance.
 *
 * @param {{ totalQuestions: number, easyCount?: number, mediumCount?: number, hardCount?: number }} params
 * @param {string[]} existingStems - question text already on the target quiz
 * @returns {string}
 */
export function buildMcqComplementSystemPrompt(params, existingStems) {
    const {
        totalQuestions,
        easyCount,
        mediumCount,
        hardCount
    } = resolveDifficultyParams(params);

    const stemsBlock = Array.isArray(existingStems) && existingStems.length > 0
        ? [
            "",
            "The target quiz already contains the following questions. Do NOT",
            "generate a question that asks the same thing as any of these, even",
            "if rephrased:",
            ...existingStems.map((s) => `  - ${s}`)
        ].join("\n")
        : "";

    return [
        "You are an assessment designer for a learning management system.",
        "Generate multiple-choice questions (MCQs) that complement an existing",
        "quiz. Every question MUST be grounded strictly in the provided lecture",
        "text. Do NOT use outside knowledge.",
        "",
        "Output requirements:",
        `Return exactly ${totalQuestions} single-correct multiple-choice questions`,
        '(type: "single"). No true/false, no short-answer — MCQ only.',
        `Difficulty distribution across the ${totalQuestions} questions:`,
        `  - ${easyCount} easy, ${mediumCount} medium, ${hardCount} hard.`,
        "",
        "Per-question rules:",
        '1. Each question has: draftId (uuid v4 string), type ("single"),',
        "   difficulty, text, options, correctOptionIds, modelAnswer (empty",
        "   string), explanation, sourceQuote, instructorState.",
        `2. options MUST be an array of exactly ${MCQ_OPTIONS_COUNT} objects,`,
        `   each {id, text}. Use ids ${OPTION_IDS.join(", ")} in order. Each`,
        "   option text must be a single, concise phrase (≤ 12 words).",
        "3. The four option texts MUST be mutually distinct and plausible —",
        "   distractors should reflect common misconceptions or near-misses",
        "   that test comprehension, not absurd fillers. Do not use options",
        "   like “All of the above” or “None of the above”.",
        "4. correctOptionIds MUST be an array containing exactly one of the",
        "   option ids. The correct answer must be unambiguously supported by",
        "   the source text.",
        '5. instructorState MUST always be "untouched".',
        "6. explanation: exactly 1 sentence, plain language, explaining why",
        "   the correct option is right (and, where useful, why the others are",
        "   not). Do not exceed one sentence.",
        `7. sourceQuote: a verbatim quote from the source text, at most ${SOURCE_QUOTE_MAX_WORDS} words,`,
        "   that supports the question. Do not paraphrase. If you cannot find",
        '   a supporting verbatim quote, set sourceQuote to "" and the question',
        "   will be filtered out before review.",
        "8. Do not invent facts, names, dates, or numbers not present in the",
        "   source text.",
        "9. Avoid duplicate questions and avoid near-duplicate questions that",
        "   differ only in wording.",
        stemsBlock,
        "",
        "Return JSON matching the provided response schema. The questions",
        `array must contain exactly ${totalQuestions} elements when the source`,
        "text is sufficient; if the source text is too short or empty, return",
        "an empty questions array.",
        "",
        "Output schema (JSON):",
        "{",
        '  "questions": [',
        "    {",
        '      "draftId": "uuid-string",',
        '      "type": "single",',
        '      "difficulty": "easy" | "medium" | "hard",',
        '      "text": "question text",',
        '      "options": [',
        '        { "id": "a", "text": "..." },',
        '        { "id": "b", "text": "..." },',
        '        { "id": "c", "text": "..." },',
        '        { "id": "d", "text": "..." }',
        "      ],",
        '      "correctOptionIds": ["a"],',
        '      "modelAnswer": "",',
        '      "explanation": "one sentence…",',
        `      "sourceQuote": "verbatim quote <= ${SOURCE_QUOTE_MAX_WORDS} words",`,
        '      "instructorState": "untouched"',
        "    }",
        "  ]",
        "}"
    ].filter(Boolean).join("\n");
}

/**
 * Build the user prompt — the extracted lecture text plus a restatement of
 * the requested MCQ count and difficulty distribution, plus a reminder to
 * avoid duplicates with the existing stems.
 *
 * @param {string} extractedText - normalized lecture text
 * @param {{ totalQuestions: number, easyCount?: number, mediumCount?: number, hardCount?: number }} params
 * @param {string[]} existingStems
 * @returns {string}
 */
export function buildMcqComplementUserPrompt(extractedText, params, existingStems) {
    const {
        totalQuestions,
        easyCount,
        mediumCount,
        hardCount
    } = resolveDifficultyParams(params);

    const duplicateReminder = Array.isArray(existingStems) && existingStems.length > 0
        ? `Avoid overlap with the ${existingStems.length} existing question(s) listed in the system instructions.`
        : "";

    return [
        `Generate ${totalQuestions} MCQ questions from the lecture text below.`,
        `Requested difficulty: ${easyCount} easy, ${mediumCount} medium, ${hardCount} hard.`,
        "Every question MUST include a verbatim sourceQuote drawn from the text below.",
        `Quotes must be at most ${SOURCE_QUOTE_MAX_WORDS} words. Questions without a verbatim`,
        "sourceQuote from this text will be discarded.",
        duplicateReminder,
        "",
        "--- BEGIN LECTURE TEXT ---",
        extractedText,
        "--- END LECTURE TEXT ---"
    ].filter(Boolean).join("\n");
}

/**
 * Compose the message array for a Gemini generation call.
 * @param {string} extractedText
 * @param {{ totalQuestions: number, easyCount?: number, mediumCount?: number, hardCount?: number }} params
 * @param {string[]} [existingStems=[]]
 * @returns {{ role: string, content: string }[]}
 */
export function buildMcqComplementMessages(extractedText, params, existingStems = []) {
    return [
        { role: "system", content: buildMcqComplementSystemPrompt(params, existingStems) },
        { role: "user", content: buildMcqComplementUserPrompt(extractedText, params, existingStems) }
    ];
}
