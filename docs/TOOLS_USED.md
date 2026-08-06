# Tools & Technologies Used

This document provides an evidence-based inventory of all tools, frameworks, and technologies used in this Learning Management System (LMS) codebase. All entries are verified through `package.json`, configuration files, and actual code usage.

## Summary

This is a Next.js 15 application built with React 18, using the App Router architecture with Server Components and Server Actions. The application uses MongoDB with Mongoose for data persistence, NextAuth v5 for authentication, and a comprehensive UI component library built on Radix UI primitives and TailwindCSS. The codebase follows modern React patterns with form handling via react-hook-form, validation with Zod, and a rich set of UI utilities for tables, drag-and-drop, file uploads, and more.

---

## 1. Frameworks & Runtime

### Next.js
- **Version:** 15.0.5
- **Usage:** Primary framework, App Router architecture
- **Location:** `next.config.mjs`, `app/` directory structure
- **Purpose:** Full-stack React framework with Server Components and Server Actions
- **Features Used:**
  - App Router (evidenced by `app/` directory structure)
  - Server Actions (`"use server"` directives in `app/actions/`)
  - Route Handlers (`app/api/` directory)
  - Image optimization (configured in `next.config.mjs`)
  - Middleware (`middleware.js`)

### React
- **Version:** 18.3.1
- **Usage:** UI library, Client Components
- **Location:** All component files, `app/`, `components/`
- **Purpose:** Component-based UI development

### React DOM
- **Version:** 18.3.1
- **Usage:** React rendering
- **Location:** Implicitly used by Next.js
- **Purpose:** DOM rendering for React components

### Node.js
- **Version:** Not specified (runtime assumption)
- **Usage:** Server runtime environment
- **Location:** Required for Next.js execution
- **Purpose:** JavaScript runtime for server-side execution

---

## 2. UI / Styling Tools

### TailwindCSS
- **Version:** 3.4.1
- **Usage:** Utility-first CSS framework
- **Location:** `tailwind.config.js`, `app/globals.css`, all component files
- **Purpose:** Styling and responsive design

### PostCSS
- **Version:** 8.x
- **Usage:** CSS processing
- **Location:** `postcss.config.mjs`
- **Purpose:** Processes TailwindCSS

### tailwindcss-animate
- **Version:** 1.0.7
- **Usage:** Animation utilities for Tailwind
- **Location:** `tailwind.config.js` (plugins array)
- **Purpose:** Provides animation utilities (accordion animations, etc.)

### tailwind-merge
- **Version:** 2.5.4
- **Usage:** Merge Tailwind classes intelligently
- **Location:** `lib/utils.js`
- **Purpose:** Utility function `cn()` for conditional class merging

### clsx
- **Version:** 2.1.1
- **Usage:** Conditional className construction
- **Location:** `lib/utils.js`
- **Purpose:** Used with `tailwind-merge` for class name utilities

### class-variance-authority
- **Version:** 0.7.0
- **Usage:** Component variant management
- **Location:** `components/alert-banner.jsx`, UI components
- **Purpose:** Type-safe component variants (e.g., button variants)

### shadcn/ui
- **Version:** Not versioned (component library)
- **Usage:** UI component library
- **Location:** `components.json`, `components/ui/` directory
- **Purpose:** Pre-built accessible UI components
- **Configuration:** Style: "new-york", RSC: true, Icon library: lucide

