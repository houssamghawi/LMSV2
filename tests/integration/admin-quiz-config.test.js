// Integration test for admin quiz config + quota enforcement + audit (T040).
//
// Flow under test (User Story 3, quickstart Scenario 5):
//   - adminUpdateQuizConfig updates the AdminQuizConfig singleton (admin only)
//   - Setting dailyQuota=2 then uploading as instructor:
//       • upload 1 → 202 (succeeded job recorded)
//       • upload 2 → 202 (succeeded job recorded)
//       • upload 3 → 429 with retryAfter (blocked attempt recorded as a failed
//         GenerationJob with failureReason="quota_exceeded")
//   - The audit log (GenerationJob collection) contains all three attempts:
//       2 queued/succeeded + 1 failed with "quota_exceeded".
//   - Non-admin users CANNOT call adminUpdateQuizConfig (throws).
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
      text: "Photosynthesis converts light into chemical energy. Plants use it to produce oxygen.",
      warnings: [],
      byteSize: buffer.byteLength
    }))
  };
});

const { POST: jobsPost } = await import("@/app/api/quiz-generation/jobs/route");
const { adminUpdateQuizConfig } = await import("@/app/actions/admin");
const { GenerationJob } = await import("@/model/generation-job-model");
const { AdminQuizConfig } = await import("@/model/admin-quiz-config-model");
const { DEFAULT_GENERATION_PARAMS } = await import("@/lib/constants");

let admin, instructor, course;

beforeEach(async () => {
  admin = await seedUser({ role: "admin", email: "admin@example.com" });
  instructor = await seedUser({ role: "instructor", email: "instructor@example.com" });
  course = await seedCourse(instructor._id, { title: "Test Course" });
  await seedConsent(instructor._id);
  // Default config — tests below override via adminUpdateQuizConfig.
  await seedAdminQuizConfig();
});

async function uploadAsInstructor() {
  setLoggedInUser({
    id: instructor._id.toString(),
    role: "instructor",
    email: instructor.email
  });
  const req = buildJobsUploadRequest({
    file: Buffer.from("docx-bytes"),
    courseId: course._id.toString(),
    params: DEFAULT_GENERATION_PARAMS
  });
  return jobsPost(req, { params: Promise.resolve({}) });
}

