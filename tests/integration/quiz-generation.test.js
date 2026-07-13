// Integration test for the quiz-generation flow (T016).
//
// Flow under test:
//   upload .docx → POST /api/quiz-generation/jobs (202 + jobId)
//   → runGenerationJob(jobId) [the after() callback body]
//   → GET /api/quiz-generation/jobs/{jobId} (succeeded + draft)
//   → PATCH a draft question (edit)
//   → POST /api/quiz-generation/jobs/{jobId}/save (201 + quizId)
//   → verify Quiz + Question documents in DB
//
// The OpenAI client and the mammoth extractor are mocked so the test exercises
// the full pipeline without external network calls or real .docx parsing.
import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";

import "../helpers/auth-mock.js";
import { setLoggedInUser } from "../helpers/auth-mock.js";
import {
  seedUser,
  seedCourse,
  seedConsent,
  seedAdminQuizConfig,
  seedLesson,
  seedModule,
  buildJobsUploadRequest,
  buildJsonRequest
} from "../helpers/fixtures.js";

import { Quiz } from "@/model/quizv2-model";
import { Question } from "@/model/questionv2-model";
import { GenerationJob } from "@/model/generation-job-model";
import { DEFAULT_GENERATION_PARAMS, AI_CONSENT_VERSION } from "@/lib/constants";

// Mock the Gemini-backed generator: return grounded questions matching the requested count.
vi.mock("@/service/quiz-generator", () => ({
  generateQuizDraft: vi.fn(async (extractedText, params) => {
    const total = params?.totalQuestions ?? 2;
    const mcqCount = params?.mcqCount ?? Math.ceil(total / 2);
    const tfCount = params?.trueFalseCount ?? (total - mcqCount);
    const questions = [];

    for (let i = 0; i < mcqCount; i++) {
      questions.push({
        draftId: `draft-mcq-${i + 1}`,
        type: "single",
        difficulty: "easy",
        text: `MCQ question ${i + 1}?`,
        options: [
          { id: "a", text: "A process" },
          { id: "b", text: "A plant" },
          { id: "c", text: "A color" },
          { id: "d", text: "An animal" }
        ],
        correctOptionIds: ["a"],
        modelAnswer: "",
        explanation: "Photosynthesis is a process.",
        sourceQuote: "Photosynthesis converts light into chemical energy.",
        instructorState: "untouched"
      });
    }

    for (let i = 0; i < tfCount; i++) {
      questions.push({
        draftId: `draft-tf-${i + 1}`,
        type: "true_false",
        difficulty: "medium",
        text: `True/false statement ${i + 1}.`,
        options: [
          { id: "t", text: "True" },
          { id: "f", text: "False" }
        ],
        correctOptionIds: ["t"],
        modelAnswer: "",
        explanation: "It releases oxygen.",
        sourceQuote: "Photosynthesis converts light into chemical energy.",
        instructorState: "untouched"
      });
    }

    return {
      questions: questions.slice(0, total),
      tokensInput: 100,
      tokensOutput: 50,
      model: "gemini-2.5-flash-mock",
      provider: "google-gemini"
    };
  })
}));

// Mock the docx extractor so we don't need a real .docx binary in the fixture.
vi.mock("@/service/docx-extractor", async () => {
  const real = await vi.importActual("@/service/docx-extractor");
  return {
    ...real,
    extractDocxText: vi.fn(async (buffer) => ({
      text: "Photosynthesis converts light into chemical energy. Plants use it to produce oxygen.",
      warnings: [],
      byteSize: buffer.byteLength
    }))
  };
});

const { POST: jobsPost } = await import("@/app/api/quiz-generation/jobs/route");
const { GET: jobGet } = await import("@/app/api/quiz-generation/jobs/[jobId]/route");
const { PATCH: draftPatch } = await import("@/app/api/quiz-generation/jobs/[jobId]/questions/[draftId]/route");
const { POST: savePost } = await import("@/app/api/quiz-generation/jobs/[jobId]/save/route");
const { runGenerationJob } = await import("@/service/generation-orchestrator");

let instructor;
let course;

beforeEach(async () => {
  instructor = await seedUser({ role: "instructor" });
  course = await seedCourse(instructor._id);
  await seedConsent(instructor._id);
  await seedAdminQuizConfig();
  setLoggedInUser({
    id: instructor._id.toString(),
    role: "instructor",
    email: instructor.email
  });
});

