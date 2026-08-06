import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("@/service/vector-store", () => ({
    queryChunks: vi.fn(),
    isVectorStoreAvailable: vi.fn(async () => true)
}));

vi.mock("@/service/lecture-embedder", () => ({
    embedTexts: vi.fn(async () => [[0.1, 0.2, 0.3]]),
    hasEmbeddedContent: vi.fn(async () => true)
}));

vi.mock("@google/genai", () => ({
    GoogleGenAI: vi.fn().mockImplementation(() => ({
        models: {
            generateContent: vi.fn()
        }
    }))
}));

import { queryChunks } from "@/service/vector-store";
import { hasEmbeddedContent } from "@/service/lecture-embedder";
import { GoogleGenAI } from "@google/genai";
import { Lesson } from "@/model/lesson.model";
import { TutorConfiguration } from "@/model/tutor-config-model";
import { LectureChunk } from "@/model/lecture-chunk-model";
import { askTutorQuestion, generateTutorResponse } from "@/service/ai-tutor";
import { DEFAULT_TUTOR_CONFIG } from "@/lib/constants";

let courseId;
let lessonId;
let studentId;

beforeEach(async () => {
    courseId = new mongoose.Types.ObjectId().toString();
    studentId = new mongoose.Types.ObjectId().toString();
    lessonId = new mongoose.Types.ObjectId().toString();

    await TutorConfiguration.deleteMany({});
    await TutorConfiguration.create({
        ...DEFAULT_TUTOR_CONFIG,
        courseId: null
    });

    await Lesson.create({
        _id: lessonId,
        title: "Cell Biology",
        slug: `lesson-${lessonId}`,
        order: 1,
        duration: 10,
        active: true,
        access: "private",
        description: "Photosynthesis occurs in the chloroplasts of plant cells."
    });

    await LectureChunk.create({
        chromaId: `${lessonId}_0`,
        lessonId,
        courseId,
        chunkIndex: 0,
        startOffset: 0,
        endOffset: 100,
        tokenCount: 25,
        contentHash: "abc123"
    });

    vi.mocked(hasEmbeddedContent).mockResolvedValue(true);
    vi.mocked(queryChunks).mockReset();
});

describe("generateTutorResponse", () => {
    it("parses a within-context Gemini JSON response", async () => {
        const mockGenerate = vi.fn().mockResolvedValue({
            text: JSON.stringify({
                answer: "Photosynthesis occurs in the chloroplasts of plant cells.",
                citation: "Photosynthesis occurs in the chloroplasts of plant cells.",
                isWithinContext: true,
                detectedLanguage: "en"
            }),
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 }
        });
        GoogleGenAI.mockImplementation(() => ({
            models: { generateContent: mockGenerate }
        }));

        process.env.GEMINI_API_KEY = "test-key";

        const result = await generateTutorResponse({
            question: "Where does photosynthesis occur?",
            contextText: "Photosynthesis occurs in the chloroplasts of plant cells.",
            lessonTitle: "Cell Biology",
            outOfContextMessage: "Not found.",
            responseLanguage: "en"
        });

        expect(result.isWithinContext).toBe(true);
        expect(result.answer).toContain("chloroplasts");
        expect(result.tokensInput).toBe(10);
    });
});

describe("askTutorQuestion", () => {
    it("returns an answered interaction when retrieval finds relevant chunks", async () => {
        vi.mocked(queryChunks).mockResolvedValue([
            {
                id: `${lessonId}_0`,
                document: "Photosynthesis occurs in the chloroplasts of plant cells.",
                metadata: {},
                similarity: 0.92
            }
        ]);

        const mockGenerate = vi.fn().mockResolvedValue({
            text: JSON.stringify({
                answer: "Photosynthesis occurs in the chloroplasts of plant cells.",
                citation: "Photosynthesis occurs in the chloroplasts of plant cells.",
                isWithinContext: true,
                detectedLanguage: "en"
            }),
            usageMetadata: {}
        });
        GoogleGenAI.mockImplementation(() => ({
            models: { generateContent: mockGenerate }
        }));
        process.env.GEMINI_API_KEY = "test-key";

        const result = await askTutorQuestion({
            question: "Where does photosynthesis occur?",
            lessonId,
            courseId,
            studentId
        });

        expect(result.contextStatus).toBe("answered");
        expect(result.answer).toContain("chloroplasts");
        expect(result.citation).toContain("Cell Biology");
        expect(result.interactionId).toBeTruthy();
    });

    it("returns out_of_context when no chunks pass the relevance threshold", async () => {
        vi.mocked(queryChunks).mockResolvedValue([]);

        const result = await askTutorQuestion({
            question: "What is the capital of France?",
            lessonId,
            courseId,
            studentId
        });

        expect(result.contextStatus).toBe("out_of_context");
        expect(result.citation).toBeNull();
        expect(result.answer).toContain("lecture materials");
    });

    it("throws NO_LECTURE_CONTENT when lesson is not embedded", async () => {
        vi.mocked(hasEmbeddedContent).mockResolvedValue(false);

        await expect(
            askTutorQuestion({
                question: "Any question?",
                lessonId,
                courseId,
                studentId
            })
        ).rejects.toMatchObject({ code: "NO_LECTURE_CONTENT", status: 400 });
    });

    it("throws SERVICE_UNAVAILABLE with AI_SERVICE_ERROR when Gemini fails", async () => {
        vi.mocked(queryChunks).mockResolvedValue([
            {
                id: `${lessonId}_0`,
                document: "Photosynthesis occurs in the chloroplasts of plant cells.",
                metadata: {},
                similarity: 0.92
            }
        ]);

        GoogleGenAI.mockImplementation(() => ({
            models: {
                generateContent: vi.fn().mockRejectedValue(new Error("API down"))
            }
        }));
        process.env.GEMINI_API_KEY = "test-key";

        await expect(
            askTutorQuestion({
                question: "Where does photosynthesis occur?",
                lessonId,
                courseId,
                studentId
            })
        ).rejects.toMatchObject({
            code: "SERVICE_UNAVAILABLE",
            status: 503,
            logCode: "AI_SERVICE_ERROR"
        });
    });
});
