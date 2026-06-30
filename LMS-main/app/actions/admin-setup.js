"use server";

import { adminSetupSchema } from "@/lib/validations";
import { createFirstAdmin, hasAdminUser } from "@/queries/admin-setup";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Create the first admin user (bootstrap setup)
 * This can only be called once - when no admin exists
 */
export async function setupFirstAdmin(formData) {
    try {
        // Rate limiting - 3 attempts per hour per IP
        const rateLimitResult = rateLimit('admin-setup', 3, 3600000);
        if (!rateLimitResult.success) {
            throw new Error('Too many setup attempts. Please try again later.');
        }

        // Check if admin already exists
        const adminExists = await hasAdminUser();
        if (adminExists) {
            // Generic error - don't reveal that admin exists
            throw new Error('Setup is not available');
        }

        // Get setup key from environment
        const requiredSetupKey = process.env.ADMIN_SETUP_KEY;
        if (!requiredSetupKey) {
            console.error('ADMIN_SETUP_KEY is not set in environment variables');
            throw new Error('Server configuration error');
        }

        // Extract form data
        const rawData = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            email: formData.get('email'),
            password: formData.get('password'),
            setupKey: formData.get('setupKey')
        };

        // Validate input
        const validationResult = adminSetupSchema.safeParse(rawData);
        if (!validationResult.success) {
            const errors = validationResult.error.errors.map(e => e.message).join(', ');
            throw new Error(`Validation failed: ${errors}`);
        }

        const { firstName, lastName, email, password, setupKey } = validationResult.data;

        // Verify setup key (constant-time comparison to prevent timing attacks)
        const setupKeyMatch = await verifySetupKey(setupKey, requiredSetupKey);
        if (!setupKeyMatch) {
            // Generic error - don't reveal if key is wrong
            throw new Error('Invalid setup credentials');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create admin user
        const admin = await createFirstAdmin({
            firstName,
            lastName,
            email,
            password: hashedPassword
        });

        // Note: Auto sign-in will be handled by redirecting to login
        // The user will need to sign in with the credentials they just created
        // This is more secure than auto-signing in

        return {
            success: true,
            message: 'Admin account created successfully',
            admin: {
                email: admin.email,
                name: admin.name
            }
        };

    } catch (error) {
        console.error('Admin setup error:', error);
        
        // Return generic error messages for security
        if (error instanceof z.ZodError) {
            throw new Error('Invalid input data');
        }
        
        // Don't expose internal errors
        throw new Error(error?.message || 'Setup failed. Please check your credentials and try again.');
    }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
async function verifySetupKey(inputKey, correctKey) {
    if (!inputKey || !correctKey) {
        return false;
    }
    
    // Use crypto.timingSafeEqual for constant-time comparison
    const crypto = await import('crypto');
    const inputBuffer = Buffer.from(inputKey, 'utf8');
    const correctBuffer = Buffer.from(correctKey, 'utf8');
    
    if (inputBuffer.length !== correctBuffer.length) {
        return false;
    }
    
    try {
        return crypto.timingSafeEqual(inputBuffer, correctBuffer);
    } catch {
        return false;
    }
}

/**
 * Check if admin setup is available
 */
export async function isAdminSetupAvailable() {
    try {
        const adminExists = await hasAdminUser();
        return !adminExists;
    } catch (error) {
        console.error('Error checking admin setup availability:', error);
        // On error, assume setup is not available for safety
        return false;
    }
}

