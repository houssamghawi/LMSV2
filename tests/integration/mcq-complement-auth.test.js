// Per-role authorization tests for MCQ complement endpoints (T015).
//
// Matrix under test (FR-012, SC-007):
//   - student:  403 on POST /jobs with targetQuizId and on POST /append
//   - instructor A (quiz owner): 202 on POST /jobs, 201 on POST /append
//   - instructor B (non-owner):  403 on POST /jobs with targetQuizId, 403 on POST /append
//   - unauthenticated: 401 on both endpoints
//
// OpenAI and mammoth are mocked so no external calls happen.
import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";

import "../helpers/auth-mock.js";
import { setLoggedInUser } from "../helpers/auth-mock.js";
import {
  seedUser,
  seedCourse,
  seedConsent,
  seedAdminQuizConfig,
  buildJobsUploadRequest,
  buildJsonRequest
} from "../helpers/fixtures.js";

import { Quiz } from "@/model/quizv2-model";
import { Question } from "@/model/questionv2-model";
import { GenerationJob } from "@/model/generation-job-model";

function buildValidMcq(id, text) {
  return {
    draftId: `mcq-${id}`,
    type: "single",
    difficulty: "easy",
    text,
    options: [
      { id: "a", text: "Oxygen" },
      { id: "b", text: "Carbon dioxide" },
      { id: "c", text: "Nitrogen" },
      { id: "d", text: "Hydrogen" }
    ],
    correctOptionIds: ["a"],
    modelAnswer: "",
    explanation: "Plants release oxygen as a byproduct of photosynthesis.",
    sourceQuote: "Photosynthesis converts light into chemical energy.",
    instructorState: "untouched"
  };
}

vi.mock("@/service/quiz-generator", () => ({
  generateQuizDraft: vi.fn(async (extractedText, params) => {
    const total = params?.totalQuestions ?? 8;
    const questions = Array.from({ length: total }, (_, i) =>
      buildValidMcq(i + 1, `MCQ ${i + 1} about photosynthesis?`)
    );
    return {
      questions,
      tokensInput: 100,
      tokensOutput: 50,
      model: "gemini-2.5-flash-mock",
      provider: "google-gemini"
    };
  })
}));

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
const { POST: appendPost } = await import("@/app/api/quiz-generation/jobs/[jobId]/append/route");
const { runGenerationJob } = await import("@/service/generation-orchestrator");

let instructorA, instructorB, admin, courseA, quizA;

beforeEach(async () => {
  instructorA = await seedUser({ role: "instructor", email: "a@example.com" });
  instructorB = await seedUser({ role: "instructor", email: "b@example.com" });
  admin = await seedUser({ role: "admin", email: "admin@example.com" });
  courseA = await seedCourse(instructorA._id, { title: "Course A" });
  await seedConsent(instructorA._id);
  await seedConsent(instructorB._id);
  await seedConsent(admin._id);
  await seedAdminQuizConfig();

  // Seed an existing quiz owned by instructor A on course A.
  quizA = await Quiz.create({
    courseId: courseA._id,
    title: "Owner Quiz",
    description: "",
    published: false,
    required: false,
    passPercent: 70,
    showAnswersPolicy: "after_submit",
    createdBy: instructorA._id,
    aiGenerated: false
  });
  await Question.create({
    quizId: quizA._id,
    type: "short_answer",
    text: "Explain photosynthesis.",
    options: [],
    correctOptionIds: [],
    modelAnswer: "Sample answer.",
    explanation: "",
    sourceQuote: "",
    difficulty: "medium",
    points: 1,
    order: 0
  });
});

function buildComplementUploadRequest(courseId, targetQuizId) {
  return buildJobsUploadRequest({
    file: Buffer.from("fake-docx-bytes"),
    courseId,
    params: {
      targetQuizId,
      totalQuestions: 8,
      mcqCount: 8,
      trueFalseCount: 0,
      shortAnswerCount: 0,
      easyCount: 3,
      mediumCount: 3,
      hardCount: 2
    }
  });
}

async function createSucceededComplementJobAsOwner() {
  setLoggedInUser({
    id: instructorA._id.toString(),
    role: "instructor",
    email: instructorA.email
  });
  const req = buildComplementUploadRequest(courseA._id.toString(), quizA._id.toString());
  const res = await jobsPost(req, { params: Promise.resolve({}) });
  const json = await res.json();
  await runGenerationJob(json.jobId);
  return json.jobId;
}

