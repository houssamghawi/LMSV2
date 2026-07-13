import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockCollection = { get: mockGet, query: vi.fn(), upsert: vi.fn(), delete: vi.fn() };
const mockClient = {
    getOrCreateCollection: vi.fn(async () => mockCollection),
    heartbeat: vi.fn(async () => 1)
};

vi.mock("chromadb", () => ({
    ChromaClient: vi.fn(() => mockClient)
}));

const {
    countLessonChunks,
    hasLessonChunks,
    distanceToSimilarity,
    parseChromaUrl,
    resetChromaClient
} = await import("@/service/vector-store");

beforeEach(() => {
    vi.clearAllMocks();
    resetChromaClient();
});

describe("vector-store helpers", () => {
    it("parseChromaUrl defaults to localhost:8000", () => {
        const parsed = parseChromaUrl("http://localhost:8000");
        expect(parsed).toEqual({ host: "localhost", port: 8000, ssl: false });
    });

    it("distanceToSimilarity converts cosine distance to similarity", () => {
        expect(distanceToSimilarity(0)).toBe(1);
        expect(distanceToSimilarity(0.2)).toBeCloseTo(0.8);
    });

    it("countLessonChunks reads from ChromaDB collection", async () => {
        mockGet.mockResolvedValueOnce({ ids: ["a", "b"] });
        const count = await countLessonChunks("course1", "lesson1");
        expect(count).toBe(2);
        expect(mockGet).toHaveBeenCalledWith({
            where: { lessonId: { $eq: "lesson1" } },
            include: []
        });
    });

    it("hasLessonChunks returns false when vector count is zero", async () => {
        mockGet.mockResolvedValueOnce({ ids: [] });
        expect(await hasLessonChunks("course1", "lesson1")).toBe(false);
    });
});

describe("queryChunks relevance fallback", () => {
    it("returns top chunks above min floor when all are below configured threshold", async () => {
        const { queryChunks } = await import("@/service/vector-store");
        mockCollection.query.mockResolvedValueOnce({
            ids: [["chunk-0"]],
            documents: [["Neural network output layer explanation"]],
            metadatas: [[{ lessonId: "lesson1" }]],
            distances: [[0.38]]
        });

        const matches = await queryChunks({
            courseId: "course1",
            lessonId: "lesson1",
            queryEmbedding: [0.1, 0.2],
            relevanceThreshold: 0.7
        });

        expect(matches).toHaveLength(1);
        expect(matches[0].similarity).toBeCloseTo(0.62);
    });

    it("returns empty when top similarity is below min floor", async () => {
        const { queryChunks } = await import("@/service/vector-store");
        mockCollection.query.mockResolvedValueOnce({
            ids: [["chunk-0"]],
            documents: [["Unrelated text"]],
            metadatas: [[{ lessonId: "lesson1" }]],
            distances: [[0.7]]
        });

        const matches = await queryChunks({
            courseId: "course1",
            lessonId: "lesson1",
            queryEmbedding: [0.1, 0.2],
            relevanceThreshold: 0.7
        });

        expect(matches).toHaveLength(0);
    });
});
