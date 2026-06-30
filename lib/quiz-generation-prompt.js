// Prompt templates for AI quiz generation (research.md §1, FR-004/FR-005).
//
// These are pure template functions — no I/O, no Gemini client. The
// quiz-generator service composes them and passes them to the Gemini SDK.
//
// The output schema (JSON shape the model must return) is defined in
// service/quiz-generator.js (Zod + Gemini responseJsonSchema). The system
// prompt below describes the same shape in prose for robustness.

import { SOURCE_QUOTE_MAX_WORDS } from "./constants.js";

/**
 * System prompt: defines the model's role, hard constraints, and the exact
 * output schema. Kept stable across calls so the model behaves consistently.
 *
 * @param {{ totalQuestions: number, mcqCount: number, trueFalseCount: number, shortAnswerCount: number, easyCount: number, mediumCount: number, hardCount: number }} params
 * @returns {string}
 */
export function buildSystemPrompt(params) {
    const {
        totalQuestions,
        mcqCount,
        trueFalseCount,
        shortAnswerCount,
        easyCount,
        mediumCount,
        hardCount
    } = params;

    return [
        "You are an assessment designer for a learning management system.",
        "Given the extracted text of a lecture document, generate a quiz draft that is",
        "grounded strictly in the provided text. Do NOT use outside knowledge.",
        "",
        "Output requirements:",
        `Return exactly ${totalQuestions} questions distributed as:`,
        `  - ${mcqCount} single-correct multiple-choice questions (type: "single")`,
        `  - ${trueFalseCount} true/false questions (type: "true_false", exactly two options: "True", "False")`,
        `  - ${shortAnswerCount} short-answer / essay questions (type: "short_answer", no options, include a modelAnswer)`,
        `Difficulty distribution across the ${totalQuestions} questions:`,
        `  - ${easyCount} easy, ${mediumCount} medium, ${hardCount} hard.`,
        "",
        "Per-question rules:",
        '1. Each question has: draftId (uuid v4 string), type, difficulty, text, options,',
        "   correctOptionIds, modelAnswer, explanation, sourceQuote, instructorState.",
        '2. instructorState MUST always be "untouched" for every generated question.',
        "3. For type \"single\": options is an array of 2-6 objects {id, text};",
        "   correctOptionIds is an array containing exactly one option id.",
        "4. For type \"true_false\": options is [{id:\"t\",text:\"True\"},{id:\"f\",text:\"False\"}];",
        "   correctOptionIds is [\"t\"] or [\"f\"].",
        "5. For type \"short_answer\": options is [], correctOptionIds is [], and modelAnswer",
        "   is a concise expected answer (1-3 sentences). modelAnswer must be empty for",
        "   non-short_answer types.",
        "6. explanation: 1-2 sentences, plain language, explaining why the answer is correct.",
        `7. sourceQuote: a verbatim quote from the source text, at most ${SOURCE_QUOTE_MAX_WORDS} words,`,
        "   that supports the question. Do not paraphrase. If you cannot find a supporting",
        '   verbatim quote, set sourceQuote to "" and the question will be filtered out.',
        "8. Do not invent facts, names, dates, or numbers not present in the source text.",
        "9. Avoid duplicate questions and avoid near-duplicate questions that differ only",
        "   in wording.",
        "",
        "Return JSON matching the provided response schema. The questions array must",
        `contain exactly ${totalQuestions} elements when the source text is sufficient;`,
        "if the source text is too short or empty, return an empty questions array.",
        "",
        "Output schema (JSON):",
        "{",
        '  "questions": [',
        "    {",
        '      "draftId": "uuid-string",',
        '      "type": "single" | "true_false" | "short_answer",',
        '      "difficulty": "easy" | "medium" | "hard",',
        '      "text": "question text",',
        '      "options": [{ "id": "a", "text": "..." }, ...],',
        '      "correctOptionIds": ["a"],',
        '      "modelAnswer": "",',
        '      "explanation": "...",',
        '      "sourceQuote": "verbatim quote <= 30 words"',
        '      "instructorState": "untouched"',
        "    }",
        "  ]",
        "}"
    ].join("\n");
}

/**
 * User prompt: the extracted lecture text plus the desired mix parameters
 * (restated for emphasis). The system prompt already encodes the mix, but
 * restating it in the user turn improves adherence.
 *
 * @param {string} extractedText - normalized lecture text
 * @param {{ totalQuestions: number, mcqCount: number, trueFalseCount: number, shortAnswerCount: number, easyCount: number, mediumCount: number, hardCount: number }} params
 * @returns {string}
 */
export function buildUserPrompt(extractedText, params) {
    const {
        totalQuestions,
        mcqCount,
        trueFalseCount,
        shortAnswerCount,
        easyCount,
        mediumCount,
        hardCount
    } = params;

    return [
        "Generate a quiz draft from the lecture text below.",
        "",
        `Requested mix: ${totalQuestions} total = ${mcqCount} MCQ + ${trueFalseCount} True/False + ${shortAnswerCount} Short Answer (essay).`,
        `Requested difficulty: ${easyCount} easy, ${mediumCount} medium, ${hardCount} hard.`,
        "",
        "Every question MUST include a verbatim sourceQuote drawn from the text below.",
        `Quotes must be at most ${SOURCE_QUOTE_MAX_WORDS} words. Questions without a verbatim`,
        "sourceQuote from this text will be discarded.",
        "",
        "--- BEGIN LECTURE TEXT ---",
        extractedText,
        "--- END LECTURE TEXT ---"
    ].join("\n");
}

/**
 * Compose the message array for a Gemini generation call.
 * @param {string} extractedText
 * @param {object} params
 * @returns {{ role: string, content: string }[]}
 */
export function buildQuizGenerationMessages(extractedText, params) {
    return [
        { role: "system", content: buildSystemPrompt(params) },
        { role: "user", content: buildUserPrompt(extractedText, params) }
    ];
}