### Radix UI Primitives
- **Versions:** Multiple (see below)
- **Usage:** Headless UI primitives
- **Location:** `components/ui/` directory
- **Purpose:** Accessible, unstyled UI primitives
- **Components Used:**
  - `@radix-ui/react-accordion` (^1.2.1) - `components/ui/accordion.jsx`
  - `@radix-ui/react-alert-dialog` (^1.1.15) - `components/ui/alert-dialog.jsx`
  - `@radix-ui/react-avatar` (^1.1.1) - `components/ui/avatar.jsx`
  - `@radix-ui/react-checkbox` (^1.1.2) - `components/ui/checkbox.jsx`
  - `@radix-ui/react-dialog` (^1.1.2) - `components/ui/dialog.jsx`
  - `@radix-ui/react-dropdown-menu` (^2.1.2) - `components/ui/dropdown-menu.jsx`
  - `@radix-ui/react-label` (^2.1.0) - `components/ui/label.jsx`
  - `@radix-ui/react-popover` (^1.1.2) - `components/ui/popover.jsx`
  - `@radix-ui/react-progress` (^1.1.0) - `components/ui/progress.jsx`
  - `@radix-ui/react-select` (^2.1.2) - `components/ui/select.jsx`
  - `@radix-ui/react-separator` (^1.1.0) - `components/ui/separator.jsx`
  - `@radix-ui/react-slot` (^1.1.0) - `components/ui/button.jsx`, `components/ui/form.jsx`
  - `@radix-ui/react-tabs` (^1.1.1) - `components/ui/tabs.jsx`
  - `@radix-ui/react-toast` (^1.2.2) - `components/ui/toast.jsx`, `components/ui/toaster.jsx`

### lucide-react
- **Version:** 0.460.0
- **Usage:** Icon library
- **Location:** Throughout `app/`, `components/` (e.g., `ArrowRight`, `BookOpen`, `CheckCircle`, etc.)
- **Purpose:** Icon components for UI

### sonner
- **Version:** 1.7.0
- **Usage:** Toast notification system
- **Location:** `components/ui/sonner.jsx`, `app/layout.js`, various components
- **Purpose:** Toast notifications (success, error, info messages)

### @tanstack/react-table
- **Version:** 8.20.5
- **Usage:** Table/data grid component
- **Location:** `app/dashboard/courses/_components/data-table.jsx`
- **Purpose:** Powerful table component with sorting, filtering, pagination

### @hello-pangea/dnd
- **Version:** 17.0.0
- **Usage:** Drag and drop functionality
- **Location:** `app/dashboard/courses/[courseId]/_components/module-list.jsx`
- **Purpose:** Drag-and-drop reordering of modules

### react-dropzone
- **Version:** 14.3.5
- **Usage:** File upload with drag-and-drop
- **Location:** `components/file-upload.jsx`
- **Purpose:** File upload component with drag-and-drop support

### react-player
- **Version:** 2.16.0
- **Usage:** Video player component
- **Location:** `app/(main)/courses/[id]/lesson/_components/lesson-video.jsx`
- **Purpose:** YouTube video playback

### pdf-lib
- **Version:** 1.17.1
- **Usage:** PDF generation
- **Location:** `app/api/certificates/[courseId]/route.js`
- **Purpose:** Generate PDF certificates for course completion

### @pdf-lib/fontkit
- **Version:** 1.1.1
- **Usage:** Font support for PDF generation
- **Location:** `app/api/certificates/[courseId]/route.js`
- **Purpose:** Custom font embedding in PDF certificates

---

## 3. Backend / API Tools

### Next.js Route Handlers
- **Usage:** API endpoints
- **Location:** `app/api/` directory
- **Endpoints:**
  - `/api/auth/[...nextauth]` - NextAuth authentication
  - `/api/certificates/[courseId]` - Certificate generation
  - `/api/lesson-watch` - Lesson progress tracking
  - `/api/me` - User profile endpoint
  - `/api/payments/mock/confirm` - Mock payment confirmation
  - `/api/payments/status` - Payment status
  - `/api/profile/avatar` - Avatar upload
  - `/api/quizv2/attempts/[attemptId]` - Quiz attempt handling
  - `/api/register` - User registration
  - `/api/upload` - File upload
  - `/api/upload/video` - Video upload
  - `/api/videos/[filename]` - Video streaming
- **Purpose:** RESTful API endpoints

