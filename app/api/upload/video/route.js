import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { mkdir, unlink } from "fs/promises";
import { existsSync, createWriteStream } from "fs";
import { join } from "path";
import { dbConnect } from "@/service/mongo";
import { Lesson } from "@/model/lesson.model";
import { Module } from "@/model/module.model";
import { Course } from "@/model/course-model";
import { ROLES } from "@/lib/permissions";
import { createErrorResponse, createSuccessResponse, ERROR_CODES } from "@/lib/errors";
import { logRoute } from "@/lib/logger";
import mongoose from "mongoose";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

// Configuration
const MAX_FILE_SIZE = 300 * 1024 * 1024; // 300MB
const ALLOWED_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'videos');

// Ensure upload directory exists
async function ensureUploadDir() {
    if (!existsSync(UPLOAD_DIR)) {
        await mkdir(UPLOAD_DIR, { recursive: true });
    }
}

/**
 * Generate safe unique filename
 */
function generateSafeFilename(originalName) {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const extension = originalName.split('.').pop();
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    const sanitized = nameWithoutExt
        .replace(/[^a-z0-9]/gi, '-')
        .toLowerCase()
        .substring(0, 50);
    
    return `${sanitized}-${timestamp}-${randomId}.${extension}`;
}

/**
 * Verify instructor owns the course (through lesson → module → course)
 */
async function verifyLessonOwnership(lessonId, userId) {
    await dbConnect();
    
    // Find lesson
    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson) {
        return { valid: false, error: 'Lesson not found' };
    }
    
    // Find module that contains this lesson
    const module = await Module.findOne({ lessonIds: lessonId }).lean();
    if (!module) {
        return { valid: false, error: 'Module not found' };
    }
    
    // Find course that contains this module
    const course = await Course.findById(module.course).lean();
    if (!course) {
        return { valid: false, error: 'Course not found' };
    }
    
    // Check if user is the instructor or admin
    const isOwner = course.instructor.toString() === userId;
    
    return { valid: isOwner, course, module, lesson };
}

/**
 * Convert Web ReadableStream to Node.js Readable stream
 */
function webStreamToNode(webStream) {
    const reader = webStream.getReader();
    
    return new Readable({
        async read() {
            try {
                const { done, value } = await reader.read();
                if (done) {
                    this.push(null);
                } else {
                    this.push(Buffer.from(value));
                }
            } catch (error) {
                this.destroy(error);
            }
        },
        destroy(error, callback) {
            reader.cancel().then(() => callback(error)).catch(callback);
        }
    });
}

/**
 * Stream file to disk without buffering entire file in memory
 * Uses stream/promises pipeline for proper backpressure handling
 */
async function streamFileToDisk(webStream, filepath) {
    const nodeStream = webStreamToNode(webStream);
    const writeStream = createWriteStream(filepath);
    
    await pipeline(nodeStream, writeStream);
}

/**
 * POST /api/upload/video
 * Upload video file for a lesson using streaming (memory efficient)
 */
