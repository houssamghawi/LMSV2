/**
 * Authentication Helper Functions
 * Server-side auth utilities for components, actions, and API routes
 */

import { auth } from "@/auth";
import { ROLES } from "@/lib/permissions";
import { redirect } from "next/navigation";

/**
 * Get the current authenticated user
 * Returns null if not authenticated
 * 
 * @returns {Promise<{id: string, email: string, name: string, role: string, status: string, image: string} | null>}
 */
export async function getCurrentUser() {
    const session = await auth();
    return session?.user || null;
}

/**
 * Require authentication - throws error or redirects if not authenticated
 * 
 * @param {boolean} redirectToLogin - If true, redirects to login instead of throwing
 * @returns {Promise<{id: string, email: string, name: string, role: string, status: string, image: string}>}
 */
export async function requireAuth(redirectToLogin = false) {
    const user = await getCurrentUser();
    
    if (!user) {
        if (redirectToLogin) {
            redirect('/login');
        }
        throw new Error('AUTH_REQUIRED: Authentication required');
    }

    // Check if user is active
    if (user.status && user.status !== 'active') {
        if (redirectToLogin) {
            redirect('/login?error=account_inactive');
        }
        throw new Error('FORBIDDEN: Account is inactive or suspended');
    }

    return user;
}

/**
 * Require specific role - throws error if user doesn't have the role
 * 
 * @param {string|string[]} roles - Required role(s)
 * @param {boolean} redirectToLogin - If true, redirects instead of throwing
 * @returns {Promise<{id: string, email: string, name: string, role: string, status: string, image: string}>}
 */
export async function requireRole(roles, redirectToLogin = false) {
    const user = await requireAuth(redirectToLogin);
    
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!requiredRoles.includes(user.role)) {
        if (redirectToLogin) {
            redirect('/');
        }
        throw new Error(`FORBIDDEN: ${requiredRoles.join(' or ')} role required`);
    }

    return user;
}

/**
 * Require admin role
 * 
 * @param {boolean} redirectToLogin - If true, redirects instead of throwing
 * @returns {Promise<{id: string, email: string, name: string, role: string, status: string, image: string}>}
 */
export async function requireAdmin(redirectToLogin = false) {
    return requireRole(ROLES.ADMIN, redirectToLogin);
}

/**
 * Require instructor or admin role
 * 
 * @param {boolean} redirectToLogin - If true, redirects instead of throwing
 * @returns {Promise<{id: string, email: string, name: string, role: string, status: string, image: string}>}
 */
export async function requireInstructorOrAdmin(redirectToLogin = false) {
    return requireRole([ROLES.INSTRUCTOR, ROLES.ADMIN], redirectToLogin);
}

/**
 * Check if user has specific role
 * 
 * @param {string} role - Role to check
 * @returns {Promise<boolean>}
 */
export async function hasRole(role) {
    const user = await getCurrentUser();
    return user?.role === role;
}

/**
 * Check if user is admin
 * 
 * @returns {Promise<boolean>}
 */
export async function isAdmin() {
    return hasRole(ROLES.ADMIN);
}

/**
 * Check if user is instructor
 * 
 * @returns {Promise<boolean>}
 */
export async function isInstructor() {
    return hasRole(ROLES.INSTRUCTOR);
}

/**
 * Check if user is student
 * 
 * @returns {Promise<boolean>}
 */
export async function isStudent() {
    return hasRole(ROLES.STUDENT);
}

/**
 * Check if user is active
 * 
 * @returns {Promise<boolean>}
 */
export async function isActive() {
    const user = await getCurrentUser();
    return user?.status === 'active';
}