### Next.js Server Actions
- **Usage:** Server-side mutations
- **Location:** `app/actions/` directory
- **Files:**
  - `account.js` - Account management
  - `admin-categories.js` - Admin category management
  - `admin-courses.js` - Admin course management
  - `admin-setup.js` - Admin setup
  - `admin.js` - Admin user management
  - `course.js` - Course CRUD operations
  - `enrollment.js` - Enrollment management
  - `lesson.js` - Lesson management
  - `module.js` - Module management
  - `quizProgressv2.js` - Quiz progress tracking
  - `quizv2.js` - Quiz management
  - `review.js` - Review management
- **Purpose:** Type-safe server-side mutations without API routes

### File System (Node.js)
- **Usage:** File upload handling
- **Location:** `app/api/upload/route.js`
- **Purpose:** Server-side file operations using `fs/promises`

---

## 4. Auth & Security Tools

### NextAuth (Auth.js)
- **Version:** 5.0.0-beta.25
- **Usage:** Authentication and session management
- **Location:** `auth.js`, `auth.config.js`, `app/api/auth/[...nextauth]/route.js`, `middleware.js`
- **Purpose:** Authentication, session management, JWT tokens
- **Configuration:**
  - JWT strategy
  - 30-day session maxAge
  - Credentials provider
  - Custom callbacks for user data

### bcryptjs
- **Version:** 2.4.3
- **Usage:** Password hashing
- **Location:** `auth.js` (password verification)
- **Purpose:** Secure password hashing and comparison

### Custom Rate Limiting
- **Usage:** Request rate limiting
- **Location:** `lib/rate-limit.js`, `auth.js`
- **Purpose:** In-memory rate limiting for login attempts (5 attempts per 15 minutes)

### Zod
- **Version:** 3.23.8
- **Usage:** Schema validation
- **Location:** `lib/validations.js`, throughout `app/actions/`, form components
- **Purpose:** Runtime type validation for forms, API inputs, and data schemas
- **Schemas Defined:**
  - User registration/login
  - Course/module/lesson
  - Reviews
  - Password changes
  - Profile updates
  - Admin operations
  - File uploads
  - Payment/checkout

---

## 5. Database & Data Layer Tools

### MongoDB
- **Version:** Not specified (database server)
- **Usage:** NoSQL database
- **Location:** Connection string in environment variables
- **Purpose:** Primary data storage

### Mongoose
- **Version:** 8.8.2
- **Usage:** MongoDB ODM (Object Document Mapper)
- **Location:** `service/mongo.js`, all `model/` files
- **Purpose:** Schema definition, validation, and database operations
- **Models:**
  - User (`model/user-model.js`)
  - Course (`model/course-model.js`)
  - Module (`model/module.model.js`)
  - Lesson (`model/lesson.model.js`)
  - Enrollment (`model/enrollment-model.js`)
  - Quiz (`model/quizv2-model.js`)
  - Report (`model/report-model.js`)
  - And more in `model/` directory
- **Features Used:**
  - Schema definitions with indexes
  - Population (references)
  - Aggregation pipelines
  - Connection pooling (configured in `service/mongo.js`)

### Database Connection
- **Usage:** Cached MongoDB connection
- **Location:** `service/mongo.js`
- **Purpose:** Singleton connection pattern with connection pooling
- **Configuration:**
  - maxPoolSize: 10
  - serverSelectionTimeoutMS: 5000
  - socketTimeoutMS: 45000

---

## 6. Form Handling & Validation

### react-hook-form
- **Version:** 7.53.2
- **Usage:** Form state management
- **Location:** 
  - `app/dashboard/courses/[courseId]/quizzes/new/_components/quiz-form.jsx`
  - `app/dashboard/courses/[courseId]/quizzes/[quizId]/_components/quiz-edit-form.jsx`
  - `app/dashboard/courses/[courseId]/quizzes/[quizId]/questions/_components/question-form-dialog.jsx`
  - `app/dashboard/lives/add/page.jsx`
- **Purpose:** Performant form handling with validation

### @hookform/resolvers
- **Version:** 3.9.1
- **Usage:** Form validation resolvers
- **Location:** `app/dashboard/lives/add/page.jsx`
- **Purpose:** Integrates Zod schemas with react-hook-form (via `zodResolver`)