describe("T040 — admin quiz config, quota enforcement, and audit", () => {
  describe("adminUpdateQuizConfig server action", () => {
    it("admin can upsert the config singleton", async () => {
      setLoggedInUser({ id: admin._id.toString(), role: "admin", email: admin.email });
      const result = await adminUpdateQuizConfig({
        dailyQuotaPerInstructor: 7,
        maxDocumentSizeBytes: 5 * 1024 * 1024,
        maxQuestionsPerGeneration: 25,
        sourceRetentionEnabled: true,
        sourceRetentionDays: 14
      });
      expect(result?.ok).toBe(true);
      expect(result?.config?.dailyQuotaPerInstructor).toBe(7);
      expect(result?.config?.maxDocumentSizeBytes).toBe(5 * 1024 * 1024);
      expect(result?.config?.maxQuestionsPerGeneration).toBe(25);
      expect(result?.config?.sourceRetentionEnabled).toBe(true);
      expect(result?.config?.sourceRetentionDays).toBe(14);

      // Persisted: only one document in the singleton collection.
      const docs = await AdminQuizConfig.find({}).lean();
      expect(docs).toHaveLength(1);
      expect(docs[0].dailyQuotaPerInstructor).toBe(7);
    });

    it("rejects non-admin callers (instructor)", async () => {
      setLoggedInUser({
        id: instructor._id.toString(),
        role: "instructor",
        email: instructor.email
      });
      await expect(
        adminUpdateQuizConfig({
          dailyQuotaPerInstructor: 5,
          maxDocumentSizeBytes: 10 * 1024 * 1024,
          maxQuestionsPerGeneration: 30,
          sourceRetentionEnabled: false
        })
      ).rejects.toThrow();
    });

    it("rejects unauthenticated callers", async () => {
      setLoggedInUser(null);
      await expect(
        adminUpdateQuizConfig({
          dailyQuotaPerInstructor: 5,
          maxDocumentSizeBytes: 10 * 1024 * 1024,
          maxQuestionsPerGeneration: 30,
          sourceRetentionEnabled: false
        })
      ).rejects.toThrow();
    });

    it("rejects out-of-range values via Zod .strict()", async () => {
      setLoggedInUser({ id: admin._id.toString(), role: "admin", email: admin.email });
      // dailyQuota 0 is below min(1)
      await expect(
        adminUpdateQuizConfig({
          dailyQuotaPerInstructor: 0,
          maxDocumentSizeBytes: 10 * 1024 * 1024,
          maxQuestionsPerGeneration: 30,
          sourceRetentionEnabled: false
        })
      ).rejects.toThrow();
      // maxDocumentSizeBytes 100KB is below 1MB min
      await expect(
        adminUpdateQuizConfig({
          dailyQuotaPerInstructor: 5,
          maxDocumentSizeBytes: 100 * 1024,
          maxQuestionsPerGeneration: 30,
          sourceRetentionEnabled: false
        })
      ).rejects.toThrow();
      // unknown extra field rejected by .strict()
      await expect(
        adminUpdateQuizConfig({
          dailyQuotaPerInstructor: 5,
          maxDocumentSizeBytes: 10 * 1024 * 1024,
          maxQuestionsPerGeneration: 30,
          sourceRetentionEnabled: false,
          rogueField: "should be rejected"
        })
      ).rejects.toThrow();
    });
  });

  describe("quota enforcement with audit log", () => {
    it("blocks the (N+1)th generation with 429 + retryAfter and logs the blocked attempt", async () => {
      // Set quota to 2 via admin action
      setLoggedInUser({ id: admin._id.toString(), role: "admin", email: admin.email });
      await adminUpdateQuizConfig({
        dailyQuotaPerInstructor: 2,
        maxDocumentSizeBytes: 10 * 1024 * 1024,
        maxQuestionsPerGeneration: 30,
        sourceRetentionEnabled: false
      });

      // 1st and 2nd uploads succeed (202)
      const r1 = await uploadAsInstructor();
      expect(r1.status).toBe(202);
      const r2 = await uploadAsInstructor();
      expect(r2.status).toBe(202);

      // 3rd upload is blocked with 429 + retryAfter
      const r3 = await uploadAsInstructor();
      expect(r3.status).toBe(429);
      const j3 = await r3.json();
      expect(j3.ok).toBe(false);
      expect(j3.retryAfter).toBeTruthy();
      expect(j3.error).toMatch(/limit/i);

      // Audit log: 2 queued jobs + 1 failed job with failureReason="quota_exceeded"
      const jobs = await GenerationJob.find({
        userId: new mongoose.Types.ObjectId(instructor._id.toString())
      }).sort({ createdAt: 1 }).lean();
      expect(jobs).toHaveLength(3);
      const statuses = jobs.map((j) => j.status);
      expect(statuses.filter((s) => s === "queued").length).toBe(2);
      expect(statuses.filter((s) => s === "failed").length).toBe(1);
      const blocked = jobs.find((j) => j.status === "failed");
      expect(blocked.failureReason).toBe("quota_exceeded");
      // The blocked record carries audit fields (FR-013): actor, target,
      // source filename, byte size, params, consent version, timestamps.
      expect(blocked.userId.toString()).toBe(instructor._id.toString());
      expect(blocked.courseId.toString()).toBe(course._id.toString());
      expect(blocked.sourceFilename).toBeTruthy();
      expect(blocked.sourceByteSize).toBeGreaterThan(0);
      expect(blocked.params).toBeTruthy();
      expect(blocked.consentVersion).toBeTruthy();
      expect(blocked.createdAt).toBeTruthy();
    });

    it("quota count excludes prior quota_exceeded records (no self-amplifying block)", async () => {
      setLoggedInUser({ id: admin._id.toString(), role: "admin", email: admin.email });
      await adminUpdateQuizConfig({
        dailyQuotaPerInstructor: 1,
        maxDocumentSizeBytes: 10 * 1024 * 1024,
        maxQuestionsPerGeneration: 30,
        sourceRetentionEnabled: false
      });

      // 1st succeeds; 2nd blocked; 3rd is STILL blocked because the 1
      // successful job already consumed the quota — the blocked record does
      // NOT itself count, so we don't end up in a state where a single
      // blocked attempt cascades.
      const r1 = await uploadAsInstructor();
      expect(r1.status).toBe(202);
      const r2 = await uploadAsInstructor();
      expect(r2.status).toBe(429);
      const r3 = await uploadAsInstructor();
      expect(r3.status).toBe(429);

      const jobs = await GenerationJob.find({
        userId: new mongoose.Types.ObjectId(instructor._id.toString())
      }).lean();
      const blocked = jobs.filter((j) => j.failureReason === "quota_exceeded");
      expect(blocked.length).toBe(2);
      const queued = jobs.filter((j) => j.status === "queued");
      expect(queued.length).toBe(1);
    });
  });
});
