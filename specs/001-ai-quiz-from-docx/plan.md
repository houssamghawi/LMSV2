# Implementation Plan: AI Quiz Generation from Lecture Notes (.docx)

**Branch**: `001-ai-quiz-from-docx` | **Date**: 2026-06-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-ai-quiz-from-docx/spec.md`

## Summary

Instructors upload a `.docx` lecture document and receive an AI-generated quiz draft containing a mix of Multiple-Choice, True/False, and Short Answer questions — each tagged with difficulty, correct answer, explanation, and a verbatim source-quote citation. The draft is editable and saveable to the existing Quiz/Question store. Short Answer is a new gradable question type with per-response instructor grading, auto-finalization, and a "Needs grading" queue. Admin governance includes daily quotas, document size limits, and an audit trail.

Technical approach: OpenAI GPT-4.1 with strict Structured Outputs for reliable JSON quiz generation; `mammoth` for DOCX text extraction; SHA-256 content fingerprinting via `node:crypto`; async job pattern using Next.js 15 `after()` + MongoDB polling (mirroring the existing payment-status flow).

## Technical Context

**Language/Version**: JavaScript (ES modules) — Node.js 20+ (Next.js 15 App Router)

**Primary Dependencies**:
- Existing: Next.js 15, React 18, Tailwind CSS, shadcn/ui, Mongoose 8.x, NextAuth v5 (beta.25), Zod 3.23, React Hook Form, next-intl 4.x, Sonner (toasts)
- New: `openai@^6.33.0` (AI provider SDK), `mammoth@^1.12.0` (DOCX text extraction)

**Storage**: MongoDB via Mongoose — 3 new collections (`GenerationJob`, `AIProcessingConsent`, `AdminQuizConfig`) + modifications to `Question`, `Quiz`, `Attempt`

**Testing**: No test framework currently installed. Constitution Principle II requires integration tests against a real test MongoDB for new server logic, per-role authorization tests, and regression tests. Test framework selection is deferred to tasks; candidates: Vitest or Jest.

**Target Platform**: Web application — Next.js running on Node.js (self-hosted or Vercel)

**Performance Goals** (per Constitution Principle IV):
- Write endpoints (job creation, save draft, grade response): ≤600 ms p95
- Read endpoints (poll status, grading queue, audit log): ≤300 ms p95
- AI generation: ≤60 s p95 for documents up to 50 pages (runs async, does not hold HTTP connection)
- New routes: FCP ≤2.0 s, LCP ≤2.5 s, ≤250 KB gzipped JS per route

**Constraints**:
- Server Actions body limit is 2 MB (next.config.mjs); document uploads (up to 10 MB) must use API Routes
- Constitution tech-stack lock: two new runtime dependencies (`openai`, `mammoth`) justified as additive capabilities, not replacements (see Complexity Tracking)
- AI provider API key via environment variable only (`OPENAI_API_KEY`)

**Scale/Scope**: Default 20 generations/day/instructor; typical quiz: 10 questions; typical document: ≤30 pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase 0 Evaluation

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality & Maintainability | **PASS** | New logic in `service/`, `queries/`, `app/actions/`. No business-rule duplication in route handlers or components. Zod `.strict()` at all boundaries. Each service file targets <200 lines. |
| II. Testing Standards | **PASS (commitment)** | Quiz grading (including SA manual grading), authorization, and quota enforcement are high-risk paths requiring automated tests. Per-role tests for every new endpoint. Integration tests against real test MongoDB. |
| III. User Experience Consistency | **PASS** | All new UI built from shadcn/ui + Tailwind. All strings via `messages/` i18n layer (en + ar). Keyboard-accessible upload/draft/grading forms. Responsive 360px–1280px. Sonner toasts for feedback. |
| IV. Performance Requirements | **PASS** | Generation-start endpoint returns within 600ms; generation itself runs async via `after()`. Read endpoints (poll, queue) within 300ms. All new queries indexed. New routes use dynamic imports to stay under 250KB gzipped JS. Grading queue and audit log paginated. |
| Additional: Tech Stack Lock | **JUSTIFIED** | Two new runtime dependencies. Neither replaces an existing layer. See Complexity Tracking. |
| Additional: Secrets Handling | **PASS** | `OPENAI_API_KEY` in `.env` only; never committed. |
| Additional: Documentation | **PASS (commitment)** | README.md updated with new env vars and feature module. |

### Post-Phase 1 Re-Evaluation

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | **PASS** | Data model adds 3 new Mongoose models + extends 3 existing ones. All changes use existing patterns (sub-schemas, compound indexes). API contracts use existing route patterns. Server actions follow quiz v2 Pattern B. |
| II. Testing | **PASS** | Contracts define clear boundaries testable with integration tests. State machine (attempt → pending_grading → submitted) has deterministic transitions testable with unit tests. Per-role authorization specified for every endpoint. |
| III. UX Consistency | **PASS** | Draft review page follows existing quiz editor layout. Grading queue follows existing admin table pattern (`getAdminUser()` + domain action + `_components/` table). Consent banner uses existing Dialog/AlertDialog component. Badges use existing Badge component. |
| IV. Performance | **PASS** | All new indexes documented in data-model.md. Polling pattern matches existing payment-status flow (2s interval, `Cache-Control: no-store`). `pendingGradingCount` field on Attempt avoids expensive aggregation queries for badge counts. `hasShortAnswers` boolean enables fast grading-queue filtering without joining to Question. |

**No unresolved violations. Gate passed.**

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-quiz-from-docx/
├── plan.md                              # This file
├── spec.md                              # Feature specification
├── research.md                          # Phase 0 research decisions
├── data-model.md                        # Phase 1 data model
├── quickstart.md                        # Phase 1 validation guide
├── contracts/
│   └── quiz-generation-api.md           # Phase 1 API contracts
└── tasks.md                             # Phase 2 (generated by /speckit-tasks)
```