---

## 7. Testing / Quality Tools

**Note:** No testing frameworks (Jest, Vitest, Playwright, Cypress) or code quality tools (ESLint config files, Prettier config) were found in the codebase. The `package.json` includes a `lint` script that uses `next lint` (Next.js built-in ESLint).

---

## 8. DevOps / Build Tools

### npm
- **Usage:** Package manager (inferred from `package-lock.json`)
- **Location:** `package-lock.json` present
- **Purpose:** Dependency management

### Build Scripts
- **Location:** `package.json`
- **Scripts:**
  - `dev` - Development server (`next dev`)
  - `build` - Production build (`next build`)
  - `start` - Production server (`next start`)
  - `lint` - Linting (`next lint`)

### Environment Variables
- **Usage:** Configuration via `.env` files (not in repository, standard Next.js pattern)
- **Location:** Referenced in code (e.g., `process.env.MONGODB_CONNECTION_STRING`, `process.env.NEXTAUTH_SECRET`)
- **Purpose:** Secure configuration management

### jsconfig.json
- **Usage:** JavaScript path aliases
- **Location:** `jsconfig.json`
- **Configuration:**
  - `@/*` maps to root directory
- **Purpose:** Path aliases for imports

---

## 9. External Services Integrations

### Resend
- **Version:** 4.0.1
- **Usage:** Email service (installed but not found in codebase)
- **Location:** Listed in `package.json` dependencies
- **Status:** ⚠️ Installed but not actively used (may be planned for future use)

---

## 10. Unused / Questionable Dependencies

The following packages are listed in `package.json` but were not found in active use within the codebase:

### cmdk
- **Version:** 1.0.0
- **Status:** ⚠️ Not found in codebase
- **Note:** Command palette component - may be planned for future use

### date-fns
- **Version:** 3.6.0
- **Status:** ⚠️ Not found in codebase
- **Note:** Date utility library - may be used indirectly or planned

### embla-carousel-react
- **Version:** 8.5.1
- **Status:** ⚠️ Not found in codebase
- **Note:** Carousel component - may be planned for future use

### react-day-picker
- **Version:** 8.10.1
- **Status:** ⚠️ Not found in codebase
- **Note:** Date picker component - may be planned for future use

### react-quill
- **Version:** 2.0.0
- **Status:** ⚠️ Not found in codebase
- **Note:** Rich text editor - may be planned for future use

### next-themes
- **Version:** 0.4.3
- **Status:** ⚠️ Not found in codebase
- **Note:** Theme switching utility - may be planned for dark mode support

---

## 11. Missing Dependencies

No missing dependencies were identified. All imports found in the codebase have corresponding entries in `package.json`.

---

## Configuration Files Summary

- **`next.config.mjs`** - Next.js configuration (image optimization, server actions, external packages)
- **`tailwind.config.js`** - TailwindCSS configuration (theme, colors, animations)
- **`postcss.config.mjs`** - PostCSS configuration
- **`jsconfig.json`** - JavaScript path aliases
- **`components.json`** - shadcn/ui configuration
- **`auth.config.js`** - NextAuth configuration
- **`auth.js`** - NextAuth setup with credentials provider
- **`middleware.js`** - Next.js middleware for route protection

---

## Architecture Notes

- **App Router:** The application uses Next.js 15 App Router architecture
- **Server Components:** Default rendering strategy (no `"use client"` unless needed)
- **Server Actions:** Used extensively for mutations (`app/actions/`)
- **Route Handlers:** Used for API endpoints (`app/api/`)
- **Middleware:** Route protection and authentication checks
- **Component Structure:** Modular UI components in `components/ui/` (shadcn/ui pattern)
- **Data Layer:** Mongoose models in `model/`, queries in `queries/`, actions in `app/actions/`

---

*Last Updated: Generated from codebase analysis*
*Repository: LMS-main*
