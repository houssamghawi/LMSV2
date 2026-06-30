/**
 * Authorization and Ownership Verification Module
 * Centralized security checks for preventing IDOR vulnerabilities
 */

import "server-only";
import { dbConnect } from "@/service/mongo";
import { Course } from "@/model/course-model";
import { Module } from "@/model/module.model";
import { Lesson } from "@/model/lesson.model";
import mongoose from "mongoose";
import { ROLES } from "./permissions";

/**
 * Custom error for authorization failures
 */
export class AuthorizationError extends Error {
  constructor(message = 'Forbidden: You do not have permission to perform this action') {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
  }
}

/**
 * Check if user is admin
 */
export function isAdmin(user) {
  return user?.role === ROLES.ADMIN;
}

/**
 * Check if user is instructor
 */
export function isInstructor(user) {
  return user?.role === ROLES.INSTRUCTOR;
}

/**
 * Check if user is admin or instructor
 */
export function isAdminOrInstructor(user) {
  return isAdmin(user) || isInstructor(user);
}

/**
 * Assert user owns the course
 * @param {string} courseId - Course ObjectId
 * @param {string} userId - User ObjectId
 * @param {object} options - { allowAdmin: boolean, returnCourse: boolean }
 * @returns {Promise<Course|boolean>} - Course object if returnCourse=true, otherwise true
 * @throws {AuthorizationError} if user doesn't own the course
 */
export async function assertInstructorOwnsCourse(courseId, userId, options = {}) {
  const { allowAdmin = true, returnCourse = false } = options;
  
  await dbConnect();
  
  // Validate ObjectIds
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    throw new Error('Invalid course ID');
  }
  
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  
  // Fetch course with minimal fields
  const course = await Course.findById(courseId)
    .select('instructor')
    .lean();
  
  if (!course) {
    throw new Error('Course not found');
  }
  
  // Check ownership
  const isOwner = course.instructor.toString() === userId.toString();
  
  if (isOwner) {
    return returnCourse ? course : true;
  }
  // Not owner: allow only if caller passed allowAdmin (caller must have verified user is admin)
  if (allowAdmin) {
    return returnCourse ? course : true;
  }
  throw new AuthorizationError('Forbidden: You do not have permission to modify this course');
}

/**
 * Verify instructor owns course (returns boolean instead of throwing)
 * @param {string} courseId - Course ObjectId
 * @param {string} userId - User ObjectId
 * @param {object} user - User object with role
 * @returns {Promise<boolean>}
 */
export async function verifyInstructorOwnsCourse(courseId, userId, user = null) {
  await dbConnect();
  
  // Validate ObjectIds
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return false;
  }
  
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return false;
  }
  
  // Admin override
  if (user && isAdmin(user)) {
    return true;
  }
  
  // Fetch course with minimal fields
  const course = await Course.findById(courseId)
    .select('instructor')
    .lean();
  
  if (!course) {
    return false;
  }
  
  return course.instructor.toString() === userId.toString();
}

/**
 * Assert user owns the module (via course ownership)
 * @param {string} moduleId - Module ObjectId
 * @param {string} userId - User ObjectId
 * @param {object} user - User object with role (for admin check)
 * @returns {Promise<object>} - { module, course }
 * @throws {AuthorizationError} if user doesn't own the module
 */
export async function assertInstructorOwnsModule(moduleId, userId, user = null) {
  await dbConnect();
  
  // Validate ObjectIds
  if (!mongoose.Types.ObjectId.isValid(moduleId)) {
    throw new Error('Invalid module ID');
  }
  
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  
  // Admin override
  if (user && isAdmin(user)) {
    const module = await Module.findById(moduleId).select('course').lean();
    if (!module) {
      throw new Error('Module not found');
    }
    return { module, course: null };
  }
  
  // Fetch module with course reference
  const module = await Module.findById(moduleId)
    .select('course')
    .lean();
  
  if (!module) {
    throw new Error('Module not found');
  }
  
  // Fetch course to verify ownership
  const course = await Course.findById(module.course)
    .select('instructor')
    .lean();
  
  if (!course) {
    throw new Error('Course not found');
  }
  
  // Check ownership
  const isOwner = course.instructor.toString() === userId.toString();
  
  if (!isOwner) {
    throw new AuthorizationError('Forbidden: You do not have permission to modify this module');
  }
  
  return { module, course };
}

/**
 * Assert user owns the lesson (via module -> course ownership)
 * @param {string} lessonId - Lesson ObjectId
 * @param {string} userId - User ObjectId
 * @param {object} user - User object with role (for admin check)
 * @returns {Promise<object>} - { lesson, module, course }
 * @throws {AuthorizationError} if user doesn't own the lesson
 */
