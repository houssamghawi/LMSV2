import { dbConnect } from "@/service/mongo";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { User } from "@/model/user-model";
import { registerSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { createApiErrorResponse, ERROR_CODES } from "@/lib/errors";
import { logRoute } from "@/lib/logger";

export const POST = async (request) => {
    const logger = logRoute('/api/register', 'POST');
    logger.start();

    try {
        // Rate limiting - by IP first (before reading body)
        const ip = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
        
        // Rate limit by IP
        const ipRateLimitResult = rateLimit(`register:ip:${ip}`, 5, 60000); // 5 requests per minute per IP
        
        if (!ipRateLimitResult.success) {
            logger.failure(new Error('Rate limited by IP'), 429);
            return NextResponse.json(
                {
                    message: 'Too many registration attempts. Please try again later.',
                    errorCode: ERROR_CODES.RATE_LIMITED
                },
                { 
                    status: 429,
                    headers: {
                        'Retry-After': '60',
                        'Content-Type': 'application/json'
                    }
                }
            );
        }
        
        // Read body after IP rate limit check
        const body = await request.json();
        
        // Rate limit by email if available
        if (body.email) {
            const emailForRateLimit = body.email.toLowerCase().trim();
            const emailRateLimitResult = rateLimit(`register:email:${emailForRateLimit}`, 3, 60000); // 3 requests per minute per email
            if (!emailRateLimitResult.success) {
                logger.failure(new Error('Rate limited by email'), 429);
                return NextResponse.json(
                    {
                        message: 'Too many registration attempts for this email. Please try again later.',
                        errorCode: ERROR_CODES.RATE_LIMITED
                    },
                    { 
                        status: 429,
                        headers: {
                            'Retry-After': '60',
                            'Content-Type': 'application/json'
                        }
                    }
                );
            }
        }
        
        // Validate input
        const validationResult = registerSchema.safeParse(body);
        if (!validationResult.success) {
            // Extract field-level errors
            const { extractZodFieldErrors } = await import('@/lib/errors');
            const fieldErrors = extractZodFieldErrors(validationResult.error);
            
            logger.failure(new Error('Validation failed'), 400);
            return NextResponse.json(
                {
                    message: 'Validation failed. Please check your input.',
                    errorCode: ERROR_CODES.VALIDATION_ERROR,
                    details: { fieldErrors }
                },
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }
        
        const {firstName, lastName, email, password, userRole, confirmPassword} = validationResult.data;
        
        // Double-check password match (redundant but safe)
        if (password !== confirmPassword) {
            logger.failure(new Error('Password mismatch'), 400);
            return NextResponse.json(
                {
                    message: 'Passwords do not match.',
                    errorCode: ERROR_CODES.VALIDATION_ERROR,
                    details: { fieldErrors: { confirmPassword: 'Passwords do not match' } }
                },
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        await dbConnect();
        
        // Check if user already exists (with timing attack prevention)
        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            // Use same delay as successful registration to prevent timing attacks
            await bcrypt.hash(password, 12);
            
            logger.failure(new Error('Email already exists'), 409);
            return NextResponse.json(
                {
                    message: 'An account with this email already exists. Please use a different email or try logging in.',
                    errorCode: ERROR_CODES.ALREADY_EXISTS
                },
                { status: 409, headers: { 'Content-Type': 'application/json' } }
            );
        }
        
        // Hash password with bcrypt (rounds >= 12)
        const hashedPassword = await bcrypt.hash(password, 12);

        // Set status based on role
        // Students: active by default
        // Instructors: active by default (can be changed to 'pending' if needed)
        const defaultStatus = 'active';
        
        // Normalize email (lowercase, trim)
        const normalizedEmail = email.toLowerCase().trim();

        const newUser = {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: userRole,
            status: defaultStatus,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await User.create(newUser);
        
        logger.success(201);
        return NextResponse.json(
            { message: "Account created successfully. You can now log in." },
            { status: 201 }
        );
    } catch (error) {
        logger.failure(error instanceof Error ? error : new Error(String(error)), 500);
        return NextResponse.json(
            {
                message: 'Failed to create account. Please try again.',
                errorCode: ERROR_CODES.INTERNAL_ERROR,
                ...(process.env.NODE_ENV === 'development' && { details: { error: error.message } })
            },
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}