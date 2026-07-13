import { z } from 'zod';
import {
  AI_CONSENT_VERSION,
  DEFAULT_GENERATION_PARAMS,
  DEFAULT_ADMIN_QUIZ_CONFIG,
  DEFAULT_MCQ_COMPLEMENT_PARAMS,
  SHORT_ANSWER_MAX_LENGTH,
  SOURCE_QUOTE_MAX_WORDS,
  QUIZ_QUESTION_TYPES,
  QUIZ_DIFFICULTY_LEVELS,
  DRAFT_INSTRUCTOR_STATES
} from './constants.js';

// User validation schemas
export const registerSchema = z.object({
  firstName: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters')
    .trim(),
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .trim(),
  email: z.string()
    .email('Invalid email address')
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be less than 100 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string()
    .min(1, 'Please confirm your password'),
  userRole: z.enum(['student', 'instructor'], {
    errorMap: () => ({ message: 'Role must be either student or instructor' })
  })
}).strict().refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
}).strict();

// Course validation schemas (strict: no role, active, instructor, etc.)
export const courseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  category: z.string().optional(),
  thumbnail: z.string().optional()
}).strict();

// Module validation schemas
export const moduleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  slug: z.string().optional(),
  courseId: z.string().min(1, 'Course ID is required'),
  order: z.number().int().min(0).optional()
}).strict();

// Lesson validation schemas
// description is optional — new lessons use .docx upload; legacy lessons may still have description.
export const lessonSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  slug: z.string().optional(),
  moduleId: z.string().min(1, 'Module ID is required'),
  order: z.number().int().min(0).optional(),
  description: z.string().max(5000).optional(),
  video_url: z.string().max(500).optional(),
  duration: z.number().int().min(0).optional(),
  access: z.enum(['private', 'public']).optional(),
  isFree: z.boolean().optional(),
  videoProvider: z.enum(['local', 'external']).optional(),
  videoFilename: z.string().max(500).optional(),
  videoUrl: z.string().max(500).optional(),
  videoMimeType: z.string().max(100).optional(),
  videoSize: z.number().int().min(0).optional()
}).strict();

// Lesson .docx upload (specs/004-docx-lesson-source/data-model.md)
export const lessonDocxUploadSchema = z.object({
  lessonId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid lesson ID format')
}).strict();

// Review validation schemas (strict: no courseId, userId, etc.)
export const reviewSchema = z.object({
  review: z.string().min(1, 'Review is required').max(1000),
  rating: z.number().int().min(1).max(5, 'Rating must be between 1 and 5')
}).strict();

// Password change validation
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password')
}).strict().refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

// Profile update validation (strict: no role, id, status - prevents privilege escalation)
export const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
  email: z.string().email('Invalid email address'),
  designation: z.string().max(100, 'Designation too long').optional().or(z.literal('')),
  bio: z.string().max(1000, 'Bio too long').optional().or(z.literal('')),
  profilePicture: z.string().max(500, 'Image URL too long').optional().or(z.literal('')),
  phone: z.string().max(20, 'Phone number too long').optional().or(z.literal(''))
}).strict();

// Avatar upload validation
export const avatarUploadSchema = z.object({
  file: z.instanceof(File, { message: 'File is required' })
    .refine((file) => file.size <= 5 * 1024 * 1024, 'File size must be less than 5MB')
    .refine(
      (file) => ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type),
      'File must be an image (JPEG, PNG, or WebP)'
    )
}).strict();

// Admin User Management Schemas
export const updateUserRoleSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['admin', 'instructor', 'student'], {
    errorMap: () => ({ message: 'Invalid role. Must be admin, instructor, or student' })
  })
}).strict();

export const updateUserStatusSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  status: z.enum(['active', 'inactive', 'suspended'], {
    errorMap: () => ({ message: 'Invalid status. Must be active, inactive, or suspended' })
  })
}).strict();

export const deleteUserSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  confirm: z.boolean().refine(val => val === true, 'Confirmation required')
}).strict();

