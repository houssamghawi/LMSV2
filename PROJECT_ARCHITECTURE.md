# LMS Project Architecture

**Document purpose:** Comprehensive mental model of the bilingual (Arabic/English) Learning Management System built with Next.js 15 App Router, Mongoose/MongoDB, and foundations for Generative AI and Adaptive Learning.

---

## 1. Tech Stack & Tools Overview

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 15 (App Router) |
| **Language** | JavaScript (ESM) |
| **i18n** | next-intl 4.x — locales `en`, `ar`; `localePrefix: 'always'`; `dir` and `lang` set per locale |
| **Auth** | NextAuth v5 (beta) — JWT strategy, Credentials provider, Edge-compatible `auth-edge.js` for middleware |
| **Database** | MongoDB via Mongoose 8.x (`serverExternalPackages: ['mongoose']`) |
| **Validation** | Zod (forms + API), Mongoose schema validators |
| **UI** | React 18, Tailwind CSS 3, tailwindcss-animate, shadcn/ui–style Radix primitives |
| **Forms** | react-hook-form, @hookform/resolvers |
| **Drag & Drop** | @hello-pangea/dnd (module/lesson reordering) |
| **Video** | Local filesystem upload + streaming; react-player for playback; HTTP Range support for seeking |
| **Payments** | Stripe + MockPay (mockpay for testing); Resend for email |
| **PDF** | pdf-lib, @pdf-lib/fontkit (e.g. certificates) |
| **Fonts** | next/font: Geist (local), Inter, Cairo (Arabic); `font-cairo` when `locale === 'ar'` |
| **Security** | OWASP-aligned headers (next.config + middleware CSP), rate limiting, bcrypt passwords |

**Key config:** `next.config.mjs` — `createNextIntlPlugin()`, OWASP headers, `images.remotePatterns` (Cloudinary, pravatar), `serverExternalPackages: ['mongoose']`, `serverActions.bodySizeLimit: '2mb'`.

---

## 2. High-Level Directory Structure & Data Flow

### 2.1 App Router & Locale Structure

```
app/
├── layout.js                    # Root: fonts, dbConnect, <html dir={rtl|ltr} lang={locale}>
├── globals.css
├── api/                         # API routes (no locale prefix)
│   ├── auth/[...nextauth]/route.js
│   ├── me/route.js
│   ├── register/route.js
│   ├── upload/video/route.js     # POST/DELETE local video upload
│   ├── videos/[filename]/route.js # GET stream with Range support
│   ├── lesson-watch/route.js
│   ├── quizv2/attempts/[attemptId]/route.js
│   ├── payments/status/route.js, payments/mock/confirm/route.js
│   ├── certificates/[courseId]/route.js
│   └── profile/avatar/route.js
├── actions/                     # Server Actions ("use server")
│   ├── course.js, module.js, lesson.js, enrollment.js
│   ├── quizv2.js, quizProgressv2.js
│   ├── account.js, review.js, admin*.js
│   └── admin-setup.js
└── [locale]/                    # next-intl: en | ar
    ├── layout.js                # NextIntlClientProvider + messages
    ├── (main)/                  # Public + student: landing, courses, account, checkout
    │   ├── layout.js            # MainNav, SiteFooter, SessionProvider
    │   ├── page.jsx
    │   ├── login/, register/[role]/
    │   ├── courses/, courses/[id]/, courses/[id]/lesson/
    │   ├── account/             # Tabs: profile, enrolled-courses, etc.
    │   ├── checkout/mock/
    │   └── inst-profile/[id]/
    ├── dashboard/               # Instructor: course CRUD, modules, lessons, quizzes, enrollments
    │   ├── layout.js            # Navbar, Sidebar (ps-56, start-0), force-dynamic
    │   ├── courses/, courses/[courseId]/modules/[moduleId]/
    │   ├── lives/, enrollments
    │   └── _components/
    └── admin/                   # Admin: users, courses, categories, payments, reviews, analytics
        ├── layout.js            # requireAdmin, AdminSidebar, AdminNavbar
        └── ...
```

**Routing rules (middleware):**

- **Locale:** Paths are `/{locale}/...`; middleware uses `getLocaleFromPathname` and `getPathnameWithoutLocale` so auth/role logic is locale-agnostic.
- **Public:** `ROOT`, `PUBLIC_ROUTES`: `/login`, `/register/student`, `/register/instructor`, `/courses`, `/setup/admin`, etc.
- **Role-protected:** `/admin` → `ROLES.ADMIN`; `/dashboard` → `ROLES.INSTRUCTOR` or `ROLES.ADMIN`. Unauthorized → redirect to `ROOT` or login with `callbackUrl`.
- **Auth:** NextAuth wrapper around `createMiddleware(routing)` from next-intl; security headers applied to responses via `addSecurityHeaders`.

**Data flow (simplified):**

