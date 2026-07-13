// Integration test: POST /api/tutor/ask — out-of-context response (T017).
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
import { DEFAULT_TUTOR_CONFIG } from "@/lib/constants";

vi.mock("@/service/vector-store", () => ({
    queryChunks: vi.fn(async () => []),
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
                    answer: "I cannot find the answer to your question in the lecture materials. Please refer to your instructor or course resources.",
                    citation: null,
                    isWithinContext: false,
                    isConversational: false,
                    detectedLanguage: "en"
                }),
                usageMetadata: {}
            })
        }
    }))
}));

const { POST: askPost } = await import("@/app/api/tutor/ask/route.js");

let student;
let instructor;
let course;
let lesson;

beforeEach(async () => {
    instructor = await seedUser({ role: "instructor", email: "inst2@example.com" });
    student = await seedUser({ role: "student", email: "student2@example.com" });
    course = await seedCourse(instructor._id, { title: "Biology 102" });
    lesson = await seedLesson({
        description: "Photosynthesis occurs in the chloroplasts of plant cells."
    });
    await seedModule(course._id, [lesson._id]);
    await seedEnrollment(course._id, student._id);
    await seedTutorConfig();

    setLoggedInUser({
        id: student._id.toString(),
        role: "student",
        email: student.email
    });
});

describe("POST /api/tutor/ask — out of context (T017)", () => {
    it("returns 200 with standardized out-of-context message when retrieval is empty", async () => {
        const req = buildJsonRequest("http://localhost/api/tutor/ask", {
            lessonId: lesson._id.toString(),
            courseId: course._id.toString(),
            question: "What is the capital of France?"
        });

        const res = await askPost(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data.contextStatus).toBe("out_of_context");
        expect(json.data.citation).toBeNull();
        expect(json.data.answer).toBe(
            DEFAULT_TUTOR_CONFIG.outOfContextMessage.en
        );
    });

    it("403 when student is not enrolled", async () => {
        const outsider = await seedUser({
            role: "student",
            email: "outsider@example.com"
        });
        setLoggedInUser({
            id: outsider._id.toString(),
            role: "student",
            email: outsider.email
        });

        const req = buildJsonRequest("http://localhost/api/tutor/ask", {
            lessonId: lesson._id.toString(),
            courseId: course._id.toString(),
            question: "Any question?"
        });

        const res = await askPost(req);
        const json = await res.json();

        expect(res.status).toBe(403);
        expect(json.code).toBe("NOT_ENROLLED");
    });

    it("400 when lesson has no embedded lecture content", async () => {
        const { hasEmbeddedContent } = await import("@/service/lecture-embedder");
        vi.mocked(hasEmbeddedContent).mockResolvedValueOnce(false);

        const req = buildJsonRequest("http://localhost/api/tutor/ask", {
            lessonId: lesson._id.toString(),
            courseId: course._id.toString(),
            question: "Any question?"
        });

        const res = await askPost(req);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.code).toBe("NO_LECTURE_CONTENT");
    });
});
