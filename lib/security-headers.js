/**
 * OWASP-aligned security headers for Next.js middleware.
 * Apply via: return addSecurityHeaders(NextResponse.next(), request).
 *
 * - X-Frame-Options: prevents clickjacking
 * - X-Content-Type-Options: prevents MIME sniffing
 * - Referrer-Policy: limits referrer leakage
 * - Permissions-Policy: disables unnecessary browser features
 * - Content-Security-Policy: restricts script/style/source origins (tune as needed)
 */

/**
 * @param {import('next/server').NextResponse} response
 * @param {import('next/server').NextRequest} [request]
 * @returns {import('next/server').NextResponse}
 */
export function addSecurityHeaders(response, request) {
    const requestUrl = request?.nextUrl?.pathname ?? '';

    // Strict CSP can break inline scripts/styles; use report-only in dev if needed.
    // Adjust directives for your app (e.g. add 'unsafe-inline' only for specific paths).
    const cspDirectives = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires these in dev; tighten in prod if possible
        "style-src 'self' 'unsafe-inline' https:",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https:",
        "connect-src 'self' https:",
        "frame-ancestors 'none'", // Same as X-Frame-Options: DENY
        "base-uri 'self'",
        "form-action 'self'",
    ].join('; ');

    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
    response.headers.set('Content-Security-Policy', cspDirectives);
    response.headers.set('X-DNS-Prefetch-Control', 'off');

    return response;
}
