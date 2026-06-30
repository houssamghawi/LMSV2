// Gemini-backed quiz draft generation (specs/001 + 002).
// Requires @google/genai and GEMINI_API_KEY in the environment.
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { randomUUID } from "node:crypto";

import {
    DEFAULT_QUIZ_MODEL,
    GEMINI_QUIZ_MODEL_FALLBACKS,
    GEMINI_DEPRECATED_MODEL_ALIASES,
    SOURCE_QUOTE_MAX_WORDS,
    QUIZ_QUESTION_TYPES,
    QUIZ_DIFFICULTY_LEVELS
} from "@/lib/constants";
import { buildQuizGenerationMessages } from "@/lib/quiz-generation-prompt";

const LOG_PREFIX = "[QUIZ_GENERATOR]";

const TYPE_ALIASES = {
    single: "single",
    mcq: "single",
    multiple_choice: "single",
    multiplechoice: "single",
    multiple_choice_question: "single",
    true_false: "true_false",
    truefalse: "true_false",
    tf: "true_false",
    boolean: "true_false",
    short_answer: "short_answer",
    shortanswer: "short_answer",
    essay: "short_answer",
    open_ended: "short_answer"
};

const DIFFICULTY_ALIASES = {
    easy: "easy",
    medium: "medium",
    hard: "hard"
};

const generatedOptionSchema = z.object({
    id: z.string().min(1),
    text: z.string().min(1)
});

const coercedQuestionSchema = z.object({
    draftId: z.string().min(1).optional(),
    type: z.enum(QUIZ_QUESTION_TYPES),
    difficulty: z.enum(QUIZ_DIFFICULTY_LEVELS),
    text: z.string().min(1),
    options: z.array(generatedOptionSchema).default([]),
    correctOptionIds: z.array(z.string()).default([]),
    modelAnswer: z.string().default(""),
    explanation: z.string().default(""),
    sourceQuote: z.string().default(""),
    instructorState: z.string().default("untouched")
});

const quizGenerationResponseSchema = z.object({
    questions: z.array(coercedQuestionSchema)
});

/** JSON Schema passed to Gemini structured-output mode. */
const GEMINI_RESPONSE_JSON_SCHEMA = {
    type: "object",
    properties: {
        questions: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    draftId: { type: "string" },
                    type: {
                        type: "string",
                        enum: ["single", "true_false", "short_answer"]
                    },
                    difficulty: {
                        type: "string",
                        enum: ["easy", "medium", "hard"]
                    },
                    text: { type: "string" },
                    options: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "string" },
                                text: { type: "string" }
                            },
                            required: ["id", "text"]
                        }
                    },
                    correctOptionIds: {
                        type: "array",
                        items: { type: "string" }
                    },
                    modelAnswer: { type: "string" },
                    explanation: { type: "string" },
                    sourceQuote: { type: "string" },
                    instructorState: { type: "string" }
                },
                required: ["type", "difficulty", "text", "explanation"]
            }
        }
    },
    required: ["questions"]
};

function resolveQuizModel(override) {
    const fromEnv = process.env.GEMINI_QUIZ_MODEL?.trim();
    const raw = override || fromEnv || DEFAULT_QUIZ_MODEL;
    const normalized = String(raw).replace(/^models\//, "") || DEFAULT_QUIZ_MODEL;
    const remapped = GEMINI_DEPRECATED_MODEL_ALIASES[normalized];
    if (remapped) {
        console.warn(
            `${LOG_PREFIX} Model "${normalized}" is retired on the Gemini API; using "${remapped}" instead. Update GEMINI_QUIZ_MODEL in .env.`
        );
        return remapped;
    }
    return normalized;
}

function buildModelCandidates(preferredModel) {
    const candidates = [
        preferredModel,
        preferredModel.endsWith("-latest") ? null : `${preferredModel}-latest`,
        ...GEMINI_QUIZ_MODEL_FALLBACKS
    ];
    return candidates.filter((m, i, arr) => m && arr.indexOf(m) === i);
}

function createGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        const err = new Error(
            "GEMINI_API_KEY is not configured. Set it in .env to enable AI quiz generation."
        );
        err.code = "GEMINI_NOT_CONFIGURED";
        throw err;
    }
    return new GoogleGenAI({ apiKey });
}

function countWords(s) {
    if (!s) return 0;
    const trimmed = String(s).trim();
    if (trimmed === "") return 0;
    return trimmed.split(/\s+/).length;
}

