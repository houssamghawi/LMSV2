// Integration test for the regeneration flows (T036, User Story 2).
//
// Flows under test:
//   1. single-question regenerate: POST /regenerate { scope: "single", draftId }
//      → runSingleQuestionRegeneration(jobId, draftId)
//      → only the targeted draft's content changes; others are untouched;
//        instructorState becomes "regenerated"; draftId is preserved.
//   2. full regenerate with new params: POST /regenerate { scope: "all", params }
//      → runGenerationJob(jobId)
//      → entire draft replaced with questions matching the new mix.
//   3. edit validation: PATCH with correctOptionIds that don't match option ids
//      → 400.
//
// OpenAI and mammoth are mocked. The quiz-generator mock returns different
// results on successive calls (mockImplementationOnce) so regeneration can be
// observed as a content change.
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

import { GenerationJob } from "@/model/generation-job-model";
import { DEFAULT_GENERATION_PARAMS } from "@/lib/constants";

// Initial generation: 2 questions (MCQ + TF) with grounded source quotes.
const INITIAL_QUESTIONS = [
  {
    draftId: "draft-mcq-1",
    type: "single",
    difficulty: "easy",
    text: "What is photosynthesis?",
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
  },
  {
    draftId: "draft-tf-1",
    type: "true_false",
    difficulty: "medium",
    text: "Photosynthesis produces oxygen.",
    options: [
      { id: "t", text: "True" },
      { id: "f", text: "False" }
    ],
    correctOptionIds: ["t"],
    modelAnswer: "",
    explanation: "It releases oxygen.",
    sourceQuote: "Photosynthesis converts light into chemical energy.",
    instructorState: "untouched"
  }
];

// Replacement for single-question regeneration of draft-mcq-1: new text, same
// type/difficulty, fresh content so the test can detect the swap.
const REGEN_SINGLE_QUESTIONS = [
  {
    draftId: "fresh-mcq-from-ai",
    type: "single",
    difficulty: "easy",
    text: "Which gas do plants release during photosynthesis?",
    options: [
      { id: "a", text: "Oxygen" },
      { id: "b", text: "Nitrogen" },
      { id: "c", text: "Hydrogen" },
      { id: "d", text: "Carbon dioxide" }
    ],
    correctOptionIds: ["a"],
    modelAnswer: "",
    explanation: "Plants release oxygen.",
    sourceQuote: "Photosynthesis converts light into chemical energy.",
    instructorState: "untouched"
  }
];

// Replacement for full regeneration with a new mix (2 MCQ + 1 TF).
const REGEN_ALL_QUESTIONS = [
  {
    draftId: "fresh-mcq-a",
    type: "single",
    difficulty: "easy",
    text: "What pigment captures light in plants?",
    options: [
      { id: "a", text: "Chlorophyll" },
      { id: "b", text: "Hemoglobin" },
      { id: "c", text: "Melanin" },
      { id: "d", text: "Keratin" }
    ],
    correctOptionIds: ["a"],
    modelAnswer: "",
    explanation: "Chlorophyll captures light.",
    sourceQuote: "Photosynthesis converts light into chemical energy.",
    instructorState: "untouched"
  },
  {
    draftId: "fresh-mcq-b",
    type: "single",
    difficulty: "medium",
    text: "Where does photosynthesis primarily occur?",
    options: [
      { id: "a", text: "Leaves" },
      { id: "b", text: "Roots" },
      { id: "c", text: "Stem" },
      { id: "d", text: "Flowers" }
    ],
    correctOptionIds: ["a"],
    modelAnswer: "",
    explanation: "In the leaves.",
    sourceQuote: "Photosynthesis converts light into chemical energy.",
    instructorState: "untouched"
  },
  {
    draftId: "fresh-tf-a",
    type: "true_false",
    difficulty: "hard",
    text: "Photosynthesis requires sunlight.",
    options: [
      { id: "t", text: "True" },
      { id: "f", text: "False" }
    ],
    correctOptionIds: ["t"],
    modelAnswer: "",
    explanation: "Light is required.",
    sourceQuote: "Photosynthesis converts light into chemical energy.",
    instructorState: "untouched"
  }
];

