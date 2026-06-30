# Tasks: AI Quiz Generation from Lecture Notes (.docx)

**Input**: Design documents from `/specs/001-ai-quiz-from-docx/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/quiz-generation-api.md, quickstart.md

**Tests**: Required — Constitution Principle II mandates integration tests against a real test MongoDB for new server logic and per-role authorization tests for every new endpoint. Test framework setup is included in Phase 1.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install new dependencies, configure environment, and set up test infrastructure

- [X] T001 Install new runtime dependencies: `openai@^6.33.0` and `mammoth@^1.12.0`
- [X] T002 [P] Add `OPENAI_API_KEY` and `OPENAI_QUIZ_MODEL=gpt-4.1` to `.env.example` and document in README.md
- [X] T003 [P] Set up Vitest test framework with MongoDB test configuration for integration tests

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data models, shared services, validation schemas, and i18n keys that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### New Models

- [X] T004 [P] Create GenerationJob model with DraftQuestion sub-schema and indexes (`{ userId: 1, createdAt: -1 }`, `{ courseId: 1, sourceContentHash: 1 }`, `{ status: 1 }`, `{ courseId: 1, lessonId: 1, createdAt: -1 }`) in model/generation-job-model.js
- [X] T005 [P] Create AIProcessingConsent model with unique compound index `{ userId: 1, consentVersion: 1 }` in model/ai-consent-model.js
- [X] T006 [P] Create AdminQuizConfig singleton model (upsert pattern) with default values (dailyQuota: 20, maxDocSize: 10MB, maxQuestions: 30) in model/admin-quiz-config-model.js

### Existing Model Modifications

- [X] T007 [P] Extend Question model: add `short_answer` to type enum, add `modelAnswer` (String), `sourceQuote` (String), `difficulty` (enum easy/medium/hard) fields, relax options/correctOptionIds validation for short_answer type, add index `{ quizId: 1, type: 1 }` in model/questionv2-model.js
- [X] T008 [P] Extend Quiz model: add `aiGenerated` (Boolean, default false), `generationJobId` (ObjectId ref GenerationJob), add index `{ aiGenerated: 1, courseId: 1 }` in model/quizv2-model.js
- [X] T009 [P] Extend Attempt model: add `pending_grading` to status enum, extend answers sub-schema with `textResponse`, `graded`, `awardedPoints`, `graderComment`, `gradedBy`, `gradedAt` fields, add `hasShortAnswers`, `pendingGradingCount`, `finalizedAt`, `finalizedBy` fields, add partial indexes for grading queue in model/attemptv2-model.js

### Shared Services & Utilities

- [X] T010 [P] Create or extend constants file with consent text version, default generation params, SA max length (2000 chars), difficulty/type enums in lib/constants.js
- [X] T011 [P] Update Zod validation schemas: add quiz generation params schema, SA grading schema (`awardedPoints`, `graderComment`), admin config schema, update question schema for `short_answer` type with `.strict()` on all in lib/validations.js
- [X] T012 [P] Create DOCX text extraction service: `mammoth.extractRawText()`, text normalization (NFKC, whitespace collapse), SHA-256 content hashing via `node:crypto`, extraction warning passthrough in service/docx-extractor.js
- [X] T013 [P] Create quiz generation prompt templates: system prompt (role, constraints, output schema) and user prompt (extracted text, question mix params) in lib/quiz-generation-prompt.js
- [X] T014 Create quiz generator service: OpenAI client init, `zodResponseFormat()` for strict structured output, Zod response schema for array of generated questions, source-quote validation (≤30 words), ungrounded-question filtering in service/quiz-generator.js
- [X] T015 [P] Add `QuizGeneration` and `Grading` i18n namespaces with all UI strings (consent banner, upload labels, status messages, grading labels, error messages, admin settings labels) to messages/en.json and messages/ar.json

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Generate a publish-ready quiz from a lecture document (Priority: P1) 🎯 MVP

**Goal**: Instructor uploads a `.docx` lecture, receives an AI-generated quiz draft with MCQ/TF/SA questions (each tagged with difficulty, answer, explanation, source quote), reviews/edits the draft, saves it as a quiz. Students take quizzes with SA questions; instructors grade SA responses via a "Needs grading" queue with per-response autosave and auto-finalization.

**Independent Test**: An instructor uploads a sample `.docx`, clicks "Generate", receives a 10-question draft within 60s, saves it as an unpublished quiz marked "AI-generated". A student takes the quiz; SA responses enter pending_grading; the instructor grades each SA response; the attempt auto-finalizes when the last response is graded.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T016 [P] [US1] Integration test for quiz generation flow: upload `.docx` → extract text → AI generates draft → save as quiz → verify quiz and questions in DB in tests/integration/quiz-generation.test.js
- [X] T017 [P] [US1] Per-role authorization tests for all quiz-generation API endpoints (student denied, instructor allowed for own course, admin allowed, instructor denied for other's course) in tests/integration/quiz-generation-auth.test.js
- [X] T018 [P] [US1] Integration test for SA grading flow: submit attempt with SA → pending_grading status → grade one response (autosave) → grade remaining → auto-finalization (score, percentage, pass/fail, finalizedAt) in tests/integration/sa-grading.test.js

### Implementation for User Story 1

- [X] T019 [P] [US1] Create quiz generation query helpers: `getGenerationJob`, `getGenerationJobs`, `checkQuota` (count today's jobs for userId), `checkDuplicate` (courseId + contentHash) in queries/quiz-generation.js
- [X] T020 [P] [US1] Add `getPendingGradingAttempts` (paginated, role-scoped) and `getPendingGradingCount` (badge counts by quiz) to queries/quizv2.js
- [X] T021 [US1] Create generation orchestrator: `after()` callback body — extract text → compute hash → dedup check → call quiz generator → validate/filter responses → save draftQuestions on job → update status to succeeded/failed in service/generation-orchestrator.js
- [X] T022 [P] [US1] Implement consent API route: POST check/acknowledge consent with version tracking, auth (instructor/admin only) in app/api/quiz-generation/consent/route.js
- [X] T023 [US1] Implement jobs API route: POST multipart/form-data upload, validate MIME/size/quota/consent/course ownership, extract text, reject if empty, compute hash, check duplicate, create GenerationJob, register `after()` callback, return 202 in app/api/quiz-generation/jobs/route.js
- [X] T024 [P] [US1] Implement job status polling: GET with auth (job owner or admin), return status/draft/failure, `Cache-Control: no-store` header in app/api/quiz-generation/jobs/[jobId]/route.js
- [X] T025 [P] [US1] Implement draft question update: PATCH partial update of DraftQuestion sub-doc, validate options/correctOptionIds per type, set instructorState to `edited` in app/api/quiz-generation/jobs/[jobId]/questions/[draftId]/route.js
- [X] T026 [US1] Implement save draft as quiz: POST create Quiz (`aiGenerated: true`, `published: false`) + Question documents from non-rejected drafts, link `generationJobId` in app/api/quiz-generation/jobs/[jobId]/save/route.js
- [X] T027 [US1] Add `gradeShortAnswerResponse` server action: load attempt, verify `pending_grading`, grade answer sub-doc, decrement `pendingGradingCount`, auto-finalize if 0 remaining (recompute score, scorePercent, passed, set finalizedAt/finalizedBy) in app/actions/quizv2.js
- [X] T028 [US1] Update `submitAttempt` logic: detect SA questions on quiz, set `hasShortAnswers: true`, set `pendingGradingCount`, route to `pending_grading` status instead of `submitted` when SA present, auto-grade MCQ/TF immediately in app/actions/quizv2.js
- [X] T029 [P] [US1] Create generation status polling component: 2s interval poll, progress indicator, auto-stop on terminal state (succeeded/failed), error display in app/[locale]/dashboard/courses/[courseId]/quizzes/_components/generation-status.jsx
- [X] T030 [P] [US1] Create draft question card component: display question text, type badge, difficulty tag, options/model answer, explanation, source quote, instructorState indicator in app/[locale]/dashboard/courses/[courseId]/quizzes/_components/draft-question-card.jsx
- [X] T031 [US1] Create quiz generator page component: consent check/banner → file upload (drag-and-drop, `.docx` only) → default config display → trigger generation → show polling → render draft cards → "Save as quiz" button with title/config form in app/[locale]/dashboard/courses/[courseId]/quizzes/_components/quiz-generator.jsx
- [X] T032 [P] [US1] Create grading queue table component: paginated list of pending-grading attempts with student name, quiz title, submission date, pending count, link to grade in app/[locale]/dashboard/grading/_components/grading-queue-table.jsx
- [X] T033 [P] [US1] Create grade response form component: display student response alongside model answer and source quote, points input (0 to max), optional comment textarea, per-response save button in app/[locale]/dashboard/grading/_components/grade-response-form.jsx
- [X] T034 [US1] Create instructor grading queue page: aggregate "Needs grading" view, load `getPendingGradingAttempts` scoped to instructor's quizzes, render grading-queue-table in app/[locale]/dashboard/grading/page.jsx
- [X] T035 [US1] Update instructor sidebar: add "Needs grading" nav item with count badge from `getPendingGradingCount` in app/[locale]/dashboard/_components/sidebar-routes.jsx

**Checkpoint**: User Story 1 fully functional — instructor can generate, review, save AI quizzes; students can take quizzes with SA; instructors can grade SA responses; auto-finalization works

---

## Phase 4: User Story 2 — Tune the question mix and regenerate individual questions (Priority: P2)

**Goal**: Instructor adjusts per-type/per-difficulty counts, edits any question field, deletes questions, regenerates a single question or the entire draft — shaping the quiz to their teaching goals before saving.

**Independent Test**: Starting from a generated draft, the instructor changes per-type counts, regenerates all, edits one question's options, deletes another, regenerates a third individually, and saves. The saved quiz reflects exactly the post-edit state; audit records capture per-question regenerations.

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T036 [P] [US2] Integration test for regeneration flows: single-question regenerate (others untouched), full regenerate with new params (draft replaced), edit validation (correctOptionIds must match options) in tests/integration/quiz-regeneration.test.js

### Implementation for User Story 2

- [X] T037 [US2] Implement regenerate API route: POST single/all scope, single regenerates one draftId via AI keeping others untouched, all replaces entire draft with new params (consumes quota slot), return 202 + poll for result in app/api/quiz-generation/jobs/[jobId]/regenerate/route.js
- [X] T038 [US2] Add edit inline, delete, and per-question "Regenerate" controls to draft-question-card component in app/[locale]/dashboard/courses/[courseId]/quizzes/_components/draft-question-card.jsx
- [X] T039 [US2] Add mix configuration panel (per-type and per-difficulty count inputs with sum validation) and "Regenerate all" button with confirmation dialog to quiz-generator component in app/[locale]/dashboard/courses/[courseId]/quizzes/_components/quiz-generator.jsx

**Checkpoint**: User Stories 1 AND 2 independently functional — full generate-edit-regenerate-save loop works

---

## Phase 5: User Story 3 — Admin governance, quotas, and audit (Priority: P3)

**Goal**: Admin configures daily quota and max document size, sees who is generating quizzes, audits source documents and parameters, and views all pending-grading attempts across the platform.

**Independent Test**: Admin sets daily cap to N; instructor exceeds N and is blocked with clear message; admin opens audit view and sees the blocked attempt plus all successful generations with source fingerprints and parameters.

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T040 [P] [US3] Integration test for admin config and quota enforcement: set dailyQuota, exceed it (expect 429 with retryAfter), verify audit log records success and blocked attempts, verify admin-only access in tests/integration/admin-quiz-config.test.js

### Implementation for User Story 3

- [X] T041 [US3] Add `adminUpdateQuizConfig` server action: admin-only auth, Zod `.strict()` validation, upsert AdminQuizConfig singleton in app/actions/admin.js
- [X] T042 [P] [US3] Create quiz config form component: fields for dailyQuota, maxDocumentSize, maxQuestions, sourceRetention toggle + days, React Hook Form + Zod validation, submit via `adminUpdateQuizConfig` in app/[locale]/admin/quiz-settings/_components/quiz-config-form.jsx
- [X] T043 [US3] Create admin quiz settings page: load current AdminQuizConfig, render quiz-config-form in app/[locale]/admin/quiz-settings/page.jsx
- [X] T044 [US3] Add AI-generated filter column and generation audit details (source filename, content hash, params, AI model, user) to admin quizzes page in app/[locale]/admin/quizzes/page.jsx
- [X] T045 [US3] Create admin aggregate grading queue page: load `getPendingGradingAttempts` for all instructors, filter by course/quiz/instructor in app/[locale]/admin/grading/page.jsx
- [X] T046 [P] [US3] Create admin grading table component: pending attempts across all instructors with instructor name, student name, quiz title, course, submission date, pending count in app/[locale]/admin/grading/_components/admin-grading-table.jsx
- [X] T047 [US3] Update admin sidebar: add "Quiz Settings" and "Grading" nav items in app/[locale]/admin/_components/admin-sidebar.jsx

**Checkpoint**: All user stories independently functional — admin governance, quotas, and audit operational

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification, accessibility, performance, and documentation across all stories

- [X] T048 [P] Verify all new UI strings exist in both messages/en.json and messages/ar.json; test both locales render without missing-key warnings
- [X] T049 [P] Responsive layout validation: test all new pages (quiz generator, grading queue, admin settings, admin grading) at 360px and 1280px widths; fix any horizontal scroll or layout overflow
- [X] T050 [P] Keyboard accessibility audit: verify tab order, focus management, and `aria-describedby` on upload form, draft review cards, grading form, and admin settings form
- [X] T051 [P] Update README.md with new env vars (`OPENAI_API_KEY`, `OPENAI_QUIZ_MODEL`), feature description, and new module documentation
- [X] T052 Run full quickstart.md validation: execute all 6 scenarios and edge cases (6a–6f), document results, fix any failures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3–5)**: All depend on Foundational phase completion
  - US1 (Phase 3) should be completed first as MVP
  - US2 (Phase 4) depends on US1 draft infrastructure (draft-question-card, quiz-generator components)
  - US3 (Phase 5) can proceed independently after Foundational, but benefits from US1's grading infrastructure
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories. Delivers end-to-end generation, SA grading, and instructor grading queue.
- **User Story 2 (P2)**: Depends on US1's draft review UI and quiz-generator component. Adds regeneration and editing capabilities.
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) for admin config (T041–T043). Admin grading queue (T045–T046) benefits from US1's grading query functions (T020). Admin quiz audit (T044) benefits from US1's generation infrastructure.

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Query helpers before routes/actions that use them
- Services before routes that call them
- API routes before UI components that consume them
- Core flow before supporting UI (sidebar badges, etc.)

### Parallel Opportunities

- **Phase 1**: T002 and T003 can run in parallel
- **Phase 2**: T004–T009 (all models) can run in parallel; T010–T013, T015 can run in parallel; T014 depends on T013 (prompts)
- **Phase 3**: T016–T018 (all tests) can run in parallel; T019–T020, T022, T024–T025, T029–T030, T032–T033 can run in parallel
- **Phase 4**: T036 (tests) first; then T037 before T038–T039
- **Phase 5**: T040 (tests) first; T041–T042 and T046 can run in parallel
- **Phase 6**: T048–T051 can all run in parallel; T052 is final

---

## Parallel Example: User Story 1

```bash
# Launch all tests for US1 together (write first, expect failures):
Task: "Integration test for quiz generation flow in tests/integration/quiz-generation.test.js"
Task: "Per-role authorization tests in tests/integration/quiz-generation-auth.test.js"
Task: "Integration test for SA grading flow in tests/integration/sa-grading.test.js"