function quoteIsGrounded(normalizedSource, quote) {
    if (!normalizedSource || !quote) return false;
    const q = String(quote).trim().replace(/\s+/g, " ").toLowerCase();
    if (q.length === 0) return false;
    const src = String(normalizedSource).toLowerCase();
    return src.includes(q);
}

function normalizeTypeAlias(rawType) {
    if (!rawType) return null;
    const key = String(rawType).toLowerCase().replace(/[\s-]+/g, "_");
    return TYPE_ALIASES[key] || (QUIZ_QUESTION_TYPES.includes(key) ? key : null);
}

function normalizeDifficultyAlias(rawDifficulty) {
    if (!rawDifficulty) return null;
    const key = String(rawDifficulty).toLowerCase().trim();
    return DIFFICULTY_ALIASES[key] || (QUIZ_DIFFICULTY_LEVELS.includes(key) ? key : null);
}

function normalizeOptions(options, type) {
    if (type === "short_answer") return [];
    if (type === "true_false") {
        return [
            { id: "t", text: "True" },
            { id: "f", text: "False" }
        ];
    }

    return (Array.isArray(options) ? options : []).map((option, index) => {
        const fallbackId = String.fromCharCode(97 + index);
        if (typeof option === "string") {
            return { id: fallbackId, text: option };
        }
        return {
            id: option?.id || fallbackId,
            text: option?.text ?? String(option ?? "")
        };
    });
}

function resolveCorrectOptionIds(type, raw) {
    const fromArray = raw.correctOptionIds ?? raw.correct_option_ids;
    if (Array.isArray(fromArray) && fromArray.length > 0) {
        const ids = fromArray.map(String);
        if (type === "true_false") return normalizeTrueFalseAnswer(ids[0]);
        return ids;
    }

    const correctAnswer = raw.correct_answer ?? raw.correctAnswer;
    if (type === "short_answer") return [];

    if (type === "true_false") {
        if (correctAnswer == null || String(correctAnswer).trim() === "") return [];
        return normalizeTrueFalseAnswer(correctAnswer);
    }

    if (Array.isArray(correctAnswer)) {
        return correctAnswer.map(String);
    }
    if (correctAnswer != null && String(correctAnswer).trim() !== "") {
        return [String(correctAnswer)];
    }

    return [];
}

function normalizeTrueFalseAnswer(answer) {
    const normalized = String(answer).toLowerCase().trim();
    if (normalized === "true" || normalized === "t") return ["t"];
    if (normalized === "false" || normalized === "f") return ["f"];
    return [String(answer)];
}

/**
 * Accept Gemini output in either the application schema (draftId, text, …)
 * or legacy/alternate shapes (id, question_text, correct_answer, essay, mcq).
 */
export function coerceRawQuestion(raw) {
    if (!raw || typeof raw !== "object") return null;

    const type = normalizeTypeAlias(raw.type);
    const difficulty = normalizeDifficultyAlias(raw.difficulty);
    const text = String(
        raw.text ?? raw.question_text ?? raw.question ?? raw.stem ?? ""
    ).trim();

    if (!type || !difficulty || !text) return null;

    const options = normalizeOptions(raw.options, type);
    let correctOptionIds = resolveCorrectOptionIds(type, raw);
    let modelAnswer = String(raw.modelAnswer ?? raw.model_answer ?? "").trim();

    if (type === "short_answer") {
        if (!modelAnswer) {
            const fallback = raw.correct_answer ?? raw.correctAnswer;
            if (fallback != null) modelAnswer = String(fallback).trim();
        }
        correctOptionIds = [];
    } else if (type === "single" && correctOptionIds.length === 0 && options.length > 0) {
        // Some models return the option text instead of the id.
        const answerText = String(raw.correct_answer ?? raw.correctAnswer ?? "").trim();
        const match = options.find(
            (o) => o.id === answerText || o.text.trim().toLowerCase() === answerText.toLowerCase()
        );
        if (match) correctOptionIds = [match.id];
    }

    return {
        draftId: raw.draftId ?? raw.id ?? raw.draft_id ?? randomUUID(),
        type,
        difficulty,
        text,
        options,
        correctOptionIds,
        modelAnswer,
        explanation: String(raw.explanation ?? "").trim(),
        sourceQuote: String(raw.sourceQuote ?? raw.source_quote ?? "").trim(),
        instructorState: raw.instructorState ?? raw.instructor_state ?? "untouched"
    };
}

