"use server";

import { getAdminUser, requireAdminPermission } from "@/lib/admin-utils";
import {
    getUsers,
    getUserById,
    updateUserRole,
    updateUserStatus,
    deleteUser,
    bulkUpdateUsers
} from "@/queries/admin";
import {
    updateUserRoleSchema,
    updateUserStatusSchema,
    deleteUserSchema,
    bulkActionSchema
} from "@/lib/validations";
import { z } from "zod";
import { revalidatePath } from "next/cache";

/**
 * Get all users (admin only)
 * Always returns a stable data structure to prevent crashes
 */
export async function adminGetUsers(params) {
    try {
        await requireAdminPermission('users:view');
        const result = await getUsers(params);
        
        // Ensure stable structure
        return {
            users: result?.users || [],
            pagination: result?.pagination || {
                page: params?.page || 1,
                limit: params?.limit || 20,
                total: 0,
                totalPages: 0
            },
            error: result?.error || null
        };
    } catch (error) {
        console.error('Admin get users error:', error);
        // Return stable error structure instead of throwing
        return {
            users: [],
            pagination: {
                page: params?.page || 1,
                limit: params?.limit || 20,
                total: 0,
                totalPages: 0
            },
            error: error?.message || 'Failed to fetch users'
        };
    }
}

/**
 * Get user by ID (admin only)
 */
export async function adminGetUser(userId) {
    try {
        await requireAdminPermission('users:view');
        return await getUserById(userId);
    } catch (error) {
        console.error('Admin get user error:', error);
        throw new Error(error?.message || 'Failed to fetch user');
    }
}

/**
 * Update user role (admin only)
 */
export async function adminUpdateUserRole(userId, newRole) {
    try {
        await requireAdminPermission('users:change_role');
        
        const validation = updateUserRoleSchema.parse({ userId, role: newRole });
        
        const admin = await getAdminUser();
        
        // Convert IDs to strings for comparison
        const adminIdStr = admin.id?.toString();
        const userIdStr = validation.userId?.toString();
        
        const updatedUser = await updateUserRole(validation.userId, validation.role);
        
        // Prevent removing last admin
        if (updatedUser.role !== 'admin' && adminIdStr === userIdStr) {
            throw new Error('Cannot change role of the last admin');
        }
        
        revalidatePath('/admin/users');
        return { success: true, user: updatedUser };
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(error.errors.map(e => e.message).join(', '));
        }
        console.error('Admin update user role error:', error);
        throw new Error(error?.message || 'Failed to update user role');
    }
}

/**
 * Update user status (admin only)
 */
export async function adminUpdateUserStatus(userId, status) {
    try {
        await requireAdminPermission('users:activate');
        
        const validation = updateUserStatusSchema.parse({ userId, status });
        
        const admin = await getAdminUser();
        
        // Convert IDs to strings for comparison
        const adminIdStr = admin.id?.toString();
        const userIdStr = validation.userId?.toString();
        
        // Prevent deactivating yourself
        if (adminIdStr === userIdStr && validation.status !== 'active') {
            throw new Error('Cannot deactivate your own account');
        }
        
        const updatedUser = await updateUserStatus(validation.userId, validation.status);
        
        revalidatePath('/admin/users');
        return { success: true, user: updatedUser };
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(error.errors.map(e => e.message).join(', '));
        }
        console.error('Admin update user status error:', error);
        throw new Error(error?.message || 'Failed to update user status');
    }
}

/**
 * Delete user (admin only)
 */
export async function adminDeleteUser(userId) {
    try {
        await requireAdminPermission('users:delete');
        
        const validation = deleteUserSchema.parse({ userId, confirm: true });
        const admin = await getAdminUser();
        
        await deleteUser(validation.userId, admin.id);
        
        revalidatePath('/admin/users');
        return { success: true };
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(error.errors.map(e => e.message).join(', '));
        }
        console.error('Admin delete user error:', error);
        throw new Error(error?.message || 'Failed to delete user');
    }
}

/**
 * Bulk actions on users (admin only)
 */
export async function adminBulkAction(userIds, action, options = {}) {
    try {
        await requireAdminPermission('bulk:actions');
        
        const validation = bulkActionSchema.parse({
            userIds,
            action,
            ...options
        });
        
        const admin = await getAdminUser();
        
        // Prevent bulk actions on yourself
        const adminIdStr = admin.id?.toString();
        const userIdsStr = validation.userIds.map(id => id?.toString());
        
        if (userIdsStr.includes(adminIdStr)) {
            throw new Error('Cannot perform bulk actions on your own account');
        }
        
        let updates = {};
        
        switch (validation.action) {
            case 'activate':
                updates = { status: 'active' };
                break;
            case 'deactivate':
                updates = { status: 'inactive' };
                break;
            case 'change_role':
                if (!validation.role) {
                    throw new Error('Role is required for change_role action');
                }
                updates = { role: validation.role };
                break;
            case 'delete':
                // Delete users one by one to check safety rules
                for (const userId of validation.userIds) {
                    await deleteUser(userId, adminIdStr);
                }
                revalidatePath('/admin/users');
                return { success: true, modified: validation.userIds.length };
        }
        
        const result = await bulkUpdateUsers(validation.userIds, updates);
        
        revalidatePath('/admin/users');
        return result;
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(error.errors.map(e => e.message).join(', '));
        }
        console.error('Admin bulk action error:', error);
        throw new Error(error?.message || 'Failed to perform bulk action');
    }
}