# Launch query helpers in parallel:
Task: "Create quiz generation query helpers in queries/quiz-generation.js"
Task: "Add getPendingGradingAttempts and getPendingGradingCount to queries/quizv2.js"

# Launch independent API routes in parallel:
Task: "Implement consent API route in app/api/quiz-generation/consent/route.js"
Task: "Implement job status polling in app/api/quiz-generation/jobs/[jobId]/route.js"
Task: "Implement draft question update in app/api/quiz-generation/jobs/[jobId]/questions/[draftId]/route.js"

# Launch independent UI components in parallel:
Task: "Create generation status polling component"
Task: "Create draft question card component"
Task: "Create grading queue table component"
Task: "Create grade response form component"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install deps, env vars, test framework)
2. Complete Phase 2: Foundational (models, services, validations, i18n)
3. Complete Phase 3: User Story 1 (generate → review → save → SA grading → needs-grading queue)
4. **STOP and VALIDATE**: Run quickstart.md Scenarios 1, 3, 4 (generation, SA grading, auth)
5. Deploy/demo if ready — instructors can generate quizzes from documents

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (**MVP — full generate-to-grade flow**)
3. Add User Story 2 → Test independently → Deploy/Demo (adds editing and regeneration)
4. Add User Story 3 → Test independently → Deploy/Demo (adds admin governance and audit)
5. Polish phase → Final validation against quickstart.md

### Single-Developer Strategy

With one developer (sequential, priority order):

1. Phase 1 → Phase 2 → Phase 3 (US1) → Validate MVP
2. Phase 4 (US2) → Validate edit/regenerate
3. Phase 5 (US3) → Validate admin governance
4. Phase 6 → Full validation

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Write tests first, verify they fail, then implement
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
- Constitution Principle II: all new server logic needs integration tests against real test MongoDB
- Constitution Principle III: all strings via i18n, shadcn/ui components, responsive 360px–1280px
- Constitution Principle IV: write endpoints ≤600ms p95, read endpoints ≤300ms p95, generation async via `after()`
