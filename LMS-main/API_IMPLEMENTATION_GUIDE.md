# API Implementation Guide

**Last Updated:** 2025-01-27

This guide explains how the API is built in this Next.js LMS repository, covering architecture, endpoint patterns, authentication, authorization, and how to add new endpoints.

---

## 1. API Architecture Overview

### Next.js App Router Route Handlers

This repository uses **Next.js 15 App Router Route Handlers** for API endpoints. Route handlers are defined using the `route.js` (or `route.ts`) file convention in the `app/api/` directory.

**Key Characteristics:**
- Each route file exports named HTTP method handlers (`GET`, `POST`, `PUT`, `DELETE`, etc.)
- Route handlers are Server Components by default (run on the server)
- Can return `NextResponse` objects with custom headers, status codes, and body
- Support dynamic routes using `[param]` and catch-all routes using `[...param]`

### API Routes vs Server Actions

The codebase uses **two different patterns** for server-side functionality:

#### API Routes (`app/api/**/route.js`)
**When to use:**
- External integrations (webhooks, payment callbacks)
- File uploads/downloads (multipart/form-data, streaming)
- When you need precise control over HTTP headers/status codes
- When building REST APIs consumed by external clients
- When you need streaming responses (video, large files)

**Examples in this repo:**
- `/api/payments/mock/confirm` - Payment webhook handler
- `/api/upload/video` - Video file upload (streaming)
- `/api/videos/[filename]` - Video streaming with Range support
- `/api/certificates/[courseId]` - PDF generation and download
- `/api/lesson-watch` - Progress tracking endpoint

#### Server Actions (`app/actions/**/*.js`)
**When to use:**
- Form submissions from React Server/Client Components
- Direct function calls from components (no fetch needed)
- When you need progressive enhancement
- When building form-heavy features
- Simpler error handling with standardized responses

**Examples in this repo:**
- `app/actions/course.js` - Course CRUD operations
- `app/actions/quizv2.js` - Quiz management and taking
- `app/actions/enrollment.js` - Enrollment creation

**Key Difference:**
- **API Routes**: Called via `fetch('/api/...')`, return `NextResponse`
- **Server Actions**: Called directly as functions, return plain objects with `{ ok, message, data, errorCode }`

---

## 2. Where the API is Located

All API routes are located in the `app/api/` directory. The folder structure maps directly to URL paths.

### Complete Endpoint Listing

#### Authentication
| Route Path | Source File | Methods | Purpose |
|------------|-------------|---------|---------|
| `/api/auth/*` | `app/api/auth/[...nextauth]/route.js` | GET, POST | NextAuth catch-all route (signin, signout, callback, session) |

**Details:**
- Re-exports handlers from `auth.js` (NextAuth configuration)
- Handles all authentication endpoints automatically
- Supports JWT-based sessions

#### User Management & Profile
| Route Path | Source File | Methods | Purpose |
|------------|-------------|---------|---------|
| `/api/register` | `app/api/register/route.js` | POST | User registration (creates new user account) |
| `/api/me` | `app/api/me/route.js` | GET | Get current authenticated user's full profile |
| `/api/profile/avatar` | `app/api/profile/avatar/route.js` | POST | Upload profile picture (multipart/form-data) |

#### Courses, Lessons & Videos
| Route Path | Source File | Methods | Purpose |
|------------|-------------|---------|---------|
| `/api/lesson-watch` | `app/api/lesson-watch/route.js` | POST | Track lesson viewing progress (updates Watch and Report models) |
| `/api/upload` | `app/api/upload/route.js` | POST | Upload images/documents (course thumbnails, etc.) |
| `/api/upload/video` | `app/api/upload/video/route.js` | POST, DELETE | Upload/delete lesson video files (streaming for large files) |
| `/api/videos/[filename]` | `app/api/videos/[filename]/route.js` | GET | Stream video files with HTTP Range support (for seeking) |

