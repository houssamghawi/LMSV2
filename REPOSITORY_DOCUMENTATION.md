# LMS Repository - Complete Documentation

**Last Updated:** 2025-01-27  
**Repository:** Learning Management System (LMS)  
**Framework:** Next.js 15 (App Router)  
**Database:** MongoDB with Mongoose  
**Authentication:** NextAuth v5

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Repository Tree](#repository-tree)
4. [Architecture Overview](#architecture-overview)
5. [Detailed File Documentation](#detailed-file-documentation)
6. [Key Flows](#key-flows)
7. [Security & Authorization](#security--authorization)
8. [Known Issues & Improvements](#known-issues--improvements)

---

## Project Overview

This is a comprehensive Learning Management System (LMS) built with Next.js 15's App Router. The system supports three user roles:

- **Admin**: Full system access, user management, course oversight, analytics
- **Instructor**: Create and manage own courses, modules, lessons, quizzes; view enrollments
- **Student**: Browse and enroll in courses, watch lessons, take quizzes, earn certificates

### Key Features

- **Course Management**: Hierarchical structure (Courses → Modules → Lessons)
- **Quiz System (V2)**: Multiple question types (single/multi-choice, true/false), auto-grading, attempts tracking
- **Enrollment & Payments**: MockPay integration (simulated payment system)
- **Progress Tracking**: Lesson watch tracking, module completion, course progress reports
- **Certificate Generation**: PDF certificates upon course completion (100% progress + required quizzes)
- **Review/Testimonial System**: Student reviews for courses
- **Role-Based Access Control**: Comprehensive permission system

---

## Tech Stack

### Core Framework
- **Next.js 15.0.5**: App Router, Server Components, Server Actions
- **React 18.3.1**: UI rendering
- **Node.js**: Server runtime

### Styling & UI
- **Tailwind CSS 3.4.1**: Utility-first CSS
- **shadcn/ui**: Component library (Radix UI primitives)
- **Lucide React**: Icon library

### Database & ODM
- **MongoDB**: NoSQL database
- **Mongoose 8.8.2**: ODM for MongoDB

### Authentication & Security
- **NextAuth v5 (beta.25)**: JWT-based session management
- **bcryptjs 2.4.3**: Password hashing
- Custom rate limiting and authorization helpers

### Form Handling & Validation
- **React Hook Form 7.53.2**: Form state management
- **Zod 3.23.8**: Schema validation
- **@hookform/resolvers 3.9.1**: Form validation integration

### Additional Libraries
- **react-player 2.16.0**: Video playback
- **react-quill 2.0.0**: Rich text editor
- **pdf-lib 1.17.1**: PDF generation (certificates)
- **@hello-pangea/dnd 17.0.0**: Drag-and-drop (module/lesson reordering)
- **date-fns 3.6.0**: Date formatting
- **resend 4.0.1**: Email service (optional)
- **sonner 1.7.0**: Toast notifications

---

## Repository Tree

```
LMS-main/
├── app/                          # Next.js App Router pages
│   ├── (main)/                   # Public/main routes (route group)
│   │   ├── account/              # Student account pages
│   │   ├── categories/           # Category listing
│   │   ├── checkout/             # Payment checkout
│   │   ├── courses/              # Course browsing & detail pages
│   │   ├── enroll-success/       # Post-enrollment success page
│   │   ├── inst-profile/         # Instructor profile pages
│   │   ├── layout.js             # Main layout wrapper
│   │   ├── page.js               # Homepage
│   │   └── error.jsx             # Error boundary
│   ├── actions/                  # Server Actions
│   ├── admin/                    # Admin dashboard routes
│   │   ├── analytics/            # Analytics dashboard
│   │   ├── categories/           # Category management
│   │   ├── courses/              # Course oversight
│   │   ├── enrollments/          # Enrollment management
│   │   ├── payments/             # Payment overview
│   │   ├── quizzes/              # Quiz oversight
│   │   ├── reviews/              # Review moderation
│   │   └── users/                # User management
│   ├── api/                      # API Route Handlers
│   │   ├── auth/[...nextauth]/   # NextAuth endpoint
│   │   ├── certificates/         # Certificate generation
│   │   ├── lesson-watch/         # Track lesson viewing
│   │   ├── payments/mock/        # MockPay webhook
│   │   ├── quizv2/               # Quiz attempt API
│   │   ├── upload/               # File upload
│   │   └── videos/               # Video streaming
│   ├── dashboard/                # Instructor dashboard
│   │   ├── courses/              # Course management
│   │   │   └── [courseId]/       # Individual course editor
│   │   │       ├── modules/      # Module management
│   │   │       ├── quizzes/      # Quiz management
│   │   │       └── enrollments/  # Enrollment list
│   │   └── lives/                # Live sessions (placeholder)
│   ├── login/                    # Login page
│   ├── register/                 # Registration pages
│   ├── setup/admin/              # First admin setup
│   ├── layout.js                 # Root layout
│   ├── globals.css               # Global styles
│   └── loading.jsx               # Global loading UI
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components
│   └── [feature components]      # Feature-specific components
├── lib/                          # Utility libraries
│   ├── action-wrapper.js         # Server action error handling
│   ├── auth-helpers.js           # Auth utilities
│   ├── authorization.js          # Ownership verification
│   ├── certificate-helpers.js    # Certificate logic
│   ├── errors.js                 # Error handling system
│   ├── permissions.js            # RBAC definitions
│   ├── rate-limit.js             # Rate limiting
│   └── [other utilities]         # Various helpers
├── model/                        # Mongoose schemas
│   ├── user-model.js             # User schema
│   ├── course-model.js           # Course schema
│   ├── module.model.js           # Module schema
│   ├── lesson.model.js           # Lesson schema
│   ├── enrollment-model.js       # Enrollment schema
│   ├── quizv2-model.js           # Quiz schema
│   ├── questionv2-model.js       # Question schema
│   ├── attemptv2-model.js        # Quiz attempt schema
│   ├── payment-model.js          # Payment schema
│   ├── watch-model.js            # Lesson watch tracking
│   ├── report-model.js           # Progress report schema
│   ├── category-model.js         # Category schema
│   ├── testimonial-model.js      # Review/testimonial schema
│   └── assessment-model.js       # Legacy assessment (deprecated)
├── queries/                      # Database query functions
│   ├── admin.js                  # Admin queries
│   ├── courses.js                # Course queries
│   ├── enrollments.js            # Enrollment queries
│   ├── quizv2.js                 # Quiz queries
│   ├── users.js                  # User queries
│   └── [other query files]       # Various query modules
├── service/                      # External services
│   └── mongo.js                  # MongoDB connection manager
├── public/                       # Static assets
├── hooks/                        # React hooks
├── auth.js                       # NextAuth configuration
├── auth.config.js                # Auth config export
├── middleware.js                 # Next.js middleware (route protection)
├── package.json                  # Dependencies
├── tailwind.config.js            # Tailwind configuration
└── jsconfig.json                 # Path aliases (@/*)
```

---

## Architecture Overview

### Routing Structure

#### Public Routes (`(main)` route group)
- `/` - Homepage (course listing)
- `/courses` - Course catalog with filtering
- `/courses/[id]` - Course detail page
- `/courses/[id]/lesson` - Lesson player (requires enrollment)
- `/courses/[id]/quizzes` - Quiz list for course
- `/courses/[id]/quizzes/[quizId]` - Quiz taking interface
- `/checkout/mock` - MockPay checkout flow
- `/enroll-success` - Post-enrollment success
- `/categories/[id]` - Category page
- `/account` - Student account dashboard
- `/inst-profile/[id]` - Instructor public profile

#### Protected Routes

**Admin Routes** (`/admin/*`)
- Requires: `role === 'admin'` AND `status === 'active'`
- Routes: `/admin`, `/admin/users`, `/admin/courses`, `/admin/analytics`, etc.

**Instructor Dashboard** (`/dashboard/*`)
- Requires: `role === 'instructor' | 'admin'` AND `status === 'active'`
- Routes: `/dashboard/courses`, `/dashboard/courses/[courseId]`, etc.

**Student Routes**
- Account pages: `/account/*` (requires authentication)
- Course access: `/courses/[id]/lesson` (requires enrollment)

### Data Flow

1. **Request → Middleware** (`middleware.js`)
   - Checks authentication
   - Validates user status (active/inactive/suspended)
   - Redirects based on role

2. **Page Component** (Server Component)
   - Fetches data via queries
   - Renders UI with data

3. **User Action → Server Action** (`app/actions/*`)
   - Validates input (Zod)
   - Checks permissions (authorization helpers)
   - Performs database operations (queries)
   - Returns standardized response `{ ok, message, data, errorCode }`

4. **API Routes** (`app/api/*`)
   - Used for webhooks, file uploads, streaming
   - Returns NextResponse

### Database Models & Relationships

```
User (id, email, role, status)
  ├──→ Course.instructor (one-to-many)
  ├──→ Enrollment.student (one-to-many)
  ├──→ Attempt.studentId (one-to-many)
  └──→ Watch.user (one-to-many)

Course (id, title, instructor, category, modules[])
  ├──→ Module.course (one-to-many)
  ├──→ Enrollment.course (one-to-many)
  ├──→ Quiz.courseId (one-to-many)
  └──→ Report.course (one-to-many)

Module (id, title, course, lessonIds[], order)
  ├──→ Lesson (via lessonIds array)
  └──→ Watch.module (one-to-many)

Lesson (id, title, videoUrl/videoFilename, access, order)
  └──→ Watch.lesson (one-to-many)

Quiz (id, courseId, lessonId?, title, published, required, passPercent)
  ├──→ Question.quizId (one-to-many)
  └──→ Attempt.quizId (one-to-many)

Question (id, quizId, type, options[], correctOptionIds[])
  └──→ Answer (embedded in Attempt)

Attempt (id, quizId, studentId, status, answers[], score, scorePercent, passed)
  └──→ Embedded Answer objects

Enrollment (id, student, course, status, method, payment)
  └──→ Payment (optional reference)

Payment (id, user, course, amount, status, provider, referenceId)

Watch (id, user, lesson, module, lastTime, state)
  └──→ Tracks lesson viewing progress

Report (id, student, course, totalCompletedLessons[], totalCompletedModules[], passedQuizIds[])
  └──→ Tracks course progress

Category (id, title, description, thumbnail)

Testimonial (id, user, courseId, content, rating)
```

---

## Detailed File Documentation

### Root Configuration Files

#### `package.json`
- **Purpose**: Defines project dependencies and scripts
- **Key Scripts**:
  - `dev`: Next.js development server
  - `build`: Production build
  - `start`: Production server
- **Dependencies**: See [Tech Stack](#tech-stack) section

#### `auth.js`
- **Purpose**: NextAuth v5 configuration with Credentials provider
- **Key Exports**:
  - `handlers: { GET, POST }` - API route handlers
  - `auth` - Server-side session getter
  - `signIn`, `signOut` - Auth helpers
- **Features**:
  - Rate limiting on login (5 attempts per 15 minutes per email)
  - Password hashing with bcryptjs
  - User status check (prevents inactive/suspended users)
  - Updates `lastLogin` timestamp
  - Timing attack prevention (dummy hash comparison)
- **Used By**: `/api/auth/[...nextauth]/route.js`, middleware, server actions

#### `auth.config.js`
- **Purpose**: Exports NextAuth configuration object
- **Key Settings**:
  - Session strategy: `jwt`, maxAge: 30 days
  - Custom JWT callback (stores: id, email, name, role, status, image)
  - Custom session callback (extends session.user with role/status)
  - Secure cookies in production
- **Used By**: `auth.js`

#### `middleware.js`
- **Purpose**: Route protection and authentication enforcement
- **Key Logic**:
  - Redirects authenticated users away from `/login`, `/register`
  - Blocks inactive/suspended users from all routes
  - Protects `/admin/*` routes (admin only)
  - Protects `/dashboard/*` routes (instructor/admin only)
  - Redirects unauthenticated users to `/login?callbackUrl=...`
- **Public Routes**: Defined in `lib/routes.js`
- **Config**: Matches all routes except `/api`, `_next/static`, `_next/image`, static files

#### `jsconfig.json`
- **Purpose**: Path alias configuration
- **Setting**: `@/*` → `./*` (enables `@/components`, `@/lib`, etc.)

#### `tailwind.config.js`
- **Purpose**: Tailwind CSS configuration
- **Features**: shadcn/ui integration, custom theme

---

### Database & Models (`model/`)

#### `service/mongo.js`
- **Purpose**: MongoDB connection manager with connection pooling
- **Key Exports**: `dbConnect()` - Returns cached connection
- **Features**:
  - Connection caching (global.mongoose)
  - Handles reconnection states
  - Connection pool: maxPoolSize: 10
  - Timeouts: serverSelectionTimeoutMS: 5000, socketTimeoutMS: 45000
- **Used By**: All query functions, server actions, API routes

#### `model/user-model.js`
- **Purpose**: User schema definition
- **Schema Fields**:
  - `firstName`, `lastName` (required, max 50 chars)
  - `email` (required, unique, indexed, lowercase, validated)
  - `password` (required, select: false)
  - `role` (enum: 'admin', 'instructor', 'student', default: 'student')
  - `status` (enum: 'active', 'inactive', 'suspended', default: 'active')
  - `phone`, `bio`, `socialMedia`, `profilePicture`, `designation`
  - `lastLogin`, `createdAt`, `updatedAt`
- **Indexes**: `email` (unique), `role`, `status`
- **Used By**: Auth, user queries, admin actions

#### `model/course-model.js`
- **Purpose**: Course schema
- **Schema Fields**:
  - `title`, `subtitle`, `description`, `thumbnail`
  - `modules[]` (ref: Module)
  - `price` (Number, default: 0)
  - `active` (Boolean, default: false) - Published state
  - `category` (ref: Category)
  - `instructor` (ref: User)
  - `testimonials[]` (ref: Testimonial)
  - `learning[]` (String array)
  - `createdOn`, `modifiedOn` (auto-updated)
- **Pre-save Hook**: Updates `modifiedOn` on save
- **Used By**: Course queries, enrollment, dashboard

#### `model/module.model.js`
- **Purpose**: Course module schema
- **Schema Fields**:
  - `title`, `description`
  - `active` (Boolean, default: false)
  - `slug` (required, String)
  - `course` (ref: Course, required)
  - `lessonIds[]` (ref: Lesson)
  - `order` (Number, required) - For sorting
- **Used By**: Module queries, course display

#### `model/lesson.model.js`
- **Purpose**: Lesson/lesson schema
- **Schema Fields**:
  - `title`, `description`, `duration` (Number, default: 0)
  - `video_url` (legacy, String)
  - `videoProvider` (enum: 'local', 'external', default: 'external')
  - `videoFilename`, `videoUrl`, `videoMimeType`, `videoSize` - For local uploads
  - `active` (Boolean, default: false)
  - `slug` (required, String)
  - `access` (String, default: 'private')
  - `order` (Number, required)
- **Used By**: Lesson queries, video player, watch tracking

#### `model/enrollment-model.js`
- **Purpose**: Student course enrollment schema
- **Schema Fields**:
  - `enrollment_date` (Date, default: Date.now)
  - `status` (enum: 'not-started', 'in-progress', 'completed', default: 'not-started')
  - `completion_date` (Date, optional)
  - `method` (enum: 'stripe', 'free', 'manual', 'mockpay', default: 'stripe')
  - `course` (ref: Course, required, indexed)
  - `student` (ref: User, required, indexed)
  - `payment` (ref: Payment, optional)
- **Indexes**:
  - Unique: `{ student: 1, course: 1 }` - One enrollment per student per course
  - Compound: `{ course: 1, enrollment_date: -1 }`, `{ student: 1, enrollment_date: -1 }`
- **Used By**: Enrollment queries, payment webhooks, progress tracking

#### `model/quizv2-model.js`
- **Purpose**: Quiz schema (V2 - improved system)
- **Schema Fields**:
  - `courseId` (ref: Course, required, indexed)
  - `lessonId` (ref: Lesson, optional, default: null) - If null, course-level quiz
  - `title` (required, String)
  - `description` (String, default: '')
  - `published` (Boolean, default: false, indexed)
  - `required` (Boolean, default: false) - Must pass to complete course
  - `passPercent` (Number, default: 70, min: 0, max: 100)
  - `timeLimitSec` (Number, optional, min: 1)
  - `maxAttempts` (Number, optional, min: 1)
  - `shuffleQuestions` (Boolean, default: false)
  - `shuffleOptions` (Boolean, default: false)
  - `showAnswersPolicy` (enum: 'never', 'after_submit', 'after_pass', default: 'after_submit')
  - `createdBy` (ref: User, required)
  - `createdAt`, `updatedAt` (timestamps: true)
- **Indexes**:
  - `{ courseId: 1, published: 1 }`
  - `{ lessonId: 1 }`
  - `{ courseId: 1, lessonId: 1 }`
  - `{ createdBy: 1 }`
- **Used By**: Quiz queries, quiz actions, certificate verification

#### `model/questionv2-model.js`
- **Purpose**: Quiz question schema
- **Schema Fields**:
  - `quizId` (ref: Quiz, required, indexed)
  - `type` (enum: 'single', 'multi', 'true_false', required)
  - `text` (required, String, trimmed)
  - `options[]` (Array of `{ id: String, text: String }`, min: 2)
  - `correctOptionIds[]` (Array of String, required)
  - `explanation` (String, default: '')
  - `points` (Number, default: 1, min: 0)
  - `order` (Number, required, default: 0)
  - `createdAt`, `updatedAt` (timestamps: true)
- **Validation**: `correctOptionIds.length > 0` and `<= options.length`
- **Indexes**: `{ quizId: 1, order: 1 }`
- **Used By**: Quiz question management, quiz taking

#### `model/attemptv2-model.js`
- **Purpose**: Quiz attempt tracking schema
- **Schema Fields**:
  - `quizId` (ref: Quiz, required, indexed)
  - `studentId` (ref: User, required, indexed)
  - `status` (enum: 'in_progress', 'submitted', 'expired', default: 'in_progress', indexed)
  - `startedAt` (Date, default: Date.now, required)
  - `expiresAt` (Date, optional) - Set if quiz has timeLimitSec
  - `submittedAt` (Date, optional)
  - `answers[]` (Array of `{ questionId: ObjectId, selectedOptionIds: [String] }`)
  - `score` (Number, default: 0)
  - `scorePercent` (Number, default: 0)
  - `passed` (Boolean, default: false) - Based on passPercent
  - `createdAt`, `updatedAt` (timestamps: true)
- **Indexes**:
  - `{ quizId: 1, studentId: 1, submittedAt: -1 }`
  - `{ studentId: 1, submittedAt: -1 }`
  - Unique partial: `{ quizId: 1, studentId: 1 }` where `status === 'in_progress'` - One active attempt per quiz per student
- **Used By**: Quiz submission, result display, progress tracking

#### `model/payment-model.js`
- **Purpose**: Payment transaction schema (supports Stripe and MockPay)
- **Schema Fields**:
  - `user`, `course` (refs, required, indexed)
  - `sessionId`, `paymentIntentId`, `customerId` (String, indexed, sparse) - Stripe fields
  - `referenceId` (String, unique, sparse, indexed) - MockPay field
  - `amount` (Number, required)
  - `currency` (String, default: 'USD')
  - `status` (enum: 'pending', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'canceled', indexed)
  - `provider` (enum: 'stripe', 'mockpay', default: 'stripe', indexed)
  - `metadata` (Mixed, default: {})
  - `refundedAmount`, `refundReason`
  - `paidAt`, `refundedAt`, `createdAt`, `updatedAt`
- **Indexes**:
  - `{ user: 1, course: 1 }`
  - `{ status: 1, createdAt: -1 }`
  - `{ provider: 1, referenceId: 1 }` (sparse)
  - `{ provider: 1, sessionId: 1 }` (sparse)
- **Pre-save Hook**: Updates `updatedAt`
- **Used By**: Payment webhooks, enrollment creation, admin dashboard

#### `model/watch-model.js`
- **Purpose**: Lesson viewing progress tracking
- **Schema Fields**:
  - `state` (String, default: 'started') - Viewing state
  - `created_at`, `modified_at` (Date, auto-updated)
  - `lesson` (ref: Lesson)
  - `module` (ref: Module)
  - `user` (ref: User)
  - `lastTime` (Number, default: 0) - Last watched timestamp (seconds)
- **Indexes**:
  - `{ user: 1, module: 1, state: 1 }`
  - `{ user: 1, lesson: 1 }`
  - `{ module: 1, state: 1 }`
- **Pre-save Hook**: Updates `modified_at`
- **Used By**: Lesson watch API, progress calculation

#### `model/report-model.js`
- **Purpose**: Course progress report schema
- **Schema Fields**:
  - `totalCompletedLessons[]` (Array, default: [])
  - `totalCompletedModules[]` (Array, default: [])
  - `course` (ref: Course)
  - `student` (ref: User)
  - `quizAssessment` (ref: Assessment, legacy)
  - `passedQuizIds[]` (Array of Quiz refs) - Quiz V2 tracking
  - `latestQuizAttemptByQuiz` (Map<String, String>) - Maps quizId to attemptId
  - `completion_date` (Date, optional)
- **Indexes**: Unique `{ course: 1, student: 1 }`
- **Virtuals**: `totalCompletedModeules` (backward compatibility typo)
- **Used By**: Progress tracking, certificate verification, course completion

#### `model/category-model.js`
- **Purpose**: Course category schema
- **Schema Fields**:
  - `title` (required, String)
  - `description` (String, optional)
  - `thumbnail` (required, String)
- **Used By**: Course categorization, category listing

#### `model/testimonial-model.js`
- **Purpose**: Course review/testimonial schema
- **Schema Fields**:
  - `content` (required, String)
  - `rating` (required, Number)
  - `courseId` (ref: Course)
  - `user` (ref: User)
- **Used By**: Course reviews, admin review moderation

#### `model/assessment-model.js`
- **Purpose**: Legacy assessment schema (appears deprecated, kept for backward compatibility)
- **Schema Fields**:
  - `assessments[]` (Array, required)
  - `otherMarks` (Number, required)
- **Notes**: Referenced in Report schema but may not be actively used (Quiz V2 replaced this)

---

### Utility Libraries (`lib/`)

#### `lib/authorization.js`
- **Purpose**: Ownership verification and authorization checks (prevents IDOR)
- **Key Exports**:
  - `AuthorizationError` - Custom error class (statusCode: 403)
  - `isAdmin(user)`, `isInstructor(user)`, `isAdminOrInstructor(user)`
  - `assertInstructorOwnsCourse(courseId, userId, options)` - Throws if not owner
  - `verifyInstructorOwnsCourse(courseId, userId, user)` - Returns boolean
  - `assertInstructorOwnsModule(moduleId, userId, user)` - Verifies via course ownership
  - `assertInstructorOwnsLesson(lessonId, userId, user)` - Verifies via module → course
  - `verifyOwnsAllModules(moduleIds[], userId, user)` - Batch verification
  - `verifyOwnsAllLessons(lessonIds[], userId, user)` - Batch verification
  - `getCourseWithOwnershipCheck(courseId, userId, user)` - Returns course or null
- **Admin Override**: All functions allow admin access (checks `user.role === 'admin'`)
- **Used By**: Server actions (course, module, lesson management)

#### `lib/permissions.js`
- **Purpose**: RBAC permission definitions (single source of truth)
- **Key Exports**:
  - `ROLES` - Object with ADMIN, INSTRUCTOR, STUDENT
  - `PERMISSIONS` - All permission constants (e.g., `USERS_VIEW`, `COURSES_EDIT_ALL`)
  - `ROLE_PERMISSIONS` - Mapping of role to permissions array
  - `hasPermission(userRole, permission)` - Check permission
  - `hasAnyPermission(userRole, permissions[])` - Check any
  - `hasAllPermissions(userRole, permissions[])` - Check all
  - `isAdmin(userRole)`, `isInstructor(userRole)`, `isStudent(userRole)`
  - `requireAdmin(userRole)`, `requirePermission(userRole, permission)` - Throw if not authorized
- **Used By**: Authorization checks, permission validation

#### `lib/auth-helpers.js`
- **Purpose**: Server-side authentication utilities
- **Key Exports**:
  - `getCurrentUser()` - Returns session.user or null
  - `requireAuth(redirectToLogin)` - Throws or redirects if not authenticated
  - `requireRole(roles, redirectToLogin)` - Requires specific role(s)
  - `requireAdmin(redirectToLogin)` - Requires admin
  - `requireInstructorOrAdmin(redirectToLogin)` - Requires instructor or admin
  - `hasRole(role)`, `isAdmin()`, `isInstructor()`, `isStudent()` - Async checks
  - `isActive()` - Checks user status
- **Features**: Checks user status (blocks inactive/suspended users)
- **Used By**: Layout components, server actions, API routes

#### `lib/auth-redirect.js`
- **Purpose**: Determines redirect URL based on user role
- **Key Exports**: `getRedirectUrlByRole(role)` - Returns dashboard URL
- **Mapping**: admin → `/admin`, instructor → `/dashboard`, student → `/`

#### `lib/routes.js`
- **Purpose**: Centralized route constants
- **Exports**:
  - `LOGIN = '/login'`
  - `ROOT = '/'`
  - `PUBLIC_ROUTES[]` - Array of public route paths (used by middleware)

#### `lib/action-wrapper.js`
- **Purpose**: Server action error handling wrapper
- **Key Exports**:
  - `withActionErrorHandling(actionFn, options)` - Wraps action with error handling
- **Features**:
  - Automatic error logging (via `lib/logger.js`)
  - Zod error extraction (field-level errors)
  - Standardized response format `{ ok, message, data, errorCode, fieldErrors }`
  - Path revalidation support (`revalidatePaths` option)
- **Options**:
  - `actionName` - Name for logging
  - `revalidatePaths` - Array of paths to revalidate on success
- **Used By**: Some server actions (not all use it - inconsistency)

#### `lib/errors.js`
- **Purpose**: Standardized error handling system
- **Key Exports**:
  - `ERROR_CODES` - Enum of error codes (AUTH_REQUIRED, FORBIDDEN, VALIDATION_ERROR, etc.)
  - `createSuccessResponse(data, message)` - Standard success response
  - `createErrorResponse(message, errorCode, fieldErrors)` - Standard error response
  - `createValidationErrorResponse(fieldErrors, message)` - Validation error
  - `createApiErrorResponse(message, status, errorCode, details)` - API route error
  - `getErrorCode(error)` - Maps error to error code
  - `sanitizeErrorMessage(error, defaultMessage)` - Removes sensitive info
  - `extractZodFieldErrors(zodError)` - Extracts field errors from Zod
- **Used By**: Server actions, API routes

#### `lib/certificate-helpers.js`
- **Purpose**: Certificate generation logic and verification
- **Key Exports**:
  - `checkCourseCompletion(courseId, userId)` - Returns completion status, progress, dates
  - `verifyCertificateAccess(courseId, userId)` - Verifies enrollment + completion
- **Completion Logic**:
  - Requires 100% module completion (all modules in `totalCompletedModules`)
  - Requires all required course-level quizzes to be passed (`passedQuizIds`)
  - Returns detailed progress info (modules, quizzes)
- **Used By**: Certificate API route, certificate download component

#### `lib/rate-limit.js`
- **Purpose**: In-memory rate limiting (simple implementation)
- **Key Exports**: `rateLimit(key, maxRequests, windowMs)` - Returns `{ success: boolean }`
- **Features**: Uses Map for storage (clears expired entries)
- **Limitation**: In-memory only (not distributed, resets on server restart)
- **Used By**: Auth login, certificate generation, potentially other endpoints

#### `lib/logger.js`
- **Purpose**: Action/route logging utility
- **Key Exports**:
  - `logAction(actionName)` - Returns logger with start(), success(), failure() methods
  - `logRoute(route, method)` - Similar for API routes
  - `error(...args)` - Error logging helper
- **Features**: Structured logging for debugging and monitoring

#### `lib/validations.js`
- **Purpose**: Zod validation schemas
- **Key Exports**: Validation schemas for forms (course, module, lesson, quiz, etc.)
- **Used By**: Server actions for input validation

#### `lib/loggedin-user.js`
- **Purpose**: Get current logged-in user (database fetch, not just session)
- **Key Exports**: `getLoggedInUser()` - Returns full User document from DB
- **Used By**: Server actions that need full user data (not just session)

#### `lib/formatPrice.js`
- **Purpose**: Format price as currency string
- **Key Exports**: `formatPrice(amount)` - Returns formatted string (e.g., '$49.99')

#### `lib/utils.js`
- **Purpose**: General utilities (likely shadcn/ui cn() function)
- **Key Exports**: `cn(...classes)` - Tailwind class name merger

#### Other `lib/` files:
- `admin-utils.js` - Admin-specific utilities
- `constants.js` - App constants
- `convertData.js` - Data transformation helpers
- `dashboard-helper.js` - Dashboard-specific helpers
- `date.js` - Date formatting (`formatMyDate()`)
- `image-utils.js` - Image processing utilities
- `toast-helpers.js` - Toast notification helpers

---

### Server Actions (`app/actions/`)

Server Actions are Next.js server-side functions called directly from client components. They return standardized responses: `{ ok: boolean, message: string, data?: any, errorCode?: string, fieldErrors?: Record<string, string> }`

#### `app/actions/index.js`
- **Purpose**: Re-exports common actions and provides `credentialLogin` wrapper
- **Key Exports**: `credentialLogin` (wrapped with error handling)

#### `app/actions/account.js`
- **Purpose**: User account management actions
- **Key Functions**:
  - `updateUserInfo(email, updatedData)` - Update user profile (name, phone, bio, etc.)
  - `changePassword(email, oldPassword, newPassword, confirmPassword)` - Change password (validates old password)
- **Used By**: Account page components

#### `app/actions/admin-setup.js`
- **Purpose**: First admin account setup (only works if no admin exists)
- **Key Functions**:
  - `setupFirstAdmin(formData)` - Creates first admin user
  - `isAdminSetupAvailable()` - Checks if setup is needed (returns boolean)
- **Used By**: `/setup/admin` page

#### `app/actions/admin.js`
- **Purpose**: Admin user management actions
- **Key Functions**:
  - `adminGetUsers(params)` - Paginated user list with filters
  - `adminGetUser(userId)` - Get single user
  - `adminUpdateUserRole(userId, newRole)` - Change user role (requires admin)
  - `adminUpdateUserStatus(userId, status)` - Change user status (active/inactive/suspended)
  - `adminDeleteUser(userId)` - Delete user (with validation)
  - `adminBulkAction(userIds[], action, options)` - Bulk operations (activate/deactivate/delete)
- **Authorization**: All require admin role
- **Used By**: Admin users page

#### `app/actions/admin-categories.js`
- **Purpose**: Admin category management
- **Key Functions**:
  - `adminGetCategories()` - Get all categories
  - `adminCreateCategory(data)` - Create category
  - `adminUpdateCategory(categoryId, data)` - Update category
  - `adminDeleteCategory(categoryId)` - Delete category
- **Used By**: Admin categories page

#### `app/actions/admin-courses.js`
- **Purpose**: Admin course oversight (view/edit all courses)
- **Key Functions**:
  - `adminGetCourses()` - Get all courses
  - `adminGetCourse(courseId)` - Get single course
  - `adminUpdateCourseStatus(courseId, active)` - Publish/unpublish course
  - `adminDeleteCourse(courseId)` - Delete course
- **Used By**: Admin courses page

#### `app/actions/course.js`
- **Purpose**: Instructor course management (own courses only)
- **Key Functions**:
  - `createCourse(data)` - Create new course (sets instructor to current user)
  - `updateCourse(courseId, dataToUpdate)` - Update course (verifies ownership)
  - `changeCoursePublishState(courseId)` - Toggle active state
  - `deleteCourse(courseId)` - Delete course (verifies ownership)
- **Authorization**: Uses `assertInstructorOwnsCourse()` (admin can access all)
- **Used By**: Dashboard course editor

#### `app/actions/module.js`
- **Purpose**: Module management
- **Key Functions**:
  - `createModule(data)` - Create module (verifies course ownership)
  - `reOrderModules(data)` - Reorder modules (drag-and-drop, verifies ownership of all)
  - `updateModule(moduleId, data)` - Update module
  - `changeModulePublishState(moduleId)` - Toggle active state
  - `deleteModule(moduleId, courseId)` - Delete module
- **Authorization**: Verifies course ownership via `assertInstructorOwnsModule()`
- **Used By**: Dashboard module editor

#### `app/actions/lesson.js`
- **Purpose**: Lesson management
- **Key Functions**:
  - `createLesson(data)` - Create lesson (verifies module/course ownership)
  - `reOrderLesson(data)` - Reorder lessons within module
  - `updateLesson(lessonId, data)` - Update lesson
  - `changeLessonPublishState(lessonId)` - Toggle active state
  - `deleteLesson(lessonId, moduleId)` - Delete lesson
- **Authorization**: Verifies ownership via `assertInstructorOwnsLesson()`
- **Used By**: Dashboard lesson editor

#### `app/actions/enrollment.js`
- **Purpose**: Student enrollment actions
- **Key Functions**:
  - `enrollInFreeCourse(data)` - Enroll in free course (price === 0)
    - Validates course exists and is free
    - Checks if already enrolled (idempotent)
    - Creates enrollment with method: 'free'
- **Used By**: Course detail page, enrollment button

#### `app/actions/quizv2.js`
- **Purpose**: Quiz management and taking (V2 system)
- **Key Functions**:

  **Quiz CRUD:**
  - `createQuiz(courseId, lessonId, data)` - Create quiz (course-level or lesson-level)
  - `updateQuiz(quizId, data)` - Update quiz settings
  - `deleteQuiz(quizId)` - Delete quiz
  - `publishQuiz(quizId, published)` - Toggle published state

  **Question Management:**
  - `addQuestion(quizId, questionData)` - Add question to quiz
  - `updateQuestion(questionId, questionData)` - Update question
  - `deleteQuestion(questionId)` - Delete question
  - `reorderQuestions(quizId, orderedQuestionIds[])` - Reorder questions

  **Quiz Taking:**
  - `startOrResumeAttempt(quizId)` - Start new attempt or resume in-progress
    - Returns quiz with questions (shuffled if enabled)
    - Returns existing attempt if in-progress
    - Creates new attempt if none exists
    - Enforces maxAttempts limit
    - Sets expiresAt if timeLimitSec exists
  - `autosaveAttempt(attemptId, answers[])` - Save progress without submitting
  - `submitAttempt(attemptId, answers[])` - Submit and grade attempt
    - Calculates score and scorePercent
    - Determines passed based on passPercent
    - Updates Report with quiz completion
    - Marks attempt as 'submitted'
  - `getAttemptResult(attemptId)` - Get graded attempt with correct answers (based on showAnswersPolicy)

- **Authorization**: Quiz CRUD requires course ownership, quiz taking requires enrollment
- **Used By**: Dashboard quiz editor, quiz taking interface

#### `app/actions/quizProgressv2.js`
- **Purpose**: Quiz progress tracking integration
- **Key Functions**:
  - `updateQuizCompletionInReport(courseId, userId, quizId, lessonId)` - Updates Report when quiz is passed
- **Used By**: Quiz submission action

#### `app/actions/review.js`
- **Purpose**: Course review/testimonial creation
- **Key Functions**:
  - `createReview(data, loginid, courseId)` - Create review (requires enrollment)
- **Used By**: Course review modal

---

### API Routes (`app/api/`)

API Routes handle webhooks, file uploads, streaming, and other non-page requests.

#### `app/api/auth/[...nextauth]/route.js`
- **Purpose**: NextAuth API endpoint
- **Exports**: `GET`, `POST` handlers (re-exported from `auth.js`)
- **Routes**: `/api/auth/signin`, `/api/auth/signout`, `/api/auth/callback`, etc.

#### `app/api/certificates/[courseId]/route.js`
- **Purpose**: Generate and download certificate PDF
- **Method**: GET
- **Flow**:
  1. Authenticates user
  2. Rate limits (5 per minute per user+IP)
  3. Verifies courseId validity
  4. Verifies enrollment and completion (`verifyCertificateAccess()`)
  5. Fetches course and user details
  6. Loads fonts and images (Kalam, Montserrat, logo, sign, pattern)
  7. Generates PDF using pdf-lib
  8. Returns PDF with proper headers
- **Authorization**: Requires enrollment + 100% completion + required quizzes passed
- **Used By**: Certificate download button

#### `app/api/lesson-watch/route.js`
- **Purpose**: Track lesson viewing progress
- **Method**: POST
- **Body**: `{ lessonId, moduleId, lastTime, state }`
- **Flow**: Creates or updates Watch document
- **Used By**: Video player component (sends periodic updates)

#### `app/api/payments/mock/confirm/route.js`
- **Purpose**: MockPay webhook - confirms payment and creates enrollment
- **Method**: POST
- **Flow**:
  1. Validates referenceId from MockPay
  2. Creates Payment document (status: 'succeeded', provider: 'mockpay')
  3. Creates Enrollment (method: 'mockpay', payment: paymentId) - idempotent
  4. Returns success response
- **Used By**: MockPay checkout flow

#### `app/api/payments/status/route.js`
- **Purpose**: Check payment status
- **Method**: GET
- **Query**: `referenceId` (MockPay) or `sessionId` (Stripe)
- **Returns**: Payment status

#### `app/api/quizv2/attempts/[attemptId]/route.js`
- **Purpose**: Get quiz attempt details (API alternative to server action)
- **Method**: GET
- **Returns**: Attempt with quiz and questions

#### `app/api/register/route.js`
- **Purpose**: User registration API endpoint
- **Method**: POST
- **Body**: `{ firstName, lastName, email, password, role }`
- **Flow**: Validates input, hashes password, creates User
- **Used By**: Registration form

#### `app/api/upload/route.js`
- **Purpose**: File upload handler (images, documents)
- **Method**: POST
- **Flow**: Handles multipart/form-data, saves to filesystem, returns file path

#### `app/api/upload/video/route.js`
- **Purpose**: Video upload handler (larger files)
- **Method**: POST
- **Flow**: Streams video upload, saves to filesystem/cloud storage, returns video URL

#### `app/api/videos/[filename]/route.js`
- **Purpose**: Video streaming endpoint (serves local videos)
- **Method**: GET
- **Flow**: Streams video file with proper headers (Range support for seeking)
- **Security**: Should verify enrollment before streaming (may need review)

#### `app/api/profile/avatar/route.js`
- **Purpose**: Profile picture upload
- **Method**: POST
- **Flow**: Uploads image, updates User.profilePicture

#### `app/api/me/route.js`
- **Purpose**: Get current user info (API endpoint)
- **Method**: GET
- **Returns**: Current user from session

---

### Query Functions (`queries/`)

Query functions are database access layer - they handle Mongoose queries with proper connection management and data transformation.

#### `queries/users.js`
- **Purpose**: User database queries
- **Key Functions**:
  - `getUserByEmail(email)` - Find user by email
  - `getUserById(userId)` - Find user by ID
  - `createUser(userData)` - Create new user
  - `updateUser(userId, data)` - Update user
- **Used By**: Auth, account actions, admin actions

#### `queries/courses.js`
- **Purpose**: Course database queries
- **Key Functions**:
  - `getCourseDetails(courseId)` - Get course with populated instructor, category, modules
  - `getCourseDetailsByInstructor(instructorId)` - Get instructor's courses with stats
  - `getActiveCourses()` - Get published courses for public listing
  - `createCourse(data)` - Create course
  - `updateCourse(courseId, data)` - Update course
- **Used By**: Course pages, dashboard, enrollment

#### `queries/enrollments.js`
- **Purpose**: Enrollment database queries
- **Key Functions**:
  - `enrollForCourse(courseId, userId, paymentMethod, paymentId)` - Create enrollment (idempotent)
  - `getEnrollmentsForUser(userId)` - Get user's enrollments with course details
  - `hasEnrollmentForCourse(courseId, userId)` - Check if enrolled
  - `getEnrollmentsForCourse(courseId)` - Get all enrollments for course (instructor view)
- **Used By**: Enrollment actions, payment webhooks, dashboard

#### `queries/quizv2.js`
- **Purpose**: Quiz V2 database queries
- **Key Functions**:
  - `getCourseQuizzes(courseId, options)` - Get quizzes for course (with filters)
  - `getQuizWithQuestions(quizId, options)` - Get quiz with questions (shuffled if needed)
  - `getStudentQuizStatusMap(courseId, studentId)` - Get quiz completion status for student
  - `getAttemptById(attemptId)` - Get attempt with quiz and questions
  - `createAttempt(data)`, `updateAttempt(attemptId, data)` - Attempt CRUD
- **Used By**: Quiz actions, quiz pages

#### `queries/admin.js`
- **Purpose**: Admin dashboard queries
- **Key Functions**:
  - `getAdminStats()` - Aggregated statistics (users, courses, enrollments, revenue)
  - `getUserById(userId)` - Get user for admin view
  - Various aggregation queries for analytics
- **Used By**: Admin dashboard page

#### `queries/categories.js`
- **Purpose**: Category queries
- **Key Functions**: CRUD operations for categories

#### `queries/lessons.js`, `queries/modules.js`
- **Purpose**: Lesson and module queries
- **Key Functions**: CRUD, reordering, fetching with relations

#### `queries/payments.js`, `queries/payments-admin.js`
- **Purpose**: Payment queries
- **Key Functions**: Payment CRUD, status checks, revenue aggregation

#### `queries/reports.js`
- **Purpose**: Progress report queries
- **Key Functions**: Report creation/updates, progress calculation

#### `queries/testimonials.js`
- **Purpose**: Review/testimonial queries
- **Key Functions**: CRUD, filtering by course, approval status

#### `queries/admin-setup.js`
- **Purpose**: Admin setup verification
- **Key Functions**: `checkAdminExists()` - Checks if any admin user exists

---

### Page Components Overview

#### Public Pages (`app/(main)/`)

##### `app/(main)/page.js`
- **Purpose**: Homepage - Course listing with featured courses
- **Data**: Fetches active courses, categories
- **Features**: Hero section, course grid, filtering

##### `app/(main)/courses/page.jsx`
- **Purpose**: Course catalog with advanced filtering
- **Features**: Search, category filter, sort options, pagination
- **Components**: `FilterCourse`, `SearchCourse`, `SortCourse`, `CourseCard`

##### `app/(main)/courses/[id]/page.jsx`
- **Purpose**: Course detail page
- **Data**: Fetches course with modules, instructor, testimonials
- **Features**: Course overview, curriculum, instructor info, enrollment button, reviews
- **Components**: `CourseDetails`, `CourseCurriculam`, `CourseInstructor`, `Testimonials`

##### `app/(main)/courses/[id]/lesson/page.jsx`
- **Purpose**: Lesson video player (requires enrollment)
- **Data**: Fetches lesson, course modules, enrollment status
- **Features**: Video player, sidebar navigation, progress tracking, download certificate button
- **Components**: `VideoPlayer`, `CourseSidebar`, `VideoDescription`
- **Authorization**: Verifies enrollment before access

##### `app/(main)/courses/[id]/quizzes/[quizId]/page.jsx`
- **Purpose**: Quiz taking interface
- **Data**: Fetches quiz with questions (via `startOrResumeAttempt` action)
- **Features**: Question display, answer selection, timer (if timeLimitSec), autosave, submit
- **Components**: `QuizTakingInterface`

##### `app/(main)/courses/[id]/quizzes/[quizId]/result/page.jsx`
- **Purpose**: Quiz result page
- **Data**: Fetches attempt result (via `getAttemptResult` action)
- **Features**: Score display, correct/incorrect answers (based on showAnswersPolicy), explanations

##### `app/(main)/checkout/mock/page.jsx`
- **Purpose**: MockPay checkout page
- **Features**: Payment form, redirects to MockPay, polling for payment status
- **Components**: `CheckoutForm`

##### `app/(main)/account/page.jsx` & `@tabs/*`
- **Purpose**: Student account dashboard
- **Features**: Profile editing, enrolled courses list, change password
- **Tabs**: Personal details, enrolled courses

#### Admin Pages (`app/admin/`)

##### `app/admin/page.jsx`
- **Purpose**: Admin dashboard overview
- **Data**: Fetches admin stats (cached for 5 minutes)
- **Features**: Stat cards (users, courses, enrollments, revenue), quick actions, recent activity

##### `app/admin/users/page.jsx`
- **Purpose**: User management
- **Features**: User table with filters, role change dialog, status change dialog, delete dialog
- **Components**: `UsersTable`, `UserRoleDialog`, `UserStatusDialog`, `DeleteUserDialog`

##### `app/admin/courses/page.jsx`
- **Purpose**: Course oversight (all courses)
- **Features**: Course table, publish/unpublish, delete

##### `app/admin/enrollments/page.jsx`, `payments/page.jsx`, `reviews/page.jsx`
- **Purpose**: Management pages for enrollments, payments, reviews
- **Features**: Tables with filtering, actions (approve/delete reviews)

##### `app/admin/analytics/page.jsx`
- **Purpose**: Analytics dashboard
- **Features**: Charts, revenue trends, user growth (components: `AnalyticsCharts`)

#### Instructor Dashboard (`app/dashboard/`)

##### `app/dashboard/page.jsx`
- **Purpose**: Instructor dashboard overview
- **Data**: Fetches instructor's course stats (total courses, enrollments, revenue)
- **Features**: Stat cards

##### `app/dashboard/courses/page.jsx`
- **Purpose**: Instructor's course list
- **Features**: Course table with publish status, create course button
- **Components**: `CoursesTable` (data-table)

##### `app/dashboard/courses/add/page.jsx`
- **Purpose**: Create new course
- **Features**: Multi-step form (title, description, image, price, category)

##### `app/dashboard/courses/[courseId]/page.jsx`
- **Purpose**: Course editor (instructor's own courses)
- **Features**: Course settings (title, description, image, price, category, publish toggle)
- **Components**: `TitleForm`, `DescriptionForm`, `ImageForm`, `PriceForm`, `CategoryForm`, `CourseAction`

##### `app/dashboard/courses/[courseId]/modules/[moduleId]/page.jsx`
- **Purpose**: Module editor with lessons
- **Features**: Module title, lesson list, add/edit/delete lessons, reorder lessons
- **Components**: `ModuleTitleForm`, `LessonList`, `LessonForm`, `LessonModal`, `VideoUploadField`

##### `app/dashboard/courses/[courseId]/quizzes/page.jsx`
- **Purpose**: Quiz list for course
- **Features**: List of quizzes (course-level and lesson-level), create quiz button

##### `app/dashboard/courses/[courseId]/quizzes/new/page.jsx`
- **Purpose**: Create new quiz
- **Features**: Quiz form (title, description, settings: passPercent, timeLimit, maxAttempts, shuffle, showAnswersPolicy)

##### `app/dashboard/courses/[courseId]/quizzes/[quizId]/page.jsx`
- **Purpose**: Quiz editor
- **Features**: Quiz settings, question list, add/edit/delete/reorder questions
- **Components**: `QuizEditForm`, `QuestionList`, `AddQuestionForm`, `EditQuestionModal`

##### `app/dashboard/courses/[courseId]/quizzes/[quizId]/attempts/page.jsx`
- **Purpose**: View student attempts for quiz
- **Features**: Attempt table (student, score, passed, submitted date)

##### `app/dashboard/courses/[courseId]/enrollments/page.jsx`
- **Purpose**: Enrollment list for course
- **Features**: Student list, enrollment date, status

---

## Key Flows

### Authentication Flow

1. **Login** (`/login`)
   - User submits email/password
   - `credentialLogin` action (or direct NextAuth signIn)
   - `auth.js` authorize function:
     - Rate limiting check (5 attempts per 15 minutes)
     - Database lookup (User.findOne with password)
     - Status check (must be 'active')
     - Password verification (bcrypt.compare)
     - Update lastLogin timestamp
     - Return user object { id, email, name, role, status, image }
   - NextAuth creates JWT token (via auth.config.js JWT callback)
   - Session created (30-day expiry)
   - Redirect based on role (via middleware or redirectUrl)

2. **Session Management**
   - JWT stored in cookie (`next-auth.session-token`)
   - Session accessible via `auth()` server function
   - Middleware validates session on every request
   - Inactive/suspended users are blocked and redirected to login

3. **Logout**
   - `signOut()` from NextAuth
   - Cookie cleared, redirect to login

### Course Enrollment Flow

1. **Free Course Enrollment**
   - Student clicks "Enroll" on course detail page
   - `enrollInFreeCourse` action called
   - Validates course exists and price === 0
   - Checks if already enrolled (idempotent)
   - Creates Enrollment document (method: 'free', status: 'not-started')
   - Redirects to course or shows success message

2. **Paid Course Enrollment (MockPay)**
   - Student clicks "Enroll" on paid course
   - Redirects to `/checkout/mock?courseId=...`
   - CheckoutForm displays course details and payment form
   - User submits payment (MockPay simulation)
   - Frontend creates Payment document (status: 'pending')
   - Redirects to MockPay confirmation page
   - MockPay webhook (`/api/payments/mock/confirm`) called:
     - Validates referenceId
     - Creates Payment document (status: 'succeeded', provider: 'mockpay')
     - Creates Enrollment (method: 'mockpay', payment: paymentId) - idempotent
   - Frontend polls `/api/payments/status` until 'succeeded'
   - Redirects to `/enroll-success`

3. **Enrollment Verification**
   - Before accessing course lessons, middleware/component checks Enrollment exists
   - `hasEnrollmentForCourse()` query used

### Lesson Watch & Progress Tracking Flow

1. **Lesson Access**
   - Student navigates to `/courses/[id]/lesson`
   - Page verifies enrollment
   - Fetches lesson, course modules, enrollment
   - Displays video player and sidebar

2. **Progress Tracking**
   - Video player component sends periodic POST to `/api/lesson-watch`
   - Body: `{ lessonId, moduleId, lastTime, state }`
   - API creates/updates Watch document:
     - If Watch exists for (user, lesson): updates `lastTime` and `modified_at`
     - If new: creates Watch document
   - When lesson completed (state: 'completed'), updates Report:
     - Adds lessonId to `totalCompletedLessons[]`
     - Checks if all lessons in module completed
     - If yes, adds moduleId to `totalCompletedModules[]`

3. **Course Completion Detection**
   - When all modules completed (`totalCompletedModules.length === course.modules.length`)
   - AND all required course-level quizzes passed (via `passedQuizIds[]`)
   - Enrollment status updated to 'completed'
   - Report.completion_date set
   - Certificate becomes available

### Quiz V2 Flow

1. **Quiz Creation (Instructor)**
   - Instructor creates quiz via `/dashboard/courses/[courseId]/quizzes/new`
   - `createQuiz` action:
     - Verifies course ownership
     - Creates Quiz document (published: false by default)
     - Can be course-level (lessonId: null) or lesson-level (lessonId set)
   - Instructor adds questions via quiz editor:
     - `addQuestion` action creates Question documents
     - Supports single-choice, multi-choice, true/false
   - Instructor publishes quiz (`publishQuiz` action)

2. **Quiz Taking (Student)**
   - Student navigates to quiz page (`/courses/[id]/quizzes/[quizId]`)
   - `startOrResumeAttempt` action called:
     - Checks enrollment
     - Checks if in-progress attempt exists (unique partial index prevents multiple)
     - Checks maxAttempts limit (counts submitted attempts)
     - If new attempt: creates Attempt (status: 'in_progress', expiresAt set if timeLimitSec)
     - Returns quiz with questions (shuffled if enabled)
   - Student answers questions:
     - Frontend stores answers in state
     - `autosaveAttempt` called periodically (saves progress without submitting)
   - Student submits:
     - `submitAttempt` action:
       - Validates attempt exists and is in-progress
       - Calculates score:
         - For each question: checks if `selectedOptionIds` matches `correctOptionIds`
         - Sums points for correct answers
         - Calculates scorePercent = (score / totalPoints) * 100
       - Determines passed = scorePercent >= passPercent
       - Updates Attempt (status: 'submitted', score, scorePercent, passed, submittedAt)
       - If passed: updates Report (`passedQuizIds[]`, `latestQuizAttemptByQuiz`)
       - If required course-level quiz passed: calls `updateQuizCompletionInReport`

3. **Quiz Results**
   - After submission, redirects to `/courses/[id]/quizzes/[quizId]/result`
   - `getAttemptResult` action:
     - Fetches attempt with quiz and questions
     - Based on `showAnswersPolicy`:
       - 'never': No answers shown
       - 'after_submit': Shows correct answers
       - 'after_pass': Shows correct answers only if passed
     - Returns attempt with correct answers and explanations

### Certificate Generation Flow

1. **Completion Check**
   - Student completes all modules and required quizzes
   - Report.completion_date set
   - Enrollment status: 'completed'

2. **Certificate Download**
   - Student clicks "Download Certificate" on course page
   - GET `/api/certificates/[courseId]`
   - API flow:
     - Authenticates user
     - Rate limits (5 per minute)
     - `verifyCertificateAccess(courseId, userId)`:
       - Checks enrollment exists
       - `checkCourseCompletion(courseId, userId)`:
         - Fetches course modules
         - Fetches Report (totalCompletedModules)
         - Calculates progress = (completedModules / totalModules) * 100
         - Fetches required course-level quizzes
         - Checks all passed (via `getStudentQuizStatusMap`)
         - Returns completed: true if progress === 100 AND all required quizzes passed
       - Returns allowed: true if completed
     - Fetches course and user details
     - Loads fonts (Kalam, Montserrat) and images (logo, sign, pattern)
     - Generates PDF using pdf-lib:
       - A4 landscape format
       - Certificate design with student name, course name, completion date, instructor signature
     - Returns PDF with Content-Disposition: attachment

---

## Security & Authorization

### Authentication
- **Password Hashing**: bcryptjs (salt rounds: 12, via bcrypt default)
- **Session Management**: JWT-based (NextAuth), 30-day expiry, secure cookies in production
- **Rate Limiting**: Login attempts (5 per 15 minutes per email), certificate generation (5 per minute)
- **Status Checks**: Inactive/suspended users blocked at middleware level

### Authorization

#### Role-Based Access Control (RBAC)
- **Admin**: Full system access (defined in `lib/permissions.js`)
- **Instructor**: Can manage own courses only (ownership verified)
- **Student**: Can enroll, view enrolled courses, take quizzes

#### Ownership Verification
- **Course Ownership**: `assertInstructorOwnsCourse()` - Verifies `course.instructor === userId`
- **Module Ownership**: `assertInstructorOwnsModule()` - Verifies via course ownership
- **Lesson Ownership**: `assertInstructorOwnsLesson()` - Verifies via module → course
- **Admin Override**: All ownership checks allow admin access
- **Used In**: All course/module/lesson/quiz edit/delete actions

#### Route Protection
- **Middleware** (`middleware.js`):
  - Blocks unauthenticated users from protected routes
  - Blocks inactive/suspended users from all routes
  - Role-based route access (`/admin` → admin only, `/dashboard` → instructor/admin)
- **Layout-Level Protection**: Admin and dashboard layouts call `requireAdmin()` / `requireInstructorOrAdmin()`

#### Input Validation
- **Zod Schemas**: All server actions validate input with Zod (`lib/validations.js`)
- **Mongoose Validation**: Schema-level validation (email format, enum values, required fields)
- **ObjectId Validation**: All IDs validated before database queries

#### IDOR Prevention
- **Ownership Checks**: All resource access verified (don't trust client-provided IDs)
- **Enrollment Verification**: Lesson access requires enrollment check
- **Certificate Access**: Server-side verification of completion (don't trust client)

### Security Considerations

#### Strengths
- Password hashing with bcryptjs
- Rate limiting on sensitive endpoints
- Ownership verification prevents IDOR
- Status-based access control
- Input validation with Zod
- Secure cookie settings in production

#### Potential Improvements
- **Rate Limiting**: Currently in-memory (not distributed) - consider Redis for multi-instance deployments
- **Video Streaming**: `/api/videos/[filename]` should verify enrollment before streaming
- **File Upload**: Should validate file types and sizes more strictly
- **XSS Protection**: Ensure all user-generated content is sanitized (react-quill content, testimonials)
- **CSRF**: NextAuth handles CSRF tokens automatically
- **Environment Variables**: Ensure sensitive keys (NEXTAUTH_SECRET, MONGODB_URI) are not exposed

---

## Known Issues & Improvements

### Known Issues

1. **Assessment Model**: Legacy `Assessment` model exists but appears unused (Quiz V2 replaced it) - consider removal
2. **Rate Limiting**: In-memory implementation resets on server restart - not suitable for distributed systems
3. **Video Streaming Security**: `/api/videos/[filename]` may not verify enrollment before streaming
4. **Lives Feature**: `/dashboard/lives` appears to be a placeholder (not fully implemented)
5. **MockPay**: Payment system is mocked - needs real payment gateway integration for production
6. **Error Handling**: Some server actions don't use `withActionErrorHandling` wrapper (inconsistency)

### Recommended Improvements

#### Performance
- **Database Indexing**: Review query patterns and add indexes as needed (many already exist)
- **Caching**: Consider Redis for session storage and rate limiting
- **Image Optimization**: Implement Next.js Image component for course thumbnails
- **Pagination**: Ensure all list queries are paginated (some may not be)

#### Features
- **Email Notifications**: Implement email alerts (course enrollment, quiz results, certificate ready) using Resend
- **Search**: Full-text search for courses (consider Algolia or MongoDB Atlas Search)
- **Notifications System**: In-app notifications for students (new lessons, quiz results)
- **Instructor Analytics**: Detailed analytics for instructors (student progress, quiz performance)
- **Bulk Operations**: Bulk course operations for admins
- **Export**: Export student progress, quiz results to CSV/PDF

#### Code Quality
- **TypeScript Migration**: Consider migrating to TypeScript for type safety
- **Testing**: Add unit tests for server actions and integration tests for key flows
- **Error Logging**: Integrate error tracking service (Sentry, LogRocket)
- **API Documentation**: Document API routes (OpenAPI/Swagger)
- **Action Wrapper**: Standardize all server actions to use `withActionErrorHandling`

#### Security
- **Video Access Control**: Implement proper video streaming access control
- **File Upload Validation**: Stricter file type and size validation
- **Content Sanitization**: Sanitize all user-generated content (rich text, testimonials)
- **Rate Limiting**: Implement distributed rate limiting (Redis)
- **Audit Logging**: Log all admin actions (user role changes, course deletions)

#### Database
- **Migrations**: Consider migration system for schema changes (migrate-mongo or custom)
- **Backups**: Implement automated database backups
- **Connection Pooling**: Review MongoDB connection pool settings (currently maxPoolSize: 10)

#### UI/UX
- **Loading States**: Ensure all async operations show loading states
- **Error Messages**: Improve error messages for users (less technical)
- **Responsive Design**: Verify all pages are mobile-responsive
- **Accessibility**: Audit and improve accessibility (WCAG compliance)

---

## Dependency Map

### Critical Files (Most Referenced)

```
auth.js → Used by: middleware.js, all protected routes, server actions
  └── Uses: auth.config.js, lib/rate-limit.js, model/user-model.js, service/mongo.js

middleware.js → Protects all routes
  └── Uses: auth.js, lib/routes.js, lib/permissions.js, lib/auth-redirect.js

lib/authorization.js → Used by: All course/module/lesson/quiz actions
  └── Uses: model/course-model.js, model/module.model.js, model/lesson.model.js, service/mongo.js

lib/errors.js → Used by: All server actions, API routes
  └── Defines: ERROR_CODES, createSuccessResponse, createErrorResponse

lib/permissions.js → Used by: authorization.js, auth-helpers.js, middleware.js
  └── Defines: ROLES, PERMISSIONS, ROLE_PERMISSIONS

service/mongo.js → Used by: All queries, server actions, API routes
  └── Manages: MongoDB connection

model/user-model.js → Used by: Auth, user queries, all ownership checks
model/course-model.js → Used by: Course queries, enrollment, ownership checks
model/enrollment-model.js → Used by: Enrollment queries, payment webhooks, access control
model/quizv2-model.js → Used by: Quiz actions, certificate verification
model/report-model.js → Used by: Progress tracking, certificate verification
```

### Key Flows Dependencies

```
Enrollment Flow:
  enrollInFreeCourse (action) → queries/enrollments.js → model/enrollment-model.js
  MockPay webhook → model/payment-model.js → model/enrollment-model.js

Quiz Flow:
  startOrResumeAttempt (action) → queries/quizv2.js → model/quizv2-model.js, model/attemptv2-model.js
  submitAttempt (action) → model/attemptv2-model.js → model/report-model.js

Certificate Flow:
  /api/certificates/[courseId] → lib/certificate-helpers.js → model/report-model.js, model/enrollment-model.js
  certificate-helpers.js → queries/quizv2.js → model/quizv2-model.js
```

---

## Conclusion

This LMS is a well-structured Next.js application with clear separation of concerns:
- **Models**: Mongoose schemas with proper relationships
- **Queries**: Database access layer
- **Actions**: Server-side business logic with error handling
- **API Routes**: Webhooks, file handling, streaming
- **Components**: Reusable UI components
- **Authorization**: Comprehensive RBAC and ownership verification

The system supports the full learning lifecycle: course creation, enrollment, lesson viewing, quiz taking, progress tracking, and certificate generation. Security measures are in place, though some improvements are recommended for production use.

For questions or contributions, refer to the codebase and this documentation.

---

**End of Documentation**
