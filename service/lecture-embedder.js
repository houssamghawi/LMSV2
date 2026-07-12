import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { dbConnect } from "@/service/mongo";
import { Lesson } from "@/model/lesson.model";
import { Module } from "@/model/module.model";
import { LectureChunk } from "@/model/lecture-chunk-model";
import {
    upsertChunks,
    deleteLessonChunks,
    isVectorStoreAvailable
} from "@/service/vector-store";
import {
    TUTOR_CHUNK_SIZE_TOKENS,
    TUTOR_CHUNK_OVERLAP_TOKENS,
    TUTOR_MIN_CHUNK_SIZE_TOKENS,
    TUTOR_EMBEDDING_MODEL,
    TUTOR_EMBEDDING_DIMENSIONS,
    TUTOR_CHARS_PER_TOKEN
} from "@/lib/constants";

const LOG_PREFIX = "[LECTURE_EMBEDDER]";

function createGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        const err = new Error(
            "GEMINI_API_KEY is not configured. Set it in .env to enable lecture embedding."
        );
        err.code = "GEMINI_NOT_CONFIGURED";
        throw err;
    }
    return new GoogleGenAI({ apiKey });
}

/**
 * Rough token estimate from character count (~4 chars per token).
 * @param {string} text
 */
export function estimateTokenCount(text) {
    if (!text) return 0;
    return Math.max(1, Math.ceil(text.length / TUTOR_CHARS_PER_TOKEN));
}

/**
 * Hash chunk text for change detection.
 * @param {string} text
 */
export function hashContent(text) {
    return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Strip HTML tags and normalize whitespace from rich-text lesson content.
 * @param {string} html
 */
export function stripHtmlContent(html) {
    return String(html || "")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, " ")
        .replace(/\s+([.,!?;:])/g, "$1")
        .trim();
}

/**
 * Extract embeddable lecture text from a lesson document.
 * Uses the lesson description field (supports HTML from the rich-text editor).
 *
 * @param {object | string} lessonOrDescription - Lesson doc or raw description string
 * @returns {string}
 */
export function extractLessonContent(lessonOrDescription) {
    const raw =
        typeof lessonOrDescription === "string"
            ? lessonOrDescription
            : lessonOrDescription?.description ?? "";
    return stripHtmlContent(raw);
}

/**
 * Split lecture text into overlapping chunks (research.md §2).
 *
 * @param {string} text
 * @param {object} [options]
 * @returns {Array<{ text: string, startOffset: number, endOffset: number, tokenCount: number, chunkIndex: number }>}
 */
export function chunkText(
    text,
    {
        chunkSizeTokens = TUTOR_CHUNK_SIZE_TOKENS,
        overlapTokens = TUTOR_CHUNK_OVERLAP_TOKENS,
        minChunkTokens = TUTOR_MIN_CHUNK_SIZE_TOKENS
    } = {}
) {
    const normalized = String(text || "").trim();
    if (!normalized) return [];

    const chunkChars = chunkSizeTokens * TUTOR_CHARS_PER_TOKEN;
    const overlapChars = overlapTokens * TUTOR_CHARS_PER_TOKEN;
    const minChunkChars = minChunkTokens * TUTOR_CHARS_PER_TOKEN;
    const step = Math.max(1, chunkChars - overlapChars);

    const chunks = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < normalized.length) {
        let end = Math.min(start + chunkChars, normalized.length);
        let slice = normalized.slice(start, end);

        if (slice.length < minChunkChars && chunks.length > 0) {
            const prev = chunks[chunks.length - 1];
            prev.text = normalized.slice(prev.startOffset, end);
            prev.endOffset = end;
            prev.tokenCount = estimateTokenCount(prev.text);
            break;
        }

        if (slice.length >= minChunkChars || start === 0) {
            chunks.push({
                text: slice,
                startOffset: start,
                endOffset: end,
                tokenCount: estimateTokenCount(slice),
                chunkIndex
            });
            chunkIndex += 1;
        }

        if (end >= normalized.length) break;
        start += step;
    }

    return chunks;
}

/**
 * Generate Gemini embeddings for one or more text strings.
 *
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function embedTexts(texts) {
    if (!texts.length) return [];

    const ai = createGeminiClient();
    const response = await ai.models.embedContent({
        model: TUTOR_EMBEDDING_MODEL,
        contents: texts,
        config: {
            outputDimensionality: TUTOR_EMBEDDING_DIMENSIONS
        }
    });

    const embeddings = response.embeddings || [];
    return embeddings.map((item) => item.values || []);
}

/**
 * Build a stable ChromaDB ID for a lesson chunk.
 * @param {string} lessonId
 * @param {number} chunkIndex
 */
export function buildChromaId(lessonId, chunkIndex) {
    return `${lessonId}_${chunkIndex}`;
}

/**
 * Embed lecture content for a lesson: chunk, embed, store in ChromaDB + MongoDB.
 * Replaces any existing chunks for the lesson.
 *
 * @param {object} params
 * @param {string} params.lessonId
 * @param {string} params.courseId
 * @param {string} params.content - Raw lecture text (e.g. lesson description)
 * @returns {Promise<{ chunkCount: number, skipped: boolean }>}
 */