export const bulkActionSchema = z.object({
  userIds: z.array(z.string()).min(1, 'At least one user ID is required'),
  action: z.enum(['activate', 'deactivate', 'delete', 'change_role']),
  role: z.enum(['admin', 'instructor', 'student']).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional()
}).strict().refine((data) => {
  if (data.action === 'change_role' && !data.role) {
    return false;
  }
  if ((data.action === 'activate' || data.action === 'deactivate') && !data.status) {
    return false;
  }
  return true;
}, {
  message: 'Missing required fields for this action'
});

// Admin Course Management Schemas
export const updateCourseStatusSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
  active: z.boolean()
}).strict();

export const deleteCourseSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
  confirm: z.boolean().refine(val => val === true, 'Confirmation required')
}).strict();

// Admin Category Schemas
export const createCategorySchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().max(500, 'Description too long').optional(),
  thumbnail: z.string().optional()
}).strict();

export const updateCategorySchema = z.object({
  categoryId: z.string().min(1, 'Category ID is required'),
  title: z.string().min(1, 'Title is required').max(100, 'Title too long').optional(),
  description: z.string().max(500, 'Description too long').optional(),
  thumbnail: z.string().optional()
}).strict();

// Admin Review/Testimonial Schemas
export const updateReviewStatusSchema = z.object({
  reviewId: z.string().min(1, 'Review ID is required'),
  approved: z.boolean()
}).strict();

export const deleteReviewSchema = z.object({
  reviewId: z.string().min(1, 'Review ID is required'),
  confirm: z.boolean().refine(val => val === true, 'Confirmation required')
}).strict();

// Admin Setup Schema
export const adminSetupSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  setupKey: z.string().min(1, 'Setup key is required')
}).strict();

// File upload validation
export const fileUploadSchema = z.object({
  destination: z.string().min(1, 'Destination is required'),
  courseId: z.string().optional()
}).strict();

// Payment/Checkout validation
export const checkoutSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required')
}).strict();

// Lesson watch API body (state transition: enrollment checked in route)
export const lessonWatchBodySchema = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
  lessonId: z.string().min(1, 'Lesson ID is required'),
  moduleSlug: z.string().min(1, 'Module slug is required'),
  state: z.enum(['started', 'completed']),
  lastTime: z.number().min(0).optional()
}).strict();

// Mock payment confirm API body (strict: no amount, userId, etc.)
export const mockPaymentConfirmSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
  simulateFailure: z.boolean().optional()
}).strict();

// Quiz create/update (strict: no courseId, createdBy, etc. - set server-side)
export const quizSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  published: z.boolean().optional(),
  required: z.boolean().optional(),
  passPercent: z.number().min(0).max(100).optional(),
  timeLimitSec: z.number().int().min(0).nullable().optional(),
  maxAttempts: z.number().int().min(0).nullable().optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  showAnswersPolicy: z.enum(['after_submit', 'after_deadline', 'never']).optional()
}).strict();

// Question option (for quiz questions)
const questionOptionSchema = z.object({
  id: z.string().optional(),
  text: z.string(),
  isCorrect: z.boolean().optional()
}).strict();

// Question create/update schema. Aligned with the Mongoose Question model
// enum: ["single", "multi", "true_false", "short_answer"]. Conditional
// validation enforces options/correctOptionIds per type (data-model.md §4).
export const questionSchema = z.object({
  type: z.enum(['single', 'multi', 'true_false', 'short_answer']),
  text: z.string().min(1),
  options: z.array(questionOptionSchema),
  correctOptionIds: z.array(z.string()).optional(),
  modelAnswer: z.string().max(SHORT_ANSWER_MAX_LENGTH).optional(),
  explanation: z.string().max(1000).optional(),
  sourceQuote: z.string().max(500).optional(),
  difficulty: z.enum(QUIZ_DIFFICULTY_LEVELS).optional(),
  points: z.number().int().min(0).optional()
}).strict().superRefine((data, ctx) => {
  if (data.type === 'short_answer') {
    if (data.options && data.options.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'short_answer questions must have no options',
        path: ['options']
      });
    }
    if (data.correctOptionIds && data.correctOptionIds.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'short_answer questions must have no correctOptionIds',
        path: ['correctOptionIds']
      });
    }
    if (!data.modelAnswer || data.modelAnswer.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'short_answer questions require a modelAnswer',
        path: ['modelAnswer']
      });
    }
  } else {
    if (!data.options || data.options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MCQ/TF questions must have at least 2 options',
        path: ['options']
      });
    }
    const optionIds = (data.options || []).map((o) => o.id).filter(Boolean);
    if (!data.correctOptionIds || data.correctOptionIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MCQ/TF questions must have at least one correctOptionId',
        path: ['correctOptionIds']
      });
    } else if (
      data.correctOptionIds.some((id) => !optionIds.includes(id))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'correctOptionIds must be a subset of option ids',
        path: ['correctOptionIds']
      });
    }
  }
});

