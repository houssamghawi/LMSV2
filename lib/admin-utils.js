import "server-only";
import { auth } from "@/auth";
import { requireAdmin, requirePermission } from "./permissions";

/**
 * Get current user with admin check
 * Throws error if user is not admin
 */
export async function getAdminUser() {
    const session = await auth();
    if (!session?.user) {
        throw new Error('Unauthorized: Please log in');
    }
    
    requireAdmin(session.user.role);
    
    return session.user;
}

/**
 * Require admin permission for a specific action
 */
export async function requireAdminPermission(permission) {
    const session = await auth();
    if (!session?.user) {
        throw new Error('Unauthorized: Please log in');
    }
    
    requirePermission(session.user.role, permission);
    
    return session.user;
}

/**
 * Check if current user is admin (non-throwing)
 */
export async function checkIsAdmin() {
    try {
        const session = await auth();
        return session?.user?.role === 'admin';
    } catch {
        return false;
    }
}

