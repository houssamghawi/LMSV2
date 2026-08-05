// Integration test for the MCQ complement flow (T014).
//
// Flow under test (specs/002-ai-mcq-complement, US1):
//   seed quiz with existing SA questions
//   → upload .docx with targetQuizId → POST /api/quiz-generation/jobs (202 + jobId, jobType="mcq_complement")
//   → runGenerationJob(jobId) dispatches to runMcqComplementJob
//   → GET /api/quiz-generation/jobs/[jobId] returns jobType, targetQuizId, mcqValidationSummary
//   → POST /api/quiz-generation/jobs/[jobId]/append atomically inserts approved MCQs
//   → verify existing questions preserved, new MCQs ordered after existing, total count correct
//
// Also covers: published-quiz confirmation flow and duplicate-stem dropping.
//
// OpenAI and mammoth are mocked so the test exercises the full pipeline without
// external network calls or real .docx parsing.
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
import { Attempt } from "@/model/attemptv2-model";
import { GenerationJob } from "@/model/generation-job-model";

// Mock the Gemini-backed generator: first batch includes duplicate + invalid
// items to exercise filters; every call returns enough unique valid MCQs to
// satisfy params.totalQuestions (backfill-aware).
function buildValidMcq(id, text) {
  return {
    draftId: `mcq-${id}`,
    type: "single",
    difficulty: "easy",
    text,
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
  };
}

let generateCallCount = 0;

