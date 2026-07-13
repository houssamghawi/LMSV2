import { ChromaClient } from "chromadb";
import {
    CHROMA_COLLECTION_PREFIX,
    TUTOR_TOP_K_CHUNKS,
    TUTOR_RELEVANCE_THRESHOLD,
    TUTOR_RELEVANCE_MIN_FLOOR
} from "@/lib/constants";

const LOG_PREFIX = "[VECTOR_STORE]";

/** @type {ChromaClient | null} */
let clientInstance = null;

/**
 * Parse CHROMA_URL into host/port/ssl for the ChromaDB client.
 * @param {string} [url]
 */
export function parseChromaUrl(url = process.env.CHROMA_URL || "http://localhost:8000") {
    const parsed = new URL(url);
    const ssl = parsed.protocol === "https:";
    const port = parsed.port
        ? Number(parsed.port)
        : ssl
          ? 443
          : 8000;
    return {
        host: parsed.hostname,
        port,
        ssl
    };
}

/**
 * @returns {ChromaClient}
 */
export function getChromaClient() {
    if (!clientInstance) {
        const { host, port, ssl } = parseChromaUrl();
        clientInstance = new ChromaClient({ host, port, ssl });
    }
    return clientInstance;
}

/** Reset cached client (useful in tests). */
export function resetChromaClient() {
    clientInstance = null;
}

/**
 * Collection name for a course's lecture embeddings.
 * @param {string} courseId
 */
export function getCollectionName(courseId) {
    return `${CHROMA_COLLECTION_PREFIX}${courseId}`;
}

/**
 * Convert Chroma cosine distance to similarity score (0–1).
 * @param {number} distance
 */
export function distanceToSimilarity(distance) {
    return 1 - distance;
}

/**
 * Get or create the ChromaDB collection for a course.
 * @param {string} courseId
 */
export async function getCourseCollection(courseId) {
    const client = getChromaClient();
    return client.getOrCreateCollection({
        name: getCollectionName(courseId),
        metadata: { "hnsw:space": "cosine" },
        // We always pass pre-computed Gemini embeddings; no Chroma embedder needed.
        embeddingFunction: null
    });
}

/**
 * Verify ChromaDB connectivity.
 */
export async function heartbeat() {
    const client = getChromaClient();
    return client.heartbeat();
}

/**
 * Upsert lecture chunks into ChromaDB.
 *
 * @param {string} courseId
 * @param {Array<{ id: string, embedding: number[], document: string, metadata: Record<string, unknown> }>} chunks
 */
export async function upsertChunks(courseId, chunks) {
    if (!chunks?.length) return;

    const collection = await getCourseCollection(String(courseId));
    await collection.upsert({
        ids: chunks.map((c) => c.id),
        embeddings: chunks.map((c) => c.embedding),
        documents: chunks.map((c) => c.document),
        metadatas: chunks.map((c) => ({
            ...c.metadata,
            lessonId: String(c.metadata.lessonId),
            courseId: String(c.metadata.courseId)
        }))
    });
}

/**
 * Query ChromaDB for semantically similar chunks scoped to a lesson.
 *
 * @param {object} params
 * @param {string} params.courseId
 * @param {string} params.lessonId
 * @param {number[]} params.queryEmbedding
 * @param {number} [params.topK]
 * @param {number} [params.relevanceThreshold]
 * @returns {Promise<Array<{ id: string, document: string, metadata: Record<string, unknown>, similarity: number }>>}
 */
export async function queryChunks({
    courseId,
    lessonId,
    queryEmbedding,
    topK = TUTOR_TOP_K_CHUNKS,
    relevanceThreshold = TUTOR_RELEVANCE_THRESHOLD
}) {
    const lessonKey = String(lessonId);
    const collection = await getCourseCollection(String(courseId));

    const result = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK,
        where: { lessonId: { $eq: lessonKey } },
        include: ["documents", "metadatas", "distances"]
    });

    const ids = result.ids?.[0] || [];
    const documents = result.documents?.[0] || [];
    const metadatas = result.metadatas?.[0] || [];
    const distances = result.distances?.[0] || [];

    const candidates = [];
    for (let i = 0; i < ids.length; i++) {
        const distance = distances[i] ?? 1;
        const similarity = distanceToSimilarity(distance);
        candidates.push({
            id: ids[i],
            document: documents[i] ?? "",
            metadata: metadatas[i] ?? {},
            similarity
        });
    }

    candidates.sort((a, b) => b.similarity - a.similarity);

    const matches = candidates.filter(
        (chunk) => chunk.similarity >= relevanceThreshold
    );

    if (candidates.length > 0 && matches.length === 0) {
        const maxSimilarity = candidates[0].similarity;
        console.warn(`${LOG_PREFIX} All ${candidates.length} chunk(s) below relevance threshold`, {
            lessonId: lessonKey,
            courseId: String(courseId),
            maxSimilarity,
            relevanceThreshold
        });

        if (maxSimilarity >= TUTOR_RELEVANCE_MIN_FLOOR) {
            console.info(`${LOG_PREFIX} Using top ${Math.min(topK, candidates.length)} chunk(s) above min floor`, {
                lessonId: lessonKey,
                minFloor: TUTOR_RELEVANCE_MIN_FLOOR,
                maxSimilarity
            });
            return candidates.slice(0, topK);
        }
    }

    return matches;
}

/**
 * Delete all ChromaDB records for a lesson.
 * @param {string} courseId
 * @param {string} lessonId
 */
export async function deleteLessonChunks(courseId, lessonId) {
    const collection = await getCourseCollection(String(courseId));
    await collection.delete({
        where: { lessonId: { $eq: String(lessonId) } }
    });
}

/**
 * Delete specific chunk IDs from ChromaDB.
 * @param {string} courseId
 * @param {string[]} ids
 */
export async function deleteChunksByIds(courseId, ids) {
    if (!ids?.length) return;
    const collection = await getCourseCollection(courseId);
    await collection.delete({ ids });
}

/**
 * Fetch stored chunks by ID (for follow-up elaboration).
 *
 * @param {string} courseId
 * @param {string[]} ids
 */
export async function getChunksByIds(courseId, ids) {
    if (!ids?.length) return [];

    const collection = await getCourseCollection(String(courseId));
    const result = await collection.get({
        ids,
        include: ["documents", "metadatas"]
    });

    return (result.ids || []).map((id, index) => ({
        id,
        document: result.documents?.[index] ?? "",
        metadata: result.metadatas?.[index] ?? {},
        similarity: 1
    }));
}

/**
 * Count vector records for a lesson in ChromaDB.
 * @param {string} courseId
 * @param {string} lessonId
 */
export async function countLessonChunks(courseId, lessonId) {
    const collection = await getCourseCollection(String(courseId));
    const result = await collection.get({
        where: { lessonId: { $eq: String(lessonId) } },
        include: []
    });
    return result.ids?.length ?? 0;
}

/**
 * Whether a lesson has any vectors stored in ChromaDB.
 * @param {string} courseId
 * @param {string} lessonId
 */
export async function hasLessonChunks(courseId, lessonId) {
    const count = await countLessonChunks(courseId, lessonId);
    return count > 0;
}

/**
 * Check whether ChromaDB is reachable; logs and returns false on failure.
 */
export async function isVectorStoreAvailable() {
    try {
        await heartbeat();
        return true;
    } catch (err) {
        console.error(`${LOG_PREFIX} VECTOR_STORE_ERROR`, {
            message: err?.message || String(err)
        });
        return false;
    }
}