describe("T015 — per-role authorization for MCQ complement endpoints", () => {
  describe("POST /api/quiz-generation/jobs with targetQuizId", () => {
    it("401 when unauthenticated", async () => {
      setLoggedInUser(null);
      const req = buildComplementUploadRequest(courseA._id.toString(), quizA._id.toString());
      const res = await jobsPost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(401);
    });

    it("403 when student", async () => {
      const student = await seedUser({ role: "student", email: "student@example.com" });
      setLoggedInUser({ id: student._id.toString(), role: "student", email: student.email });
      const req = buildComplementUploadRequest(courseA._id.toString(), quizA._id.toString());
      const res = await jobsPost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(403);
    });

    it("403 when instructor does not own the target quiz", async () => {
      setLoggedInUser({
        id: instructorB._id.toString(),
        role: "instructor",
        email: instructorB.email
      });
      const req = buildComplementUploadRequest(courseA._id.toString(), quizA._id.toString());
      const res = await jobsPost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(403);
    });

    it("202 when instructor owns the target quiz", async () => {
      setLoggedInUser({
        id: instructorA._id.toString(),
        role: "instructor",
        email: instructorA.email
      });
      const req = buildComplementUploadRequest(courseA._id.toString(), quizA._id.toString());
      const res = await jobsPost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.jobType).toBe("mcq_complement");
      expect(json.targetQuizId).toBe(quizA._id.toString());
    });

    it("404 when targetQuizId does not reference an existing quiz", async () => {
      setLoggedInUser({
        id: instructorA._id.toString(),
        role: "instructor",
        email: instructorA.email
      });
      const fakeId = new mongoose.Types.ObjectId().toString();
      const req = buildComplementUploadRequest(courseA._id.toString(), fakeId);
      const res = await jobsPost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(404);
    });

    it("403 when targetQuizId references a quiz on a different course", async () => {
      // instructorB owns courseB; they try to complement a quiz that lives on
      // instructorA's course while sending courseB as courseId.
      const courseB = await seedCourse(instructorB._id, { title: "Course B" });
      setLoggedInUser({
        id: instructorB._id.toString(),
        role: "instructor",
        email: instructorB.email
      });
      const req = buildComplementUploadRequest(courseB._id.toString(), quizA._id.toString());
      const res = await jobsPost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(403);
    });

    it("202 when admin acts on any instructor's quiz", async () => {
      setLoggedInUser({ id: admin._id.toString(), role: "admin", email: admin.email });
      const req = buildComplementUploadRequest(courseA._id.toString(), quizA._id.toString());
      const res = await jobsPost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/quiz-generation/jobs/[jobId]/append", () => {
    it("401 when unauthenticated", async () => {
      const jobId = await createSucceededComplementJobAsOwner();
      setLoggedInUser(null);
      const req = buildJsonRequest(
        `http://localhost/api/quiz-generation/jobs/${jobId}/append`,
        { confirmPublishedAppend: false }
      );
      const res = await appendPost(req, { params: Promise.resolve({ jobId }) });
      expect(res.status).toBe(401);
    });

    it("403 when student", async () => {
      const jobId = await createSucceededComplementJobAsOwner();
      const student = await seedUser({ role: "student", email: "student2@example.com" });
      setLoggedInUser({ id: student._id.toString(), role: "student", email: student.email });
      const req = buildJsonRequest(
        `http://localhost/api/quiz-generation/jobs/${jobId}/append`,
        { confirmPublishedAppend: false }
      );
      const res = await appendPost(req, { params: Promise.resolve({ jobId }) });
      expect(res.status).toBe(403);
    });

    it("403 when instructor does not own the job", async () => {
      const jobId = await createSucceededComplementJobAsOwner();
      setLoggedInUser({
        id: instructorB._id.toString(),
        role: "instructor",
        email: instructorB.email
      });
      const req = buildJsonRequest(
        `http://localhost/api/quiz-generation/jobs/${jobId}/append`,
        { confirmPublishedAppend: false }
      );
      const res = await appendPost(req, { params: Promise.resolve({ jobId }) });
      expect(res.status).toBe(403);
    });

    it("201 when instructor owner appends approved MCQs", async () => {
      const jobId = await createSucceededComplementJobAsOwner();
      setLoggedInUser({
        id: instructorA._id.toString(),
        role: "instructor",
        email: instructorA.email
      });
      const req = buildJsonRequest(
        `http://localhost/api/quiz-generation/jobs/${jobId}/append`,
        { confirmPublishedAppend: false }
      );
      const res = await appendPost(req, { params: Promise.resolve({ jobId }) });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.appendedCount).toBe(8);
      expect(json.totalQuestionCount).toBe(9); // 1 SA + 8 MCQ
    });

    it("201 when admin appends any instructor's approved MCQs", async () => {
      const jobId = await createSucceededComplementJobAsOwner();
      setLoggedInUser({ id: admin._id.toString(), role: "admin", email: admin.email });
      const req = buildJsonRequest(
        `http://localhost/api/quiz-generation/jobs/${jobId}/append`,
        { confirmPublishedAppend: false }
      );
      const res = await appendPost(req, { params: Promise.resolve({ jobId }) });
      expect(res.status).toBe(201);
    });
  });
});