// ===========================================================================
// AI Quiz Generation schemas (specs/001-ai-quiz-from-docx/contracts)
// ===========================================================================

// Consent check/acknowledge (contracts §1).
export const quizConsentSchema = z.object({
  consentVersion: z.string().min(1).max(50).optional(),
  action: z.enum(['check', 'acknowledge'])
}).strict();

// Generation params (contracts §2). Counts must sum to totalQuestions.
export const quizGenerationParamsSchema = z.object({
  totalQuestions: z.number().int().min(1).max(50),
  mcqCount: z.number().int().min(0),
  trueFalseCount: z.number().int().min(0),
  easyCount: z.number().int().min(0).optional(),
  mediumCount: z.number().int().min(0).optional(),
  hardCount: z.number().int().min(0).optional()
}).strict().superRefine((data, ctx) => {
  if (data.mcqCount + data.trueFalseCount !== data.totalQuestions) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'mcqCount + trueFalseCount must equal totalQuestions',
      path: ['mcqCount']
    });
  }
  const easy = data.easyCount ?? 0;
  const medium = data.mediumCount ?? 0;
  const hard = data.hardCount ?? 0;
  if (easy + medium + hard !== data.totalQuestions) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'easyCount + mediumCount + hardCount must equal totalQuestions',
      path: ['easyCount']
    });
  }
});

// Job creation body (multipart fields after parsing). Accepts string
// courseId/lessonId and numeric counts. The route handler merges in defaults.
export const createGenerationJobSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
  lessonId: z.string().min(1).optional(),
  params: quizGenerationParamsSchema.optional()
}).strict();

// Draft question update (contracts §4). Partial update of a DraftQuestion.
export const updateDraftQuestionSchema = z.object({
  type: z.enum(QUIZ_QUESTION_TYPES).optional(),
  difficulty: z.enum(QUIZ_DIFFICULTY_LEVELS).optional(),
  text: z.string().min(1).optional(),
  options: z.array(questionOptionSchema).optional(),
  correctOptionIds: z.array(z.string()).optional(),
  modelAnswer: z.string().max(SHORT_ANSWER_MAX_LENGTH).optional(),
  explanation: z.string().max(1000).optional(),
  sourceQuote: z.string().max(500).optional(),
  instructorState: z.enum(DRAFT_INSTRUCTOR_STATES).optional()
}).strict().superRefine((data, ctx) => {
  if (data.type === 'single' || data.type === 'true_false') {
    if (data.options && data.options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MCQ/TF questions must have at least 2 options',
        path: ['options']
      });
    }
    const optionIds = (data.options || []).map((o) => o.id).filter(Boolean);
    if (
      data.correctOptionIds &&
      data.correctOptionIds.length > 0 &&
      data.correctOptionIds.some((id) => !optionIds.includes(id))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'correctOptionIds must be a subset of option ids',
        path: ['correctOptionIds']
      });
    }
  }
});

// Regenerate request (contracts §5).
export const regenerateDraftSchema = z.object({
  scope: z.enum(['single', 'all']),
  draftId: z.string().min(1).optional(),
  params: quizGenerationParamsSchema.optional()
}).strict().superRefine((data, ctx) => {
  if (data.scope === 'single' && !data.draftId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'draftId is required when scope is "single"',
      path: ['draftId']
    });
  }
});