#### Payments
| Route Path | Source File | Methods | Purpose |
|------------|-------------|---------|---------|
| `/api/payments/mock/confirm` | `app/api/payments/mock/confirm/route.js` | POST | MockPay webhook - creates payment and enrollment |
| `/api/payments/status` | `app/api/payments/status/route.js` | GET | Check payment status by session_id (query param) |

#### Certificates
| Route Path | Source File | Methods | Purpose |
|------------|-------------|---------|---------|
| `/api/certificates/[courseId]` | `app/api/certificates/[courseId]/route.js` | GET | Generate and download course completion certificate (PDF) |

#### Quiz V2
| Route Path | Source File | Methods | Purpose |
|------------|-------------|---------|---------|
| `/api/quizv2/attempts/[attemptId]` | `app/api/quizv2/attempts/[attemptId]/route.js` | GET | Get quiz attempt details (with ownership verification) |

---

## 3. How Endpoints are Implemented (The "Shape")

### Standard Route Handler Pattern

All API routes in this repository follow a consistent pattern:

#### 1. Imports Structure

```javascript
// Core Next.js
import { NextRequest, NextResponse } from "next/server";

// Authentication
import { auth } from "@/auth";
import { getLoggedInUser } from "@/lib/loggedin-user";

// Database
import { dbConnect } from "@/service/mongo";
import { ModelName } from "@/model/model-name";
import { queryFunction } from "@/queries/query-file";

// Validation
import { validationSchema } from "@/lib/validations";

// Utilities
import { rateLimit } from "@/lib/rate-limit";
import { createErrorResponse, createSuccessResponse, ERROR_CODES } from "@/lib/errors";
import { logRoute } from "@/lib/logger";

// Authorization
import { verifyInstructorOwnsCourse, isAdmin } from "@/lib/authorization";

// Other
import mongoose from "mongoose";
```

#### 2. Input Validation Strategy

**Zod Schemas** (`lib/validations.js`):
- Most endpoints validate request bodies using Zod schemas
- Example: `/api/register` uses `registerSchema.safeParse(body)`
- Field-level errors extracted using `extractZodFieldErrors()`

**Manual Validation**:
- ObjectId validation: `mongoose.Types.ObjectId.isValid(id)`
- Required fields check: `if (!field) return error`
- Enum validation: Check against allowed values
- File validation: MIME type, file size checks

**Path Traversal Prevention**:
- Filename sanitization: `path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, '_')`
- Path validation: Check `filepath.startsWith(ALLOWED_DIR)`

#### 3. Authentication & Authorization Flow

**Step 1: Authentication Check**
```javascript
const session = await auth();
if (!session?.user?.id) {
    return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
    );
}
```

**Step 2: Role-Based Authorization**
- **Admin override**: Check `user.role === 'admin'` first
- **Instructor ownership**: Use `verifyInstructorOwnsCourse(courseId, userId, user)`
- **Enrollment check**: Use `hasEnrollmentForCourse(courseId, userId)` for students
- **Ownership verification**: Verify resource ownership to prevent IDOR

**Authorization Helpers Used:**
- `getLoggedInUser()` - Get full user object from database
- `isAdmin(user)` - Check admin role
- `verifyInstructorOwnsCourse()` - Verify course ownership
- `assertInstructorOwnsCourse()` - Throw error if not owner

#### 4. Rate Limiting

**Pattern Used:**
```javascript
const rateLimitResult = rateLimit(`endpoint:${identifier}`, maxRequests, windowMs);
if (!rateLimitResult.success) {
    return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': '60' } }
    );
}
```

**Rate Limits Applied:**
- `/api/register`: 5 per IP per minute, 3 per email per minute
- `/api/profile/avatar`: 5 per user per minute
- `/api/upload`: 10 per user per minute
- `/api/certificates/[courseId]`: 5 per user+IP per minute

#### 5. Database Operations

**Connection:**
```javascript
await dbConnect(); // Ensures MongoDB connection (with pooling/caching)
```

