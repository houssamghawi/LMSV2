/**
 * Shared constants used across UI and server
 * Single source of truth for configuration values
 */

// Upload limits
export const MAX_IMAGE_SIZE_MB = 5;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

export const MAX_VIDEO_SIZE_MB = 300;
export const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

// Allowed file types
export const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
];

export const ALLOWED_VIDEO_TYPES = [
    'video/mp4',
    'video/webm',
    'video/quicktime'
];

// ===========================================================================
// AI Quiz Generation from Lecture Notes (.docx) — specs/001-ai-quiz-from-docx
// ===========================================================================

// Version of the third-party AI processing consent text the user must
// acknowledge before triggering generation (FR-022). Bump when the consent
// text changes materially — users must re-acknowledge the new version.
export const AI_CONSENT_VERSION = "1.0.0";

// Gemini model used for quiz generation. Override at runtime with GEMINI_QUIZ_MODEL.
// gemini-1.5-* models were removed from the API; use 2.x flash models instead.
export const DEFAULT_QUIZ_MODEL = "gemini-2.5-flash";

// Tried in order when the configured model returns 404 (deprecated or unavailable).
export const GEMINI_QUIZ_MODEL_FALLBACKS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-flash-latest",
    "gemini-2.0-flash-001"
];

// Map retired model ids (still in old .env files) to a supported replacement.
export const GEMINI_DEPRECATED_MODEL_ALIASES = {
    "gemini-1.5-flash": "gemini-2.0-flash",
    "gemini-1.5-flash-latest": "gemini-2.0-flash",
    "gemini-1.5-flash-001": "gemini-2.0-flash",
    "gemini-1.5-flash-002": "gemini-2.0-flash",
    "gemini-1.5-pro": "gemini-2.5-flash",
    "gemini-1.5-pro-latest": "gemini-2.5-flash",
    "gemini-pro": "gemini-2.0-flash"
};

// Question types supported by the AI generator (subset of Question.type enum).
// "multi" is intentionally excluded — the generator emits single-correct MCQs
// as `single`, matching the data model's DraftQuestion sub-schema enum.
export const QUIZ_QUESTION_TYPES = ["single", "true_false", "short_answer"];

// Difficulty tags for AI-generated questions (FR-006).
export const QUIZ_DIFFICULTY_LEVELS = ["easy", "medium", "hard"];

// Default generation mix (data-model.md §1 params sub-schema, quickstart §1).
export const DEFAULT_GENERATION_PARAMS = {
    totalQuestions: 10,
    mcqCount: 5,
    trueFalseCount: 3,
    shortAnswerCount: 2,
    easyCount: 4,
    mediumCount: 4,
    hardCount: 2
};

// AdminQuizConfig singleton defaults (data-model.md §3).
export const DEFAULT_ADMIN_QUIZ_CONFIG = {
    dailyQuotaPerInstructor: 20,
    maxDocumentSizeBytes: 10 * 1024 * 1024, // 10 MB
    maxQuestionsPerGeneration: 30,
    sourceRetentionEnabled: false,
    sourceRetentionDays: 30
};

// Maximum length (chars) of a Short Answer student response (data-model.md §6).
export const SHORT_ANSWER_MAX_LENGTH = 2000;

// Maximum number of words allowed in a verbatim source-quote citation (FR-005).
export const SOURCE_QUOTE_MAX_WORDS = 30;

// Job lifecycle states (data-model.md §1, contracts §3).
export const GENERATION_JOB_STATUSES = ["queued", "running", "succeeded", "failed"];

// Instructor state on a draft question (data-model.md §1 DraftQuestion).
export const DRAFT_INSTRUCTOR_STATES = [
    "untouched",
    "edited",
    "approved",
    "rejected",
    "regenerated"
];

// Attempt status values (data-model.md §6).
export const ATTEMPT_STATUSES = [
    "in_progress",
    "submitted",
    "expired",
    "pending_grading"
];

// MIME type for .docx uploads (contracts §2).
export const DOCX_MIME_TYPE =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Polling interval for the generation-status client (quickstart §1 step 8).
export const GENERATION_POLL_INTERVAL_MS = 2000;

// ===========================================================================
// AI MCQ Complement for Existing Quizzes — specs/002-ai-mcq-complement
// ===========================================================================

// Number of options per generated MCQ (spec 002: exactly 4 options labeled A–D).
export const MCQ_OPTIONS_COUNT = 4;

// Default MCQ complement params (data-model.md §"MCQ Complement Params",
// contracts/mcq-complement-api.md §1). MCQ-only: trueFalse and shortAnswer
// are always 0; difficulty distribution defaults to a balanced 3/3/2 split
// for the default total of 8 MCQs.
export const DEFAULT_MCQ_COMPLEMENT_PARAMS = {
    totalQuestions: 8,
    mcqCount: 8,
    trueFalseCount: 0,
    shortAnswerCount: 0,
    easyCount: 3,
    mediumCount: 3,
    hardCount: 2
};

// Discriminator values for GenerationJob.jobType (data-model.md §1).
export const GENERATION_JOB_TYPES = ["full_quiz", "mcq_complement"];