describe("T016 — quiz generation end-to-end flow", () => {
  it("creates a job, runs generation, returns draft via GET, saves as quiz", async () => {
    // 1. Upload .docx
    const uploadReq = buildJobsUploadRequest({
      file: Buffer.from("fake-docx-bytes"),
      courseId: course._id.toString(),
      params: {
        totalQuestions: 2,
        mcqCount: 1,
        trueFalseCount: 1,
        easyCount: 1,
        mediumCount: 1,
        hardCount: 0
      }
    });
    const uploadRes = await jobsPost(uploadReq, { params: Promise.resolve({}) });
    expect(uploadRes.status).toBe(200);
    const uploadJson = await uploadRes.json();
    expect(uploadJson.ok).toBe(true);
    expect(uploadJson.jobId).toBeTruthy();
    const jobId = uploadJson.jobId;

    // 2. Run the after() callback body
    await runGenerationJob(jobId);

    // 3. Poll status — should be succeeded with draft
    const getReq = buildJsonRequest(
      `http://localhost/api/quiz-generation/jobs/${jobId}`,
      null,
      "GET"
    );
    const getRes = await jobGet(getReq, { params: Promise.resolve({ jobId }) });
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get("Cache-Control")).toContain("no-store");
    const getJson = await getRes.json();
    expect(getJson.status).toBe("succeeded");
    expect(getJson.draftQuestions).toHaveLength(2);
    expect(getJson.draftQuestions[0].sourceQuote).toBeTruthy();

    // 4. Edit one draft question (mark edited)
    const draftId = getJson.draftQuestions[0].draftId;
    const patchReq = buildJsonRequest(
      `http://localhost/api/quiz-generation/jobs/${jobId}/questions/${draftId}`,
      { text: "What does photosynthesis convert light into?", instructorState: "edited" }
    );
    const patchRes = await draftPatch(patchReq, {
      params: Promise.resolve({ jobId, draftId })
    });
    expect(patchRes.status).toBe(200);
    const patchJson = await patchRes.json();
    expect(patchJson.instructorState).toBe("edited");

    // 5. Reject one draft (should be excluded from saved quiz)
    const rejectId = getJson.draftQuestions[1].draftId;
    const rejectReq = buildJsonRequest(
      `http://localhost/api/quiz-generation/jobs/${jobId}/questions/${rejectId}`,
      { instructorState: "rejected" }
    );
    const rejectRes = await draftPatch(rejectReq, {
      params: Promise.resolve({ jobId, draftId: rejectId })
    });
    expect(rejectRes.status).toBe(200);

    // 6. Save draft as quiz
    const saveReq = buildJsonRequest(
      `http://localhost/api/quiz-generation/jobs/${jobId}/save`,
      {
        courseId: course._id.toString(),
        title: "Chapter Photosynthesis Quiz",
        passPercent: 70
      }
    );
    const saveRes = await savePost(saveReq, { params: Promise.resolve({ jobId }) });
    expect(saveRes.status).toBe(201);
    const saveJson = await saveRes.json();
    expect(saveJson.ok).toBe(true);
    expect(saveJson.quizId).toBeTruthy();
    expect(saveJson.aiGenerated).toBe(true);
    const quizId = saveJson.quizId;

    // 7. Verify DB state: quiz + questions
    const quiz = await Quiz.findById(quizId).lean();
    expect(quiz).toBeTruthy();
    expect(quiz.aiGenerated).toBe(true);
    expect(quiz.published).toBe(false);
    expect(quiz.generationJobId.toString()).toBe(jobId);
    expect(quiz.title).toBe("Chapter Photosynthesis Quiz");

    const questions = await Question.find({ quizId: new mongoose.Types.ObjectId(quizId) }).lean();
    // 2 drafts minus the 1 rejected = 1 saved question
    expect(questions).toHaveLength(1);
    const types = questions.map((q) => q.type).sort();
    expect(types).toEqual(["single"]);
  });

  it("rejects empty extracted text with a 400 (FR-002)", async () => {
    // Override the extractor mock for this test only
    const { extractDocxText } = await import("@/service/docx-extractor");
    extractDocxText.mockResolvedValueOnce({ text: "", warnings: [], byteSize: 0 });

    const uploadReq = buildJobsUploadRequest({
      file: Buffer.from("empty-docx"),
      courseId: course._id.toString(),
      params: {
        totalQuestions: 2,
        mcqCount: 1,
        trueFalseCount: 1,
        easyCount: 1,
        mediumCount: 1,
        hardCount: 0
      }
    });
    const res = await jobsPost(uploadReq, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  it("records consent version and source hash on the job (audit)", async () => {
    const uploadReq = buildJobsUploadRequest({
      file: Buffer.from("docx-bytes"),
      courseId: course._id.toString(),
      params: DEFAULT_GENERATION_PARAMS
    });
    const res = await jobsPost(uploadReq, { params: Promise.resolve({}) });
    const { jobId } = await res.json();
    const job = await GenerationJob.findById(jobId).lean();
    expect(job.consentVersion).toBe(AI_CONSENT_VERSION);
    expect(job.sourceContentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(job.sourceFilename).toBe("lecture.docx");
  });
});

describe("T028 — quiz generation from lesson stored text (US4)", () => {
  it("generates from lesson extractedText without a file upload", async () => {
    const lesson = await seedLesson({
      docxFilename: `${new mongoose.Types.ObjectId()}.docx`,
      docxOriginalName: "lecture-upload.docx",
      docxSize: 4096,
      extractedText:
        "Photosynthesis converts light into chemical energy. Plants use it to produce oxygen."
    });
    await seedModule(course._id, [lesson._id]);

    const uploadReq = buildJobsUploadRequest({
      courseId: course._id.toString(),
      lessonId: lesson._id.toString(),
      params: DEFAULT_GENERATION_PARAMS
    });
    const res = await jobsPost(uploadReq, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.status).toBe("succeeded");
    expect(json.draftQuestions.length).toBeGreaterThan(0);

    const job = await GenerationJob.findById(json.jobId).lean();
    expect(job.lessonId.toString()).toBe(lesson._id.toString());
    expect(job.sourceFilename).toBe("lecture-upload.docx");
  });

  it("returns 400 when lesson has no extractedText and no file is uploaded", async () => {
    const lesson = await seedLesson();
    await seedModule(course._id, [lesson._id]);

    const uploadReq = buildJobsUploadRequest({
      courseId: course._id.toString(),
      lessonId: lesson._id.toString(),
      params: DEFAULT_GENERATION_PARAMS
    });
    const res = await jobsPost(uploadReq, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe("Lecture content must be uploaded first.");
  });
});