// Save draft as quiz (contracts §6).
export const saveDraftAsQuizSchema = z.object({
  courseId: z.string().min(1).optional(),
  lessonId: z.string().min(1).nullable().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  passPercent: z.number().min(0).max(100).optional(),
  timeLimitSec: z.number().int().min(0).nullable().optional(),
  maxAttempts: z.number().int().min(0).nullable().optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  showAnswersPolicy: z.enum(['never', 'after_submit', 'after_pass']).optional()
}).strict();

// Short-answer grading payload (contracts §7).
export const gradeShortAnswerSchema = z.object({
  awardedPoints: z.number().min(0),
  graderComment: z.string().max(1000).optional()
}).strict().superRefine((data, ctx) => {
  // awardedPoints upper bound (question.points) is validated in the action
  // where the question is loaded; here we only enforce the static floor.
  if (Number.isNaN(data.awardedPoints)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'awardedPoints must be a number',
      path: ['awardedPoints']
    });
  }
});

// Admin quiz config update (contracts §10).
export const adminQuizConfigSchema = z.object({
  dailyQuotaPerInstructor: z.number().int().min(1).max(1000),
  maxDocumentSizeBytes: z.number().int().min(1048576).max(52428800),
  maxQuestionsPerGeneration: z.number().int().min(1).max(50),
  sourceRetentionEnabled: z.boolean(),
  sourceRetentionDays: z.number().int().min(1).max(365).optional()
}).strict();

// ===========================================================================
// AI MCQ Complement schemas (specs/002-ai-mcq-complement/contracts)
// ===========================================================================

// MCQ-only generation params (contracts/mcq-complement-api.md §1).
// Stricter than quizGenerationParamsSchema: trueFalse and shortAnswer counts
// must be 0, and mcqCount must equal totalQuestions. The route merges
// DEFAULT_MCQ_COMPLEMENT_PARAMS before validation when the client omits params.
export const mcqComplementParamsSchema = z.object({
  totalQuestions: z.number().int().min(1).max(50),
  mcqCount: z.number().int().min(0),
  trueFalseCount: z.number().int().min(0),
  shortAnswerCount: z.number().int().min(0),
  easyCount: z.number().int().min(0).optional(),
  mediumCount: z.number().int().min(0).optional(),
  hardCount: z.number().int().min(0).optional()
}).strict().superRefine((data, ctx) => {
  if (data.trueFalseCount !== 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'MCQ complement jobs must have trueFalseCount === 0',
      path: ['trueFalseCount']
    });
  }
  if (data.shortAnswerCount !== 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'MCQ complement jobs must have shortAnswerCount === 0',
      path: ['shortAnswerCount']
    });
  }
  if (data.mcqCount !== data.totalQuestions) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'MCQ complement jobs must have mcqCount === totalQuestions',
      path: ['mcqCount']
    });
  }
  const easy = data.easyCount ?? 0;
  const medium = data.mediumCount ?? 0;
  const hard = data.hardCount ?? 0;
  if (easy + medium + hard !== data.totalQuestions) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'easyCount + mediumCount + hardCount must equal totalQuestions',
      path: ['easyCount']
    });
  }
});

// Start MCQ complement job (contracts §1). targetQuizId is required and
// triggers MCQ complement mode in the shared POST /api/quiz-generation/jobs
// route. Ownership and concurrent-job checks are enforced in the route.
export const startMcqComplementSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
  lessonId: z.string().min(1).optional(),
  targetQuizId: z.string().min(1, 'Target quiz ID is required'),
  params: mcqComplementParamsSchema.optional()
}).strict();

// Append approved MCQs to target quiz (contracts §5). confirmPublishedAppend
// must be true when the target quiz is published and has existing attempts;
// the route returns requiresConfirmation when the flag is missing in that case.
export const appendMcqsSchema = z.object({
  confirmPublishedAppend: z.boolean().optional()
}).strict();

// Re-export the consent version for callers that want a single import.
export {
  AI_CONSENT_VERSION,
  DEFAULT_GENERATION_PARAMS,
  DEFAULT_ADMIN_QUIZ_CONFIG,
  DEFAULT_MCQ_COMPLEMENT_PARAMS
};