### Source Code (repository root)

```text
model/
├── quizv2-model.js                      # MODIFY: add aiGenerated, generationJobId
├── questionv2-model.js                  # MODIFY: add short_answer type, modelAnswer, sourceQuote, difficulty
├── attemptv2-model.js                   # MODIFY: add pending_grading status, SA grading fields, finalization
├── generation-job-model.js              # NEW: GenerationJob + DraftQuestion sub-schema
├── ai-consent-model.js                  # NEW: AIProcessingConsent
└── admin-quiz-config-model.js           # NEW: AdminQuizConfig (singleton)

service/
├── mongo.js                             # EXISTING: dbConnect()
├── docx-extractor.js                    # NEW: mammoth text extraction + normalization + hashing
├── quiz-generator.js                    # NEW: OpenAI structured output call, prompt construction, response validation
└── generation-orchestrator.js           # NEW: after() callback body — extract → hash → dedup check → AI call → save draft

lib/
├── validations.js                       # MODIFY: add quiz generation schemas, SA grading schema, admin config schema
├── quiz-generation-prompt.js            # NEW: system + user prompt templates for AI quiz generation
└── constants.js                         # NEW (or extend existing): consent text version, default quotas, SA max length

queries/
├── quizv2.js                            # MODIFY: add getPendingGradingAttempts, getPendingGradingCount
└── quiz-generation.js                   # NEW: getGenerationJob, getGenerationJobs, checkQuota, checkDuplicate

app/
├── api/
│   └── quiz-generation/
│       ├── consent/route.js             # NEW: POST — check/acknowledge consent
│       ├── jobs/route.js                # NEW: POST — upload + start job
│       └── jobs/[jobId]/
│           ├── route.js                 # NEW: GET — poll status + draft
│           ├── save/route.js            # NEW: POST — save draft as quiz
│           ├── regenerate/route.js      # NEW: POST — regenerate single/all
│           └── questions/[draftId]/
│               └── route.js             # NEW: PATCH — update draft question
├── actions/
│   ├── quizv2.js                        # MODIFY: add gradeShortAnswerResponse, submitAttempt update for SA
│   └── admin.js                         # MODIFY: add adminUpdateQuizConfig
├── [locale]/
│   ├── dashboard/
│   │   ├── courses/[courseId]/quizzes/
│   │   │   └── _components/
│   │   │       ├── quiz-generator.jsx   # NEW: upload + config + draft review UI (client)
│   │   │       ├── draft-question-card.jsx  # NEW: individual question card with edit/delete/regenerate
│   │   │       └── generation-status.jsx    # NEW: polling progress indicator
│   │   ├── grading/
│   │   │   ├── page.jsx                 # NEW: aggregate "Needs grading" queue
│   │   │   └── _components/
│   │   │       ├── grading-queue-table.jsx  # NEW: pending attempts list
│   │   │       └── grade-response-form.jsx  # NEW: SA grading form (client)
│   │   └── _components/
│   │       └── sidebar-routes.jsx       # MODIFY: add "Needs grading" nav item with badge
│   └── admin/
│       ├── quizzes/page.jsx             # MODIFY: add AI-generated filter column
│       ├── quiz-settings/
│       │   ├── page.jsx                 # NEW: admin quiz generation config page
│       │   └── _components/
│       │       └── quiz-config-form.jsx # NEW: config form (client)
│       ├── grading/
│       │   ├── page.jsx                 # NEW: admin aggregate grading queue (all instructors)
│       │   └── _components/
│       │       └── admin-grading-table.jsx  # NEW
│       └── _components/
│           └── admin-sidebar.jsx        # MODIFY: add "Quiz Settings" and "Grading" nav items

messages/
├── en.json                              # MODIFY: add "QuizGeneration" and "Grading" namespaces
└── ar.json                              # MODIFY: add "QuizGeneration" and "Grading" namespaces
```

**Structure Decision**: Follows the existing Next.js 15 App Router layout — no new top-level directories. New service files in `service/`, new queries in `queries/`, new API routes under `app/api/quiz-generation/`, new UI pages co-located with existing dashboard/admin routes. Client components in `_components/` subfolders per page.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| New runtime dependency: `openai@^6.33.0` | Required to call OpenAI's GPT-4.1 API with Structured Outputs for quiz generation. The project has no existing AI/LLM capability. | Raw `fetch()` to the OpenAI REST API: loses `zodResponseFormat()` integration, structured output type safety, automatic retry/error handling, and SDK-managed auth. The SDK is the officially maintained client; raw fetch would be a custom, unmaintained abstraction doing the same thing worse. |
| New runtime dependency: `mammoth@^1.12.0` | Required to extract plain text from uploaded `.docx` files. The project has no existing document-parsing capability. | Manual OOXML unzipping + XML parsing: `.docx` is a ZIP of XML; extracting paragraphs, headings, lists, and table cells requires understanding the OOXML `w:` namespace, numbering definitions, style inheritance, and relationship references. This is effectively re-implementing mammoth poorly. The library is BSD-licensed, 5.6M weekly downloads, minimal dependency surface. |
