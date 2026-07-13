# Tasks: Word File as Lesson Source

**Input**: Design documents from `specs/004-docx-lesson-source/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/lesson-file-api.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend constants, model schema, and validations to support .docx file uploads

- [X] T001 Add DOCX upload constants to lib/constants.js: MAX_LESSON_DOCX_SIZE (25 MB), LESSON_UPLOAD_DIR ("uploads/lessons"), LESSON_IMAGES_DIR ("uploads/lesson-images"), DOCX_ALLOWED_TAGS (whitelist for HTML sanitization)
- [X] T002 Extend Lesson schema in model/lesson.model.js with six new fields: docxFilename (String, default null), docxOriginalName (String, default null), docxSize (Number, default null), docxUploadedAt (Date, default null), extractedHtml (String, default null), extractedText (String, default null) — per data-model.md
- [X] T003 Update lesson validation in lib/validations.js: relax description requirement (no longer required for lesson updates), add lessonDocxUploadSchema with lessonId ObjectId validation — per data-model.md validation rules

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core services that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Create DOCX validator service in service/docx-validator.js: implement validateDocxBuffer(buffer) with 3-layer validation — (1) OOXML structure check via ZIP entry inspection for [Content_Types].xml and word/document.xml, (2) macro detection and stripping of word/vbaProject.bin and word/vbaData.xml entries, (3) return sanitized buffer — per research.md §3
- [X] T005 [P] Extend DOCX extractor service in service/docx-extractor.js: add extractDocxHtml(buffer, lessonId) function using mammoth.convertToHtml with custom image handler that saves images to uploads/lesson-images/{lessonId}/ and returns URL paths /api/lesson-images/{lessonId}/{uuid}.{ext} — per research.md §1 and §2. Keep existing extractDocxText function unchanged.
- [X] T006 [P] Create upload directory initialization: ensure uploads/lessons/ and uploads/lesson-images/ directories are created on server start or first upload — follow the pattern used by uploads/videos/ in app/api/upload/video/route.js

**Checkpoint**: Foundation ready — DOCX validation, HTML+image extraction, and file storage directories are operational

---

## Phase 3: User Story 1 — Instructor Uploads Word File (Priority: P1) MVP

**Goal**: Instructors can upload a .docx file in lesson settings, replacing the description textarea. Files are validated, stored, extracted (HTML + plain text), and processing status is displayed.

**Independent Test**: Upload a .docx file in lesson settings → file is stored → filename and status displayed → old description textarea is absent

### Implementation for User Story 1

- [X] T007 [US1] Create upload API route in app/api/upload/lesson-docx/route.js: implement POST handler — parse multipart FormData (file + lessonId), validate auth (instructor/admin), validate MIME type against DOCX_MIME_TYPE, check file size against MAX_LESSON_DOCX_SIZE, call validateDocxBuffer, call extractDocxText for plain text, call extractDocxHtml for HTML+images, save .docx to uploads/lessons/{lessonId}.docx, update Lesson document with all six new fields, trigger syncLessonEmbeddings, return success response — per contracts/lesson-file-api.md §1
- [X] T008 [US1] Add DELETE handler to app/api/upload/lesson-docx/route.js: parse lessonId from query params, validate auth, delete .docx file from uploads/lessons/, delete lesson-images/{lessonId}/ directory, clear all six docx fields and extractedHtml/extractedText on Lesson document, call removeLessonEmbeddings, set tutorEmbeddingStatus to "none" — per contracts/lesson-file-api.md §2
- [X] T009 [US1] Create retry API route in app/api/upload/lesson-docx/retry/route.js: POST handler that validates auth, checks tutorEmbeddingStatus is "failed", re-reads stored .docx from disk, re-extracts and re-triggers syncLessonEmbeddings — per contracts/lesson-file-api.md §3
- [X] T010 [US1] Create image serving route in app/api/lesson-images/[lessonId]/[filename]/route.js: GET handler that validates auth (enrolled student, instructor, or admin), reads image file from uploads/lesson-images/{lessonId}/{filename}, returns binary with correct Content-Type and Cache-Control headers — per contracts/lesson-file-api.md §4
- [X] T011 [US1] Create lesson DOCX upload component in app/[locale]/dashboard/courses/[courseId]/modules/[moduleId]/_components/lesson-docx-upload.jsx: file input accepting .docx only (accept attribute), client-side size validation, XHR upload with progress tracking, display uploaded filename + size + status, delete button, retry button on failed status — mirror VideoUploadField pattern from video-upload-field.jsx. All strings via i18n.
- [X] T012 [US1] Modify lesson-modal.jsx in app/[locale]/dashboard/courses/[courseId]/modules/[moduleId]/_components/lesson-modal.jsx: replace LessonDescriptionForm import/usage with LessonDocxUpload component. Remove description form from the left column layout and add the file upload component in its place.
- [X] T013 [US1] Modify lesson-embedding-status.jsx in app/[locale]/dashboard/courses/[courseId]/modules/[moduleId]/_components/lesson-embedding-status.jsx: add a "Retry" button that appears when tutorEmbeddingStatus is "failed", calls retryLessonEmbeddingAction server action — per spec FR-012
- [X] T014 [US1] Add retryLessonEmbeddingAction server action in app/actions/lesson.js: validate instructor auth, verify lesson has uploaded file, verify status is "failed", re-read .docx from disk, re-extract, call syncLessonEmbeddings
- [X] T015 [US1] Delete lesson-description-form.jsx from app/[locale]/dashboard/courses/[courseId]/modules/[moduleId]/_components/lesson-description-form.jsx — per spec FR-007 and US5

**Checkpoint**: Instructor can upload a .docx file, see processing status, retry on failure, replace, and delete. No description textarea is visible. This is the MVP.

---

## Phase 4: User Story 2 — Uploaded File Feeds RAG/AI Tutor (Priority: P1)

**Goal**: The RAG embedding pipeline reads from the uploaded file's extracted text instead of the description field. Legacy lessons without uploaded files continue to use their description-based embeddings.

**Independent Test**: Upload a .docx file → embeddings created from file content → ask AI tutor a question → get cited answer from file content (not description)

### Implementation for User Story 2

- [X] T016 [US2] Modify extractLessonContent in service/lecture-embedder.js: change content source resolution — (1) if lesson.extractedText is non-empty, use it, (2) else if lesson.description is non-empty, use it (legacy fallback), (3) else return empty. Remove the direct description-only reading. — per research.md §6
- [X] T017 [US2] Modify syncLessonEmbeddings in service/lecture-embedder.js: update the content hash computation to use extractedText when available (instead of always using description). The rest of the pipeline (chunking, embedding, ChromaDB upsert) stays unchanged.
- [X] T018 [US2] Modify updateLesson action in app/actions/lesson.js: when a .docx file has been uploaded (docxFilename is set), do NOT trigger syncLessonEmbeddings from description changes — embedding is triggered by the upload route only. When no .docx file exists (legacy path), retain existing description-triggered embedding behavior.
- [X] T019 [US2] Update deleteLesson action in app/actions/lesson.js: on lesson deletion, cascade cleanup — delete uploads/lessons/{lessonId}.docx if it exists, delete uploads/lesson-images/{lessonId}/ directory if it exists, call removeLessonEmbeddings (already exists)

**Checkpoint**: AI tutor answers from uploaded file content. Legacy lessons with description-based embeddings still work. File replacement triggers re-embedding.

---

## Phase 5: User Story 3 — Student Views "Lecture" Section (Priority: P1)

**Goal**: Students see the uploaded document's formatted content below the lesson video in a section labeled "Lecture" (replacing the old "Description" section), with headings, lists, tables, images faithfully rendered.

**Independent Test**: Upload a .docx file with formatted content → navigate to lesson page as student → see "Lecture" section with preserved formatting and images

### Implementation for User Story 3

- [X] T020 [US3] Rename and refactor video-description.jsx to lecture-content.jsx in app/[locale]/(main)/courses/[id]/lesson/_components/: change the component to render lesson.extractedHtml (sanitized with DOMPurify or equivalent tag whitelist) under a "Lecture" heading. If extractedHtml is null, fall back to lesson.description (legacy). If both are null, show empty state message. All strings via i18n.
- [X] T021 [US3] Update the lesson page in app/[locale]/(main)/courses/[id]/lesson/page.jsx: import LectureContent (renamed from VideoDescription), pass lesson data including extractedHtml. Update the tab/section label from "Description" to "Lecture" via i18n key.
- [X] T022 [US3] Install and configure DOMPurify (isomorphic-dompurify for SSR compatibility) for HTML sanitization: create a utility in lib/sanitize-html.js that whitelists only mammoth-produced tags (h1-h6, p, ul, ol, li, table, tr, td, th, thead, tbody, strong, em, img, a, br, sup, sub) and allowed attributes (src, href, alt, class, dir). Use this in lecture-content.jsx.
- [X] T023 [US3] Style the Lecture content section: add Tailwind prose classes (or equivalent typography styles) to the rendered HTML container for consistent heading sizes, list indentation, table borders, image max-width, and RTL support — per constitution Principle III

**Checkpoint**: Students see formatted lecture content under "Lecture" label. Images render inline. Legacy lessons show description content. Empty lessons show appropriate message.

---

## Phase 6: User Story 5 — Existing Description System Fully Removed (Priority: P1)

**Goal**: Verify all traces of the old "Lesson Description" workflow are removed from the user-facing surfaces and the content pipeline.

**Independent Test**: Confirm no description textarea in lesson settings, no "Description" label on student page, embedding pipeline reads from file only (with legacy fallback for old lessons)

### Implementation for User Story 5

- [X] T024 [US5] Verify and clean up lesson-modal.jsx: ensure no remaining imports or references to LessonDescriptionForm or description-related form logic. Remove any conditional rendering that would show a description textarea.
- [X] T025 [US5] Verify lecture-content.jsx (formerly video-description.jsx): ensure the "Description" heading/tab label is fully replaced with "Lecture" in all i18n keys and component markup. Remove any references to the old "Description" naming.
- [X] T026 [US5] Verify extractLessonContent in service/lecture-embedder.js: ensure the new path (extractedText first, description fallback) is correct and that no code path writes to or reads from description for new uploads.
- [X] T027 [US5] Verify lesson page data fetching in queries/lessons.js or equivalent: ensure lesson queries include the new fields (extractedHtml, extractedText, docxFilename, docxOriginalName) in their projections for the student lesson page and the instructor modal.

**Checkpoint**: US5 acceptance scenarios pass — no description textarea, no "Description" display, embedding pipeline uses file content exclusively for new uploads.

---

## Phase 7: User Story 4 — Quiz Generation from Uploaded File (Priority: P2)

**Goal**: Quiz generation uses the lesson's stored extracted text when available, eliminating the need for instructors to re-upload a .docx file for question generation.

**Independent Test**: Upload a .docx file for a lesson → trigger quiz generation for that lesson → questions are generated from the uploaded content without a separate file upload

### Implementation for User Story 4

- [X] T028 [US4] Modify quiz generation job route in app/api/quiz-generation/jobs/route.js: when lessonId is provided and the lesson has extractedText, use it as the source text (skip the multipart file requirement). If lessonId has no extractedText and no file is uploaded in the request, return error "Lecture content must be uploaded first." Retain the existing multipart upload path for standalone (non-lesson) quiz generation.
- [X] T029 [US4] Modify quiz generation orchestrator in service/generation-orchestrator.js (or equivalent): accept extractedText as an input source alongside the existing buffer-based extraction. Skip the in-memory extractedTextStore when reading from lesson's stored text.
- [X] T030 [US4] Update quiz generator UI component: when a lessonId is selected and the lesson has an uploaded .docx file, show a "Generate from uploaded lecture" option instead of requiring a separate file upload. Disable generation if lesson has no uploaded content.

**Checkpoint**: Quiz generation works from uploaded lesson content. Standalone .docx upload for quiz gen still works for non-lesson contexts.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: i18n, cleanup, and final validation across all user stories

- [X] T031 [P] Update i18n strings in messages/en.json: add keys for file upload labels, status messages, "Lecture" heading, retry button, error messages, empty state message. Remove or deprecate "Lesson Description" / "chapterDescription" keys.
- [X] T032 [P] Update i18n strings in messages/ar.json: Arabic translations for all new keys added in T031. Ensure RTL-appropriate wording.
- [X] T033 Update next.config.mjs: ensure experimental.serverActions.bodySizeLimit is set to at least "25mb" to support the max .docx upload size
- [X] T034 Update .env.example: document any new environment variables if needed (none expected — uses existing CHROMA_URL, GEMINI_API_KEY)
- [X] T035 Run quickstart.md validation scenarios 1–9 end-to-end and verify all pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (constants, model) — BLOCKS all user stories
- **US1 Upload (Phase 3)**: Depends on Phase 2 (validator, extractor, directories)
- **US2 RAG Pipeline (Phase 4)**: Depends on Phase 2 (extractor changes) — can run in parallel with US1 at service layer, but integration depends on US1 upload route
- **US3 Lecture Display (Phase 5)**: Depends on Phase 1 (model fields) — can start in parallel with US1 at component layer
- **US5 Remove Old System (Phase 6)**: Depends on US1, US2, US3 — verification phase
- **US4 Quiz Generation (Phase 7)**: Depends on Phase 1 (model fields) — independent of US1/US2/US3
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only — no cross-story dependencies. **This is the MVP.**
- **US2 (P1)**: Depends on Foundational; integrates with US1's upload route but service-layer work is independent
- **US3 (P1)**: Depends on Phase 1 only; can start in parallel with US1
- **US5 (P1)**: Verification of US1 + US2 + US3 outcomes — must come after all three
- **US4 (P2)**: Depends on Phase 1 only; fully independent of US1/US2/US3

### Within Each User Story

- Models/constants before services
- Services before API routes
- API routes before UI components
- Core implementation before integration points

### Parallel Opportunities

- T004, T005, T006 in Phase 2 (different files, no dependencies)
- T031, T032 in Phase 8 (different files)
- US3 component work (T020–T023) can start in parallel with US1 API work (T007–T010) — different file trees
- US4 (Phase 7) can start in parallel with US3 (Phase 5) — fully independent

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Launch all foundational tasks together (different files):
Task T004: "Create DOCX validator service in service/docx-validator.js"
Task T005: "Extend DOCX extractor service in service/docx-extractor.js"
Task T006: "Create upload directory initialization"
```

