import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getLesson } from "@/queries/lessons";
import {
    createTutorInteraction,
    resolveTutorConfig
} from "@/queries/tutor-interactions";
import { embedTexts, hasEmbeddedContent } from "@/service/lecture-embedder";
import { queryChunks, isVectorStoreAvailable } from "@/service/vector-store";
import { detectLanguage, pickLocalizedMessage } from "@/lib/language-detector";
import {
    buildTutorSystemPrompt,
    buildTutorUserMessage,
    formatCitation,
    TUTOR_RESPONSE_JSON_SCHEMA
} from "@/lib/ai-tutor-prompt";
import {
    DEFAULT_TUTOR_MODEL,
    TUTOR_MODEL_FALLBACKS
} from "@/lib/constants";

const LOG_PREFIX = "[AI_TUTOR]";

const tutorResponseSchema = z.object({
    answer: z.string(),
    citation: z.string().nullable(),
    isWithinContext: z.boolean(),
    detectedLanguage: z.enum(["ar", "en"])
});

/**
 * Resolve effective tutor configuration: course-specific → global → defaults.
 *
 * @param {string | null} [courseId]
 */
export async function resolveTutorConfiguration(courseId = null) {
    return resolveTutorConfig(courseId);
}

const SERVICE_UNAVAILABLE_MESSAGE =
    "AI tutor is temporarily unavailable. Please try again later.";

export class TutorServiceError extends Error {
    /**
     * @param {string} code - API error code returned to the client
     * @param {number} status - HTTP status
     * @param {string} message - User-facing message
     * @param {string} [logCode] - Structured log code (defaults to `code`)
     */
    constructor(code, status, message, logCode = code) {
        super(message);
        this.name = "TutorServiceError";
        this.code = code;
        this.status = status;
        this.logCode = logCode;
    }
}

function logTutorError(logCode, context = {}) {
    console.error(`${LOG_PREFIX} ${logCode}`, context);
}

function createGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        logTutorError("AI_SERVICE_ERROR", { reason: "GEMINI_API_KEY not configured" });
        throw new TutorServiceError(
            "SERVICE_UNAVAILABLE",
            503,
            SERVICE_UNAVAILABLE_MESSAGE,
            "AI_SERVICE_ERROR"
        );
    }
    return new GoogleGenAI({ apiKey });
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
        throw new Error("Failed to parse Gemini JSON response.");
    }
}

function buildModelCandidates() {
    const preferred = process.env.GEMINI_TUTOR_MODEL?.trim() || DEFAULT_TUTOR_MODEL;
    return [preferred, ...TUTOR_MODEL_FALLBACKS].filter(
        (model, index, arr) => model && arr.indexOf(model) === index
    );
}

/**
 * Call Gemini to generate a context-bound tutor response.
 * @param {object} params
 */
export async function generateTutorResponse({
    question,
    contextText,
    lessonTitle,
    outOfContextMessage,
    responseLanguage
}) {
    const client = createGeminiClient();
    const systemPrompt = buildTutorSystemPrompt({
        contextText,
        lessonTitle,
        outOfContextMessage,
        responseLanguage
    });
    const userMessage = buildTutorUserMessage(question);
    const contents = [
        { role: "user", parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] }
    ];

    const models = buildModelCandidates();
    let lastError;

    for (const model of models) {
        try {
            const response = await client.models.generateContent({
                model,
                contents,
                config: {
                    responseMimeType: "application/json",
                    responseJsonSchema: TUTOR_RESPONSE_JSON_SCHEMA,
                    temperature: 0.2
                }
            });

            const parsed = tutorResponseSchema.parse(parseJsonResponse(readGeminiText(response)));
            const usage = response?.usageMetadata || {};

            return {
                ...parsed,
                model,
                tokensInput: usage.promptTokenCount ?? null,
                tokensOutput: usage.candidatesTokenCount ?? null
            };
        } catch (err) {
            lastError = err;
            logTutorError("AI_SERVICE_ERROR", {
                model,
                message: err?.message
            });
        }
    }

    logTutorError("AI_SERVICE_ERROR", {
        reason: "All Gemini models failed",
        message: lastError?.message
    });
    throw new TutorServiceError(
        "SERVICE_UNAVAILABLE",
        503,
        SERVICE_UNAVAILABLE_MESSAGE,
        "AI_SERVICE_ERROR"
    );
}