export function normalizeDraftQuestion(q) {
    const coerced = coerceRawQuestion(q);
    if (!coerced) {
        throw new Error("Invalid question shape from AI response.");
    }
    return {
        draftId: coerced.draftId,
        type: coerced.type,
        difficulty: coerced.difficulty,
        text: coerced.text,
        options: coerced.options,
        correctOptionIds: coerced.correctOptionIds,
        modelAnswer: coerced.type === "short_answer" ? coerced.modelAnswer : "",
        explanation: coerced.explanation || "",
        sourceQuote: coerced.sourceQuote || "",
        instructorState: coerced.instructorState || "untouched"
    };
}

function filterUngroundedQuestions(questions, normalizedSource) {
    return questions.filter((q) => {
        if (!q.sourceQuote) return true;
        if (countWords(q.sourceQuote) > SOURCE_QUOTE_MAX_WORDS) return false;
        if (!quoteIsGrounded(normalizedSource, q.sourceQuote)) return false;
        return true;
    });
}

function normalizeGenerationParams(params = {}) {
    return {
        totalQuestions: Number(params.totalQuestions ?? params.total_questions),
        mcqCount: Number(params.mcqCount ?? params.mcq_count),
        trueFalseCount: Number(params.trueFalseCount ?? params.tf_count),
        shortAnswerCount: Number(params.shortAnswerCount ?? params.short_count),
        easyCount: Number(params.easyCount ?? params.easy_count),
        mediumCount: Number(params.mediumCount ?? params.medium_count),
        hardCount: Number(params.hardCount ?? params.hard_count)
    };
}

function buildGeminiContents(messages) {
    return messages
        .map((message) => `${String(message.role || "user").toUpperCase()}:\n${message.content}`)
        .join("\n\n");
}

function readGeminiText(response) {
    if (typeof response?.text === "string") return response.text;
    if (typeof response?.text === "function") return response.text();
    const parts = response?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
        return parts.map((p) => p?.text ?? "").join("");
    }
    return "";
}

function parseJsonResponse(rawText) {
    const trimmed = String(rawText || "").trim();
    if (!trimmed) {
        throw new Error("Gemini returned an empty response.");
    }

    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    const candidate = fenced ? fenced[1].trim() : trimmed;

    try {
        return JSON.parse(candidate);
    } catch {
        const start = candidate.indexOf("{");
        const end = candidate.lastIndexOf("}");
        if (start >= 0 && end > start) {
            return JSON.parse(candidate.slice(start, end + 1));
        }
        throw new Error("Gemini returned invalid JSON.");
    }
}

function isStructurallyValidQuestion(q) {
    if (!q?.text?.trim()) return false;
    if (q.type === "short_answer") {
        return Boolean(q.modelAnswer?.trim());
    }
    if (q.type === "true_false") {
        return q.correctOptionIds?.length === 1 && ["t", "f"].includes(q.correctOptionIds[0]);
    }
    if (q.type === "single") {
        return (
            Array.isArray(q.options) &&
            q.options.length >= 2 &&
            q.correctOptionIds?.length >= 1 &&
            q.options.some((o) => o.id === q.correctOptionIds[0])
        );
    }
    return false;
}

function parseAndValidateQuestions(rawJson) {
    const questionsArray = Array.isArray(rawJson?.questions) ? rawJson.questions : [];
    const coerced = questionsArray
        .map(coerceRawQuestion)
        .filter(Boolean);

    const parsed = quizGenerationResponseSchema.safeParse({ questions: coerced });
    if (!parsed.success) {
        const err = new Error("Gemini returned a response that did not match the expected schema.");
        err.code = "AI_GENERATION_FAILED";
        err.cause = parsed.error;
        throw err;
    }

    const normalized = parsed.data.questions
        .map(normalizeDraftQuestion)
        .filter(isStructurallyValidQuestion);

    if (normalized.length === 0) {
        const err = new Error(
            "Gemini returned no usable questions after validation. Check the document content and try again."
        );
        err.code = "AI_GENERATION_FAILED";
        throw err;
    }

    return normalized;
}

function getErrorStatus(error) {
    return error?.status ?? error?.cause?.status ?? error?.cause?.cause?.status;
}

function isModelNotFoundError(error) {
    const message = String(error?.message || "").toLowerCase();
    const status = getErrorStatus(error);
    return status === 404 || message.includes("not found") || message.includes("404");
}

