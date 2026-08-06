import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { stat, createReadStream } from "fs";
import { existsSync } from "fs";
import { join } from "path";
import { dbConnect } from "@/service/mongo";
import { Lesson } from "@/model/lesson.model";
import { Module } from "@/model/module.model";
import { Course } from "@/model/course-model";
import { Enrollment } from "@/model/enrollment-model";
import { ROLES } from "@/lib/permissions";
import { logRoute } from "@/lib/logger";
import mongoose from "mongoose";
import { promisify } from "util";
import { Readable } from "stream";

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'videos');
const statAsync = promisify(stat);

/**
 * Parse Range header
 * Returns { start, end } or null for invalid/missing range
 */
function parseRange(range, fileSize) {
    if (!range || !range.startsWith('bytes=')) return null;
    
    const rangeValue = range.replace(/bytes=/, '');
    const parts = rangeValue.split('-');
    
    // Handle different range formats:
    // bytes=0-499 (first 500 bytes)
    // bytes=500-999 (second 500 bytes)
    // bytes=-500 (last 500 bytes)
    // bytes=500- (from byte 500 to end)
    
    let start, end;
    
    if (parts[0] === '') {
        // Suffix range: bytes=-500 (last 500 bytes)
        const suffixLength = parseInt(parts[1], 10);
        if (isNaN(suffixLength) || suffixLength <= 0) return null;
        start = Math.max(0, fileSize - suffixLength);
        end = fileSize - 1;
    } else {
        start = parseInt(parts[0], 10);
        end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    }
    
    // Validate range
    if (isNaN(start) || isNaN(end)) return null;
    if (start < 0 || start >= fileSize) return null;
    if (end < start) return null;
    
    // Clamp end to file size
    end = Math.min(end, fileSize - 1);
    
    return { start, end };
}

/**
 * Verify user can access the video
 * - Enrolled students can access
 * - Course instructor can access
 * - Admins can access
 */
async function verifyVideoAccess(filename, userId, userRole) {
    await dbConnect();
    
    // Find lesson by videoFilename
    const lesson = await Lesson.findOne({ videoFilename: filename }).lean();
    if (!lesson) {
        return { allowed: false, error: 'Lesson not found' };
    }
    
    // Find module containing this lesson
    const module = await Module.findOne({ lessonIds: lesson._id }).lean();
    if (!module) {
        return { allowed: false, error: 'Module not found' };
    }
    
    // Find course containing this module
    const course = await Course.findById(module.course).lean();
    if (!course) {
        return { allowed: false, error: 'Course not found' };
    }
    
    // Admins can always access
    if (userRole === ROLES.ADMIN) {
        return { allowed: true, course, lesson };
    }
    
    // Instructors can access their own courses
    if (userRole === ROLES.INSTRUCTOR && course.instructor.toString() === userId) {
        return { allowed: true, course, lesson };
    }
    
    // Students must be enrolled
    if (userRole === ROLES.STUDENT) {
        const enrollment = await Enrollment.findOne({
            student: new mongoose.Types.ObjectId(userId),
            course: course._id
        }).lean();
        
        if (enrollment) {
            return { allowed: true, course, lesson };
        }
    }
    
    return { allowed: false, error: 'Access denied' };
}

/**
 * Convert Node.js Readable stream to Web ReadableStream
 * Uses Readable.toWeb() for Node 18+
 */
function nodeStreamToWeb(nodeStream) {
    // Node 18+ has Readable.toWeb()
    if (typeof Readable.toWeb === 'function') {
        return Readable.toWeb(nodeStream);
    }
    
    // Fallback for older Node versions
    return new ReadableStream({
        start(controller) {
            nodeStream.on('data', (chunk) => {
                controller.enqueue(chunk);
            });
            nodeStream.on('end', () => {
                controller.close();
            });
            nodeStream.on('error', (err) => {
                controller.error(err);
            });
        },
        cancel() {
            nodeStream.destroy();
        }
    });
}