/**
 * Run the full RAG pipeline for a student question.
 *
 * @param {object} params
 * @param {string} params.question
 * @param {string} params.lessonId
 * @param {string} params.courseId
 * @param {string} params.studentId
 */
export async function askTutorQuestion({ question, lessonId, courseId, studentId }) {
    const startedAt = Date.now();

    const config = await resolveTutorConfiguration(courseId);
    if (!config.enabled) {
        throw new TutorServiceError(
            "TUTOR_DISABLED",
            503,
            "AI tutor is currently disabled for this course."
        );
    }

    const embedded = await hasEmbeddedContent(lessonId);
    if (!embedded) {
        throw new TutorServiceError(
            "NO_LECTURE_CONTENT",
            400,
            "AI tutor unavailable—no lecture content uploaded."
        );
    }

    const vectorAvailable = await isVectorStoreAvailable();
    if (!vectorAvailable) {
        throw new TutorServiceError(
            "SERVICE_UNAVAILABLE",
            503,
            SERVICE_UNAVAILABLE_MESSAGE,
            "VECTOR_STORE_ERROR"
        );
    }

    const lesson = await getLesson(lessonId);
    if (!lesson) {
        throw new TutorServiceError("NOT_FOUND", 404, "Lesson not found.");
    }

    const responseLanguage = detectLanguage(question);
    const outOfContextMessage = pickLocalizedMessage(
        config.outOfContextMessage,
        responseLanguage
    );

    let queryEmbedding;
    try {
        [queryEmbedding] = await embedTexts([question]);
    } catch (err) {
        logTutorError("AI_SERVICE_ERROR", {
            stage: "embedding",
            message: err?.message
        });
        throw new TutorServiceError(
            "SERVICE_UNAVAILABLE",
            503,
            SERVICE_UNAVAILABLE_MESSAGE,
            "AI_SERVICE_ERROR"
        );
    }

    let chunks;
    try {
        chunks = await queryChunks({
            courseId,
            lessonId,
            queryEmbedding,
            topK: config.maxContextChunks,
            relevanceThreshold: config.relevanceThreshold
        });
    } catch (err) {
        logTutorError("VECTOR_STORE_ERROR", {
            stage: "query",
            message: err?.message
        });
        throw new TutorServiceError(
            "SERVICE_UNAVAILABLE",
            503,
            SERVICE_UNAVAILABLE_MESSAGE,
            "VECTOR_STORE_ERROR"
        );
    }

    let answer;
    let citation = null;
    let contextStatus;
    let contextChunkIds = [];
    let modelUsed = null;
    let tokensInput = null;
    let tokensOutput = null;
    const relevanceScores = chunks.map((chunk) => chunk.similarity);

    if (chunks.length === 0) {
        answer = outOfContextMessage;
        contextStatus = "out_of_context";
    } else {
        const contextText = chunks.map((chunk) => chunk.document).join("\n\n");
        const generated = await generateTutorResponse({
            question,
            contextText,
            lessonTitle: lesson.title,
            outOfContextMessage,
            responseLanguage
        });

        modelUsed = generated.model;
        tokensInput = generated.tokensInput;
        tokensOutput = generated.tokensOutput;
        contextChunkIds = chunks.map((chunk) => chunk.id);

        if (generated.isWithinContext) {
            answer = generated.answer;
            citation = generated.citation
                ? formatCitation(generated.citation, lesson.title)
                : null;
            contextStatus = "answered";
        } else {
            answer = outOfContextMessage;
            contextStatus = "out_of_context";
        }
    }

    const interaction = await createTutorInteraction({
        question,
        response: answer,
        citation,
        contextStatus,
        contextChunkIds,
        detectedLanguage: responseLanguage,
        studentId,
        courseId,
        lessonId,
        metadata: {
            modelUsed,
            tokensInput,
            tokensOutput,
            responseTimeMs: Date.now() - startedAt,
            relevanceScores
        }
    });

    return {
        interactionId: interaction.id,
        answer,
        citation,
        contextStatus,
        detectedLanguage: responseLanguage,
        lessonTitle: lesson.title
    };
}