- **UI (RSC or client)** → `Link`/`redirect`/`useRouter` from `@/i18n/navigation` (locale-aware).
- **Mutations:** Server Actions in `app/actions/*` (e.g. `createCourse`, `reOrderModules`) or fetch to `app/api/*`.
- **Data:** `queries/*` (e.g. `getCourseList`, `getCourseDetails`) + Mongoose models; RSC serialization via `lib/schemas/course-schema.js` (`serializeCourse`/Zod) and `replaceMongoIdInObject` where needed.

---

## 3. Database Schema Relational Map

**Connection:** `service/mongo.js` — single cached Mongoose connection; `dbConnect()` used in Server Actions, API routes, and root layout.

| Model | File | Key relations | Notes |
|-------|------|----------------|-------|
| **User** | `model/user-model.js` | — | email unique; role: admin \| instructor \| student; status: active \| inactive \| suspended; password select:false |
| **Category** | `model/category-model.js` | — | title, description, thumbnail |
| **Course** | `model/course-model.js` | modules→Module, category→Category, instructor→User, testimonials→Testimonial | learning[], createdOn, modifiedOn |
| **Module** | `model/module.model.js` | course (ObjectId), lessonIds→Lesson | order, slug, active |
| **Lesson** | `model/lesson.model.js` | (referenced by Module.lessonIds) | video_url; videoProvider: local \| external; videoFilename, videoUrl, videoMimeType, videoSize; order, slug, access |
| **Quiz** | `model/quizv2-model.js` | courseId→Course, lessonId→Lesson, createdBy→User | published, passPercent, timeLimitSec, maxAttempts, shuffleQuestions/Options, showAnswersPolicy |
| **Question** | `model/questionv2-model.js` | quizId→Quiz | type: single \| multi \| true_false; options[], correctOptionIds[], points, order |
| **Attempt** | `model/attemptv2-model.js` | quizId→Quiz, studentId→User | status: in_progress \| submitted \| expired; answers[], score, scorePercent, passed; partial unique (quizId, studentId) where status=in_progress |
| **Enrollment** | `model/enrollment-model.js` | course→Course, student→User, payment→Payment | status: not-started \| in-progress \| completed; method: stripe \| free \| manual \| mockpay; unique (student, course) |
| **Payment** | `model/payment-model.js` | user→User, course→Course | provider: stripe \| mockpay; sessionId, referenceId, status, amount, currency |
| **Watch** | `model/watch-model.js` | lesson→Lesson, module→Module, user→User | state (e.g. started), lastTime; indexes for user+module, user+lesson |
| **Report** | `model/report-model.js` | course→Course, student→User, quizAssessment→Assessment | totalCompletedLessons/Modules; passedQuizIds[], latestQuizAttemptByQuiz (Map); unique (course, student) |
| **Testimonial** | `model/testimonial-model.js` | courseId→Course, user→User | content, rating |
| **Assessment** | `model/assessment-model.js` | — | assessments[], otherMarks (legacy) |

**IRT / semantic tagging:** Current schemas do **not** expose explicit IRT fields (e.g. difficulty, discrimination) or semantic tags on questions. The **Attempt** and **Report** structures (scores, passed quizzes, per-quiz attempt history) and **Question** (points, order) form a **foundation** for future IRT or adaptive logic (e.g. storing item parameters or tagging in Question, or deriving from attempt data).

---

## 4. UI & Styling System

- **Tailwind:** `tailwind.config.js` — `darkMode: 'class'`; theme extends colors from CSS variables (e.g. `hsl(var(--primary))`); fontFamily: inter, poppins, cairo; borderRadius and keyframes for accordion; `tailwindcss-animate` plugin.
- **globals.css:** CSS variables for light/dark (e.g. `--background`, `--foreground`, `--primary`, `--radius`); `@layer base` for `border-border`, `bg-background text-foreground`.
- **RTL/LTR:** Root `<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>`. Tailwind **logical** classes used for layout and spacing so the same markup works in both directions:
  - **Padding/margin:** `ps-56`, `pe-4`, `ms-2`, `me-2` (start/end) instead of pl/pr/ml/mr.
  - **Position:** `start-0`, `end-0` (e.g. sidebar `start-0`, navbar `inset-y-0`).
  - **Borders:** `border-e`, `rounded-s-md`, `rounded-e-md` where direction matters.
  - **Icons:** `rtl:rotate-180` for arrows (e.g. back) so they flip in RTL.
- **Components:** `components/ui/` — shadcn-style components (Button, Card, Dialog, Sheet, Table, Tabs, Accordion, Form, Select, etc.); `cn()` from `@/lib/utils` (clsx + tailwind-merge). No layout or logic in `components/ui`; RTL is handled by logical classes in consuming pages.

---

## 5. Core Mechanics & State

- **Instructor dashboard:** `app/[locale]/dashboard/` — course list, course edit (title, description, price, category, image, modules). Modules and lessons edited under `courses/[courseId]/modules/[moduleId]/`; reorder via drag-and-drop.
- **Drag-and-drop:** `@hello-pangea/dnd` in:
  - `dashboard/courses/[courseId]/_components/module-list.jsx` — `DragDropContext`, `Droppable`, `Draggable` for modules; `onReorder(bulkUpdateData)` calls Server Action (e.g. `reOrderModules`).
  - `dashboard/courses/[courseId]/modules/[moduleId]/_components/lesson-list.jsx` — same pattern for lessons; reorder persisted via module/lesson actions.
