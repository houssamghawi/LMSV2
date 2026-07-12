# Tasks: Context-Bound AI Tutor

**Input**: Design documents from `/specs/003-context-bound-ai-tutor/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/ai-tutor-api.md, quickstart.md

**Tests**: Integration tests included per Constitution Principle II (Testing Standards)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md, this project uses the existing LMS structure:
- `model/` - Mongoose models
- `service/` - Business logic services
- `queries/` - Data access queries
- `lib/` - Shared utilities
- `app/api/` - API routes
- `app/[locale]/` - Localized pages
- `components/` - Reusable UI components
- `messages/` - i18n strings
- `tests/` - Test files

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependencies, and configuration

- [X] T001 Install chromadb npm package via `npm install chromadb`
- [X] T002 [P] Add CHROMA_URL environment variable to .env.example
- [X] T003 [P] Update README.md with ChromaDB Docker setup instructions
- [X] T004 [P] Add AI tutor i18n strings to messages/en.json (tutor section)
- [X] T005 [P] Add AI tutor i18n strings to messages/ar.json (tutor section)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Data Models

- [X] T006 [P] Create TutorInteraction model in model/tutor-interaction-model.js (per data-model.md schema)
- [X] T007 [P] Create TutorConfiguration model in model/tutor-config-model.js (per data-model.md schema)
- [X] T008 [P] Create LectureChunk model in model/lecture-chunk-model.js (per data-model.md schema)

### Validation Schemas

- [X] T009 [P] Create Zod schemas for tutor API requests in lib/validations/tutor-schemas.js

### Core Services

- [X] T010 Create ChromaDB client wrapper in service/vector-store.js (connect, query, upsert, delete)
- [X] T011 [P] Create language detector utility in lib/language-detector.js (Arabic/English detection)
- [X] T012 Create AI tutor system prompt builder in lib/ai-tutor-prompt.js (context-bound behavior)
- [X] T013 Create lecture embedder service in service/lecture-embedder.js (chunk, embed, store in ChromaDB)
- [X] T014 Create tutor interaction queries in queries/tutor-interactions.js (create, find, update, paginate)

### Configuration

- [X] T015 Add tutor constants to lib/constants.js (CHUNK_SIZE, RELEVANCE_THRESHOLD, RATE_LIMIT defaults)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 & 2 - Core Q&A (Priority: P1) 🎯 MVP

**Goal**: Student can ask questions and receive context-grounded answers with citations, OR receive the standardized out-of-context message when answer is not found

**Independent Test**: Ask a question with an answer in the lecture content → receive cited answer. Ask a question without an answer → receive out-of-context message.

> **Note**: US1 (within context) and US2 (out of context) share the same implementation - the difference is the AI's response based on context retrieval results.

### Tests for User Story 1 & 2

- [X] T016 [P] [US1] Create integration test for POST /api/tutor/ask (within context) in tests/integration/tutor-ask-context.test.js
- [X] T017 [P] [US2] Create integration test for POST /api/tutor/ask (out of context) in tests/integration/tutor-ask-nocontext.test.js
- [X] T018 [P] [US1] Create unit test for language detector in tests/unit/language-detector.test.js
- [X] T019 [P] [US1] Create unit test for AI tutor service in tests/unit/ai-tutor.test.js

### Implementation for User Story 1 & 2

- [X] T020 [US1] Create core AI tutor service in service/ai-tutor.js (RAG pipeline: retrieve → generate → cite)
- [X] T021 [US1] Implement POST /api/tutor/ask route in app/api/tutor/ask/route.js (per contracts/ai-tutor-api.md)
- [X] T022 [P] [US1] Create chat message UI component in components/ui/chat-message.jsx (student/tutor bubbles)
- [X] T023 [US1] Create AI tutor panel component in app/[locale]/dashboard/courses/[courseId]/lessons/[lessonId]/_components/ai-tutor-panel.jsx
- [X] T024 [US1] Integrate AI tutor panel into lesson page layout
- [X] T025 [P] [US1] Implement POST /api/tutor/feedback route in app/api/tutor/feedback/route.js (thumbs up/down)
- [X] T026 [US1] Add feedback UI (thumbs up/down buttons) to chat message component
- [X] T027 [US1] Implement rate limiting check in /api/tutor/ask route (per config rateLimitPerHour)
- [X] T028 [US2] Handle empty lecture context case (disable tutor, show message per spec edge case)

**Checkpoint**: Core Q&A functionality complete - students can ask questions and receive answers or out-of-context messages

---

## Phase 4: User Story 3 - Instructor Interaction Logs (Priority: P2)

**Goal**: Instructors can view and filter student interactions with the AI tutor for their courses

**Independent Test**: Login as instructor, navigate to course, view interaction log, filter by out-of-context responses

### Tests for User Story 3

- [X] T029 [P] [US3] Create integration test for GET /api/tutor/history (instructor view) in tests/integration/tutor-history-instructor.test.js
- [X] T030 [P] [US3] Create authorization test (student vs instructor access) in tests/integration/tutor-history-auth.test.js

### Implementation for User Story 3

- [X] T031 [US3] Implement GET /api/tutor/history route in app/api/tutor/history/route.js (per contracts/ai-tutor-api.md)
- [X] T032 [US3] Add instructor-specific query logic to queries/tutor-interactions.js (filter by course, include all students)
- [X] T033 [P] [US3] Create interaction log table component in app/[locale]/dashboard/courses/[courseId]/_components/tutor-interactions-table.jsx
- [X] T034 [US3] Create instructor tutor analytics page in app/[locale]/dashboard/courses/[courseId]/tutor-analytics/page.jsx
- [X] T035 [US3] Add filter controls (by contextStatus, lessonId, date range) to interactions table
- [X] T036 [US3] Add navigation link to tutor analytics from course dashboard sidebar

**Checkpoint**: Instructors can view and filter interaction logs for their courses

---

## Phase 5: Student History Access (Extension of US1/US2)

**Goal**: Students can view their own AI tutor interaction history for the current course

**Independent Test**: Login as student, navigate to course, view own Q&A history

- [X] T037 [US1] Add student history section to AI tutor panel (collapsible past Q&A)
- [X] T038 [US1] Implement student-scoped history query in queries/tutor-interactions.js
- [X] T039 [US1] Create history list component in app/[locale]/dashboard/courses/[courseId]/lessons/[lessonId]/_components/tutor-history-list.jsx

**Checkpoint**: Students can view their own interaction history

---

## Phase 6: User Story 4 - Admin Configuration (Priority: P3)

**Goal**: Admins can configure AI tutor settings including the out-of-context message

**Independent Test**: Login as admin, access tutor settings, update out-of-context message, verify new message appears in subsequent out-of-context responses

### Tests for User Story 4

- [X] T040 [P] [US4] Create integration test for GET/PUT /api/tutor/config in tests/integration/tutor-config.test.js
- [X] T041 [P] [US4] Create authorization test (admin-only access) in tests/integration/tutor-config-auth.test.js

### Implementation for User Story 4

- [X] T042 [US4] Implement GET /api/tutor/config route in app/api/tutor/config/route.js
- [X] T043 [US4] Implement PUT /api/tutor/config route in app/api/tutor/config/route.js (per contracts/ai-tutor-api.md)
- [X] T044 [US4] Create admin tutor config form in app/[locale]/admin/tutor-settings/_components/tutor-config-form.jsx
- [X] T045 [US4] Create admin tutor settings page in app/[locale]/admin/tutor-settings/page.jsx
- [X] T046 [US4] Add navigation link to tutor settings in admin sidebar
- [X] T047 [US4] Implement config resolution logic in service/ai-tutor.js (course-specific → global → defaults)

**Checkpoint**: Admins can configure AI tutor behavior

---

## Phase 7: Lecture Content Embedding Pipeline

**Purpose**: Enable lecture content to be embedded for AI tutor retrieval

- [X] T048 Implement lesson content extraction in service/lecture-embedder.js (handle text from lesson description)
- [X] T049 Create embed-lesson script in scripts/embed-lesson.js (CLI for manual embedding)
- [X] T050 Add lecture content field to Lesson model (or use existing description field) with embedding trigger
- [X] T051 Implement automatic re-embedding when lesson content changes (via Mongoose pre-save hook or API trigger)
- [X] T052 Add embedding status indicator to lesson editor UI (instructor view)

**Checkpoint**: Lecture content can be embedded and updated

---

## Phase 8: Error Handling & Edge Cases

**Purpose**: Robust error handling per spec edge cases and clarifications

- [X] T053 [P] Implement AI service unavailability handling in service/ai-tutor.js (graceful error message)
- [X] T054 [P] Implement question length validation (max 1000 chars) in /api/tutor/ask
- [X] T055 Implement POST /api/tutor/report route in app/api/tutor/report/route.js (issue reporting)
- [X] T056 Add report issue button to chat message component

**Checkpoint**: All error cases handled gracefully

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T057 [P] Create seed script for default TutorConfiguration in scripts/seed-tutor-config.js
- [X] T058 [P] Add tutor feature documentation to docs/ai-tutor.md
- [X] T059 Run quickstart.md validation scenarios manually
- [X] T060 [P] Add loading skeleton to AI tutor panel (per Constitution Principle III)
- [X] T061 [P] Add empty state to interaction history (per Constitution Principle III)
- [X] T062 Verify all i18n strings are used correctly (no hardcoded strings)
- [X] T063 Verify accessibility: keyboard navigation for tutor panel, ARIA labels
- [X] T064 Performance check: verify response time meets 5-second target (SC-001)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 & 2 (Phase 3)**: Depends on Foundational phase completion
- **User Story 3 (Phase 4)**: Depends on Phase 3 (needs TutorInteraction records to exist)
- **Student History (Phase 5)**: Depends on Phase 3
- **User Story 4 (Phase 6)**: Can start after Foundational (Phase 2) - Independent of US1-3
- **Embedding Pipeline (Phase 7)**: Can start after Foundational (Phase 2) - Independent
- **Error Handling (Phase 8)**: Depends on Phase 3
- **Polish (Phase 9)**: Depends on all previous phases

### User Story Dependencies

| Story | Can Start After | Dependencies on Other Stories |
|-------|-----------------|-------------------------------|
| **US1 & US2 (P1)** | Phase 2 | None - core MVP |
| **US3 (P2)** | Phase 3 | Needs interaction data from US1/US2 |
| **US4 (P3)** | Phase 2 | None - can be built in parallel |

### Within Each User Story

1. Tests written first (if included) - should FAIL initially
2. Models before services
3. Services before API routes
4. API routes before UI components
5. Core implementation before integration
6. Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**: T002, T003, T004, T005 can run in parallel

**Phase 2 (Foundational)**:
- T006, T007, T008 (models) can run in parallel
- T009, T011 can run in parallel
- T010, T012, T013 depend on T006-T008 but T011 is independent

**Phase 3 (US1 & US2)**:
- All test tasks (T016-T019) can run in parallel
- T022 (chat component) independent of T020, T021
- T025 (feedback route) independent of core flow

**Phase 4 (US3)**:
- T029, T030 (tests) can run in parallel
- T033 (table component) can be built while T031 is in progress

**Phase 6 (US4)**:
- T040, T041 (tests) can run in parallel
- T042, T043 can be built in sequence
- T044 (form) can be built while routes are in progress

---

## Parallel Example: Phase 2 Foundation

```bash
# Launch all models in parallel:
Task: "Create TutorInteraction model in model/tutor-interaction-model.js"
Task: "Create TutorConfiguration model in model/tutor-config-model.js"
Task: "Create LectureChunk model in model/lecture-chunk-model.js"
Task: "Create Zod schemas in lib/validations/tutor-schemas.js"

