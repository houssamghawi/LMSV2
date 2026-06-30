import { z } from 'zod';

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

export const questionSchema = z.object({
  type: z.enum(['multiple_choice', 'true_false', 'multiple_select']),
  text: z.string().min(1),
  options: z.array(questionOptionSchema),
  correctOptionIds: z.array(z.string()).optional(),
  explanation: z.string().max(1000).optional(),
  points: z.number().int().min(0).optional()
}).strict();