## Parallel Example: US1 + US3 (Across Stories)

```bash
# Backend (US1) and Frontend display (US3) can proceed simultaneously:
# Developer A — US1 backend:
Task T007: "Create upload API route in app/api/upload/lesson-docx/route.js"
Task T010: "Create image serving route in app/api/lesson-images/"

# Developer B — US3 frontend:
Task T020: "Rename video-description.jsx to lecture-content.jsx"
Task T022: "Install and configure DOMPurify for HTML sanitization"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T006)
3. Complete Phase 3: User Story 1 (T007–T015)
4. **STOP and VALIDATE**: Upload a .docx → file stored → extraction works → status shows ready → description textarea gone
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Upload) → Test independently → **MVP!**
3. Add US2 (RAG Pipeline) → Test AI tutor answers from file → Deploy
4. Add US3 (Lecture Display) → Test student sees formatted content → Deploy
5. Verify US5 (Old System Removed) → Acceptance check
6. Add US4 (Quiz Gen) → Test quiz from uploaded content → Deploy
7. Polish → i18n, validation, cleanup → Final release

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US5 (Remove Old System) is primarily a verification phase — its implementation is distributed across US1 (remove textarea), US2 (disconnect description pipeline), and US3 (rename "Description" to "Lecture")
- Legacy description fallback is retained per clarification Q1 — old lessons keep working
- No new Mongoose models — all changes are fields on existing Lesson schema
- No migration script needed — all new fields default to null (non-breaking additive change)
