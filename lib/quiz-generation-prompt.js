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
 * @param {{ totalQuestions: number, mcqCount: number, trueFalseCount: number, easyCount: number, mediumCount: number, hardCount: number }} params
 * @param {string[]} [existingStems] - question texts to avoid duplicating
 * @returns {string}
 */
export function buildSystemPrompt(params, existingStems = []) {
    const {
        totalQuestions,
        mcqCount,
        trueFalseCount,
        easyCount,
        mediumCount,
        hardCount
    } = params;

    const lines = [
        "You are an assessment designer for a learning management system.",
        "Given the extracted text of a lecture document, generate a quiz draft that is",
        "grounded strictly in the provided text. Do NOT use outside knowledge.",
        "",
        "CRITICAL OUTPUT RULES:",
        `- Generate EXACTLY ${totalQuestions} questions — no more, no fewer.`,
        "- Return STRICT JSON only. No markdown. No code fences. No explanations outside the JSON.",
        "- Allowed question types ONLY:",
        '  - MCQ (type: "single")',
        '  - True/False (type: "true_false")',
        "- Essay questions are FORBIDDEN.",
        "- Short-answer / open-ended / free-text questions are FORBIDDEN.",
        "- Do NOT use types such as essay, short_answer, open_ended, or long_answer.",
        "",
        "Required distribution:",
        `  - ${mcqCount} single-correct multiple-choice questions (type: "single")`,
        `  - ${trueFalseCount} true/false questions (type: "true_false", exactly two options: "True", "False")`,
        `Difficulty distribution across all ${totalQuestions} questions:`,
        `  - ${easyCount} easy, ${mediumCount} medium, ${hardCount} hard.`,
        "",
        "Per-question rules:",
        '1. Each question has: draftId (uuid v4 string), type, difficulty, text, options,',
        "   correctOptionIds, modelAnswer, explanation, sourceQuote, instructorState.",
        '2. instructorState MUST always be "untouched" for every generated question.',
        "3. For type \"single\": options is an array of exactly 4 objects {id, text} with ids a–d;",
        "   correctOptionIds is an array containing exactly one option id.",
        "4. For type \"true_false\": options is [{id:\"t\",text:\"True\"},{id:\"f\",text:\"False\"}];",
        "   correctOptionIds is [\"t\"] or [\"f\"].",
        "5. modelAnswer MUST always be an empty string \"\".",
        "6. explanation: 1-2 sentences, plain language, explaining why the answer is correct.",
        `7. sourceQuote: a verbatim quote from the source text, at most ${SOURCE_QUOTE_MAX_WORDS} words,`,
        "   that supports the question. Do not paraphrase.",
        "8. Do not invent facts, names, dates, or numbers not present in the source text.",
        "9. Avoid duplicate questions and avoid near-duplicate questions that differ only",
        "   in wording.",
        "",
        `The questions array MUST contain exactly ${totalQuestions} elements.`,
        "If the source text is too short or empty, return {\"questions\":[]}.",
        "",
        "Output schema (JSON only):",
        "{",
        '  "questions": [',
        "    {",
        '      "draftId": "uuid-string",',
        '      "type": "single" | "true_false",',
        '      "difficulty": "easy" | "medium" | "hard",',
        '      "text": "question text",',
        '      "options": [{ "id": "a", "text": "..." }, ...],',
        '      "correctOptionIds": ["a"],',
        '      "modelAnswer": "",',
        '      "explanation": "...",',
        `      "sourceQuote": "verbatim quote <= ${SOURCE_QUOTE_MAX_WORDS} words",`,
        '      "instructorState": "untouched"',
        "    }",
        "  ]",
        "}"
    ];

    if (existingStems.length > 0) {
        lines.push(
            "",
            "Do NOT duplicate or closely paraphrase any of these existing question stems:",
            ...existingStems.map((s, i) => `${i + 1}. ${s}`)
        );
    }

    return lines.join("\n");
}

/**
 * User prompt: the extracted lecture text plus the desired mix parameters.
 *
 * @param {string} extractedText - normalized lecture text
 * @param {{ totalQuestions: number, mcqCount: number, trueFalseCount: number, easyCount: number, mediumCount: number, hardCount: number }} params
 * @returns {string}
 */
export function buildUserPrompt(extractedText, params) {
    const {
        totalQuestions,
        mcqCount,
        trueFalseCount,
        easyCount,
        mediumCount,
        hardCount
    } = params;

    return [
        `Generate EXACTLY ${totalQuestions} quiz questions from the lecture text below.`,
        "",
        `Required mix: ${totalQuestions} total = ${mcqCount} MCQ + ${trueFalseCount} True/False.`,
        `Required difficulty: ${easyCount} easy, ${mediumCount} medium, ${hardCount} hard.`,
        "",
        "Allowed types: MCQ (single) and True/False (true_false) ONLY.",
        "Essay and short-answer questions are FORBIDDEN.",
        "",
        "Return ONLY the JSON object. No markdown. No extra text.",
        "",
        "Every question MUST include a verbatim sourceQuote drawn from the text below.",
        `Quotes must be at most ${SOURCE_QUOTE_MAX_WORDS} words.`,
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
 * @param {string[]} [existingStems]
 * @returns {{ role: string, content: string }[]}
 */
export function buildQuizGenerationMessages(extractedText, params, existingStems = []) {
    return [
        { role: "system", content: buildSystemPrompt(params, existingStems) },
        { role: "user", content: buildUserPrompt(extractedText, params) }
    ];
}
