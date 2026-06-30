import { NextResponse } from "next/server";
import { writeFile } from 'fs/promises';
import path from 'path';
import { auth } from "@/auth";
import { updateCourse } from "@/app/actions/course";
import { rateLimit } from "@/lib/rate-limit";

// Security configuration
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_DESTINATIONS = [
    'public/uploads/courses',
    'public/uploads/thumbnails',
    'public/uploads/avatars',
    'public/assets/images/courses',
    './public/assets/images/courses',
    'public/assets/images',
    'public/assets/images/categories',
    './public/assets/images/categories'
];

// Sanitize filename to prevent path traversal
function sanitizeFilename(filename) {
    return path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, '_');
}

// Validate file type
function isValidFileType(file) {
    return ALLOWED_MIME_TYPES.includes(file.type);
}

// Normalize destination path
function normalizeDestination(destination) {
    if (!destination) return null;
    // Remove leading ./ if present
    let normalized = destination.replace(/^\.\//, '');
    // Remove leading / if present (to make it relative)
    normalized = normalized.replace(/^\//, '');
    return normalized;
}

// Validate destination path
function isValidDestination(destination) {
    if (!destination) return false;
    
    const normalized = normalizeDestination(destination);
    
    // Check if it matches any allowed destination pattern
    const isAllowed = ALLOWED_DESTINATIONS.some(allowed => {
        const normalizedAllowed = normalizeDestination(allowed);
        return normalized.startsWith(normalizedAllowed) || normalizedAllowed.startsWith(normalized);
    });
    
    // Security checks: no path traversal, not absolute
    const hasPathTraversal = normalized.includes('..');
    const isAbsolute = path.isAbsolute(normalized);
    
    return isAllowed && !hasPathTraversal && !isAbsolute;
}

export async function POST(request) {
    try {
        // Authentication check
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json(
                { error: 'Unauthorized: Authentication required' },
                { status: 401 }
            );
        }
        
        // Rate limiting
        const userId = session.user.email || 'unknown';
        const rateLimitResult = rateLimit(`upload:${userId}`, 10, 60000); // 10 uploads per minute
        
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
        const file = formData.get("files");
        const destination = formData.get("destination");
        const courseId = formData.get("courseId");

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
                { status: 400 }
            );
        }

        // Validate destination
        if (!destination || !isValidDestination(destination)) {
            return NextResponse.json(
                { error: 'Invalid or missing destination path' },
                { status: 400 }
            );
        }

        // Normalize destination for consistent path construction
        const normalizedDestination = normalizeDestination(destination);

        // Validate courseId if provided - verify ownership
        if (courseId) {
            const { verifyInstructorOwnsCourse, isAdmin } = await import('@/lib/authorization');
            const { dbConnect } = await import('@/service/mongo');
            
            await dbConnect();
            
            // Check if user owns the course or is admin
            const canUpload = await verifyInstructorOwnsCourse(
                courseId, 
                session.user.id, 
                session.user
            );
            
            if (!canUpload && !isAdmin(session.user)) {
                return NextResponse.json(
                    { error: 'Forbidden: You do not have permission to upload to this course' },
                    { status: 403 }
                );
            }
        }

        // Sanitize filename
        const sanitizedName = sanitizeFilename(file.name);
        const timestamp = Date.now();
        const ext = path.extname(sanitizedName);
        const baseName = path.basename(sanitizedName, ext);
        const finalFilename = `${baseName}_${timestamp}${ext}`;

        // Construct safe file path using normalized destination
        const filePath = path.join(process.cwd(), normalizedDestination, finalFilename);

        // Ensure directory exists
        const fs = await import('fs/promises');
        await fs.mkdir(path.dirname(filePath), { recursive: true });

        // Convert file to buffer and write
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        // Update course if courseId provided
        if (courseId) {
            try {
                await updateCourse(courseId, { thumbnail: finalFilename });
            } catch (updateError) {
                // If course update fails, clean up uploaded file
                try {
                    await fs.unlink(filePath);
                } catch (cleanupError) {
                    console.error('Failed to cleanup file:', cleanupError);
                }
                throw updateError;
            }
        }

        // Return path relative to public directory for frontend use
        const publicPath = normalizedDestination.replace(/^public\//, '');
        
        return NextResponse.json(
            { 
                message: 'File uploaded successfully',
                filename: finalFilename,
                path: `/${publicPath}/${finalFilename}`
            },
            { status: 200 }
        );

    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: 'File upload failed. Please try again.' },
            { status: 500 }
        );
    }
}