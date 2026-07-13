import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("@/service/vector-store", () => ({
    queryChunks: vi.fn(),
    getChunksByIds: vi.fn(async () => []),
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
import { askTutorQuestion, generateTutorResponse } from "@/service/ai-tutor";
import { DEFAULT_TUTOR_CONFIG } from "@/lib/constants";

let courseId;
let lessonId;
let studentId;

function mockGeminiResponse(payload) {
    const mockGenerate = vi.fn().mockResolvedValue({
        text: JSON.stringify({
            detectedLanguage: "en",
            isConversational: false,
            ...payload
        }),
        usageMetadata: {}
    });
    GoogleGenAI.mockImplementation(() => ({
        models: { generateContent: mockGenerate }
    }));
}

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

    vi.mocked(hasEmbeddedContent).mockResolvedValue(true);
    vi.mocked(queryChunks).mockReset();
    process.env.GEMINI_API_KEY = "test-key";
});

describe("generateTutorResponse", () => {
    it("parses a within-context Gemini JSON response", async () => {
        mockGeminiResponse({
            answer: "Photosynthesis occurs in the chloroplasts of plant cells.",
            citation: "Photosynthesis occurs in the chloroplasts of plant cells.",
            isWithinContext: true
        });

        const result = await generateTutorResponse({
            question: "Where does photosynthesis occur?",
            contextText: "Photosynthesis occurs in the chloroplasts of plant cells.",
            lessonTitle: "Cell Biology",
            outOfContextMessage: "Not found.",
            responseLanguage: "en",
            conversationBlock: "(no prior messages in this conversation)"
        });

        expect(result.isWithinContext).toBe(true);
        expect(result.answer).toContain("chloroplasts");
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

        mockGeminiResponse({
            answer: "Photosynthesis occurs in the chloroplasts of plant cells.",
            citation: "Photosynthesis occurs in the chloroplasts of plant cells.",
            isWithinContext: true
        });

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

    it("returns out_of_context when the model rejects an unrelated question", async () => {
        vi.mocked(queryChunks).mockResolvedValue([]);

        mockGeminiResponse({
            answer: DEFAULT_TUTOR_CONFIG.outOfContextMessage.en,
            citation: null,
            isWithinContext: false
        });

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

    it("accepts natural conversational replies without lecture retrieval", async () => {
        vi.mocked(queryChunks).mockResolvedValue([]);

        mockGeminiResponse({
            answer: "Hello. Ask me anything about this lesson.",
            citation: null,
            isWithinContext: true,
            isConversational: true
        });

        const result = await askTutorQuestion({
            question: "Hey, are you there?",
            lessonId,
            courseId,
            studentId
        });

        expect(result.contextStatus).toBe("answered");
        expect(result.answer).toContain("Ask me anything");
        expect(result.citation).toBeNull();
    });

    it("uses conversation history for follow-up style messages", async () => {
        vi.mocked(queryChunks).mockResolvedValue([
            {
                id: `${lessonId}_0`,
                document: "Photosynthesis occurs in the chloroplasts of plant cells.",
                metadata: {},
                similarity: 0.88
            }
        ]);

        mockGeminiResponse({
            answer: "Photosynthesis is the process plants use to convert light into energy in chloroplasts.",
            citation: "Photosynthesis occurs in the chloroplasts of plant cells.",
            isWithinContext: true,
            isConversational: true
        });

        const result = await askTutorQuestion({
            question: "I didn't get that, can you say it more simply?",
            lessonId,
            courseId,
            studentId,
            conversationHistory: [
                {
                    role: "student",
                    content: "What is photosynthesis?"
                },
                {
                    role: "tutor",
                    content: "Photosynthesis occurs in the chloroplasts of plant cells."
                }
            ]
        });

        expect(result.contextStatus).toBe("answered");
        expect(result.answer).toContain("Photosynthesis");
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
