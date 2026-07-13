// Test fixtures: seed users, courses, and consent records used across the
// quiz-generation integration tests. Each helper writes to the in-memory
// MongoDB provided by tests/setup/test-db.js.
import mongoose from "mongoose";
import { User } from "@/model/user-model";
import { Course } from "@/model/course-model";
import { Lesson } from "@/model/lesson.model";
import { Module } from "@/model/module.model";
import { AIProcessingConsent } from "@/model/ai-consent-model";
import { AdminQuizConfig } from "@/model/admin-quiz-config-model";
import { TutorConfiguration } from "@/model/tutor-config-model";
import { enrollForCourse } from "@/queries/enrollments";
import { AI_CONSENT_VERSION, DEFAULT_ADMIN_QUIZ_CONFIG, DEFAULT_TUTOR_CONFIG } from "@/lib/constants";

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
// `file` is optional when `lessonId` points to a lesson with stored extractedText.
export function buildJobsUploadRequest({ file, filename = "lecture.docx", courseId, lessonId, params }) {
  const fd = new FormData();
  if (file != null) {
    fd.append("file", new Blob([file], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), filename);
  }
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

export function buildGetRequest(url, params = {}) {
  const u = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") {
      u.searchParams.set(key, String(value));
    }
  }
  return new Request(u.toString(), { method: "GET" });
}

export async function seedTutorInteraction({
  studentId,
  courseId,
  lessonId,
  overrides = {}
}) {
  const { TutorInteraction } = await import("@/model/tutor-interaction-model");
  return TutorInteraction.create({
    question: "Where does photosynthesis occur?",
    response: "Photosynthesis occurs in the chloroplasts.",
    citation: "Photosynthesis occurs in the chloroplasts.",
    contextStatus: "answered",
    detectedLanguage: "en",
    studentId,
    courseId,
    lessonId,
    ...overrides
  });
}

export async function seedLesson(overrides = {}) {
  const slug = overrides.slug || `lesson-${Math.random().toString(36).slice(2)}`;
  return Lesson.create({
    title: "Introduction",
    slug,
    order: 1,
    duration: 10,
    active: true,
    access: "private",
    description:
      "Photosynthesis occurs in the chloroplasts of plant cells.",
    ...overrides
  });
}

export async function seedModule(courseId, lessonIds = [], overrides = {}) {
  const slug = overrides.slug || `module-${Math.random().toString(36).slice(2)}`;
  return Module.create({
    title: "Module 1",
    slug,
    course: courseId,
    lessonIds,
    order: 0,
    active: true,
    ...overrides
  });
}

export async function seedEnrollment(courseId, studentId) {
  return enrollForCourse(courseId, studentId, "mockpay");
}

export async function seedTutorConfig(overrides = {}) {
  return TutorConfiguration.findOneAndUpdate(
    { courseId: overrides.courseId ?? null },
    {
      ...DEFAULT_TUTOR_CONFIG,
      updatedBy: new mongoose.Types.ObjectId(),
      ...overrides
    },
    { upsert: true, new: true }
  );
}
