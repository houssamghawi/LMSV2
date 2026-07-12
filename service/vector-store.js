import { ChromaClient } from "chromadb";
import {
    CHROMA_COLLECTION_PREFIX,
    TUTOR_TOP_K_CHUNKS,
    TUTOR_RELEVANCE_THRESHOLD
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

    const collection = await getCourseCollection(courseId);
    await collection.upsert({
        ids: chunks.map((c) => c.id),
        embeddings: chunks.map((c) => c.embedding),
        documents: chunks.map((c) => c.document),
        metadatas: chunks.map((c) => c.metadata)
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
    const collection = await getCourseCollection(courseId);

    const result = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK,
        where: { lessonId: { $eq: lessonId } },
        include: ["documents", "metadatas", "distances"]
    });

    const ids = result.ids?.[0] || [];
    const documents = result.documents?.[0] || [];
    const metadatas = result.metadatas?.[0] || [];
    const distances = result.distances?.[0] || [];

    const matches = [];
    for (let i = 0; i < ids.length; i++) {
        const distance = distances[i] ?? 1;
        const similarity = distanceToSimilarity(distance);
        if (similarity < relevanceThreshold) continue;

        matches.push({
            id: ids[i],
            document: documents[i] ?? "",
            metadata: metadatas[i] ?? {},
            similarity
        });
    }

    return matches;
}

/**
 * Delete all ChromaDB records for a lesson.
 * @param {string} courseId
 * @param {string} lessonId
 */
export async function deleteLessonChunks(courseId, lessonId) {
    const collection = await getCourseCollection(courseId);
    await collection.delete({
        where: { lessonId: { $eq: lessonId } }
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