- **Video upload:** No Mux or UploadThing. **Local upload** only:
  - **POST** `app/api/upload/video` — FormData (file, lessonId); instructor/admin only; ownership verified (lesson→module→course→instructor); stream-to-disk (300MB max, mp4/webm/quicktime); Lesson updated with `videoProvider: 'local'`, `videoFilename`, `videoUrl`, etc.
  - **GET** `app/api/videos/[filename]` — auth + enrollment/ownership check; streams file with Range support for seeking.
- **Server Actions:** All under `app/actions/*` with `"use server"`. Pattern: `getLoggedInUser()` → ownership/permission checks (e.g. course instructor, admin) → Zod or schema validation → queries/models → return or throw. BOLA/IDOR guarded (e.g. `verifyLessonOwnership`, `verifyOwnsAllModules`).
- **API routes:** Auth via `auth()` from `@/auth` (Node); error shape via `lib/errors` (createErrorResponse, ERROR_CODES); logging via `lib/logger` (logRoute).

---

## 6. AI & Adaptive Learning Integration Strategy

**Current state:** The codebase does **not** yet implement:

- A **Weakness Analyzer** (e.g. AI-driven analysis of wrong answers or skill gaps).
- A **Semantic Oral Testing** engine (Speech-to-Text + Gemini or other LLM).
- Any Gemini or other LLM API integration.
- Any Speech-to-Text service.

**Foundations already in place:**

- **Data for analytics/adaptive:** Attempts (per-question `answers`, `selectedOptionIds`), Report (`passedQuizIds`, `latestQuizAttemptByQuiz`), and Watch (lesson progress, `lastTime`) support future “what the user got wrong” and “what they’ve seen” analytics.
- **Question model:** Has `text`, `options`, `correctOptionIds`, `explanation`, `points`, `order` — enough to later add IRT parameters or semantic tags and to feed into an AI or adaptive engine.
- **Course/lesson structure:** Modules and lessons with order and completion data allow sequencing and prerequisite logic for adaptive paths.

**Recommended integration points (when adding AI/adaptive):**

1. **Weakness analyzer:** Use Attempt + Question data (and optionally Report) in a server action or API route; call an LLM (e.g. Gemini) with structured prompt; store results in a new collection or extend Report/User profile.
2. **Semantic oral testing:** Add an API route that accepts audio (or a client that uses Web Speech API or a third-party STT), then sends transcript + question context to an LLM for scoring/feedback; persist outcome in Attempt or a dedicated “oral attempt” model.
3. **IRT/adaptive:** Extend Question schema with optional fields (e.g. difficulty, discrimination); add a service that updates estimates from attempt data and selects next items by ability.

---

## 7. Established Coding Rules & Conventions

- **RTL/LTR:** Use Tailwind **logical** classes: `ps-*`, `pe-*`, `ms-*`, `me-*`, `start-*`, `end-*`, `border-e`, `rounded-s-*`, `rounded-e-*`. Use `rtl:rotate-180` for directional icons (e.g. arrows). Avoid `pl/pr/ml/mr` for layout that should flip in RTL.
- **next-intl:** Use `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname` from `@/i18n/navigation` so all links and redirects are locale-prefixed. Use `useTranslations(namespace)` or `getTranslations` for copy; messages live in `messages/en.json` and `messages/ar.json`. Root layout sets `dir` and `lang` from locale; `i18n/request.js` sets `dir: locale === 'ar' ? 'rtl' : 'ltr'`.
- **Auth:** Use `auth()` from `@/auth` in API routes and Server Components (Node). Middleware uses `auth` from `@/auth-edge` (Edge-only; no Mongoose/Node APIs). Role redirects: `getRedirectUrlByRole(role)` → `/admin`, `/dashboard`, or `/`.
- **Permissions:** `lib/permissions.js` — `ROLES`, `PERMISSIONS`, `ROLE_PERMISSIONS`, `hasPermission`, `requireAdmin`, etc. Use for UI and server-side checks.
- **Validation:** Zod for request/action input; Mongoose for persistence. Use `createErrorResponse` / `createSuccessResponse` and `ERROR_CODES` from `lib/errors` in API responses.
- **Serialization:** For RSC/client, use `serializeCourse` / `serializeCourseList` and `replaceMongoIdInObject` where needed; avoid passing raw Mongoose docs with `_id`/non-serializable values.
- **Security:** Apply `addSecurityHeaders(response, request)` in middleware for all relevant responses. Validate ObjectIds, check ownership before any update/delete, and avoid exposing internal errors to the client.

---

*This document reflects the architecture as of the last full codebase analysis. For detailed flows (e.g. quiz attempt lifecycle, certificate generation, payment hooks), see `docs/ARCHITECTURE_REPORT.md` and `docs/ARCHITECTURE_DIAGRAM.mmd`.*
