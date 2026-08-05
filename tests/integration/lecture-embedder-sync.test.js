// Integration test: syncLessonEmbeddings pipeline (Phase 7).
import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import {
    seedUser,
    seedCourse,
    seedLesson,
    seedModule
} from "../helpers/fixtures.js";
import { Lesson } from "@/model/lesson.model";

let vectorChunkCount = 0;

vi.mock("@/service/vector-store", () => ({
    upsertChunks: vi.fn(async (_courseId, records) => {
        vectorChunkCount = records?.length ?? 0;
    }),
    deleteLessonChunks: vi.fn(async () => {
        vectorChunkCount = 0;
    }),
    isVectorStoreAvailable: vi.fn(async () => true),
    countLessonChunks: vi.fn(async () => vectorChunkCount),
    hasLessonChunks: vi.fn(async () => vectorChunkCount > 0)
}));

vi.mock("@google/genai", () => ({
    GoogleGenAI: vi.fn().mockImplementation(() => ({
        models: {
            embedContent: vi.fn(async ({ contents }) => ({
                embeddings: contents.map(() => ({ values: [0.1, 0.2, 0.3] }))
            }))
        }
    }))
}));

import { upsertChunks, deleteLessonChunks } from "@/service/vector-store";
import {
    syncLessonEmbeddings,
    extractLessonContent,
    getLessonEmbeddingStatus
} from "@/service/lecture-embedder";

let instructor;
let course;
let lesson;

beforeEach(async () => {
    vi.clearAllMocks();
    vectorChunkCount = 0;
    instructor = await seedUser({ role: "instructor" });
    course = await seedCourse(instructor._id);
    lesson = await seedLesson({
        description: "<p>Photosynthesis occurs in chloroplasts of plant cells.</p>"
    });
    await seedModule(course._id, [lesson._id]);
});

describe("syncLessonEmbeddings (Phase 7)", () => {
    it("embeds lesson description and marks lesson ready", async () => {
        const result = await syncLessonEmbeddings(
            lesson._id.toString(),
            course._id.toString()
        );

        expect(result.status).toBe("ready");
        expect(result.chunkCount).toBeGreaterThan(0);
        expect(upsertChunks).toHaveBeenCalled();

        const updated = await Lesson.findById(lesson._id).lean();
        expect(updated.tutorEmbeddingStatus).toBe("ready");
        expect(updated.tutorContentHash).toBeTruthy();
        expect(vectorChunkCount).toBeGreaterThan(0);
    });

    it("skips re-embedding when content hash is unchanged", async () => {
        await syncLessonEmbeddings(lesson._id.toString(), course._id.toString());
        vi.mocked(upsertChunks).mockClear();

        const second = await syncLessonEmbeddings(
            lesson._id.toString(),
            course._id.toString()
        );

        expect(second.skipped).toBe(true);
        expect(upsertChunks).not.toHaveBeenCalled();
    });

    it("re-embeds when status is ready but Chroma has no vectors", async () => {
        await syncLessonEmbeddings(lesson._id.toString(), course._id.toString());
        vectorChunkCount = 0;
        vi.mocked(upsertChunks).mockClear();

        const second = await syncLessonEmbeddings(
            lesson._id.toString(),
            course._id.toString()
        );

        expect(second.skipped).toBe(false);
        expect(upsertChunks).toHaveBeenCalled();
    });

    it("clears embeddings when description is emptied", async () => {
        await syncLessonEmbeddings(lesson._id.toString(), course._id.toString());

        await Lesson.findByIdAndUpdate(lesson._id, { description: "" });
        const result = await syncLessonEmbeddings(
            lesson._id.toString(),
            course._id.toString()
        );

        expect(result.status).toBe("none");
        expect(deleteLessonChunks).toHaveBeenCalled();
        expect(vectorChunkCount).toBe(0);
    });

    it("getLessonEmbeddingStatus reflects ready state", async () => {
        await syncLessonEmbeddings(lesson._id.toString(), course._id.toString());
        const status = await getLessonEmbeddingStatus(lesson._id.toString());
        expect(status.status).toBe("ready");
        expect(status.chunkCount).toBeGreaterThan(0);
    });

    it("embeds extractedText from uploaded file instead of description", async () => {
        await Lesson.findByIdAndUpdate(lesson._id, {
            docxFilename: `${lesson._id}.docx`,
            extractedText:
                "CRISPR gene editing enables precise modifications to DNA sequences in living cells.",
            description: "<p>Legacy description about unrelated photosynthesis content.</p>"
        });

        vi.mocked(upsertChunks).mockClear();
        const result = await syncLessonEmbeddings(
            lesson._id.toString(),
            course._id.toString()
        );

        expect(result.status).toBe("ready");
        expect(upsertChunks).toHaveBeenCalled();
        const chromaCall = vi.mocked(upsertChunks).mock.calls[0];
        const documents = chromaCall[1].map((r) => r.document).join(" ");
        expect(documents).toContain("CRISPR");
        expect(documents).not.toContain("photosynthesis");
    });
});

describe("extractLessonContent integration", () => {
    it("matches stored lesson description", () => {
        const content = extractLessonContent({
            description: lesson.description
        });
        expect(content).toContain("chloroplasts");
    });
});