export async function POST(request) {
    const logger = logRoute('/api/upload/video', 'POST');
    logger.start();
    
    let filepath = null; // Track for cleanup on error
    
    try {
        // 1. Authentication check
        const session = await auth();
        if (!session?.user?.id) {
            logger.failure(new Error('Unauthorized'));
            return NextResponse.json(
                createErrorResponse('You must be logged in to upload videos.', ERROR_CODES.AUTH_REQUIRED),
                { status: 401 }
            );
        }
        
        const userId = session.user.id;
        const userRole = session.user.role;
        
        // 2. Role check - only instructors and admins can upload
        if (userRole !== ROLES.INSTRUCTOR && userRole !== ROLES.ADMIN) {
            logger.failure(new Error('Forbidden: Not an instructor or admin'));
            return NextResponse.json(
                createErrorResponse('Only instructors and admins can upload videos.', ERROR_CODES.FORBIDDEN),
                { status: 403 }
            );
        }
        
        // 3. Parse form data
        const formData = await request.formData();
        const file = formData.get('file');
        const lessonId = formData.get('lessonId');
        
        if (!file || !lessonId) {
            logger.failure(new Error('Missing file or lessonId'));
            return NextResponse.json(
                createErrorResponse('File and lesson ID are required.', ERROR_CODES.VALIDATION_ERROR),
                { status: 400 }
            );
        }
        
        // 4. Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(lessonId)) {
            logger.failure(new Error('Invalid lessonId'));
            return NextResponse.json(
                createErrorResponse('Invalid lesson ID.', ERROR_CODES.VALIDATION_ERROR),
                { status: 400 }
            );
        }
        
        // 5. Verify ownership (RBAC + IDOR protection)
        const ownershipCheck = await verifyLessonOwnership(lessonId, userId);
        if (!ownershipCheck.valid) {
            if (ownershipCheck.error) {
                logger.failure(new Error(ownershipCheck.error));
                return NextResponse.json(
                    createErrorResponse(ownershipCheck.error, ERROR_CODES.NOT_FOUND),
                    { status: 404 }
                );
            }
            logger.failure(new Error('Forbidden: Not the course instructor'));
            return NextResponse.json(
                createErrorResponse('You do not have permission to upload videos for this lesson.', ERROR_CODES.FORBIDDEN),
                { status: 403 }
            );
        }
        
        // 6. Validate file
        if (!(file instanceof File)) {
            logger.failure(new Error('Invalid file object'));
            return NextResponse.json(
                createErrorResponse('Invalid file.', ERROR_CODES.VALIDATION_ERROR),
                { status: 400 }
            );
        }
        
        // 7. Validate file type
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            logger.failure(new Error(`Invalid file type: ${file.type}`));
            return NextResponse.json(
                createErrorResponse(`Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`, ERROR_CODES.VALIDATION_ERROR),
                { status: 400 }
            );
        }
        
        // 8. Validate file size
        if (file.size > MAX_FILE_SIZE) {
            logger.failure(new Error(`File too large: ${file.size} bytes`));
            return NextResponse.json(
                createErrorResponse(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB.`, ERROR_CODES.VALIDATION_ERROR),
                { status: 400 }
            );
        }
        
        // 9. Ensure upload directory exists
        await ensureUploadDir();
        
        // 10. Generate safe filename
        const filename = generateSafeFilename(file.name);
        filepath = join(UPLOAD_DIR, filename);
        
        // 11. Prevent path traversal (extra safety)
        if (!filepath.startsWith(UPLOAD_DIR)) {
            logger.failure(new Error('Path traversal attempt'));
            return NextResponse.json(
                createErrorResponse('Invalid file path.', ERROR_CODES.VALIDATION_ERROR),
                { status: 400 }
            );
        }
        
        // 12. Delete old video if exists
        const lesson = ownershipCheck.lesson;
        if (lesson.videoFilename) {
            const oldFilepath = join(UPLOAD_DIR, lesson.videoFilename);
            try {
                if (existsSync(oldFilepath)) {
                    await unlink(oldFilepath);
                    console.log('[UPLOAD] Deleted old video:', lesson.videoFilename);
                }
            } catch (deleteError) {
                console.error('[UPLOAD] Error deleting old video:', deleteError);
                // Continue with upload even if old file deletion fails
            }
        }
        
        // 13. Stream file to disk (MEMORY EFFICIENT - no buffering)
        // Uses pipeline with backpressure handling
        await streamFileToDisk(file.stream(), filepath);
        
        console.log('[UPLOAD] Video saved (streamed):', filename, 'Size:', file.size, 'bytes');
        
        // 14. Update lesson record
        const videoUrl = `/api/videos/${filename}`;
        await Lesson.findByIdAndUpdate(lessonId, {
            videoProvider: 'local',
            videoFilename: filename,
            videoUrl: videoUrl,
            videoMimeType: file.type,
            videoSize: file.size,
            video_url: videoUrl // Keep for backward compatibility
        });
        
        logger.success();
        return NextResponse.json(
            createSuccessResponse({
                videoUrl,
                filename,
                size: file.size,
                mimeType: file.type
            }, 'Video uploaded successfully.')
        );
        
    } catch (error) {
        console.error('[UPLOAD] Error:', error);
        
        // Cleanup partially uploaded file on error
        if (filepath && existsSync(filepath)) {
            try {
                await unlink(filepath);
                console.log('[UPLOAD] Cleaned up partial file:', filepath);
            } catch (cleanupError) {
                console.error('[UPLOAD] Error cleaning up partial file:', cleanupError);
            }
        }
        
        logger.failure(error instanceof Error ? error : new Error(String(error)));
        return NextResponse.json(
            createErrorResponse(
                'Failed to upload video. Please try again.',
                ERROR_CODES.INTERNAL_ERROR
            ),
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/upload/video?lessonId=...
 * Delete video file for a lesson
 */
export async function DELETE(request) {
    const logger = logRoute('/api/upload/video', 'DELETE');
    logger.start();
    
    try {
        // 1. Authentication check
        const session = await auth();
        if (!session?.user?.id) {
            logger.failure(new Error('Unauthorized'));
            return NextResponse.json(
                createErrorResponse('You must be logged in to delete videos.', ERROR_CODES.AUTH_REQUIRED),
                { status: 401 }
            );
        }
        
        const userId = session.user.id;
        const userRole = session.user.role;
        
        // 2. Role check
        if (userRole !== ROLES.INSTRUCTOR && userRole !== ROLES.ADMIN) {
            logger.failure(new Error('Forbidden: Not an instructor or admin'));
            return NextResponse.json(
                createErrorResponse('Only instructors and admins can delete videos.', ERROR_CODES.FORBIDDEN),
                { status: 403 }
            );
        }
        
        // 3. Get lessonId from query params
        const { searchParams } = new URL(request.url);
        const lessonId = searchParams.get('lessonId');
        
        if (!lessonId) {
            logger.failure(new Error('Missing lessonId'));
            return NextResponse.json(
                createErrorResponse('Lesson ID is required.', ERROR_CODES.VALIDATION_ERROR),
                { status: 400 }
            );
        }
        
        // 4. Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(lessonId)) {
            logger.failure(new Error('Invalid lessonId'));
            return NextResponse.json(
                createErrorResponse('Invalid lesson ID.', ERROR_CODES.VALIDATION_ERROR),
                { status: 400 }
            );
        }
        
        // 5. Verify ownership
        const ownershipCheck = await verifyLessonOwnership(lessonId, userId);
        if (!ownershipCheck.valid) {
            if (ownershipCheck.error) {
                logger.failure(new Error(ownershipCheck.error));
                return NextResponse.json(
                    createErrorResponse(ownershipCheck.error, ERROR_CODES.NOT_FOUND),
                    { status: 404 }
                );
            }
            logger.failure(new Error('Forbidden: Not the course instructor'));
            return NextResponse.json(
                createErrorResponse('You do not have permission to delete videos for this lesson.', ERROR_CODES.FORBIDDEN),
                { status: 403 }
            );
        }
        
        const lesson = ownershipCheck.lesson;
        
        // 6. Delete file if exists
        if (lesson.videoFilename) {
            const filepath = join(UPLOAD_DIR, lesson.videoFilename);
            try {
                if (existsSync(filepath)) {
                    await unlink(filepath);
                    console.log('[UPLOAD] Deleted video file:', lesson.videoFilename);
                }
            } catch (deleteError) {
                console.error('[UPLOAD] Error deleting video file:', deleteError);
                // Continue with DB update even if file deletion fails
            }
        }
        
        // 7. Clear lesson video fields
        await Lesson.findByIdAndUpdate(lessonId, {
            $unset: {
                videoProvider: '',
                videoFilename: '',
                videoUrl: '',
                videoMimeType: '',
                videoSize: ''
            },
            video_url: '' // Clear for backward compatibility
        });
        
        logger.success();
        return NextResponse.json(
            createSuccessResponse(null, 'Video deleted successfully.')
        );
        
    } catch (error) {
        console.error('[UPLOAD] Error:', error);
        logger.failure(error instanceof Error ? error : new Error(String(error)));
        return NextResponse.json(
            createErrorResponse(
                'Failed to delete video. Please try again.',
                ERROR_CODES.INTERNAL_ERROR
            ),
            { status: 500 }
        );
    }
}