/**
 * GET /api/videos/[filename]
 * Stream video with proper HTTP Range support for seeking
 * Uses Node.js streams to avoid loading entire file into memory
 */
export async function GET(request, { params }) {
    const logger = logRoute('/api/videos/[filename]', 'GET');
    logger.start();
    
    try {
        // 1. Authentication check
        const session = await auth();
        if (!session?.user?.id) {
            logger.failure(new Error('Unauthorized'));
            return NextResponse.json(
                { error: 'Unauthorized', message: 'Please login to watch this video' },
                { status: 401 }
            );
        }
        
        const userId = session.user.id;
        const userRole = session.user.role;
        
        // 2. Get filename from params
        const { filename } = await params;
        
        // 3. Prevent path traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            logger.failure(new Error('Path traversal attempt'));
            return new NextResponse('Invalid filename', { status: 400 });
        }
        
        // 4. Verify access
        const accessCheck = await verifyVideoAccess(filename, userId, userRole);
        if (!accessCheck.allowed) {
            logger.failure(new Error(accessCheck.error || 'Access denied'));
            const errorMessage = accessCheck.error === 'Access denied' 
                ? 'You must be enrolled in this course to watch this video'
                : accessCheck.error || 'Access denied';
            return NextResponse.json(
                { error: 'Forbidden', message: errorMessage },
                { status: 403 }
            );
        }
        
        // 5. Get file path
        const filepath = join(UPLOAD_DIR, filename);
        
        // 6. Prevent path traversal (extra safety)
        if (!filepath.startsWith(UPLOAD_DIR)) {
            logger.failure(new Error('Path traversal attempt'));
            return new NextResponse('Invalid file path', { status: 400 });
        }
        
        // 7. Check if file exists
        if (!existsSync(filepath)) {
            logger.failure(new Error('File not found'));
            return NextResponse.json(
                { error: 'Not Found', message: 'Video file not found' },
                { status: 404 }
            );
        }
        
        // 8. Get file stats
        const stats = await statAsync(filepath);
        const fileSize = stats.size;
        
        // 9. Get Range header and MIME type
        const range = request.headers.get('range');
        const lesson = accessCheck.lesson;
        const mimeType = lesson.videoMimeType || 'video/mp4';
        
        // 10. Handle Range request (for seeking)
        if (range) {
            const rangeData = parseRange(range, fileSize);
            
            // Invalid range - return 416
            if (!rangeData) {
                logger.failure(new Error('Invalid range'));
                return new NextResponse(null, {
                    status: 416, // Range Not Satisfiable
                    headers: {
                        'Content-Range': `bytes */${fileSize}`,
                        'Accept-Ranges': 'bytes',
                    },
                });
            }
            
            const { start, end } = rangeData;
            const chunkSize = (end - start) + 1;
            
            // Create read stream for the requested range
            const nodeStream = createReadStream(filepath, { start, end });
            const webStream = nodeStreamToWeb(nodeStream);
            
            logger.success();
            return new Response(webStream, {
                status: 206, // Partial Content
                headers: {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunkSize.toString(),
                    'Content-Type': mimeType,
                    'Cache-Control': 'private, max-age=3600',
                },
            });
        }
        
        // 11. Full file request - stream entire file
        const nodeStream = createReadStream(filepath);
        const webStream = nodeStreamToWeb(nodeStream);
        
        logger.success();
        return new Response(webStream, {
            status: 200,
            headers: {
                'Content-Length': fileSize.toString(),
                'Content-Type': mimeType,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'private, max-age=3600',
            },
        });
        
    } catch (error) {
        console.error('[VIDEO] Error:', error);
        logger.failure(error instanceof Error ? error : new Error(String(error)));
        return NextResponse.json(
            { error: 'Internal Server Error', message: 'Failed to stream video' },
            { status: 500 }
        );
    }
}
