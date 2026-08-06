/**
 * Get redirect URL based on user role
 */
export function getRedirectUrlByRole(role) {
    switch (role) {
        case 'admin':
            return '/admin';
        case 'instructor':
            return '/dashboard';
        case 'student':
        default:
            return '/';
    }
}

/**
 * Check if user should be redirected from login page
 */
export function shouldRedirectFromLogin(role) {
    // If user has a role, they should be redirected
    return !!role;
}

