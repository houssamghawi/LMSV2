# Tasks: AI MCQ Complement for Existing Quizzes

**Input**: Design documents from `/specs/002-ai-mcq-complement/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/mcq-complement-api.md, quickstart.md

**Tests**: Included — the plan explicitly specifies integration tests for the append flow and per-role authorization tests for new endpoints.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app (Next.js 15 App Router)**: `app/`, `lib/`, `service/`, `model/`, `queries/`, `messages/`, `tests/`
- Paths are relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add shared constants, validation schemas, and i18n strings used by all user stories

- [X] T001 Add MCQ complement constants (DEFAULT_MCQ_COMPLEMENT_PARAMS, MCQ_OPTIONS_COUNT) to lib/constants.js
- [X] T002 [P] Add MCQ complement Zod schemas (startMcqComplementSchema validating targetQuizId + MCQ-only params, appendMcqsSchema validating confirmPublishedAppend) to lib/validations.js

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core model extension, MCQ prompt template, MCQ structural validator, and query function that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Extend GenerationJob schema with targetQuizId (ObjectId, ref Quiz, default null) and jobType (String, enum ["full_quiz", "mcq_complement"], default "full_quiz"), add partial index { targetQuizId: 1, createdAt: -1 } with partialFilterExpression { targetQuizId: { $ne: null } } in model/generation-job-model.js
- [X] T004 [P] Create MCQ complement prompt template exporting buildMcqComplementMessages(extractedText, params, existingStems) with MCQ-specific system prompt (4 options A–D, plausible distractors, 1-sentence justification, difficulty tags, duplicate avoidance via existing stems) in lib/mcq-complement-prompt.js
- [X] T005 [P] Create MCQ validator service exporting validateMcqStructure (exactly 4 distinct options, correct answer maps to an option, justification present and ≤2 sentences, near-identical option detection via Dice coefficient ≥0.9) and filterDuplicateStems (normalized Dice coefficient ≥0.8 against existing stems) in service/mcq-validator.js
- [X] T006 [P] Add getExistingQuestionStems(quizId) query returning string[] of question text values with projection { text: 1, _id: 0 } in queries/quiz-generation.js
- [X] T007 [P] Add McqComplement i18n namespace strings (trigger button, config dialog labels, draft view headings, validation summary, append confirmation, published-quiz warning, error messages, difficulty labels) to messages/en.json and messages/ar.json

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Generate MCQs to complement an existing quiz (Priority: P1) 🎯 MVP

**Goal**: An instructor opens a quiz with existing questions, uploads a .docx, generates MCQ-only questions, reviews a basic draft, and appends them atomically to the quiz without disturbing existing questions.

**Independent Test**: Instructor opens a quiz with 5 SA questions, uploads a .docx, clicks "Generate MCQs", sees a draft of MCQs (each with 4 options, correct answer, justification, difficulty), clicks "Append to Quiz", and the quiz now contains the original 5 SA questions plus the new MCQs.

### Implementation for User Story 1

- [X] T008 [US1] Extend POST /api/quiz-generation/jobs route to accept targetQuizId and jobType="mcq_complement": validate quiz exists and instructor owns it, enforce MCQ-only params (trueFalseCount=0, shortAnswerCount=0, mcqCount=totalQuestions), check for concurrent running complement job on same quiz (409 Conflict), pass targetQuizId and existing stems to orchestrator in app/api/quiz-generation/jobs/route.js
- [X] T009 [US1] Add runMcqComplementJob() to service/generation-orchestrator.js — fetch existing stems via getExistingQuestionStems, build MCQ prompt via buildMcqComplementMessages, call generateQuizDraft, run validateMcqStructure and filterDuplicateStems, store mcqValidationSummary (generated, droppedUngrounded, droppedInvalidStructure, droppedDuplicate, included) on the job
- [X] T010 [US1] Extend GET /api/quiz-generation/jobs/[jobId] response to include jobType, targetQuizId, and mcqValidationSummary fields when job is MCQ complement type in app/api/quiz-generation/jobs/[jobId]/route.js
- [X] T011 [US1] Create POST /api/quiz-generation/jobs/[jobId]/append endpoint: auth + ownership check, validate job.status==="succeeded" and job.jobType==="mcq_complement", load target quiz, check published-quiz with attempts (return requiresConfirmation if confirmPublishedAppend!==true), filter drafts excluding instructorState==="rejected", assign order starting from existing question count, insert Question documents in MongoDB transaction, return appendedCount and totalQuestionCount in app/api/quiz-generation/jobs/[jobId]/append/route.js
- [X] T012 [P] [US1] Create mcq-complement-trigger.jsx client component — "Generate MCQs" button on quiz editor, .docx upload dialog with file validation, default MCQ count (8), AI consent check (reuse spec 001 mechanism), start generation call, poll job status via existing generation-status pattern, transition to draft view on success in app/[locale]/dashboard/courses/[courseId]/quizzes/_components/mcq-complement-trigger.jsx
- [X] T013 [US1] Create mcq-complement-draft.jsx client component — display draft MCQs as cards (stem, 4 options A–D, correct answer highlighted, justification, difficulty tag), show mcqValidationSummary (generated/dropped/included counts), "Append to Quiz" button calling append endpoint, published-quiz warning AlertDialog with confirmation, success toast and quiz editor refresh on append in app/[locale]/dashboard/courses/[courseId]/quizzes/_components/mcq-complement-draft.jsx

### Tests for User Story 1

- [X] T014 [P] [US1] Integration test for MCQ complement job creation (POST with targetQuizId) and append flow (atomic insert, existing questions preserved, order continuity, confirmPublishedAppend flow) against real test MongoDB in tests/integration/mcq-complement.test.js
- [X] T015 [P] [US1] Per-role authorization integration tests for MCQ complement endpoints — instructor-owner allowed, non-owner instructor denied (403), student denied (403), unauthenticated denied (401) — for both job creation with targetQuizId and append endpoint in tests/integration/mcq-complement-auth.test.js

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently — an instructor can generate and append MCQs to an existing quiz

---

## Phase 4: User Story 2 — Review, edit, and selectively accept generated MCQs (Priority: P2)

**Goal**: Before confirming append, the instructor can edit any MCQ field, delete individual MCQs, or regenerate a single MCQ while keeping the rest intact. Only approved MCQs are appended.

**Independent Test**: From a generated draft of 8 MCQs, the instructor edits 2 stems, deletes 1, regenerates 1, and confirms. The quiz receives exactly 7 MCQs reflecting all edits, and original SA questions are unchanged.

### Implementation for User Story 2

- [X] T016 [US2] Add MCQ inline editing capabilities to mcq-complement-draft.jsx — editable fields for stem, options A–D text, correct answer letter select, justification text, with instructorState tracking ("edited" on save) using existing PATCH /api/quiz-generation/jobs/[jobId]/questions/[draftId] endpoint in app/[locale]/dashboard/courses/[courseId]/quizzes/_components/mcq-complement-draft.jsx
- [X] T017 [US2] Add delete/reject MCQ functionality to mcq-complement-draft.jsx — "Remove" button that sets instructorState to "rejected" via PATCH, visually removes card from draft, updates draft count display in app/[locale]/dashboard/courses/[courseId]/quizzes/_components/mcq-complement-draft.jsx
- [X] T018 [US2] Extend regeneration routing in service/generation-orchestrator.js — when jobType==="mcq_complement" and scope==="single", use buildMcqComplementMessages instead of the full quiz prompt, include current existing stems plus other draft stems for duplicate avoidance, run MCQ validation on the replacement question in service/generation-orchestrator.js
- [X] T019 [US2] Add single-question regeneration UI to mcq-complement-draft.jsx — "Regenerate" button per MCQ card, call POST /api/quiz-generation/jobs/[jobId]/regenerate with scope "single" and draftId, show loading state on that card only, replace card content on success in app/[locale]/dashboard/courses/[courseId]/quizzes/_components/mcq-complement-draft.jsx

**Checkpoint**: At this point, User Stories 1 AND 2 should both work — instructors can generate, review, edit, delete, regenerate, and selectively append MCQs

---

## Phase 5: User Story 3 — Difficulty-balanced MCQ mix (Priority: P2)

**Goal**: The instructor specifies the desired difficulty distribution (Easy/Medium/Hard counts) before generation and can re-tag difficulty in the draft. Generated MCQs respect the requested distribution.

**Independent Test**: Instructor requests 8 MCQs with 3 Easy / 3 Medium / 2 Hard, the draft matches that distribution, instructor re-tags one Medium as Hard, and the appended questions carry the updated tags.

### Implementation for User Story 3

- [X] T020 [US3] Add difficulty distribution configuration UI to mcq-complement-trigger.jsx — three number inputs (Easy/Medium/Hard counts) with Zod validation (sum === totalQuestions), pre-filled defaults (3/3/2 for 8 MCQs), auto-adjust on total change in app/[locale]/dashboard/courses/[courseId]/quizzes/_components/mcq-complement-trigger.jsx
- [X] T021 [US3] Add difficulty tag display and inline editing to mcq-complement-draft.jsx — difficulty badge per MCQ card (Easy/Medium/Hard with color coding), dropdown to re-tag difficulty, persist via PATCH endpoint, update instructorState to "edited" on re-tag in app/[locale]/dashboard/courses/[courseId]/quizzes/_components/mcq-complement-draft.jsx
- [X] T022 [US3] Ensure difficulty distribution params (easyCount, mediumCount, hardCount) are passed through to the MCQ prompt instructions in buildMcqComplementMessages and that the default balanced distribution (3/3/2) is applied when not specified in lib/mcq-complement-prompt.js

**Checkpoint**: All user stories should now be independently functional — full generate, review, edit, difficulty-control, and append workflow is complete

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, additional test coverage, and end-to-end validation

- [X] T023 [P] Concurrent complement job conflict test (409 on duplicate running job for same quiz) and duplicate detection integration test (Dice coefficient filtering) in tests/integration/mcq-complement.test.js
- [X] T024 [P] Update README.md with MCQ complement feature documentation — feature description, usage instructions, new endpoint summary, new env vars (none), new dependencies (none)
- [X] T025 Run quickstart.md validation scenarios (Scenarios 1–6: happy path, edit/delete/regenerate, published-quiz warning, duplicate detection, authorization enforcement, quota/size enforcement)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) completion for constants and schemas — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion
- **User Story 2 (Phase 4)**: Depends on User Story 1 (Phase 3) — extends the draft view and orchestrator from US1
- **User Story 3 (Phase 5)**: Depends on User Story 1 (Phase 3) — extends the trigger and draft view from US1. Independent of US2.
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependencies on other stories
- **User Story 2 (P2)**: Depends on US1's draft view (T013) and orchestrator (T009) — extends them with edit/delete/regenerate
- **User Story 3 (P2)**: Depends on US1's trigger (T012) and draft view (T013) — extends them with difficulty config. Independent of US2.
- **US2 and US3 can proceed in parallel** since US2 modifies editing/regeneration and US3 modifies difficulty configuration — different concerns within the same components

### Within Each User Story

- Backend services and endpoints before frontend components
- Frontend trigger before draft view (trigger initiates the flow)
- Core implementation before tests
- Tests validate the complete story flow

### Parallel Opportunities

- **Phase 1**: T001 and T002 can run in parallel (different files)
- **Phase 2**: T004, T005, T006, T007 can all run in parallel (different files). T003 should go first (model changes)
- **Phase 3**: T008–T011 are backend tasks with dependencies (endpoint → orchestrator → response extension → append). T012 can run in parallel with backend tasks. T014 and T015 can run in parallel after implementation.
- **Phase 4**: T16–T17 modify the same file sequentially. T018 (backend) and T019 (frontend) are sequential.
- **Phase 5**: T020 and T021 modify different components and can run in parallel. T022 is independent.
- **Phase 6**: T023 and T024 can run in parallel

---

## Parallel Example: User Story 1

```bash
# After Phase 2 is complete, launch backend tasks sequentially:
Task: T008 "Extend POST /api/quiz-generation/jobs for MCQ complement in app/api/quiz-generation/jobs/route.js"
Task: T009 "Add runMcqComplementJob() in service/generation-orchestrator.js"
Task: T010 "Extend GET response with MCQ complement fields in app/api/quiz-generation/jobs/[jobId]/route.js"
Task: T011 "Create append endpoint in app/api/quiz-generation/jobs/[jobId]/append/route.js"

