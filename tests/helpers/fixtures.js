// Test fixtures: seed users, courses, and consent records used across the
// quiz-generation integration tests. Each helper writes to the in-memory
// MongoDB provided by tests/setup/test-db.js.
import mongoose from "mongoose";
import { User } from "@/model/user-model";
import { Course } from "@/model/course-model";
import { AIProcessingConsent } from "@/model/ai-consent-model";
import { AdminQuizConfig } from "@/model/admin-quiz-config-model";
import { AI_CONSENT_VERSION, DEFAULT_ADMIN_QUIZ_CONFIG } from "@/lib/constants";

export async function seedUser(overrides = {}) {
  const defaults = {
    firstName: "Test",
    lastName: "User",
    email: `test-${Math.random().toString(36).slice(2)}@example.com`,
    password: "$2a$10$hashhashhashhashhashhashhashhashhashhashhashhash",
    role: "instructor",
    status: "active"
  };
  const user = await User.create({ ...defaults, ...overrides });
  return user;
}

export async function seedCourse(instructorId, overrides = {}) {
  const defaults = {
    title: "Test Course",
    description: "A test course",
    price: 0,
    active: true,
    instructor: instructorId
  };
  const course = await Course.create({ ...defaults, ...overrides });
  return course;
}

export async function seedConsent(userId, version = AI_CONSENT_VERSION) {
  return AIProcessingConsent.create({
    userId,
    consentVersion: version,
    acknowledgedAt: new Date()
  });
}

export async function seedAdminQuizConfig(overrides = {}) {
  return AdminQuizConfig.findOneAndUpdate(
    {},
    {
      ...DEFAULT_ADMIN_QUIZ_CONFIG,
      updatedBy: new mongoose.Types.ObjectId(),
      ...overrides
    },
    { upsert: true, new: true }
  );
}

// Build a multipart/form-data Request for the jobs upload endpoint.
// `docxBuffer` is sent as the `file` field with the given filename.
export function buildJobsUploadRequest({ file, filename = "lecture.docx", courseId, lessonId, params }) {
  const fd = new FormData();
  fd.append("file", new Blob([file], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), filename);
  fd.append("courseId", courseId);
  if (lessonId) fd.append("lessonId", lessonId);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      fd.append(k, String(v));
    }
  }
  return new Request("http://localhost/api/quiz-generation/jobs", {
    method: "POST",
    body: fd
  });
}

export function buildJsonRequest(url, body, method = "POST") {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body == null ? undefined : JSON.stringify(body)
  });
}