# Then launch independent services:
Task: "Create language detector in lib/language-detector.js"
Task: "Add tutor constants to lib/constants.js"
```

## Parallel Example: Phase 3 Tests

```bash
# Launch all tests for US1/US2 in parallel:
Task: "Integration test for ask (within context) in tests/integration/tutor-ask-context.test.js"
Task: "Integration test for ask (out of context) in tests/integration/tutor-ask-nocontext.test.js"
Task: "Unit test for language detector in tests/unit/language-detector.test.js"
Task: "Unit test for AI tutor service in tests/unit/ai-tutor.test.js"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 & 2
4. **STOP and VALIDATE**: Test core Q&A independently
5. Deploy/demo if ready - this is the MVP!

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 & US2 → Test independently → Deploy/Demo (**MVP!**)
3. Add US3 → Test independently → Deploy/Demo (Instructor insights)
4. Add US4 → Test independently → Deploy/Demo (Admin customization)
5. Each story adds value without breaking previous stories

### Recommended Execution Order

For a single developer working sequentially:

1. **Week 1**: Phases 1-2 (Setup + Foundation)
2. **Week 2**: Phase 3 (Core Q&A MVP) + Phase 7 (Embedding Pipeline)
3. **Week 3**: Phases 4-5 (Instructor + Student History)
4. **Week 4**: Phase 6 (Admin Config) + Phases 8-9 (Polish)

---

## Task Summary

| Phase | Tasks | Parallel Tasks |
|-------|-------|----------------|
| Phase 1: Setup | 5 | 4 |
| Phase 2: Foundational | 10 | 6 |
| Phase 3: US1 & US2 (P1) | 13 | 6 |
| Phase 4: US3 (P2) | 8 | 3 |
| Phase 5: Student History | 3 | 0 |
| Phase 6: US4 (P3) | 8 | 3 |
| Phase 7: Embedding | 5 | 0 |
| Phase 8: Error Handling | 4 | 2 |
| Phase 9: Polish | 8 | 5 |
| **Total** | **64** | **29** |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Constitution Principle II requires integration tests for API routes with authorization checks