const generateQuizDraft = vi.fn();

vi.mock("@/service/quiz-generator", () => ({
  generateQuizDraft: (...args) => generateQuizDraft(...args),
  quizGenerationResponseSchema: { safeParse: (v) => ({ success: true, data: v }) },
  normalizeDraftQuestion: (q) => q,
  filterUngroundedQuestions: (qs) => qs
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
const { GET: jobGet } = await import("@/app/api/quiz-generation/jobs/[jobId]/route");
const { PATCH: draftPatch } = await import("@/app/api/quiz-generation/jobs/[jobId]/questions/[draftId]/route");
const { POST: regeneratePost } = await import("@/app/api/quiz-generation/jobs/[jobId]/regenerate/route");
const {
  runGenerationJob,
  runSingleQuestionRegeneration
} = await import("@/service/generation-orchestrator");

let instructor;
let course;

async function createSucceededJob() {
  generateQuizDraft.mockReset();
  generateQuizDraft.mockResolvedValueOnce({
    questions: INITIAL_QUESTIONS,
    tokensInput: 100,
    tokensOutput: 50,
    model: "gemini-2.5-flash-mock",
    provider: "google-gemini"
  });

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
  const { jobId } = await uploadRes.json();

  await runGenerationJob(jobId);
  return jobId;
}

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

describe("T036 — regeneration flows", () => {
  it("regenerates a single question while leaving the others untouched", async () => {
    const jobId = await createSucceededJob();

    const before = await GenerationJob.findById(jobId).lean();
    const targetDraftId = before.draftQuestions[0].draftId;
    const untouchedDraftId = before.draftQuestions[1].draftId;
    const originalUntouched = JSON.parse(JSON.stringify(before.draftQuestions[1]));
    const originalSecond = JSON.parse(JSON.stringify(before.draftQuestions[1]));

    // Stub the AI to return a single replacement question for this draft.
    generateQuizDraft.mockResolvedValueOnce({
      questions: REGEN_SINGLE_QUESTIONS,
      tokensInput: 30,
      tokensOutput: 20,
      model: "gemini-2.5-flash-mock",
      provider: "google-gemini"
    });

    const req = buildJsonRequest(
      `http://localhost/api/quiz-generation/jobs/${jobId}/regenerate`,
      { scope: "single", draftId: targetDraftId }
    );
    const res = await regeneratePost(req, { params: Promise.resolve({ jobId }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.status).toBe("succeeded");

    const after = await GenerationJob.findById(jobId).lean();
    expect(after.status).toBe("succeeded");
    expect(after.draftQuestions).toHaveLength(2);

    const replaced = after.draftQuestions.find((d) => d.draftId === targetDraftId);
    expect(replaced).toBeTruthy();
    // draftId is preserved; content is replaced.
    expect(replaced.text).toBe(REGEN_SINGLE_QUESTIONS[0].text);
    expect(replaced.options).toEqual(REGEN_SINGLE_QUESTIONS[0].options);
    expect(replaced.correctOptionIds).toEqual(["a"]);
    expect(replaced.instructorState).toBe("regenerated");

    // The other draft is byte-for-byte unchanged.
    const untouched = after.draftQuestions.find((d) => d.draftId === untouchedDraftId);
    expect(JSON.parse(JSON.stringify(untouched))).toEqual(originalUntouched);
    const second = after.draftQuestions.find((d) => d.draftId === originalSecond.draftId);
    expect(JSON.parse(JSON.stringify(second))).toEqual(originalSecond);

    // AI was called with a single-question mix matching the target's type+difficulty.
    expect(generateQuizDraft).toHaveBeenCalled();
    const lastCallArgs = generateQuizDraft.mock.calls.at(-1);
    const passedParams = lastCallArgs[1];
    expect(passedParams.totalQuestions).toBe(1);
    expect(passedParams.mcqCount).toBe(1);
    expect(passedParams.trueFalseCount).toBe(0);
    expect(passedParams.easyCount).toBe(1);
  });

  it("replaces the entire draft when regenerating all with new params", async () => {
    const jobId = await createSucceededJob();
    const previousDraftIds = (await GenerationJob.findById(jobId).lean()).draftQuestions.map(
      (d) => d.draftId
    );

    generateQuizDraft.mockResolvedValueOnce({
      questions: REGEN_ALL_QUESTIONS,
      tokensInput: 200,
      tokensOutput: 80,
      model: "gemini-2.5-flash-mock",
      provider: "google-gemini"
    });

    const newParams = {
      totalQuestions: 3,
      mcqCount: 2,
      trueFalseCount: 1,
      easyCount: 1,
      mediumCount: 1,
      hardCount: 1
    };
    const req = buildJsonRequest(
      `http://localhost/api/quiz-generation/jobs/${jobId}/regenerate`,
      { scope: "all", params: newParams }
    );
    const res = await regeneratePost(req, { params: Promise.resolve({ jobId }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.status).toBe("succeeded");

    const after = await GenerationJob.findById(jobId).lean();
    expect(after.status).toBe("succeeded");
    expect(after.draftQuestions).toHaveLength(3);
    expect(after.params.totalQuestions).toBe(3);
    expect(after.params.mcqCount).toBe(2);
    expect(after.params.trueFalseCount).toBe(1);

    // None of the previous draftIds should remain (draft replaced entirely).
    const newIds = after.draftQuestions.map((d) => d.draftId);
    for (const oldId of previousDraftIds) {
      expect(newIds).not.toContain(oldId);
    }
    // New mix: 2 MCQ + 1 TF.
    const types = after.draftQuestions.map((d) => d.type).sort();
    expect(types).toEqual(["single", "single", "true_false"]);

    // The AI must have been called with the new params.
    const lastCallArgs = generateQuizDraft.mock.calls.at(-1);
    expect(lastCallArgs[1]).toMatchObject(newParams);
  });

  it("rejects an edit where correctOptionIds do not match option ids", async () => {
    const jobId = await createSucceededJob();
    const job = await GenerationJob.findById(jobId).lean();
    const draftId = job.draftQuestions[0].draftId;

    // correctOptionIds references an id that is not in options.
    const req = buildJsonRequest(
      `http://localhost/api/quiz-generation/jobs/${jobId}/questions/${draftId}`,
      {
        options: [
          { id: "a", text: "A" },
          { id: "b", text: "B" }
        ],
        correctOptionIds: ["zzz"]
      }
    );
    const res = await draftPatch(req, {
      params: Promise.resolve({ jobId, draftId })
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  it("requires draftId when scope is single", async () => {
    const jobId = await createSucceededJob();
    const req = buildJsonRequest(
      `http://localhost/api/quiz-generation/jobs/${jobId}/regenerate`,
      { scope: "single" }
    );
    const res = await regeneratePost(req, { params: Promise.resolve({ jobId }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when regenerating a non-existent draftId", async () => {
    const jobId = await createSucceededJob();
    generateQuizDraft.mockResolvedValueOnce({
      questions: REGEN_SINGLE_QUESTIONS,
      tokensInput: 1,
      tokensOutput: 1,
      model: "gemini-2.5-flash-mock",
      provider: "google-gemini"
    });
    const req = buildJsonRequest(
      `http://localhost/api/quiz-generation/jobs/${jobId}/regenerate`,
      { scope: "single", draftId: "does-not-exist" }
    );
    const res = await regeneratePost(req, { params: Promise.resolve({ jobId }) });
    expect(res.status).toBe(404);
  });

  it("denies regeneration to a non-owner instructor", async () => {
    const jobId = await createSucceededJob();
    const other = await seedUser({ role: "instructor", email: "other@example.com" });
    setLoggedInUser({ id: other._id.toString(), role: "instructor", email: other.email });

    const req = buildJsonRequest(
      `http://localhost/api/quiz-generation/jobs/${jobId}/regenerate`,
      { scope: "all" }
    );
    const res = await regeneratePost(req, { params: Promise.resolve({ jobId }) });
    expect(res.status).toBe(403);
  });
});
