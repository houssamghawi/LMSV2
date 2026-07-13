// Integration tests: Phase 9 polish — question length, performance budget, report route.
import { describe, it, expect, beforeEach, vi } from "vitest";
import "../helpers/auth-mock.js";
import { setLoggedInUser } from "../helpers/auth-mock.js";
import {
    seedUser,
    seedCourse,
    seedLesson,
    seedModule,
    seedEnrollment,
    seedTutorConfig,
    buildJsonRequest
} from "../helpers/fixtures.js";
import { TutorInteraction } from "@/model/tutor-interaction-model";
import { TUTOR_QUESTION_MAX_LENGTH } from "@/lib/constants";

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
            generateContent: vi.fn().mockResolvedValue({
                text: JSON.stringify({
                    answer: "Photosynthesis occurs in the chloroplasts of plant cells.",
                    citation: "Photosynthesis occurs in the chloroplasts of plant cells.",
                    isWithinContext: true,
                    isConversational: false,
                    detectedLanguage: "en"
                }),
                usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 18 }
            })
        }
    }))
}));

import { queryChunks } from "@/service/vector-store";

const { POST: askPost } = await import("@/app/api/tutor/ask/route.js");
const { POST: reportPost } = await import("@/app/api/tutor/report/route.js");

const RESPONSE_TIME_BUDGET_MS = 5000;

let student;
let course;
let lesson;

beforeEach(async () => {
    const instructor = await seedUser({ role: "instructor", email: "inst@example.com" });
    student = await seedUser({ role: "student", email: "student@example.com" });
    course = await seedCourse(instructor._id, { title: "Biology 101" });
    lesson = await seedLesson({
        title: "Cell Biology",
        description: "Photosynthesis occurs in the chloroplasts of plant cells."
    });
    await seedModule(course._id, [lesson._id]);
    await seedEnrollment(course._id, student._id);
    await seedTutorConfig();

    vi.mocked(queryChunks).mockResolvedValue([
        {
            id: `${lesson._id}_0`,
            document: "Photosynthesis occurs in the chloroplasts of plant cells.",
            metadata: {},
            similarity: 0.91
        }
    ]);

    setLoggedInUser({
        id: student._id.toString(),
        role: "student",
        email: student.email
    });
});

describe("POST /api/tutor/ask — polish (T054, T064)", () => {
    it("returns 400 QUESTION_TOO_LONG when question exceeds 1000 characters", async () => {
        const req = buildJsonRequest("http://localhost/api/tutor/ask", {
            lessonId: lesson._id.toString(),
            courseId: course._id.toString(),
            question: "x".repeat(TUTOR_QUESTION_MAX_LENGTH + 1)
        });

        const res = await askPost(req);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.success).toBe(false);
        expect(json.code).toBe("QUESTION_TOO_LONG");
        expect(json.error).toContain("1000");
    });

    it("records responseTimeMs within the 5-second budget (SC-001)", async () => {
        const req = buildJsonRequest("http://localhost/api/tutor/ask", {
            lessonId: lesson._id.toString(),
            courseId: course._id.toString(),
            question: "Where does photosynthesis occur?"
        });

        const res = await askPost(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);

        const logged = await TutorInteraction.findOne({
            studentId: student._id,
            lessonId: lesson._id
        }).lean();

        expect(logged?.metadata?.responseTimeMs).toBeTypeOf("number");
        expect(logged.metadata.responseTimeMs).toBeLessThanOrEqual(RESPONSE_TIME_BUDGET_MS);
    });
});

describe("POST /api/tutor/report — polish (Phase 8/9)", () => {
    it("creates a report for the student's own interaction", async () => {
        const askReq = buildJsonRequest("http://localhost/api/tutor/ask", {
            lessonId: lesson._id.toString(),
            courseId: course._id.toString(),
            question: "Where does photosynthesis occur?"
        });
        const askRes = await askPost(askReq);
        const askJson = await askRes.json();
        const interactionId = askJson.data.interactionId;

        const reportReq = buildJsonRequest("http://localhost/api/tutor/report", {
            interactionId,
            reason: "incorrect",
            details: "The citation does not match the video."
        });
        const reportRes = await reportPost(reportReq);
        const reportJson = await reportRes.json();

        expect(reportRes.status).toBe(201);
        expect(reportJson.success).toBe(true);
        expect(reportJson.data.reportId).toBeTruthy();
        expect(reportJson.data.message).toContain("reported");
    });
});
