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
const MAX_TOP_UP_ATTEMPTS = 15;

/** Types that must never be accepted from Gemini — discarded and replaced. */
const FORBIDDEN_QUESTION_TYPES = new Set([
    "essay",
    "short_answer",
    "shortanswer",
    "open_ended",
    "openended",
    "long_answer",
    "longanswer",
    "free_response",
    "freeresponse",
    "descriptive",
    "narrative",
    "written",
    "text_response"
]);

const TYPE_ALIASES = {
    single: "single",
    mcq: "single",
    multiple_choice: "single",
    multiplechoice: "single",
    multiple_choice_question: "single",
    true_false: "true_false",
    truefalse: "true_false",
    tf: "true_false",
    boolean: "true_false"
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

/** Base JSON Schema passed to Gemini structured-output mode. */
const GEMINI_RESPONSE_JSON_SCHEMA_BASE = {
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
                        enum: ["single", "true_false"]
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

function buildResponseJsonSchema() {
    return GEMINI_RESPONSE_JSON_SCHEMA_BASE;
}

function resolveQuizModel(override) {
    const fromEnv = process.env.GEMINI_QUIZ_MODEL?.trim();
    const raw = override || fromEnv || DEFAULT_QUIZ_MODEL;
    const normalized = String(raw).replace(/^models\//, "") || DEFAULT_QUIZ_MODEL;
    const remapped = GEMINI_DEPRECATED_MODEL_ALIASES[normalized];
    if (remapped) {
        console.warn(
            `${LOG_PREFIX} Model "${normalized}" is retired; using "${remapped}" instead. Update GEMINI_QUIZ_MODEL in .env.`
        );
        return remapped;
    }
    return normalized;
}

function buildModelCandidates(preferredModel) {
    const candidates = [preferredModel, ...GEMINI_QUIZ_MODEL_FALLBACKS];
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
    const src = String(normalizedSource).replace(/\s+/g, " ").toLowerCase();
    return src.includes(q);
}

function normalizeTypeAlias(rawType) {
    if (!rawType) return null;
    const key = String(rawType).toLowerCase().replace(/[\s-]+/g, "_");
    if (FORBIDDEN_QUESTION_TYPES.has(key)) return null;
    return TYPE_ALIASES[key] || (QUIZ_QUESTION_TYPES.includes(key) ? key : null);
}

function readRawType(raw) {
    return raw?.type ?? raw?.question_type ?? raw?.questionType ?? null;
}

function isForbiddenRawQuestion(raw) {
    const candidates = [readRawType(raw), raw?.type, raw?.question_type, raw?.questionType];
    for (const candidate of candidates) {
        if (!candidate) continue;
        const key = String(candidate).toLowerCase().replace(/[\s-]+/g, "_");
        if (FORBIDDEN_QUESTION_TYPES.has(key)) return true;
    }
    return false;
}

function normalizeDifficultyAlias(rawDifficulty) {
    if (!rawDifficulty) return null;
    const key = String(rawDifficulty).toLowerCase().trim();
    return DIFFICULTY_ALIASES[key] || (QUIZ_DIFFICULTY_LEVELS.includes(key) ? key : null);
}

function normalizeOptions(options, type) {
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
 * or legacy/alternate shapes (id, question_text, correct_answer, mcq).
 */
export function coerceRawQuestion(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (isForbiddenRawQuestion(raw)) return null;

    const type = normalizeTypeAlias(readRawType(raw));
    const difficulty = normalizeDifficultyAlias(raw.difficulty);
    const text = String(
        raw.text ?? raw.question_text ?? raw.question ?? raw.stem ?? ""
    ).trim();

    if (!type || !difficulty || !text) return null;

    const options = normalizeOptions(raw.options, type);
    let correctOptionIds = resolveCorrectOptionIds(type, raw);

    if (type === "single" && correctOptionIds.length === 0 && options.length > 0) {
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
        modelAnswer: "",
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
        modelAnswer: "",
        explanation: coerced.explanation || "",
        sourceQuote: coerced.sourceQuote || "",
        instructorState: coerced.instructorState || "untouched"
    };
}

function isSourceQuoteValid(normalizedSource, sourceQuote) {
    if (!sourceQuote) return true;
    if (countWords(sourceQuote) > SOURCE_QUOTE_MAX_WORDS) return false;
    if (!quoteIsGrounded(normalizedSource, sourceQuote)) return false;
    return true;
}

/** Strip invalid sourceQuote values instead of discarding otherwise-valid questions. */
function filterUngroundedQuestions(questions, normalizedSource) {
    let strippedCount = 0;
    const sanitized = questions.map((q) => {
        if (!q.sourceQuote || isSourceQuoteValid(normalizedSource, q.sourceQuote)) {
            return q;
        }
        strippedCount += 1;
        return { ...q, sourceQuote: "" };
    });
    if (strippedCount > 0) {
        console.log(`${LOG_PREFIX} stripped invalid sourceQuote from questions`, {
            strippedCount,
            keptCount: sanitized.length
        });
    }
    return sanitized;
}

export function normalizeGenerationParams(params = {}) {
    const totalQuestions = Number(params.totalQuestions ?? params.total_questions);
    let mcqCount = Number(params.mcqCount ?? params.mcq_count);
    let trueFalseCount = Number(params.trueFalseCount ?? params.tf_count);

    if (!Number.isFinite(mcqCount) && !Number.isFinite(trueFalseCount) && Number.isFinite(totalQuestions)) {
        mcqCount = Math.ceil(totalQuestions / 2);
        trueFalseCount = totalQuestions - mcqCount;
    }

    return {
        totalQuestions,
        mcqCount: Number.isFinite(mcqCount) ? mcqCount : 0,
        trueFalseCount: Number.isFinite(trueFalseCount) ? trueFalseCount : 0,
        easyCount: Number(params.easyCount ?? params.easy_count ?? 0),
        mediumCount: Number(params.mediumCount ?? params.medium_count ?? 0),
        hardCount: Number(params.hardCount ?? params.hard_count ?? 0)
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

function parseAndValidateQuestions(rawJson, logContext = {}) {
    const questionsArray = Array.isArray(rawJson?.questions) ? rawJson.questions : [];
    const rawTypes = questionsArray.map((q) => readRawType(q)).filter(Boolean);
    const forbiddenDiscarded = questionsArray.filter((q) => isForbiddenRawQuestion(q)).length;

    const coerced = questionsArray
        .map(coerceRawQuestion)
        .filter(Boolean);

    console.log(`${LOG_PREFIX} parseAndValidateQuestions`, {
        ...logContext,
        rawQuestionCount: questionsArray.length,
        rawTypes,
        forbiddenDiscarded,
        coercedCount: coerced.length,
        coercedTypes: coerced.map((q) => q.type)
    });

    const parsed = quizGenerationResponseSchema.safeParse({ questions: coerced });
    if (!parsed.success) {
        const err = new Error("Gemini returned a response that did not match the expected schema.");
        err.code = "AI_GENERATION_FAILED";
        err.cause = parsed.error;
        throw err;
    }

    const valid = parsed.data.questions
        .map(normalizeDraftQuestion)
        .filter(isStructurallyValidQuestion);

    console.log(`${LOG_PREFIX} parseAndValidateQuestions result`, {
        ...logContext,
        structurallyValidCount: valid.length,
        structurallyValidTypes: valid.map((q) => q.type)
    });

    return valid;
}

function questionTextKey(q) {
    return q.text.trim().toLowerCase();
}

function dedupeQuestionsByText(questions) {
    const seen = new Set();
    return questions.filter((q) => {
        const key = questionTextKey(q);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function countByType(questions) {
    return {
        single: questions.filter((q) => q.type === "single").length,
        true_false: questions.filter((q) => q.type === "true_false").length
    };
}

function selectQuestionsForMix(pool, params) {
    const { totalQuestions, mcqCount, trueFalseCount } = params;
    const deduped = dedupeQuestionsByText(pool.filter((q) => QUIZ_QUESTION_TYPES.includes(q.type)));
    const mcqs = deduped.filter((q) => q.type === "single");
    const tfs = deduped.filter((q) => q.type === "true_false");

    const selected = [
        ...mcqs.slice(0, mcqCount),
        ...tfs.slice(0, trueFalseCount)
    ];

    const selectedKeys = new Set(selected.map(questionTextKey));
    if (selected.length < totalQuestions) {
        for (const q of deduped) {
            if (selected.length >= totalQuestions) break;
            const key = questionTextKey(q);
            if (selectedKeys.has(key)) continue;
            selected.push(q);
            selectedKeys.add(key);
        }
    }

    return selected.slice(0, totalQuestions);
}

function buildTopUpParams(params, selected) {
    const selectedCounts = countByType(selected);
    const mcqNeeded = Math.max(0, params.mcqCount - selectedCounts.single);
    const tfNeeded = Math.max(0, params.trueFalseCount - selectedCounts.true_false);
    const totalNeeded = Math.max(params.totalQuestions - selected.length, mcqNeeded + tfNeeded);

    if (totalNeeded <= 0) return null;

    const ratio = params.totalQuestions > 0 ? totalNeeded / params.totalQuestions : 1;
    return {
        totalQuestions: totalNeeded,
        mcqCount: mcqNeeded > 0 ? mcqNeeded : Math.max(0, totalNeeded - tfNeeded),
        trueFalseCount: tfNeeded > 0 ? tfNeeded : Math.max(0, totalNeeded - mcqNeeded),
        easyCount: Math.max(0, Math.round((params.easyCount ?? 0) * ratio)),
        mediumCount: Math.max(0, Math.round((params.mediumCount ?? 0) * ratio)),
        hardCount: Math.max(0, Math.round((params.hardCount ?? 0) * ratio))
    };
}

function balanceDifficultyCounts(topUpParams) {
    const sum =
        (topUpParams.easyCount ?? 0) +
        (topUpParams.mediumCount ?? 0) +
        (topUpParams.hardCount ?? 0);
    if (sum === topUpParams.totalQuestions) return topUpParams;

    const balanced = { ...topUpParams };
    balanced.easyCount = topUpParams.totalQuestions;
    balanced.mediumCount = 0;
    balanced.hardCount = 0;
    return balanced;
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

/** Free-tier projects get limit: 0 for some models (e.g. gemini-2.5-pro) — retrying is pointless. */
function isFreeTierQuotaBlockedError(error) {
    return isQuotaExceededError(error) && String(error?.message || "").includes("limit: 0");
}

function isTransientUnavailableError(error) {
    const message = String(error?.message || "").toLowerCase();
    const status = getErrorStatus(error);
    return (
        status === 503 ||
        message.includes("unavailable") ||
        message.includes("high demand")
    );
}

function shouldTryNextModel(error) {
    return (
        isModelNotFoundError(error) ||
        isQuotaExceededError(error) ||
        isTransientUnavailableError(error)
    );
}

function parseRetryDelayMs(error) {
    try {
        const raw = String(error?.message || "");
        if (raw.startsWith("{")) {
            const parsed = JSON.parse(raw);
            const retryInfo = parsed?.error?.details?.find((d) =>
                String(d?.["@type"] || "").includes("RetryInfo")
            );
            if (retryInfo?.retryDelay) {
                const seconds = parseFloat(String(retryInfo.retryDelay).replace(/s$/i, ""));
                if (Number.isFinite(seconds) && seconds > 0) {
                    return Math.ceil(seconds * 1000) + 500;
                }
            }
        }
        const match = raw.match(/retry in ([\d.]+)s/i);
        if (match) {
            const seconds = parseFloat(match[1]);
            if (Number.isFinite(seconds) && seconds > 0) {
                return Math.ceil(seconds * 1000) + 500;
            }
        }
    } catch {
        // ignore parse errors
    }
    return null;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_QUOTA_RETRIES_PER_MODEL = 2;
const MAX_TRANSIENT_RETRIES_PER_MODEL = 2;

async function callGeminiWithModel(client, model, contents) {
    return client.models.generateContent({
        model,
        contents,
        config: {
            responseMimeType: "application/json",
            responseJsonSchema: buildResponseJsonSchema(),
            temperature: 0.2
        }
    });
}

async function invokeGemini(client, modelCandidates, contents) {
    let response;
    let usedModel = modelCandidates[0];
    let lastError;

    for (const candidate of modelCandidates) {
        let quotaRetries = 0;
        let transientRetries = 0;
        while (quotaRetries <= MAX_QUOTA_RETRIES_PER_MODEL) {
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
                    message: cause?.message,
                    quotaRetry: quotaRetries,
                    transientRetry: transientRetries
                });

                if (isFreeTierQuotaBlockedError(cause)) {
                    console.warn(`${LOG_PREFIX} Model not available on free tier — skipping`, {
                        model: candidate
                    });
                    break;
                }

                if (
                    isTransientUnavailableError(cause) &&
                    transientRetries < MAX_TRANSIENT_RETRIES_PER_MODEL
                ) {
                    const delayMs = 5_000 * (transientRetries + 1);
                    console.log(`${LOG_PREFIX} Gemini temporarily unavailable — retrying after ${delayMs}ms`, {
                        model: candidate,
                        attempt: transientRetries + 1
                    });
                    await sleep(delayMs);
                    transientRetries += 1;
                    continue;
                }

                if (isQuotaExceededError(cause) && quotaRetries < MAX_QUOTA_RETRIES_PER_MODEL) {
                    const delayMs = parseRetryDelayMs(cause) ?? 30_000;
                    console.log(`${LOG_PREFIX} Gemini quota/rate limit — retrying after ${delayMs}ms`, {
                        model: candidate,
                        attempt: quotaRetries + 1
                    });
                    await sleep(delayMs);
                    quotaRetries += 1;
                    continue;
                }

                if (!shouldTryNextModel(cause)) break;
                break;
            }
        }
        if (response) break;
    }

    if (!response) {
        const code = isQuotaExceededError(lastError)
            ? "GEMINI_QUOTA_EXCEEDED"
            : isModelNotFoundError(lastError)
              ? "AI_MODEL_NOT_FOUND"
              : isTransientUnavailableError(lastError)
                ? "GEMINI_UNAVAILABLE"
                : "AI_GENERATION_FAILED";
        const err = new Error(
            code === "GEMINI_QUOTA_EXCEEDED"
                ? "Gemini API quota exceeded for all attempted models. Check billing or retry later."
                : code === "AI_MODEL_NOT_FOUND"
                  ? "AI quiz generation failed: no supported Gemini model available. Set GEMINI_QUIZ_MODEL to gemini-2.5-flash."
                  : code === "GEMINI_UNAVAILABLE"
                    ? "Gemini is temporarily overloaded. Please try again in a few minutes."
                    : `AI quiz generation failed: ${lastError?.message || "unknown error"}`
        );
        err.code = code;
        err.cause = lastError;
        throw err;
    }

    return { response, usedModel };
}

async function generateQuestionBatch(client, modelCandidates, extractedText, batchParams, existingStems) {
    console.log(`${LOG_PREFIX} generateQuestionBatch request`, {
        requestedCount: batchParams.totalQuestions,
        mcqCount: batchParams.mcqCount,
        trueFalseCount: batchParams.trueFalseCount,
        allowedTypes: QUIZ_QUESTION_TYPES
    });

    const messages = buildQuizGenerationMessages(extractedText, batchParams, existingStems);
    const contents = buildGeminiContents(messages);
    const { response, usedModel } = await invokeGemini(
        client,
        modelCandidates,
        contents
    );

    let rawJson;
    const rawText = readGeminiText(response);
    try {
        rawJson = parseJsonResponse(rawText);
    } catch (cause) {
        console.error(`${LOG_PREFIX} Failed to parse Gemini JSON`, {
            model: usedModel,
            preview: String(rawText).slice(0, 500),
            message: cause?.message
        });
        const err = new Error(cause?.message || "Gemini returned invalid JSON.");
        err.code = "AI_GENERATION_FAILED";
        err.cause = cause;
        throw err;
    }

    console.log(`${LOG_PREFIX} Gemini raw response`, {
        model: usedModel,
        requestedCount: batchParams.totalQuestions,
        rawQuestionCount: Array.isArray(rawJson?.questions) ? rawJson.questions.length : 0,
        rawTypes: Array.isArray(rawJson?.questions)
            ? rawJson.questions.map((q) => readRawType(q)).filter(Boolean)
            : []
    });

    let normalized;
    try {
        normalized = parseAndValidateQuestions(rawJson, { model: usedModel, phase: "batch" });
    } catch (cause) {
        console.error(`${LOG_PREFIX} Schema validation failed`, {
            model: usedModel,
            questionCount: Array.isArray(rawJson?.questions) ? rawJson.questions.length : 0,
            issues: cause?.cause?.issues ?? cause?.message
        });
        throw cause;
    }

    return {
        questions: normalized,
        usedModel,
        tokensInput: response?.usageMetadata?.promptTokenCount ?? null,
        tokensOutput: response?.usageMetadata?.candidatesTokenCount ?? null
    };
}

async function enforceExactQuestionCount(client, modelCandidates, extractedText, params, initialPool) {
    const target = params.totalQuestions;
    let pool = dedupeQuestionsByText(initialPool.filter((q) => QUIZ_QUESTION_TYPES.includes(q?.type)));
    let usedModel = null;
    let tokensInput = null;
    let tokensOutput = null;

    console.log(`${LOG_PREFIX} enforceExactQuestionCount start`, {
        target,
        mcqCount: params.mcqCount,
        trueFalseCount: params.trueFalseCount,
        initialPoolCount: initialPool.length,
        usablePoolCount: pool.length,
        initialTypes: pool.map((q) => q.type)
    });

    for (let attempt = 0; attempt <= MAX_TOP_UP_ATTEMPTS; attempt++) {
        const selected = selectQuestionsForMix(pool, params);

        console.log(`${LOG_PREFIX} enforceExactQuestionCount attempt`, {
            attempt,
            target,
            selectedCount: selected.length,
            selectedTypes: selected.map((q) => q.type),
            poolCount: pool.length
        });

        if (selected.length === target) {
            console.log(`${LOG_PREFIX} enforceExactQuestionCount success`, {
                target,
                finalCount: selected.length,
                finalTypes: selected.map((q) => q.type)
            });
            return { questions: selected, usedModel, tokensInput, tokensOutput };
        }

        const topUpParams = balanceDifficultyCounts(buildTopUpParams(params, selected));
        if (!topUpParams) {
            console.warn(`${LOG_PREFIX} enforceExactQuestionCount cannot build top-up params`, {
                attempt,
                target,
                selectedCount: selected.length
            });
            break;
        }

        console.log(`${LOG_PREFIX} enforceExactQuestionCount top-up`, {
            attempt,
            deficit: target - selected.length,
            topUpParams
        });

        const existingStems = pool.map((q) => q.text);
        const batch = await generateQuestionBatch(
            client,
            modelCandidates,
            extractedText,
            topUpParams,
            existingStems
        );

        usedModel = batch.usedModel;
        if (batch.tokensInput != null) tokensInput = (tokensInput ?? 0) + batch.tokensInput;
        if (batch.tokensOutput != null) tokensOutput = (tokensOutput ?? 0) + batch.tokensOutput;

        const additions = filterUngroundedQuestions(batch.questions, extractedText);
        pool = dedupeQuestionsByText([
            ...pool,
            ...additions.filter((q) => QUIZ_QUESTION_TYPES.includes(q?.type))
        ]);
    }

    const finalSelected = selectQuestionsForMix(pool, params);
    console.error(`${LOG_PREFIX} enforceExactQuestionCount failed`, {
        target,
        finalSelectedCount: finalSelected.length,
        finalTypes: finalSelected.map((q) => q.type),
        poolCount: pool.length
    });

    if (finalSelected.length !== target) {
        const err = new Error(
            `Gemini returned ${finalSelected.length} usable questions but ${target} were requested. Try again or adjust the document.`
        );
        err.code = "AI_GENERATION_FAILED";
        throw err;
    }

    return { questions: finalSelected, usedModel, tokensInput, tokensOutput };
}

export async function generateQuizDraft(extractedText, params, options = {}) {
    const model = resolveQuizModel(options.model);
    const normalizedParams = normalizeGenerationParams(params);

    console.log(`${LOG_PREFIX} generateQuizDraft start`, {
        requestedCount: normalizedParams.totalQuestions,
        mcqCount: normalizedParams.mcqCount,
        trueFalseCount: normalizedParams.trueFalseCount,
        allowedTypes: QUIZ_QUESTION_TYPES
    });

    if (!extractedText || !extractedText.trim()) {
        return {
            questions: [],
            tokensInput: null,
            tokensOutput: null,
            model,
            provider: "google-gemini"
        };
    }

    if (!Number.isFinite(normalizedParams.totalQuestions) || normalizedParams.totalQuestions < 1) {
        const err = new Error("Invalid totalQuestions in generation params.");
        err.code = "AI_GENERATION_FAILED";
        throw err;
    }

    const client = createGeminiClient();
    const modelCandidates = buildModelCandidates(model);

    let usedModel = model;
    let tokensInput = null;
    let tokensOutput = null;
    let initialPool;

    if (Array.isArray(options.messages) && options.messages.length > 0) {
        const contents = buildGeminiContents(options.messages);
        const { response, usedModel: m } = await invokeGemini(
            client,
            modelCandidates,
            contents
        );
        usedModel = m;
        const rawText = readGeminiText(response);
        const rawJson = parseJsonResponse(rawText);
        console.log(`${LOG_PREFIX} generateQuizDraft custom messages response`, {
            requestedCount: normalizedParams.totalQuestions,
            rawQuestionCount: Array.isArray(rawJson?.questions) ? rawJson.questions.length : 0,
            rawTypes: Array.isArray(rawJson?.questions)
                ? rawJson.questions.map((q) => readRawType(q)).filter(Boolean)
                : []
        });
        initialPool = parseAndValidateQuestions(rawJson, { model: usedModel, phase: "custom-messages" });
        tokensInput = response?.usageMetadata?.promptTokenCount ?? null;
        tokensOutput = response?.usageMetadata?.candidatesTokenCount ?? null;
    } else {
        const batch = await generateQuestionBatch(
            client,
            modelCandidates,
            extractedText,
            normalizedParams,
            []
        );
        usedModel = batch.usedModel;
        tokensInput = batch.tokensInput;
        tokensOutput = batch.tokensOutput;
        initialPool = batch.questions;
    }

    const poolForSelection = filterUngroundedQuestions(initialPool, extractedText);

    const result = await enforceExactQuestionCount(
        client,
        modelCandidates,
        extractedText,
        normalizedParams,
        poolForSelection
    );

    const finalQuestions = result.questions.filter((q) => QUIZ_QUESTION_TYPES.includes(q.type));
    if (finalQuestions.length !== normalizedParams.totalQuestions) {
        const err = new Error(
            `Internal count mismatch: expected ${normalizedParams.totalQuestions}, got ${finalQuestions.length}.`
        );
        err.code = "AI_GENERATION_FAILED";
        throw err;
    }

    console.log(`${LOG_PREFIX} generateQuizDraft complete`, {
        requestedCount: normalizedParams.totalQuestions,
        returnedCount: finalQuestions.length,
        returnedTypes: finalQuestions.map((q) => q.type)
    });

    return {
        questions: finalQuestions,
        tokensInput: result.tokensInput ?? tokensInput,
        tokensOutput: result.tokensOutput ?? tokensOutput,
        model: result.usedModel ?? usedModel,
        provider: "google-gemini"
    };
}

export {
    quizGenerationResponseSchema,
    filterUngroundedQuestions,
    countWords,
    quoteIsGrounded,
    selectQuestionsForMix,
    enforceExactQuestionCount as _enforceExactQuestionCountForTests,
    parseAndValidateQuestions,
    FORBIDDEN_QUESTION_TYPES
};
