// Integration test: POST /api/tutor/ask — within-context response (T016).
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

let student;
let instructor;
let course;
let lesson;

beforeEach(async () => {
    instructor = await seedUser({ role: "instructor", email: "inst@example.com" });
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

describe("POST /api/tutor/ask — within context (T016)", () => {
    it("returns 200 with cited answer and logs interaction", async () => {
        const req = buildJsonRequest("http://localhost/api/tutor/ask", {
            lessonId: lesson._id.toString(),
            courseId: course._id.toString(),
            question: "Where does photosynthesis occur?"
        });

        const res = await askPost(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data.contextStatus).toBe("answered");
        expect(json.data.answer).toContain("chloroplasts");
        expect(json.data.citation).toContain("Cell Biology");
        expect(json.data.detectedLanguage).toBe("en");
        expect(res.headers.get("X-RateLimit-Limit")).toBeTruthy();

        const logged = await TutorInteraction.findOne({
            studentId: student._id,
            lessonId: lesson._id
        }).lean();
        expect(logged).toBeTruthy();
        expect(logged.contextStatus).toBe("answered");
    });

    it("401 when unauthenticated", async () => {
        setLoggedInUser(null);
        const req = buildJsonRequest("http://localhost/api/tutor/ask", {
            lessonId: lesson._id.toString(),
            courseId: course._id.toString(),
            question: "Where does photosynthesis occur?"
        });
        const res = await askPost(req);
        expect(res.status).toBe(401);
    });
});
