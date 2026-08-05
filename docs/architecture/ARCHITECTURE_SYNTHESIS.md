# LMS Software Architecture Synthesis

**Source of truth:** reverse-engineered from `LMSV2-main` source (excluding nested `LMS-main/`).  
**Diagram style:** IEEE 1016 / UML 2.x / C4 Model Level 2 (Container).  
**Date:** 2026-07-24

## Architectural Pattern

**Modular Monolith with Layered Architecture**, deployed as a single **Next.js 15 App Router** application.

Evidence:
- One Node process serves UI, Server Actions, and API Route Handlers.
- Clear layering: Presentation (`app/[locale]/*`) → Application (`middleware.js`, `app/actions`, `app/api`) → Business (`service/*`) → Data Access (`queries/*`, `model/*`) → Persistence (MongoDB, local FS, ChromaDB).
- Cross-cutting: Auth.js (Credentials/JWT), next-intl (`en`/`ar`), RBAC in `middleware.js` + `lib/authorization.js` / `lib/permissions.js`.

## Roles (Actors)

| Role | Home | UI tree |
|------|------|---------|
| Student | `/` | `app/[locale]/(main)` |
| Instructor | `/dashboard` | `app/[locale]/dashboard` |
| Admin | `/admin` | `app/[locale]/admin` |

## Layers and Source Paths

| Layer | Containers | Paths |
|-------|------------|-------|
| Presentation | Student UI, Instructor UI, Admin UI | `app/[locale]/(main)`, `dashboard`, `admin` |
| Edge / Application | Middleware, App Router, Server Actions, API Routes, Auth | `middleware.js`, `app/actions/*`, `app/api/*`, `auth.js`, `auth-edge.js`, `auth.config.js` |
| Business | Domain services | `service/*` |
| Data Access | Query modules + Mongoose models | `queries/*`, `model/*` |
| Persistence | MongoDB, Local filesystem, ChromaDB | `service/mongo.js`, `uploads/*`, `public/uploads/*`, `.chroma-data` |
| External | Google Gemini API, ChromaDB HTTP | `@google/genai`, `chromadb` client |

## Container Inventory (code-backed)

### Presentation
- **Student UI** — catalog, course detail, lesson player, quiz attempt, account, mock checkout
- **Instructor UI** — course/module/lesson authoring, quiz management, AI quiz generation, grading, analytics, lives
- **Admin UI** — users, courses, categories, enrollments, payments, reviews, analytics, quiz settings, tutor settings

### Application
- **middleware.js** — Auth.js edge session, next-intl, role gates (`/admin`, `/dashboard`), security headers
- **Server Actions** — `app/actions/{course,module,lesson,quizv2,enrollment,account,review,admin,admin-courses,admin-categories,admin-setup,quizProgressv2,index}.js`
- **API Routes** — auth, register, me, upload (image/video/lesson-docx), videos, lesson-images, lesson-watch, certificates, payments/mock, quizv2 attempts, quiz-generation/*, tutor/*, analytics/*

### Business Services
- `generation-orchestrator.js`, `quiz-generator.js`, `mcq-validator.js`, `docx-extractor.js`, `docx-validator.js`
- `ai-tutor.js`, `lecture-embedder.js`, `vector-store.js`
- `analytics/{admin-analytics,instructor-analytics,export,projection,anomaly-detection,dashboard-preference}.service.ts`
- `mongo.js`

### Data Models (Mongoose)
User, Course, Module, Lesson, Category, Enrollment, Payment, Watch, Report, Assessment, Testimonial, Quiz, Question, Attempt, GenerationJob, AdminQuizConfig, AIProcessingConsent, TutorConfiguration, TutorInteraction, TutorReport, UserActivityLog, DashboardPreference

## Key Flows

1. **Request** — Browser → `middleware.js` → localized page / Server Action / API route  
2. **Auth** — Credentials → `auth.js` → `User` (bcrypt) → JWT session  
3. **Persistence** — Actions/APIs/Services → `queries` / models → `dbConnect()` → MongoDB  
4. **AI Quiz** — DOCX upload → extract/validate → `generation-orchestrator` → `quiz-generator` → Gemini → `GenerationJob.draftQuestions`  
5. **RAG Tutor** — Lesson DOCX → `lecture-embedder` → Gemini embeddings → Chroma `lms_course_{id}` → student ask → `ai-tutor` retrieve + Gemini answer → `TutorInteraction`  
6. **Files** — Upload APIs ↔ `uploads/` and `public/uploads/`; Range video via `/api/videos/[filename]`

## Explicit Non-Components

- **Resend** — listed in `package.json` / README; no runtime import found  
- **Stripe SDK** — payment *fields* exist; live provider is MockPay API routes  
- **OAuth providers** — Credentials only  

## Diagram Artifacts

| File | Format |
|------|--------|
| `architecture.svg` | Vector (canonical) |
| `architecture.png` | Raster ≥5000 px width |
| `architecture.pdf` | Printable PDF |
| `architecture.mmd` | Mermaid source |
| `architecture.puml` | PlantUML C4 source |
| `architecture.drawio` | diagrams.net XML |
