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

// Gemini 2.5 model used for quiz generation. Override at runtime with GEMINI_QUIZ_MODEL.
export const DEFAULT_QUIZ_MODEL = "gemini-2.5-flash";

// Tried in order when the primary model is unavailable (404/503) or rate-limited.
// Prefer flash-tier models — gemini-2.5-pro has no free-tier quota (limit: 0).
export const GEMINI_QUIZ_MODEL_FALLBACKS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash"
];

// Map retired model ids (still in old .env files) to Gemini 2.5 replacements.
export const GEMINI_DEPRECATED_MODEL_ALIASES = {
    "gemini-1.5-flash": "gemini-2.5-flash",
    "gemini-1.5-flash-latest": "gemini-2.5-flash",
    "gemini-1.5-flash-001": "gemini-2.5-flash",
    "gemini-1.5-flash-002": "gemini-2.5-flash",
    "gemini-1.5-pro": "gemini-2.5-pro",
    "gemini-1.5-pro-latest": "gemini-2.5-pro",
    "gemini-pro": "gemini-2.5-flash",
    "gemini-2.0-flash": "gemini-2.5-flash",
    "gemini-2.0-flash-001": "gemini-2.5-flash",
    "gemini-flash-latest": "gemini-2.5-flash"
};

// Question types supported by the AI generator (MCQ and True/False only).
export const QUIZ_QUESTION_TYPES = ["single", "true_false"];

// Difficulty tags for AI-generated questions (FR-006).
export const QUIZ_DIFFICULTY_LEVELS = ["easy", "medium", "hard"];

// Default generation mix (data-model.md §1 params sub-schema, quickstart §1).
export const DEFAULT_GENERATION_PARAMS = {
    totalQuestions: 10,
    mcqCount: 5,
    trueFalseCount: 5,
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

// ===========================================================================
// Context-Bound AI Tutor — specs/003-context-bound-ai-tutor
// ===========================================================================

export const TUTOR_QUESTION_MAX_LENGTH = 1000;
export const TUTOR_REPORT_DETAILS_MAX_LENGTH = 500;

export const TUTOR_CONTEXT_STATUSES = ["answered", "out_of_context"];
export const TUTOR_FEEDBACK_VALUES = ["helpful", "not_helpful"];
export const TUTOR_REPORT_REASONS = ["incorrect", "inappropriate", "other"];

// Chunking (research.md §2)
export const TUTOR_CHUNK_SIZE_TOKENS = 500;
export const TUTOR_CHUNK_OVERLAP_TOKENS = 50;
export const TUTOR_MIN_CHUNK_SIZE_TOKENS = 100;
export const TUTOR_CHARS_PER_TOKEN = 4;

// Retrieval (research.md §3)
export const TUTOR_TOP_K_CHUNKS = 5;
export const TUTOR_RELEVANCE_THRESHOLD = 0.55;
/** When no chunk clears relevanceThreshold, still return top hits at or above this floor. */
export const TUTOR_RELEVANCE_MIN_FLOOR = 0.5;
export const TUTOR_MAX_CONTEXT_TOKENS = 2000;

// Rate limiting default (research.md §9)
export const TUTOR_DEFAULT_RATE_LIMIT_PER_HOUR = 20;

// ChromaDB collection prefix (one collection per course)
export const CHROMA_COLLECTION_PREFIX = "lms_course_";

// Gemini models (research.md §2, §4)
export const TUTOR_EMBEDDING_MODEL = "gemini-embedding-001";
export const TUTOR_EMBEDDING_DIMENSIONS = 768;
export const DEFAULT_TUTOR_MODEL = "gemini-2.0-flash";
export const TUTOR_MODEL_FALLBACKS = ["gemini-2.5-flash", "gemini-2.0-flash"];

export const TUTOR_EMBEDDING_STATUSES = ["none", "pending", "ready", "failed"];

// ===========================================================================
// Lesson DOCX Upload — specs/004-docx-lesson-source
// ===========================================================================

export const MAX_LESSON_DOCX_SIZE_MB = 25;
export const MAX_LESSON_DOCX_SIZE = MAX_LESSON_DOCX_SIZE_MB * 1024 * 1024;

export const LESSON_UPLOAD_DIR = "uploads/lessons";
export const LESSON_IMAGES_DIR = "uploads/lesson-images";

// Whitelist for HTML sanitization of mammoth.convertToHtml output (research.md §5).
export const DOCX_ALLOWED_TAGS = [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "ul", "ol", "li",
    "table", "tr", "td", "th", "thead", "tbody",
    "strong", "em", "img", "a", "br", "sup", "sub"
];

export const DEFAULT_TUTOR_CONFIG = {
    courseId: null,
    outOfContextMessage: {
        en: "I cannot find the answer to your question in the lecture materials. Please refer to your instructor or course resources.",
        ar: "لا أستطيع العثور على إجابة لسؤالك في مواد المحاضرة. يرجى الرجوع إلى المدرس أو موارد الدورة."
    },
    enabled: true,
    rateLimitPerHour: TUTOR_DEFAULT_RATE_LIMIT_PER_HOUR,
    relevanceThreshold: TUTOR_RELEVANCE_THRESHOLD,
    maxContextChunks: TUTOR_TOP_K_CHUNKS
};