function isQuotaExceededError(error) {
    const message = String(error?.message || "").toLowerCase();
    const status = getErrorStatus(error);
    return status === 429 || message.includes("quota") || message.includes("resource_exhausted");
}

function shouldTryNextModel(error) {
    return isModelNotFoundError(error) || isQuotaExceededError(error);
}

async function callGeminiWithModel(client, model, contents) {
    return client.models.generateContent({
        model,
        contents,
        config: {
            responseMimeType: "application/json",
            responseJsonSchema: GEMINI_RESPONSE_JSON_SCHEMA,
            temperature: 0.2
        }
    });
}

export async function generateQuizDraft(extractedText, params, options = {}) {
    const model = resolveQuizModel(options.model);

    if (!extractedText || !extractedText.trim()) {
        return {
            questions: [],
            tokensInput: null,
            tokensOutput: null,
            model,
            provider: "google-gemini"
        };
    }

    const client = createGeminiClient();
    const messages =
        Array.isArray(options.messages) && options.messages.length > 0
            ? options.messages
            : buildQuizGenerationMessages(extractedText, params);
    const contents = buildGeminiContents(messages);

    const modelCandidates = buildModelCandidates(model);

    let response;
    let usedModel = model;
    let lastError;

    for (const candidate of modelCandidates) {
        try {
            response = await callGeminiWithModel(client, candidate, contents);
            usedModel = candidate;
            lastError = null;
            break;
        } catch (cause) {
            lastError = cause;
            console.error(`${LOG_PREFIX} Gemini call failed`, {
                model: candidate,
                code: cause?.code,
                status: cause?.status,
                message: cause?.message
            });
            if (!shouldTryNextModel(cause)) break;
        }
    }

    if (!response) {
        const code = isQuotaExceededError(lastError)
            ? "GEMINI_QUOTA_EXCEEDED"
            : isModelNotFoundError(lastError)
              ? "AI_MODEL_NOT_FOUND"
              : "AI_GENERATION_FAILED";
        const err = new Error(
            code === "GEMINI_QUOTA_EXCEEDED"
                ? "Gemini API quota exceeded for all attempted models. Check billing or retry later."
                : code === "AI_MODEL_NOT_FOUND"
                  ? `AI quiz generation failed: no supported Gemini model available. Set GEMINI_QUIZ_MODEL to gemini-2.5-flash or gemini-2.0-flash.`
                  : `AI quiz generation failed: ${lastError?.message || "unknown error"}`
        );
        err.code = code;
        err.cause = lastError;
        throw err;
    }

    let rawJson;
    try {
        const rawText = readGeminiText(response);
        rawJson = parseJsonResponse(rawText);
    } catch (cause) {
        console.error(`${LOG_PREFIX} Failed to parse Gemini JSON`, {
            model: usedModel,
            preview: String(readGeminiText(response)).slice(0, 500),
            message: cause?.message
        });
        const err = new Error(cause?.message || "Gemini returned invalid JSON.");
        err.code = "AI_GENERATION_FAILED";
        err.cause = cause;
        throw err;
    }

    let normalized;
    try {
        normalized = parseAndValidateQuestions(rawJson);
    } catch (cause) {
        console.error(`${LOG_PREFIX} Schema validation failed`, {
            model: usedModel,
            questionCount: Array.isArray(rawJson?.questions) ? rawJson.questions.length : 0,
            issues: cause?.cause?.issues ?? cause?.message
        });
        throw cause;
    }

    const grounded = filterUngroundedQuestions(normalized, extractedText);

    if (grounded.length === 0 && normalized.length > 0) {
        console.warn(
            `${LOG_PREFIX} All ${normalized.length} questions were filtered as ungrounded; returning unfiltered set as fallback.`
        );
        return {
            questions: normalized,
            tokensInput: response?.usageMetadata?.promptTokenCount ?? null,
            tokensOutput: response?.usageMetadata?.candidatesTokenCount ?? null,
            model: usedModel,
            provider: "google-gemini"
        };
    }

    return {
        questions: grounded,
        tokensInput: response?.usageMetadata?.promptTokenCount ?? null,
        tokensOutput: response?.usageMetadata?.candidatesTokenCount ?? null,
        model: usedModel,
        provider: "google-gemini"
    };
}

export {
    quizGenerationResponseSchema,
    filterUngroundedQuestions,
    countWords,
    quoteIsGrounded
};