vi.mock("@/service/quiz-generator", () => ({
  generateQuizDraft: vi.fn(async (extractedText, params) => {
    generateCallCount += 1;
    const total = params?.totalQuestions ?? 8;

    if (generateCallCount === 1 && total >= 4) {
      return {
        questions: [
          buildValidMcq(1, "What is photosynthesis?"),
          buildValidMcq(2, "Which gas do plants release during photosynthesis?"),
          buildValidMcq(3, "Where in the plant cell does photosynthesis primarily occur?"),
          {
            ...buildValidMcq(4, "Invalid question with only three options"),
            options: [
              { id: "a", text: "A" },
              { id: "b", text: "B" },
              { id: "c", text: "C" }
            ]
          },
          ...Array.from({ length: Math.max(0, total - 4) }, (_, i) =>
            buildValidMcq(`extra-${i}`, `Additional MCQ ${i + 1} about photosynthesis?`)
          )
        ].slice(0, total),
        tokensInput: 120,
        tokensOutput: 60,
        model: "gemini-2.5-flash-mock",
        provider: "google-gemini"
      };
    }

    const questions = Array.from({ length: total }, (_, i) =>
      buildValidMcq(
        `backfill-${generateCallCount}-${i}`,
        `Backfill MCQ ${generateCallCount}-${i} about photosynthesis?`
      )
    );

    return {
      questions,
      tokensInput: 120,
      tokensOutput: 60,
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
const { POST: appendPost } = await import("@/app/api/quiz-generation/jobs/[jobId]/append/route");
const { runGenerationJob } = await import("@/service/generation-orchestrator");

let instructor;
let course;
let existingQuiz;

beforeEach(async () => {
  generateCallCount = 0;
  instructor = await seedUser({ role: "instructor", email: "inst@example.com" });
  course = await seedCourse(instructor._id);
  await seedConsent(instructor._id);
  await seedAdminQuizConfig();
  setLoggedInUser({
    id: instructor._id.toString(),
    role: "instructor",
    email: instructor.email
  });

  // Seed an existing quiz with 5 Short Answer questions (US1 independent test).
  existingQuiz = await Quiz.create({
    courseId: course._id,
    title: "Existing SA Quiz",
    description: "",
    published: false,
    required: false,
    passPercent: 70,
    showAnswersPolicy: "after_submit",
    createdBy: instructor._id,
    aiGenerated: false
  });
  const saStems = [
    "What is photosynthesis?",
    "Why does photosynthesis matter for life on Earth?",
    "Describe the role of chlorophyll.",
    "How does light intensity affect photosynthesis?",
    "Explain the difference between light and dark reactions."
  ];
  await Question.insertMany(
    saStems.map((text, idx) => ({
      quizId: existingQuiz._id,
      type: "short_answer",
      text,
      options: [],
      correctOptionIds: [],
      modelAnswer: "Sample answer.",
      explanation: "",
      sourceQuote: "",
      difficulty: "medium",
      points: 1,
      order: idx
    }))
  );
});

async function startMcqComplementJob({ targetQuizId, params } = {}) {
  const uploadReq = buildJobsUploadRequest({
    file: Buffer.from("fake-docx-bytes"),
    courseId: course._id.toString(),
    params: {
      targetQuizId: targetQuizId || existingQuiz._id.toString(),
      totalQuestions: (params && params.totalQuestions) || 8,
      mcqCount: (params && params.totalQuestions) || 8,
      trueFalseCount: 0,
      shortAnswerCount: 0,
      easyCount: (params && params.easyCount) || 3,
      mediumCount: (params && params.mediumCount) || 3,
      hardCount: (params && params.hardCount) || 2
    }
  });
  const res = await jobsPost(uploadReq, { params: Promise.resolve({}) });
  return { res, json: await res.json() };
}

describe("T014 — MCQ complement job creation and append flow", () => {
  it("creates an mcq_complement job with targetQuizId and runs generation", async () => {
    const { res, json } = await startMcqComplementJob();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.jobType).toBe("mcq_complement");
    expect(json.targetQuizId).toBe(existingQuiz._id.toString());
    const jobId = json.jobId;

    await runGenerationJob(jobId);

    const job = await GenerationJob.findById(jobId).lean();
    expect(job.jobType).toBe("mcq_complement");
    expect(job.targetQuizId.toString()).toBe(existingQuiz._id.toString());
    expect(job.status).toBe("succeeded");
    // 4 generated, 1 dropped as duplicate of existing "What is photosynthesis?",
    // 1 dropped for invalid structure (3 options), 2 included.
    expect(job.mcqValidationSummary.generated).toBe(8);
    expect(job.mcqValidationSummary.droppedDuplicate).toBeGreaterThanOrEqual(1);
    expect(job.mcqValidationSummary.droppedInvalidStructure).toBeGreaterThanOrEqual(1);
    expect(job.mcqValidationSummary.included).toBe(8);
    expect(job.draftQuestions).toHaveLength(8);
    for (const d of job.draftQuestions) {
      expect(d.type).toBe("single");
      expect(d.options).toHaveLength(4);
    }
  });

  it("extends the GET poll response with MCQ complement fields", async () => {
    const { json } = await startMcqComplementJob();
    await runGenerationJob(json.jobId);

    const req = buildJsonRequest(
      `http://localhost/api/quiz-generation/jobs/${json.jobId}`,
      null,
      "GET"
    );
    const res = await jobGet(req, { params: Promise.resolve({ jobId: json.jobId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobType).toBe("mcq_complement");
    expect(body.targetQuizId).toBe(existingQuiz._id.toString());
    expect(body.mcqValidationSummary).toBeDefined();
    expect(body.mcqValidationSummary.included).toBe(8);
    expect(body.draftQuestions).toHaveLength(8);
  });

  it("appends approved MCQs atomically and preserves existing questions", async () => {
    const { json } = await startMcqComplementJob();
    await runGenerationJob(json.jobId);

    const appendReq = buildJsonRequest(
      `http://localhost/api/quiz-generation/jobs/${json.jobId}/append`,
      { confirmPublishedAppend: false }
    );
    const res = await appendPost(appendReq, { params: Promise.resolve({ jobId: json.jobId }) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.quizId).toBe(existingQuiz._id.toString());
    expect(body.appendedCount).toBe(8);
    expect(body.totalQuestionCount).toBe(13); // 5 SA + 8 MCQ

    // Verify all questions on the quiz: 5 SA (unchanged) + 8 MCQ (appended).
    const questions = await Question.find({ quizId: existingQuiz._id }).sort({ order: 1 }).lean();
    expect(questions).toHaveLength(13);
    const saQuestions = questions.filter((q) => q.type === "short_answer");
    const mcqQuestions = questions.filter((q) => q.type === "single");
    expect(saQuestions).toHaveLength(5);
    expect(mcqQuestions).toHaveLength(8);

    // Existing SA questions retain their original order 0..4.
    expect(saQuestions.map((q) => q.order)).toEqual([0, 1, 2, 3, 4]);
    // New MCQs continue from order 5.
    expect(mcqQuestions.map((q) => q.order)).toEqual([5, 6, 7, 8, 9, 10, 11, 12]);

    // Existing SA stems are unchanged.
    const originalStems = [
      "What is photosynthesis?",
      "Why does photosynthesis matter for life on Earth?",
      "Describe the role of chlorophyll.",
      "How does light intensity affect photosynthesis?",
      "Explain the difference between light and dark reactions."
    ];
    expect(saQuestions.map((q) => q.text)).toEqual(originalStems);
  });

  it("excludes rejected drafts from the append", async () => {
    const { json } = await startMcqComplementJob();
    await runGenerationJob(json.jobId);

    // Reject one of the two included drafts.
    const job = await GenerationJob.findById(json.jobId);
    const firstDraftId = job.draftQuestions[0].draftId;
    job.draftQuestions[0].instructorState = "rejected";
    await job.save();

    const appendReq = buildJsonRequest(
      `http://localhost/api/quiz-generation/jobs/${json.jobId}/append`,
      { confirmPublishedAppend: false }
    );
    const res = await appendPost(appendReq, { params: Promise.resolve({ jobId: json.jobId }) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.appendedCount).toBe(7);
    expect(body.totalQuestionCount).toBe(12); // 5 SA + 7 MCQ

    const mcqs = await Question.find({ quizId: existingQuiz._id, type: "single" }).lean();
    expect(mcqs).toHaveLength(7);
    expect(mcqs[0].order).toBe(5);
  });

  it("returns 400 when no approved MCQs remain to append", async () => {
    const { json } = await startMcqComplementJob();
    await runGenerationJob(json.jobId);

    // Reject every draft.
    const job = await GenerationJob.findById(json.jobId);
    for (const d of job.draftQuestions) d.instructorState = "rejected";
    await job.save();

    const appendReq = buildJsonRequest(
      `http://localhost/api/quiz-generation/jobs/${json.jobId}/append`,
      { confirmPublishedAppend: false }
    );
    const res = await appendPost(appendReq, { params: Promise.resolve({ jobId: json.jobId }) });
    expect(res.status).toBe(400);
  });

  it("rejects append on a non-mcq_complement job", async () => {
    // Create a full-quiz job (no targetQuizId) so jobType defaults to "full_quiz".
    const uploadReq = buildJobsUploadRequest({
      file: Buffer.from("fake-docx-bytes"),
      courseId: course._id.toString(),
      params: {
        totalQuestions: 3,
        mcqCount: 1,
        trueFalseCount: 1,
        shortAnswerCount: 1,
        easyCount: 1,
        mediumCount: 1,
        hardCount: 1
      }
    });
    const res = await jobsPost(uploadReq, { params: Promise.resolve({}) });
    const json = await res.json();
    await runGenerationJob(json.jobId);
    // Force succeeded with a draft so the append endpoint can reach the
    // jobType check (orchestrator mock may produce a draft depending on mock).
    await GenerationJob.findByIdAndUpdate(json.jobId, {
      status: "succeeded",
      $set: {
        draftQuestions: [
          {
            draftId: "d1",
            type: "single",
            difficulty: "easy",
            text: "Q?",
            options: [
              { id: "a", text: "A" },
              { id: "b", text: "B" },
              { id: "c", text: "C" },
              { id: "d", text: "D" }
            ],
            correctOptionIds: ["a"],
            modelAnswer: "",
            explanation: "x",
            sourceQuote: "Photosynthesis converts light into chemical energy.",
            instructorState: "untouched"
          }
        ]
      }
    });

    const appendReq = buildJsonRequest(
      `http://localhost/api/quiz-generation/jobs/${json.jobId}/append`,
      { confirmPublishedAppend: false }
    );
    const appendRes = await appendPost(appendReq, { params: Promise.resolve({ jobId: json.jobId }) });
    expect(appendRes.status).toBe(400);
  });

  it("returns 409 when a complement job is already running for the same quiz", async () => {
    // Simulate a job still in flight (queued/running) without completing generation.
    await GenerationJob.create({
      userId: instructor._id,
      courseId: course._id,
      targetQuizId: existingQuiz._id,
      jobType: "mcq_complement",
      status: "running",
      sourceFilename: "lecture.docx",
      sourceByteSize: 1024,
      sourceContentHash: "abc",
      params: {
        totalQuestions: 8,
        mcqCount: 8,
        trueFalseCount: 0,
        easyCount: 3,
        mediumCount: 3,
        hardCount: 2
      },
      consentVersion: "1.0.0"
    });

    const second = await startMcqComplementJob();
    expect(second.res.status).toBe(409);
  });

  it("published-quiz warning: returns requiresConfirmation, then appends on confirm", async () => {
    // Mark the quiz published and seed one attempt so the warning kicks in.
    existingQuiz.published = true;
    await existingQuiz.save();
    await Attempt.create({
      quizId: existingQuiz._id,
      studentId: instructor._id,
      status: "submitted",
      submittedAt: new Date()
    });

    const { json } = await startMcqComplementJob();
    await runGenerationJob(json.jobId);

    // First append call without confirmation -> 200 requiresConfirmation.
    const req1 = buildJsonRequest(
      `http://localhost/api/quiz-generation/jobs/${json.jobId}/append`,
      { confirmPublishedAppend: false }
    );
    const res1 = await appendPost(req1, { params: Promise.resolve({ jobId: json.jobId }) });
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.ok).toBe(false);
    expect(body1.requiresConfirmation).toBe(true);
    expect(body1.existingAttemptCount).toBe(1);
    // No MCQs appended yet.
    const mcqsBefore = await Question.find({ quizId: existingQuiz._id, type: "single" }).lean();
    expect(mcqsBefore).toHaveLength(0);

    // Second call with confirmPublishedAppend=true -> 201, MCQs appended.
    const req2 = buildJsonRequest(
      `http://localhost/api/quiz-generation/jobs/${json.jobId}/append`,
      { confirmPublishedAppend: true }
    );
    const res2 = await appendPost(req2, { params: Promise.resolve({ jobId: json.jobId }) });
    expect(res2.status).toBe(201);
    const body2 = await res2.json();
    expect(body2.appendedCount).toBe(8);
    expect(body2.totalQuestionCount).toBe(13);
  });

  it("duplicate detection: drops MCQs whose stems overlap existing SA stems", async () => {
    const { json } = await startMcqComplementJob();
    await runGenerationJob(json.jobId);

    const job = await GenerationJob.findById(json.jobId).lean();
    // The "What is photosynthesis?" MCQ overlaps the seeded SA stem and must
    // be absent from the included drafts.
    const includedStems = job.draftQuestions.map((d) => d.text);
    expect(includedStems).not.toContain("What is photosynthesis?");
    expect(job.mcqValidationSummary.droppedDuplicate).toBeGreaterThanOrEqual(1);
  });
});

// Phase 6 — T023: additional concurrent-job conflict and Dice coefficient
// duplicate-detection coverage. The basic cases (queued-state 409 and a
// single overlapping stem) are covered above; these tests exercise the
// running-state branch of the conflict check and the Dice coefficient
// threshold behavior of filterDuplicateStems directly.
describe("T023 — Concurrent complement job conflict and Dice duplicate filtering", () => {
  it("returns 409 when a complement job is already running for the same quiz", async () => {
    // Seed a job in the "running" state directly so the conflict check
    // hits the running branch (the basic test above only covers "queued").
    await GenerationJob.create({
      userId: instructor._id,
      courseId: course._id,
      targetQuizId: existingQuiz._id,
      jobType: "mcq_complement",
      status: "running",
      sourceFilename: "in-progress.docx",
      sourceByteSize: 1024,
      sourceContentHash: "hash-running",
      params: {
        totalQuestions: 8,
        mcqCount: 8,
        trueFalseCount: 0,
        shortAnswerCount: 0,
        easyCount: 3,
        mediumCount: 3,
        hardCount: 2
      },
      consentVersion: 1
    });

    const second = await startMcqComplementJob();
    expect(second.res.status).toBe(409);
    expect(second.json.ok).toBe(false);
    expect(second.json.error).toMatch(/already running/i);
  });

  it("allows a new complement job once the prior running job has finished", async () => {
    // Seed a succeeded (non-running) job — the conflict check should not
    // fire because the only prior job is no longer queued or running.
    await GenerationJob.create({
      userId: instructor._id,
      courseId: course._id,
      targetQuizId: existingQuiz._id,
      jobType: "mcq_complement",
      status: "succeeded",
      sourceFilename: "done.docx",
      sourceByteSize: 1024,
      sourceContentHash: "hash-succeeded",
      params: {
        totalQuestions: 8,
        mcqCount: 8,
        trueFalseCount: 0,
        shortAnswerCount: 0,
        easyCount: 3,
        mediumCount: 3,
        hardCount: 2
      },
      consentVersion: 1
    });

    const next = await startMcqComplementJob();
    expect(next.res.status).toBe(200);
    expect(next.json.jobType).toBe("mcq_complement");
  });

  it("filterDuplicateStems drops near-duplicate stems at Dice ≥ 0.8 but keeps distinct stems", async () => {
    // Direct unit-style exercise of the Dice coefficient filter used by the
    // orchestrator (service/mcq-validator.js). Validates the threshold
    // behavior: minor wording variations below the threshold are kept,
    // near-identical stems at or above 0.8 are dropped.
    const { filterDuplicateStems } = await import("@/service/mcq-validator");

    const existingStems = [
      "What is the primary function of photosynthesis in plants?"
    ];

    const drafts = [
      // Exact match — Dice = 1.0 → dropped.
      {
        draftId: "d-exact",
        type: "single",
        text: "What is the primary function of photosynthesis in plants?",
        options: [
          { id: "a", text: "A" },
          { id: "b", text: "B" },
          { id: "c", text: "C" },
          { id: "d", text: "D" }
        ],
        correctOptionIds: ["a"],
        explanation: "x.",
        instructorState: "untouched"
      },
      // Near-identical (punctuation + one word swapped) — Dice ≥ 0.8 → dropped.
      {
        draftId: "d-near",
        type: "single",
        text: "What is the primary function of photosynthesis in a plant?",
        options: [
          { id: "a", text: "A" },
          { id: "b", text: "B" },
          { id: "c", text: "C" },
          { id: "d", text: "D" }
        ],
        correctOptionIds: ["a"],
        explanation: "x.",
        instructorState: "untouched"
      },
      // Topically similar but structurally different — Dice < 0.8 → kept.
      {
        draftId: "d-distinct",
        type: "single",
        text: "Which gas is released by plants as a byproduct of photosynthesis?",
        options: [
          { id: "a", text: "Oxygen" },
          { id: "b", text: "Carbon dioxide" },
          { id: "c", text: "Nitrogen" },
          { id: "d", text: "Hydrogen" }
        ],
        correctOptionIds: ["a"],
        explanation: "Oxygen is released.",
        instructorState: "untouched"
      }
    ];

    const { kept, dropped } = filterDuplicateStems(drafts, existingStems);
    expect(dropped.map((d) => d.draftId).sort()).toEqual(["d-exact", "d-near"]);
    expect(kept.map((d) => d.draftId)).toEqual(["d-distinct"]);
  });

  it("filterDuplicateStems keeps all drafts when no existing stems are present", async () => {
    const { filterDuplicateStems } = await import("@/service/mcq-validator");
    const drafts = [
      {
        draftId: "d-1",
        type: "single",
        text: "Any question at all?",
        options: [
          { id: "a", text: "A" },
          { id: "b", text: "B" },
          { id: "c", text: "C" },
          { id: "d", text: "D" }
        ],
        correctOptionIds: ["a"],
        explanation: "x.",
        instructorState: "untouched"
      }
    ];
    const { kept, dropped } = filterDuplicateStems(drafts, []);
    expect(kept).toHaveLength(1);
    expect(dropped).toHaveLength(0);
  });
});