# Frontend trigger can run in parallel with backend tasks:
Task: T012 "Create mcq-complement-trigger.jsx"

# Draft view depends on trigger pattern:
Task: T013 "Create mcq-complement-draft.jsx"

# Tests can run in parallel after implementation:
Task: T014 "Integration test for MCQ complement flow"
Task: T015 "Per-role authorization integration tests"
```

---

## Parallel Example: User Stories 2 & 3 (after US1)

```bash
# US2 and US3 can proceed in parallel:

# Developer A — US2 (edit/delete/regenerate):
Task: T016 "MCQ inline editing in mcq-complement-draft.jsx"
Task: T017 "Delete/reject functionality in mcq-complement-draft.jsx"
Task: T018 "Regeneration routing in generation-orchestrator.js"
Task: T019 "Regeneration UI in mcq-complement-draft.jsx"

# Developer B — US3 (difficulty config):
Task: T020 "Difficulty distribution config in mcq-complement-trigger.jsx"
Task: T021 "Difficulty tag display/editing in mcq-complement-draft.jsx"
Task: T022 "Difficulty params in MCQ prompt"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T007) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T008–T015)
4. **STOP and VALIDATE**: Test User Story 1 independently — can an instructor generate and append MCQs?
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (edit/delete/regenerate)
4. Add User Story 3 → Test independently → Deploy/Demo (difficulty config)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - All developers: User Story 1 (core flow, everyone needs to understand it)
3. After US1 is complete and validated:
   - Developer A: User Story 2 (edit/delete/regenerate)
   - Developer B: User Story 3 (difficulty config)
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Zero new runtime dependencies — all new code extends existing spec 001 patterns
- The existing quiz-generator.js, docx-extractor.js, and spec 001 endpoints are reused as-is
- MCQ complement jobs share the daily generation quota with full quiz generation jobs
