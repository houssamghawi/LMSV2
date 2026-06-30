import { NextResponse } from "next/server";
import { writeFile } from 'fs/promises';
import path from 'path';
import { auth } from "@/auth";
import { updateUserInfo } from "@/app/actions/account";
import { rateLimit } from "@/lib/rate-limit";
import { dbConnect } from "@/service/mongo";
import { User } from "@/model/user-model";

// Security configuration
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const AVATAR_DESTINATION = 'public/uploads/avatars';

// Sanitize filename to prevent path traversal
function sanitizeFilename(filename) {
    return path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, '_');
}

// Validate file type
function isValidFileType(file) {
    return ALLOWED_MIME_TYPES.includes(file.type);
}

export async function POST(request) {
    try {
        // Authentication check
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Unauthorized: Authentication required' },
                { status: 401 }
            );
        }
        
        // Rate limiting
        const userId = session.user.email;
        const rateLimitResult = rateLimit(`avatar:${userId}`, 5, 60000); // 5 uploads per minute
        
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Too many upload requests. Please try again later.' },
                { 
                    status: 429,
                    headers: {
                        'Retry-After': '60'
                    }
                }
            );
        }

        const formData = await request.formData();
        const file = formData.get("file");

        // Validate file
        if (!file || !(file instanceof File)) {
            return NextResponse.json(
                { error: 'Invalid file: No file provided' },
                { status: 400 }
            );
        }

        // Validate file type
        if (!isValidFileType(file)) {
            return NextResponse.json(
                { error: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}` },
                { status: 400 }
            );
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
                { status: 413 }
            );
        }

        // Sanitize filename
        const sanitizedName = sanitizeFilename(file.name);
        const timestamp = Date.now();
        const ext = path.extname(sanitizedName) || '.jpg';
        const baseName = path.basename(sanitizedName, ext);
        const finalFilename = `avatar_${session.user.email.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}${ext}`;

        // Construct safe file path
        const filePath = path.join(process.cwd(), AVATAR_DESTINATION, finalFilename);

        // Ensure directory exists
        const fs = await import('fs/promises');
        await fs.mkdir(path.dirname(filePath), { recursive: true });

        // Convert file to buffer and write
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        // Update user profile picture in database
        await dbConnect();
        const updatedUser = await User.findOneAndUpdate(
            { email: session.user.email },
            { $set: { profilePicture: `/uploads/avatars/${finalFilename}` } },
            { new: true, lean: true }
        );

        if (!updatedUser) {
            // Clean up uploaded file if user update fails
            try {
                await fs.unlink(filePath);
            } catch (cleanupError) {
                console.error('Failed to cleanup file:', cleanupError);
            }
            return NextResponse.json(
                { error: 'Failed to update profile' },
                { status: 500 }
            );
        }

        // Return success with image path
        return NextResponse.json(
            { 
                success: true,
                message: 'Avatar uploaded successfully',
                imageUrl: `/uploads/avatars/${finalFilename}`,
                filename: finalFilename
            },
            { status: 200 }
        );

    } catch (error) {
        console.error('Avatar upload error:', error);
        return NextResponse.json(
            { error: 'Avatar upload failed. Please try again.' },
            { status: 500 }
        );
    }
}