**Query Pattern:**
- Use query functions from `queries/` directory (abstraction layer)
- Direct model queries when query functions don't exist
- Always use `.lean()` for read-only queries (better performance)
- Validate ObjectIds before queries

**Transaction Pattern:**
- No explicit transactions used (MongoDB doesn't support multi-document transactions easily)
- Idempotency checks used instead (check before create)
- Error cleanup: Delete uploaded files if DB operation fails

#### 6. Error Handling

**Standardized Response Shape:**
```javascript
// Success
{
    ok: true,
    message: "Operation successful",
    data: { ... }
}

// Error
{
    ok: false,
    message: "Error message",
    errorCode: "ERROR_CODE",
    details?: { fieldErrors?: {...} }
}
```

**Error Response Helpers:**
- `createSuccessResponse(data, message)` - Standard success response
- `createErrorResponse(message, errorCode, fieldErrors)` - Standard error response
- `createApiErrorResponse(message, status, errorCode, details)` - API route error (includes status)

**HTTP Status Codes Used:**
- `200` - Success
- `201` - Created
- `206` - Partial Content (video streaming with Range)
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (authenticated but no permission)
- `404` - Not Found
- `409` - Conflict (already exists)
- `413` - Payload Too Large (file size)
- `416` - Range Not Satisfiable (invalid Range header)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

#### 7. Logging

**Pattern:**
```javascript
const logger = logRoute('/api/endpoint', 'GET');
logger.start();
// ... operation ...
logger.success(); // or logger.failure(error, statusCode)
```

**Logging Utility** (`lib/logger.js`):
- `logRoute(route, method)` - Returns logger object
- `logger.start()` - Log start of request
- `logger.success(statusCode?)` - Log successful completion
- `logger.failure(error, statusCode?)` - Log failure

#### 8. Response Headers

**Common Headers Set:**
```javascript
{
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0', // For dynamic data
    'Retry-After': '60' // For rate limiting
}
```

**Video Streaming Headers:**
```javascript
{
    'Content-Type': 'video/mp4',
    'Content-Range': 'bytes 0-1023/2048',
    'Accept-Ranges': 'bytes',
    'Content-Length': '1024',
    'Cache-Control': 'private, max-age=3600'
}
```

---

## 4. Request/Response Examples

### POST `/api/register`

**Request:**
```javascript
POST /api/register
Content-Type: application/json

{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "password": "securePassword123",
    "confirmPassword": "securePassword123",
    "userRole": "student"
}
```

**Success Response (201):**
```javascript
{
    "message": "Account created successfully. You can now log in."
}
```

**Error Response (400):**
```javascript
{
    "message": "Validation failed. Please check your input.",
    "errorCode": "VALIDATION_ERROR",
    "details": {
        "fieldErrors": {
            "email": "Invalid email format",
            "password": "Password must be at least 8 characters"
        }
    }
}
```

### POST `/api/lesson-watch`

**Request:**
```javascript
POST /api/lesson-watch
Content-Type: application/json
Authorization: (via NextAuth session cookie)

{
    "courseId": "507f1f77bcf86cd799439011",
    "lessonId": "507f1f77bcf86cd799439012",
    "moduleSlug": "introduction-to-react",
    "state": "completed",
    "lastTime": 120.5
}
```

**Success Response (200):**
```javascript
{
    "message": "Watch record added successfully"
}
```

### GET `/api/videos/[filename]`

**Request:**
```javascript
GET /api/videos/lesson-123-4567890.mp4
Range: bytes=0-1023
Authorization: (via NextAuth session cookie)
```

**Success Response (206 - Partial Content):**
```javascript
// Binary video data stream
Headers:
  Content-Type: video/mp4
  Content-Range: bytes 0-1023/5242880
  Accept-Ranges: bytes
  Content-Length: 1024
```

### GET `/api/certificates/[courseId]`

**Request:**
```javascript
GET /api/certificates/507f1f77bcf86cd799439011
Authorization: (via NextAuth session cookie)
```

**Success Response (200):**
```javascript
// Binary PDF data
Headers:
  Content-Type: application/pdf
  Content-Disposition: attachment; filename="certificate-course-name.pdf"
  Content-Length: 123456
```

---

## 5. Authentication & Permissions Enforcement

### Authentication Flow

1. **Session Check** (`auth()` from `@/auth`):
   - Reads JWT token from cookie
   - Returns `session.user` with: `{ id, email, name, role, status, image }`
   - Returns `null` if not authenticated

2. **Status Check**:
   - Inactive/suspended users are blocked at middleware level
   - API routes may also check `user.status !== 'active'`

### Permission Enforcement Patterns

#### Pattern 1: Public Endpoint (No Auth)
```javascript
// No auth check needed
export async function GET(request) {
    // Public data
}
```

#### Pattern 2: Authenticated Endpoint
```javascript
export async function GET(request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Protected data
}
```

#### Pattern 3: Role-Based Access
```javascript
export async function POST(request) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (session.user.role !== ROLES.INSTRUCTOR && session.user.role !== ROLES.ADMIN) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Instructor/admin only
}
```

#### Pattern 4: Ownership Verification (IDOR Prevention)
```javascript
export async function DELETE(request, { params }) {
    const session = await auth();
    const userId = session.user.id;
    const { resourceId } = await params;
    
    // Verify ownership
    const ownsResource = await verifyInstructorOwnsCourse(resourceId, userId, session.user);
    if (!ownsResource && !isAdmin(session.user)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // User owns resource or is admin
}
```

#### Pattern 5: Enrollment Check
```javascript
export async function GET(request) {
    const user = await getLoggedInUser();
    const { courseId } = await params;
    
    // Admin/instructor can access
    if (user.role === 'admin' || user.role === 'instructor') {
        // Allow access
    } else {
        // Student must be enrolled
        const isEnrolled = await hasEnrollmentForCourse(courseId, user.id);
        if (!isEnrolled) {
            return NextResponse.json({ error: 'Not enrolled' }, { status: 403 });
        }
    }
}
```

### Authorization Helpers Reference

**From `lib/authorization.js`:**
- `verifyInstructorOwnsCourse(courseId, userId, user)` - Returns boolean
- `assertInstructorOwnsCourse(courseId, userId, options)` - Throws if not owner
- `verifyInstructorOwnsModule(moduleId, userId, user)` - Verifies via course
- `verifyInstructorOwnsLesson(lessonId, userId, user)` - Verifies via module→course
- `isAdmin(user)` - Check if user is admin

**From `lib/auth-helpers.js`:**
- `getCurrentUser()` - Get session user
- `requireAuth()` - Throw if not authenticated
- `requireAdmin()` - Throw if not admin

**From `lib/loggedin-user.js`:**
- `getLoggedInUser()` - Get full user document from database (not just session)

---

## 6. How API Routes Connect to Database

### Architecture Flow

```
API Route Handler
    ↓
1. Validate Input (Zod/manual)
    ↓
2. Authenticate (auth())
    ↓
3. Authorize (verifyOwnership, checkRole, checkEnrollment)
    ↓
4. Connect DB (dbConnect())
    ↓
5. Query Database
    Option A: Use query function (queries/*.js)
    Option B: Direct model query (Model.findOne(), etc.)
    ↓
6. Process Business Logic
    ↓
7. Return Response (NextResponse.json)
```

### Query Layer Pattern

**Query Functions** (`queries/`):
- Abstraction layer over Mongoose models
- Handle database connection
- Provide reusable query logic
- Used by both API routes and server actions

**Example:**
```javascript
// In API route
import { getCourseDetails } from "@/queries/courses";
const course = await getCourseDetails(courseId);

// In queries/courses.js
export async function getCourseDetails(courseId) {
    await dbConnect();
    return await Course.findById(courseId)
        .populate('instructor', 'firstName lastName email')
        .populate('category')
        .lean();
}
```

**Direct Model Queries** (when needed):
```javascript
// For simple queries or when query function doesn't exist
await dbConnect();
const user = await User.findOne({ email }).lean();
```

### Model Relationships

API routes often need to traverse relationships:
- **Lesson → Module → Course**: To verify ownership or enrollment
- **Attempt → Quiz → Course**: To verify quiz access
- **Enrollment → Course → Instructor**: To get course details

**Example Pattern:**
```javascript
// Find lesson, then its module, then its course
const lesson = await Lesson.findById(lessonId).lean();
const module = await Module.findOne({ lessonIds: lessonId }).lean();
const course = await Course.findById(module.course).lean();
// Now verify: course.instructor === userId
```

---

## 7. How to Add a New Endpoint (Example)

### Example: Add `/api/courses/[courseId]/students` endpoint

**Goal:** Get list of enrolled students for a course (instructor/admin only)

#### Step 1: Create Route File

Create `app/api/courses/[courseId]/students/route.js`:

```javascript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbConnect } from "@/service/mongo";
import { Enrollment } from "@/model/enrollment-model";
import { verifyInstructorOwnsCourse, isAdmin } from "@/lib/authorization";
import { createErrorResponse, createSuccessResponse, ERROR_CODES } from "@/lib/errors";
import { logRoute } from "@/lib/logger";
import mongoose from "mongoose";

/**
 * GET /api/courses/[courseId]/students
 * Get list of enrolled students for a course (instructor/admin only)
 */
export async function GET(request, { params }) {
    const logger = logRoute('/api/courses/[courseId]/students', 'GET');
    logger.start();
    
    try {
        // 1. Authentication check
        const session = await auth();
        if (!session?.user?.id) {
            logger.failure(new Error('Unauthorized'));
            return NextResponse.json(
                createErrorResponse('Authentication required.', ERROR_CODES.AUTH_REQUIRED),
                { status: 401 }
            );
        }
        
        const userId = session.user.id;
        const user = session.user;
        
        // 2. Get courseId from params
        const { courseId } = await params;
        
        // 3. Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(courseId)) {
            logger.failure(new Error('Invalid courseId'));
            return NextResponse.json(
                createErrorResponse('Invalid course ID.', ERROR_CODES.VALIDATION_ERROR),
                { status: 400 }
            );
        }
        
        // 4. Connect to database
        await dbConnect();
        
        // 5. Verify ownership (instructor) or admin access
        const ownsCourse = await verifyInstructorOwnsCourse(courseId, userId, user);
        if (!ownsCourse && !isAdmin(user)) {
            logger.failure(new Error('Forbidden: Not course instructor or admin'));
            return NextResponse.json(
                createErrorResponse('You do not have permission to view students for this course.', ERROR_CODES.FORBIDDEN),
                { status: 403 }
            );
        }
        
        // 6. Query enrollments with populated student data
        const enrollments = await Enrollment.find({ course: courseId })
            .populate('student', 'firstName lastName email profilePicture')
            .select('student enrollment_date status completion_date')
            .sort({ enrollment_date: -1 })
            .lean();
        
        // 7. Transform data for response
        const students = enrollments.map(enrollment => ({
            id: enrollment.student._id,
            name: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
            email: enrollment.student.email,
            profilePicture: enrollment.student.profilePicture,
            enrollmentDate: enrollment.enrollment_date,
            status: enrollment.status,
            completionDate: enrollment.completion_date
        }));
        
        logger.success();
        return NextResponse.json(
            createSuccessResponse({ students, count: students.length }, 'Students retrieved successfully.')
        );
        
    } catch (error) {
        console.error('[GET_STUDENTS] Error:', error);
        logger.failure(error instanceof Error ? error : new Error(String(error)));
        return NextResponse.json(
            createErrorResponse(
                'Failed to retrieve students. Please try again.',
                ERROR_CODES.INTERNAL_ERROR
            ),
            { status: 500 }
        );
    }
}
```

#### Step 2: Test the Endpoint

**Request:**
```bash
GET /api/courses/507f1f77bcf86cd799439011/students
Authorization: (session cookie)
```

**Success Response (200):**
```json
{
    "ok": true,
    "message": "Students retrieved successfully.",
    "data": {
        "students": [
            {
                "id": "507f1f77bcf86cd799439020",
                "name": "John Doe",
                "email": "john@example.com",
                "profilePicture": "/uploads/avatars/avatar_john.jpg",
                "enrollmentDate": "2025-01-15T10:00:00Z",
                "status": "in-progress",
                "completionDate": null
            }
        ],
        "count": 1
    }
}
```

#### Step 3: Add Rate Limiting (Optional)

```javascript
// After authentication check
const rateLimitResult = rateLimit(`course-students:${userId}`, 10, 60000); // 10 per minute
if (!rateLimitResult.success) {
    return NextResponse.json(
        createErrorResponse('Too many requests.', ERROR_CODES.RATE_LIMITED),
        { status: 429, headers: { 'Retry-After': '60' } }
    );
}
```

#### Step 4: Add Query Function (Optional, for reusability)

Create `queries/enrollments.js` addition:
```javascript
export async function getCourseStudents(courseId, options = {}) {
    await dbConnect();
    
    const query = Enrollment.find({ course: courseId })
        .populate('student', 'firstName lastName email profilePicture');
    
    if (options.sort) {
        query.sort(options.sort);
    }
    
    return await query.lean();
}
```

Then use in route:
```javascript
import { getCourseStudents } from "@/queries/enrollments";
const enrollments = await getCourseStudents(courseId, { sort: { enrollment_date: -1 } });
```

---

## 8. Best Practices & Patterns

### ✅ DO

1. **Always validate input** (Zod schemas or manual validation)
2. **Always authenticate** before accessing protected resources
3. **Always verify ownership** to prevent IDOR attacks
4. **Use query functions** from `queries/` for reusability
5. **Use `.lean()`** for read-only queries (better performance)
6. **Validate ObjectIds** before database queries
7. **Use rate limiting** on sensitive endpoints
8. **Log operations** using `logRoute()` utility
9. **Return standardized responses** using `createSuccessResponse()` / `createErrorResponse()`
10. **Sanitize filenames** to prevent path traversal
11. **Use streaming** for large file uploads/downloads
12. **Clean up resources** on error (delete uploaded files, etc.)

### ❌ DON'T

1. **Don't trust client input** - always validate and verify
2. **Don't expose sensitive data** in error messages (use `sanitizeErrorMessage()`)
3. **Don't load entire files into memory** - use streaming for large files
4. **Don't skip authorization checks** - verify ownership even if user is authenticated
5. **Don't return stack traces** in production error responses
6. **Don't use synchronous operations** - use async/await consistently
7. **Don't forget to handle edge cases** (file not found, duplicate entries, etc.)
8. **Don't skip idempotency checks** for create operations

### Security Checklist

- [ ] Input validation (Zod or manual)
- [ ] Authentication check
- [ ] Authorization check (role/ownership/enrollment)
- [ ] ObjectId validation
- [ ] Rate limiting (if needed)
- [ ] Path traversal prevention (for file operations)
- [ ] File type/size validation (for uploads)
- [ ] Error message sanitization
- [ ] Proper HTTP status codes
- [ ] Idempotency checks (for create operations)

---

## 9. Common Patterns Reference

### Pattern: File Upload with Ownership Check

```javascript
export async function POST(request) {
    const session = await auth();
    if (!session?.user) return unauthorized();
    
    const formData = await request.formData();
    const file = formData.get('file');
    const resourceId = formData.get('resourceId');
    
    // Validate file
    if (!isValidFile(file)) return invalidFile();
    
    // Verify ownership
    const ownsResource = await verifyOwnership(resourceId, session.user.id);
    if (!ownsResource) return forbidden();
    
    // Upload file
    const filename = await saveFile(file);
    
    // Update database
    await updateResource(resourceId, { file: filename });
    
    return success({ filename });
}
```

### Pattern: Streaming Response

```javascript
export async function GET(request, { params }) {
    const { filename } = await params;
    
    // Verify access
    const hasAccess = await verifyAccess(filename, userId);
    if (!hasAccess) return forbidden();
    
    // Stream file
    const fileStream = createReadStream(filepath);
    const webStream = Readable.toWeb(fileStream);
    
    return new Response(webStream, {
        headers: { 'Content-Type': 'application/octet-stream' }
    });
}
```

### Pattern: Webhook Handler

```javascript
export async function POST(request) {
    // Verify webhook signature (if applicable)
    
    const body = await request.json();
    const { referenceId, status } = body;
    
    // Idempotency check
    const existing = await Payment.findOne({ referenceId });
    if (existing) return success({ idempotent: true });
    
    // Create payment
    const payment = await Payment.create({ ... });
    
    // Create enrollment (idempotent)
    try {
        await Enrollment.create({ ... });
    } catch (error) {
        if (error.code === 11000) {
            // Already exists - fine
        } else {
            throw error;
        }
    }
    
    return success({ paymentId: payment._id });
}
```

---

## 10. Error Codes Reference

From `lib/errors.js`:

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `AUTH_REQUIRED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Authenticated but no permission |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `ALREADY_EXISTS` | 409 | Resource already exists (duplicate) |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `DATABASE_ERROR` | 500 | Database operation failed |

---

## 11. Testing Endpoints

### Using cURL

```bash
# GET request with auth cookie
curl -X GET "http://localhost:3000/api/me" \
  -H "Cookie: next-auth.session-token=..."

# POST request with JSON body
curl -X POST "http://localhost:3000/api/register" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"John","lastName":"Doe","email":"john@example.com","password":"pass123","confirmPassword":"pass123","userRole":"student"}'

