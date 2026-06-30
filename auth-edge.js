/**
 * Edge-compatible NextAuth instance for middleware ONLY.
 * Uses only auth.config.js (no providers, no Mongoose/Node APIs).
 * Session verification uses the JWT from the cookie; no DB needed.
 * Do NOT import this in API routes or server components — use auth.js instead.
 */
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export const { auth } = NextAuth(authConfig);
