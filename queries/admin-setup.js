import "server-only";
import { dbConnect } from "@/service/mongo";
import { User } from "@/model/user-model";

/**
 * Check if any admin user exists
 * Returns true if at least one admin exists
 */
export async function hasAdminUser() {
    await dbConnect();
    try {
        const adminCount = await User.countDocuments({ role: 'admin' });
        return adminCount > 0;
    } catch (error) {
        console.error('Error checking admin users:', error);
        // On error, assume admin exists for safety
        return true;
    }
}

/**
 * Create the first admin user
 */
export async function createFirstAdmin(userData) {
    await dbConnect();
    try {
        // Double-check no admin exists
        const adminExists = await hasAdminUser();
        if (adminExists) {
            throw new Error('Admin setup is no longer available');
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email: userData.email });
        if (existingUser) {
            throw new Error('Email already registered');
        }

        // Create admin user
        const admin = await User.create({
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
            password: userData.password, // Already hashed
            role: 'admin',
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return {
            id: admin._id.toString(),
            email: admin.email,
            name: `${admin.firstName} ${admin.lastName}`,
            role: admin.role
        };
    } catch (error) {
        console.error('Error creating first admin:', error);
        throw error;
    }
}