export async function embedLessonContent({ lessonId, courseId, content }) {
    const normalized = String(content || "").trim();
    if (!normalized) {
        return { chunkCount: 0, skipped: true };
    }

    const available = await isVectorStoreAvailable();
    if (!available) {
        const err = new Error(
            "ChromaDB is not reachable. Start it with `npm run chroma` (or Docker) and set CHROMA_URL in .env."
        );
        err.code = "CHROMA_UNAVAILABLE";
        throw err;
    }

    const textChunks = chunkText(normalized);
    if (textChunks.length === 0) {
        return { chunkCount: 0, skipped: true };
    }

    const embeddings = await embedTexts(textChunks.map((c) => c.text));

    const chromaRecords = textChunks.map((chunk, index) => ({
        id: buildChromaId(lessonId, chunk.chunkIndex),
        embedding: embeddings[index],
        document: chunk.text,
        metadata: {
            lessonId,
            courseId,
            chunkIndex: chunk.chunkIndex,
            startOffset: chunk.startOffset,
            endOffset: chunk.endOffset,
            tokenCount: chunk.tokenCount
        }
    }));

    await upsertChunks(courseId, chromaRecords);

    await dbConnect();
    await LectureChunk.deleteMany({ lessonId });
    await LectureChunk.insertMany(
        textChunks.map((chunk, index) => ({
            chromaId: buildChromaId(lessonId, chunk.chunkIndex),
            lessonId,
            courseId,
            chunkIndex: chunk.chunkIndex,
            startOffset: chunk.startOffset,
            endOffset: chunk.endOffset,
            tokenCount: chunk.tokenCount,
            contentHash: hashContent(chunk.text),
            embeddedAt: new Date()
        }))
    );

    console.info(
        `${LOG_PREFIX} Embedded ${textChunks.length} chunk(s) for lesson ${lessonId}`
    );

    return { chunkCount: textChunks.length, skipped: false };
}

/**
 * Remove all embedded chunks for a lesson from ChromaDB and MongoDB.
 *
 * @param {string} lessonId
 * @param {string} courseId
 */
export async function removeLessonEmbeddings(lessonId, courseId) {
    await deleteLessonChunks(courseId, lessonId);
    await dbConnect();
    await LectureChunk.deleteMany({ lessonId });
}

/**
 * Check whether a lesson has embedded content.
 * @param {string} lessonId
 */
export async function hasEmbeddedContent(lessonId) {
    await dbConnect();
    const count = await LectureChunk.countDocuments({ lessonId });
    return count > 0;
}

/**
 * Count embedded chunks for a lesson.
 * @param {string} lessonId
 */
export async function countLessonChunks(lessonId) {
    await dbConnect();
    return LectureChunk.countDocuments({ lessonId });
}

/**
 * Resolve the parent course ID for a lesson via its module.
 * @param {string} lessonId
 */
export async function getCourseIdForLesson(lessonId) {
    await dbConnect();
    const module = await Module.findOne({ lessonIds: lessonId })
        .select("course")
        .lean();
    return module?.course?.toString() ?? null;
}

/**
 * Sync embeddings for a lesson: extract content, skip if unchanged, embed or clear.
 *
 * @param {string} lessonId
 * @param {string | null} [courseId]
 */
export async function syncLessonEmbeddings(lessonId, courseId = null) {
    await dbConnect();

    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson) {
        throw new Error("Lesson not found");
    }

    const resolvedCourseId = courseId ?? (await getCourseIdForLesson(lessonId));
    if (!resolvedCourseId) {
        throw new Error("Course not found for lesson");
    }

    const content = extractLessonContent(lesson);
    const contentHash = hashContent(content);

    if (!content) {
        await removeLessonEmbeddings(lessonId, resolvedCourseId);
        await Lesson.findByIdAndUpdate(lessonId, {
            $set: {
                tutorEmbeddingStatus: "none",
                tutorContentHash: null,
                tutorEmbeddedAt: null,
                tutorEmbeddingError: null
            }
        });
        return { status: "none", chunkCount: 0, skipped: false };
    }

    if (
        lesson.tutorContentHash === contentHash &&
        lesson.tutorEmbeddingStatus === "ready"
    ) {
        const chunkCount = await countLessonChunks(lessonId);
        return { status: "ready", chunkCount, skipped: true };
    }

    await Lesson.findByIdAndUpdate(lessonId, {
        $set: {
            tutorEmbeddingStatus: "pending",
            tutorEmbeddingError: null
        }
    });

    try {
        const result = await embedLessonContent({
            lessonId,
            courseId: resolvedCourseId,
            content
        });

        const status = result.skipped ? "none" : "ready";
        await Lesson.findByIdAndUpdate(lessonId, {
            $set: {
                tutorEmbeddingStatus: status,
                tutorContentHash: contentHash,
                tutorEmbeddedAt: result.skipped ? null : new Date(),
                tutorEmbeddingError: null
            }
        });

        return {
            status,
            chunkCount: result.chunkCount,
            skipped: result.skipped
        };
    } catch (error) {
        await Lesson.findByIdAndUpdate(lessonId, {
            $set: {
                tutorEmbeddingStatus: "failed",
                tutorEmbeddingError: String(error?.message || "Embedding failed").slice(
                    0,
                    500
                )
            }
        });
        throw error;
    }
}

/**
 * Get embedding status summary for instructor UI.
 * @param {string} lessonId
 */
export async function getLessonEmbeddingStatus(lessonId) {
    await dbConnect();
    const lesson = await Lesson.findById(lessonId)
        .select(
            "tutorEmbeddingStatus tutorEmbeddedAt tutorEmbeddingError tutorContentHash description"
        )
        .lean();

    if (!lesson) {
        return {
            status: "none",
            chunkCount: 0,
            embeddedAt: null,
            error: null
        };
    }

    const chunkCount = await countLessonChunks(lessonId);
    const hasContent = Boolean(extractLessonContent(lesson));

    let status = lesson.tutorEmbeddingStatus || "none";
    if (hasContent && status === "none" && chunkCount > 0) {
        status = "ready";
    }

    return {
        status,
        chunkCount,
        embeddedAt: lesson.tutorEmbeddedAt ?? null,
        error: lesson.tutorEmbeddingError ?? null
    };
}
