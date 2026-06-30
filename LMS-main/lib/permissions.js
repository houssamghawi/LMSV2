/**
 * Permission System - Single Source of Truth
 * Centralized role-based access control definitions
 */

export const ROLES = {
  ADMIN: 'admin',
  INSTRUCTOR: 'instructor',
  STUDENT: 'student',
};

export const PERMISSIONS = {
  // User Management
  USERS_VIEW: 'users:view',
  USERS_CREATE: 'users:create',
  USERS_EDIT: 'users:edit',
  USERS_DELETE: 'users:delete',
  USERS_CHANGE_ROLE: 'users:change_role',
  USERS_ACTIVATE: 'users:activate',
  
  // Course Management
  COURSES_VIEW_ALL: 'courses:view_all',
  COURSES_EDIT_ALL: 'courses:edit_all',
  COURSES_DELETE_ALL: 'courses:delete_all',
  COURSES_PUBLISH_ALL: 'courses:publish_all',
  
  // Own Course Management (for instructors)
  COURSES_VIEW_OWN: 'courses:view_own',
  COURSES_EDIT_OWN: 'courses:edit_own',
  COURSES_DELETE_OWN: 'courses:delete_own',
  COURSES_PUBLISH_OWN: 'courses:publish_own',
  
  // Category Management
  CATEGORIES_VIEW: 'categories:view',
  CATEGORIES_CREATE: 'categories:create',
  CATEGORIES_EDIT: 'categories:edit',
  CATEGORIES_DELETE: 'categories:delete',
  
  // Enrollment Management
  ENROLLMENTS_VIEW_ALL: 'enrollments:view_all',
  ENROLLMENTS_DELETE: 'enrollments:delete',
  
  // Review/Testimonial Management
  REVIEWS_VIEW_ALL: 'reviews:view_all',
  REVIEWS_APPROVE: 'reviews:approve',
  REVIEWS_DELETE: 'reviews:delete',
  
  // Analytics
  ANALYTICS_VIEW: 'analytics:view',
  
  // Admin Tools
  ADMIN_ACCESS: 'admin:access',
  AUDIT_LOG_VIEW: 'audit_log:view',
  EXPORT_DATA: 'export:data',
  BULK_ACTIONS: 'bulk:actions',
};

/**
 * Role-Permission Mapping
 * Defines what each role can do
 */
export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    // Full access to everything
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_EDIT,
    PERMISSIONS.USERS_DELETE,
    PERMISSIONS.USERS_CHANGE_ROLE,
    PERMISSIONS.USERS_ACTIVATE,
    PERMISSIONS.COURSES_VIEW_ALL,
    PERMISSIONS.COURSES_EDIT_ALL,
    PERMISSIONS.COURSES_DELETE_ALL,
    PERMISSIONS.COURSES_PUBLISH_ALL,
    PERMISSIONS.CATEGORIES_VIEW,
    PERMISSIONS.CATEGORIES_CREATE,
    PERMISSIONS.CATEGORIES_EDIT,
    PERMISSIONS.CATEGORIES_DELETE,
    PERMISSIONS.ENROLLMENTS_VIEW_ALL,
    PERMISSIONS.ENROLLMENTS_DELETE,
    PERMISSIONS.REVIEWS_VIEW_ALL,
    PERMISSIONS.REVIEWS_APPROVE,
    PERMISSIONS.REVIEWS_DELETE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ADMIN_ACCESS,
    PERMISSIONS.AUDIT_LOG_VIEW,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.BULK_ACTIONS,
  ],
  [ROLES.INSTRUCTOR]: [
    // Can manage own courses
    PERMISSIONS.COURSES_VIEW_OWN,
    PERMISSIONS.COURSES_EDIT_OWN,
    PERMISSIONS.COURSES_DELETE_OWN,
    PERMISSIONS.COURSES_PUBLISH_OWN,
  ],
  [ROLES.STUDENT]: [
    // No admin permissions
  ],
};

/**
 * Check if user has a specific permission
 */
export function hasPermission(userRole, permission) {
  if (!userRole || !permission) return false;
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(permission);
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(userRole, permissions) {
  if (!userRole || !permissions || permissions.length === 0) return false;
  return permissions.some(permission => hasPermission(userRole, permission));
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(userRole, permissions) {
  if (!userRole || !permissions || permissions.length === 0) return false;
  return permissions.every(permission => hasPermission(userRole, permission));
}

/**
 * Check if user is admin
 */
export function isAdmin(userRole) {
  return userRole === ROLES.ADMIN;
}

/**
 * Check if user is instructor
 */
export function isInstructor(userRole) {
  return userRole === ROLES.INSTRUCTOR;
}

/**
 * Check if user is student
 */
export function isStudent(userRole) {
  return userRole === ROLES.STUDENT;
}

/**
 * Require admin role - throws error if not admin
 */
export function requireAdmin(userRole) {
  if (!isAdmin(userRole)) {
    throw new Error('Unauthorized: Admin access required');
  }
}

/**
 * Require permission - throws error if user doesn't have permission
 */
export function requirePermission(userRole, permission) {
  if (!hasPermission(userRole, permission)) {
    throw new Error(`Unauthorized: Permission '${permission}' required`);
  }
}