export async function assertInstructorOwnsLesson(lessonId, userId, user = null) {
  await dbConnect();
  
  // Validate ObjectIds
  if (!mongoose.Types.ObjectId.isValid(lessonId)) {
    throw new Error('Invalid lesson ID');
  }
  
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  
  // Admin override - return early without full chain verification
  if (user && isAdmin(user)) {
    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson) {
      throw new Error('Lesson not found');
    }
    return { lesson, module: null, course: null };
  }
  
  // Fetch lesson (minimal fields, we need to find its module)
  const lesson = await Lesson.findById(lessonId).lean();
  
  if (!lesson) {
    throw new Error('Lesson not found');
  }
  
  // Find module that contains this lesson
  const module = await Module.findOne({ lessonIds: lessonId })
    .select('course')
    .lean();
  
  if (!module) {
    throw new Error('Module not found for this lesson');
  }
  
  // Fetch course to verify ownership
  const course = await Course.findById(module.course)
    .select('instructor')
    .lean();
  
  if (!course) {
    throw new Error('Course not found');
  }
  
  // Check ownership
  const isOwner = course.instructor.toString() === userId.toString();
  
  if (!isOwner) {
    throw new AuthorizationError('Forbidden: You do not have permission to modify this lesson');
  }
  
  return { lesson, module, course };
}

/**
 * Batch verify ownership for multiple modules (for reorder operations)
 * @param {Array<string>} moduleIds - Array of module ObjectIds
 * @param {string} userId - User ObjectId
 * @param {object} user - User object with role
 * @returns {Promise<boolean>}
 */
export async function verifyOwnsAllModules(moduleIds, userId, user = null) {
  await dbConnect();
  
  // Admin override
  if (user && isAdmin(user)) {
    return true;
  }
  
  if (!moduleIds || moduleIds.length === 0) {
    return true;
  }
  
  // Fetch all modules with their course references
  const modules = await Module.find({ _id: { $in: moduleIds } })
    .select('course')
    .lean();
  
  if (modules.length !== moduleIds.length) {
    throw new Error('Some modules not found');
  }
  
  // Get unique course IDs
  const courseIds = [...new Set(modules.map(m => m.course.toString()))];
  
  // Fetch all courses to verify ownership
  const courses = await Course.find({ _id: { $in: courseIds } })
    .select('instructor')
    .lean();
  
  // Check all courses are owned by the user
  const allOwned = courses.every(
    course => course.instructor.toString() === userId.toString()
  );
  
  if (!allOwned) {
    throw new AuthorizationError('Forbidden: You do not have permission to modify one or more modules');
  }
  
  return true;
}

/**
 * Batch verify ownership for multiple lessons (for reorder operations)
 * @param {Array<string>} lessonIds - Array of lesson ObjectIds
 * @param {string} userId - User ObjectId
 * @param {object} user - User object with role
 * @returns {Promise<boolean>}
 */
export async function verifyOwnsAllLessons(lessonIds, userId, user = null) {
  await dbConnect();
  
  // Admin override
  if (user && isAdmin(user)) {
    return true;
  }
  
  if (!lessonIds || lessonIds.length === 0) {
    return true;
  }
  
  // Find all modules that contain these lessons
  const modules = await Module.find({ lessonIds: { $in: lessonIds } })
    .select('course lessonIds')
    .lean();
  
  if (!modules || modules.length === 0) {
    throw new Error('No modules found for these lessons');
  }
  
  // Get unique course IDs
  const courseIds = [...new Set(modules.map(m => m.course.toString()))];
  
  // Fetch all courses to verify ownership
  const courses = await Course.find({ _id: { $in: courseIds } })
    .select('instructor')
    .lean();
  
  // Check all courses are owned by the user
  const allOwned = courses.every(
    course => course.instructor.toString() === userId.toString()
  );
  
  if (!allOwned) {
    throw new AuthorizationError('Forbidden: You do not have permission to modify one or more lessons');
  }
  
  return true;
}

/**
 * Get course with ownership verification (for dashboard pages)
 * @param {string} courseId - Course ObjectId
 * @param {string} userId - User ObjectId
 * @param {object} user - User object with role
 * @returns {Promise<Course|null>} - Full course object or null if not found/unauthorized
 */
export async function getCourseWithOwnershipCheck(courseId, userId, user = null) {
  await dbConnect();
  
  // Validate ObjectIds
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return null;
  }
  
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }
  
  // Fetch course
  const course = await Course.findById(courseId).lean();
  
  if (!course) {
    return null;
  }
  
  // Admin can access all courses
  if (user && isAdmin(user)) {
    return course;
  }
  
  // Check ownership
  const isOwner = course.instructor.toString() === userId.toString();
  
  if (!isOwner) {
    return null;
  }
  
  return course;
}

