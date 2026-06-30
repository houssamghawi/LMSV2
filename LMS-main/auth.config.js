/**
 * NextAuth v5 config – OWASP-aligned session & cookie security.
 * EDGE-ONLY: This file is used by middleware (via auth-edge.js). It must contain
 * ONLY Edge-compatible code. Do NOT import mongoose, models, service/mongo.js, or
 * any Node.js-only modules here.
 * - JWT strategy with bounded maxAge and rolling sessions (updateAge).
 * - Cookies: HttpOnly, Secure in prod, SameSite to mitigate XSS/CSRF.
 */

const isProduction = process.env.NODE_ENV === 'production';

// Session lifetime: default 7 days; use SESSION_MAX_AGE_SECONDS to override (e.g. 2592000 = 30 days).
const SESSION_MAX_AGE = Number(process.env.SESSION_MAX_AGE_SECONDS) || 7 * 24 * 60 * 60; // 7 days
const SESSION_UPDATE_AGE = 24 * 60 * 60; // 24h – refresh JWT if older (rolling session)

export const authConfig = {
    session: {
        strategy: 'jwt',
        maxAge: SESSION_MAX_AGE,
        updateAge: SESSION_UPDATE_AGE,
    },
    pages: {
        signIn: '/login',
        error: '/login', // Error code passed in query string as ?error=
    },
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            // Initial sign in
            if (user) {
                token.id = user.id;
                token.email = user.email;
                token.name = user.name;
                token.role = user.role;
                token.status = user.status;
                token.image = user.image;
            }

            // Update session when profile is updated (via signIn with trigger: "update")
            if (trigger === "update" && session) {
                if (session.name) token.name = session.name;
                if (session.email) token.email = session.email;
                if (session.role) token.role = session.role;
                if (session.status) token.status = session.status;
                if (session.image !== undefined) token.image = session.image;
            }

            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id;
                session.user.email = token.email;
                session.user.name = token.name;
                session.user.role = token.role;
                session.user.status = token.status;
                session.user.image = token.image;
            }
            return session;
        },
    },
    cookies: {
        sessionToken: {
            name: isProduction
                ? `__Secure-next-auth.session-token`
                : `next-auth.session-token`,
            options: {
                httpOnly: true,
                sameSite: 'lax', // 'strict' if you never use OAuth callbacks from external sites
                path: '/',
                secure: isProduction,
                maxAge: SESSION_MAX_AGE, // Explicit cookie expiry aligned with session (OWASP)
            },
        },
        callbackUrl: {
            name: isProduction
                ? `__Secure-next-auth.callback-url`
                : `next-auth.callback-url`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: isProduction,
                maxAge: 60 * 10, // 10 minutes for callback URL
            },
        },
        csrfToken: {
            name: isProduction
                ? `__Host-next-auth.csrf-token`
                : `next-auth.csrf-token`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: isProduction,
                maxAge: 60 * 60 * 24, // 24h
            },
        },
    },
    providers: [],
};