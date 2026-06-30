'use server'
import { signIn } from "@/auth";
import { getUserByEmail } from "@/queries/users";
import { getRedirectUrlByRole } from "@/lib/auth-redirect";
import { withActionErrorHandling } from "@/lib/action-wrapper";
import { createErrorResponse, createSuccessResponse, ERROR_CODES } from "@/lib/errors";
import { logAction } from "@/lib/logger";

/**
 * Login with credentials
 * Returns standardized response: { ok, message, data?, errorCode? }
 */
export const credentialLogin = withActionErrorHandling(
    async (formData) => {
        const logger = logAction('credentialLogin');
        logger.start();

        const email = formData.get("email");
        const password = formData.get("password");
        
        // Validation
        if (!email || !password) {
            throw new Error(`VALIDATION_ERROR: {"email": "Email and password are required"}`);
        }
        
        // Attempt sign in
        let response;
        try {
            response = await signIn("credentials", {
                email: email.toString(),
                password: password.toString(),
                redirect: false
            });
        } catch (signInError) {
            // Handle any unexpected errors from signIn
            throw new Error('AUTH_REQUIRED: Authentication failed. Please try again.');
        }
        
        // NextAuth returns { error: string } on failure, or undefined/null on success
        // When authorize returns null, NextAuth returns { error: "CredentialsSignin" }
        if (response?.error) {
            // Map NextAuth errors to user-friendly messages
            const errorMessage = response.error.toLowerCase();
            if (errorMessage.includes('credentials') || 
                errorMessage.includes('credentialsignin') ||
                errorMessage.includes('invalid')) {
                throw new Error('AUTH_REQUIRED: Invalid email or password');
            }
            // Generic auth error
            throw new Error('AUTH_REQUIRED: Invalid email or password');
        }
        
        // Get user role for redirect
        const user = await getUserByEmail(email.toString());
        if (!user) {
            throw new Error('NOT_FOUND: User not found after authentication');
        }
        
        const redirectUrl = user?.role ? getRedirectUrlByRole(user.role) : '/';
        
        logger.success();
        return {
            redirectUrl,
            role: user?.role
        };
    },
    {
        actionName: 'credentialLogin',
        // Don't revalidate paths on login (handled by NextAuth)
    }
);