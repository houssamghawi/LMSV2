// Per-role authorization tests for quiz-generation endpoints (T017).
//
// Matrix under test (FR-021):
//   - student:  403 on every generation endpoint
//   - instructor A: allowed on own course; 403 on instructor B's course
//   - admin: allowed on any course
//   - unauthenticated: 401
//
// OpenAI and mammoth are mocked so no external calls happen.
import { describe, it, expect, beforeEach, vi } from "vitest";
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

vi.mock("@/service/quiz-generator", () => ({
  generateQuizDraft: vi.fn(async () => ({
    questions: [],
    tokensInput: 0,
    tokensOutput: 0,
    model: "gpt-4.1-mock",
    provider: "openai"
  }))
}));

vi.mock("@/service/docx-extractor", async () => {
  const real = await vi.importActual("@/service/docx-extractor");
  return {
    ...real,
    extractDocxText: vi.fn(async (buffer) => ({
      text: "Some text here for extraction.",
      warnings: [],
      byteSize: buffer.byteLength
    }))
  };
});

const { POST: jobsPost } = await import("@/app/api/quiz-generation/jobs/route");
const { GET: jobGet } = await import("@/app/api/quiz-generation/jobs/[jobId]/route");
const { POST: consentPost } = await import("@/app/api/quiz-generation/consent/route");
const { POST: savePost } = await import("@/app/api/quiz-generation/jobs/[jobId]/save/route");
const { runGenerationJob } = await import("@/service/generation-orchestrator");
const { GenerationJob } = await import("@/model/generation-job-model");
const { DEFAULT_GENERATION_PARAMS } = await import("@/lib/constants");

let instructorA, instructorB, admin, courseA, courseB;

beforeEach(async () => {
  instructorA = await seedUser({ role: "instructor", email: "a@example.com" });
  instructorB = await seedUser({ role: "instructor", email: "b@example.com" });
  admin = await seedUser({ role: "admin", email: "admin@example.com" });
  courseA = await seedCourse(instructorA._id, { title: "Course A" });
  courseB = await seedCourse(instructorB._id, { title: "Course B" });
  await seedConsent(instructorA._id);
  await seedConsent(instructorB._id);
  await seedConsent(admin._id);
  await seedAdminQuizConfig();
});

async function createJobAsInstructorA() {
  setLoggedInUser({ id: instructorA._id.toString(), role: "instructor", email: instructorA.email });
  const req = buildJobsUploadRequest({
    file: Buffer.from("docx"),
    courseId: courseA._id.toString(),
    params: DEFAULT_GENERATION_PARAMS
  });
  const res = await jobsPost(req, { params: Promise.resolve({}) });
  const json = await res.json();
  return json.jobId;
}