# POST with multipart/form-data (file upload)
curl -X POST "http://localhost:3000/api/upload" \
  -H "Cookie: next-auth.session-token=..." \
  -F "file=@image.jpg" \
  -F "destination=public/uploads/courses"
```

### Using JavaScript fetch

```javascript
// GET request
const response = await fetch('/api/me', {
    credentials: 'include' // Include cookies
});
const data = await response.json();

// POST with JSON
const response = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName, lastName, email, password, ... })
});

// POST with FormData (file upload)
const formData = new FormData();
formData.append('file', file);
formData.append('destination', 'public/uploads/courses');
const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
});
```

---

## 12. Troubleshooting

### Common Issues

**Issue: "Unauthorized" even when logged in**
- Check session cookie is being sent (`credentials: 'include'` in fetch)
- Verify `auth()` is returning session correctly
- Check user status is 'active' (not 'inactive' or 'suspended')

**Issue: "Forbidden" when should have access**
- Verify ownership check logic (check `verifyInstructorOwnsCourse` implementation)
- Check if admin override is working (`isAdmin(user)`)
- Verify enrollment exists for student endpoints

**Issue: File upload fails**
- Check file size limits
- Verify MIME type is allowed
- Check destination path is in ALLOWED_DESTINATIONS
- Ensure directory exists or is created

**Issue: Database query returns null**
- Verify ObjectId format is valid
- Check if document exists in database
- Verify populate() paths are correct
- Check if `.lean()` is used when needed

**Issue: Video streaming doesn't seek**
- Verify Range header is being sent by client
- Check `parseRange()` function handles all range formats
- Verify file exists and stats are correct
- Check Content-Range header format

---

## Conclusion

This API implementation follows Next.js App Router best practices with:
- Consistent error handling
- Comprehensive authentication/authorization
- Input validation
- Rate limiting
- Proper security measures (IDOR prevention, path traversal prevention)
- Streaming for large files
- Standardized response shapes

When adding new endpoints, follow the patterns outlined in this guide and reference existing endpoints as examples.

---

**End of Guide**