describe("T017 — per-role authorization for quiz-generation endpoints", () => {
  describe("POST /api/quiz-generation/consent", () => {
    it("401 when unauthenticated", async () => {
      setLoggedInUser(null);
      const req = buildJsonRequest("http://localhost/api/quiz-generation/consent", { action: "check" });
      const res = await consentPost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(401);
    });

    it("403 when student", async () => {
      const student = await seedUser({ role: "student", email: "student@example.com" });
      setLoggedInUser({ id: student._id.toString(), role: "student", email: student.email });
      const req = buildJsonRequest("http://localhost/api/quiz-generation/consent", { action: "check" });
      const res = await consentPost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(403);
    });

    it("200 when instructor", async () => {
      setLoggedInUser({ id: instructorA._id.toString(), role: "instructor", email: instructorA.email });
      const req = buildJsonRequest("http://localhost/api/quiz-generation/consent", { action: "check" });
      const res = await consentPost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
    });

    it("200 when admin", async () => {
      setLoggedInUser({ id: admin._id.toString(), role: "admin", email: admin.email });
      const req = buildJsonRequest("http://localhost/api/quiz-generation/consent", { action: "check" });
      const res = await consentPost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/quiz-generation/jobs", () => {
    it("401 when unauthenticated", async () => {
      setLoggedInUser(null);
      const req = buildJobsUploadRequest({
        file: Buffer.from("docx"),
        courseId: courseA._id.toString(),
        params: DEFAULT_GENERATION_PARAMS
      });
      const res = await jobsPost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(401);
    });

    it("403 when student", async () => {
      const student = await seedUser({ role: "student", email: "s2@example.com" });
      setLoggedInUser({ id: student._id.toString(), role: "student", email: student.email });
      const req = buildJobsUploadRequest({
        file: Buffer.from("docx"),
        courseId: courseA._id.toString(),
        params: DEFAULT_GENERATION_PARAMS
      });
      const res = await jobsPost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(403);
    });

    it("403 when instructor does not own the course", async () => {
      setLoggedInUser({ id: instructorB._id.toString(), role: "instructor", email: instructorB.email });
      const req = buildJobsUploadRequest({
        file: Buffer.from("docx"),
        courseId: courseA._id.toString(),
        params: DEFAULT_GENERATION_PARAMS
      });
      const res = await jobsPost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(403);
    });

    it("202 when instructor owns the course", async () => {
      setLoggedInUser({ id: instructorA._id.toString(), role: "instructor", email: instructorA.email });
      const req = buildJobsUploadRequest({
        file: Buffer.from("docx"),
        courseId: courseA._id.toString(),
        params: DEFAULT_GENERATION_PARAMS
      });
      const res = await jobsPost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(202);
    });

    it("202 when admin acts on any course", async () => {
      setLoggedInUser({ id: admin._id.toString(), role: "admin", email: admin.email });
      const req = buildJobsUploadRequest({
        file: Buffer.from("docx"),
        courseId: courseB._id.toString(),
        params: DEFAULT_GENERATION_PARAMS
      });
      const res = await jobsPost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(202);
    });
  });

  describe("GET /api/quiz-generation/jobs/[jobId]", () => {
    it("403 when instructor B reads instructor A's job", async () => {
      const jobId = await createJobAsInstructorA();
      setLoggedInUser({ id: instructorB._id.toString(), role: "instructor", email: instructorB.email });
      const req = buildJsonRequest(`http://localhost/api/quiz-generation/jobs/${jobId}`, null, "GET");
      const res = await jobGet(req, { params: Promise.resolve({ jobId }) });
      expect(res.status).toBe(403);
    });

    it("200 when admin reads any job", async () => {
      const jobId = await createJobAsInstructorA();
      setLoggedInUser({ id: admin._id.toString(), role: "admin", email: admin.email });
      const req = buildJsonRequest(`http://localhost/api/quiz-generation/jobs/${jobId}`, null, "GET");
      const res = await jobGet(req, { params: Promise.resolve({ jobId }) });
      expect(res.status).toBe(200);
    });

    it("200 when job owner reads own job", async () => {
      const jobId = await createJobAsInstructorA();
      setLoggedInUser({ id: instructorA._id.toString(), role: "instructor", email: instructorA.email });
      const req = buildJsonRequest(`http://localhost/api/quiz-generation/jobs/${jobId}`, null, "GET");
      const res = await jobGet(req, { params: Promise.resolve({ jobId }) });
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/quiz-generation/jobs/[jobId]/save", () => {
    it("403 when instructor B saves instructor A's job", async () => {
      const jobId = await createJobAsInstructorA();
      await runGenerationJob(jobId);
      // Patch the job to look succeeded for the save flow (orchestrator already set status)
      setLoggedInUser({ id: instructorB._id.toString(), role: "instructor", email: instructorB.email });
      const req = buildJsonRequest(`http://localhost/api/quiz-generation/jobs/${jobId}/save`, {
        courseId: courseA._id.toString(),
        title: "Stolen"
      });
      const res = await savePost(req, { params: Promise.resolve({ jobId }) });
      expect(res.status).toBe(403);
    });

    it("201 when admin saves any succeeded job", async () => {
      const jobId = await createJobAsInstructorA();
      await runGenerationJob(jobId);
      // Force succeeded with a draft for save (orchestrator mock produced empty questions;
      // manually inject one so save has something to persist).
      await GenerationJob.findByIdAndUpdate(jobId, {
        status: "succeeded",
        $push: {
          draftQuestions: {
            draftId: "d1",
            type: "single",
            difficulty: "easy",
            text: "Q?",
            options: [{ id: "a", text: "A" }, { id: "b", text: "B" }],
            correctOptionIds: ["a"],
            modelAnswer: "",
            explanation: "x",
            sourceQuote: "Some text here for extraction."
          }
        }
      });
      setLoggedInUser({ id: admin._id.toString(), role: "admin", email: admin.email });
      const req = buildJsonRequest(`http://localhost/api/quiz-generation/jobs/${jobId}/save`, {
        title: "Admin Saved"
      });
      const res = await savePost(req, { params: Promise.resolve({ jobId }) });
      expect(res.status).toBe(201);
    });
  });
});
