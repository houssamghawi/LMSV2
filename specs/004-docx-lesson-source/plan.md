# Implementation Plan: Word File as Lesson Source

**Branch**: `004-docx-lesson-source` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-docx-lesson-source/spec.md`

## Summary

Replace the existing "Lesson Description" textarea-based content pipeline with a Word (.docx) file upload workflow. The uploaded file becomes the single source of truth for three downstream consumers: (1) the RAG/AI tutor embedding pipeline, (2) AI quiz question generation, and (3) a student-facing "Lecture" section that renders the document with formatting and images preserved. The existing description field is retained in the schema but disconnected from all pipelines; a temporary legacy code path keeps old description-based lessons functional until instructors migrate them individually.

## Technical Context

**Language/Version**: TypeScript/JavaScript (Node.js 18+), Next.js 15 App Router

**Primary Dependencies**:
- `mammoth` (existing, v1.12+) — DOCX-to-HTML conversion (currently used for plain text only; will use `convertToHtml` for formatted extraction)
- `mongoose` (existing) — MongoDB ODM for lesson file metadata
- `zod` (existing) — Input validation at API boundaries
- `@google/genai` (existing) — Gemini embeddings for RAG pipeline
- `chromadb` (existing) — Vector store for semantic retrieval
- `react-dropzone` (existing) — File upload UI (used by `UploadDropzone` component)

**Storage**:
- MongoDB (existing) — Lesson model extension, extracted content persistence
- ChromaDB (existing) — LectureChunk embeddings (unchanged architecture)
- Local filesystem (existing pattern) — Uploaded .docx files stored under `uploads/lessons/`

**Testing**: Vitest (existing) with mongodb-memory-server for integration tests

**Target Platform**: Web (Next.js server + client)

**Project Type**: Web service feature (modification of existing LMS content pipeline)

**Performance Goals**:
- File upload + processing to "ready" status ≤ 30 seconds for 50-page documents (spec SC-001)
- Constitution: read endpoints ≤ 300ms, write endpoints ≤ 600ms
- Upload endpoint returns within 600ms; extraction/embedding runs asynchronously

**Constraints**:
- 100% of AI tutor responses sourced from uploaded file (spec SC-002)
- OOXML/MIME validation + macro stripping on upload (spec FR-011, clarification Q5)
- Legacy description path retained temporarily (clarification Q1)
- `description` field kept in schema, not removed (clarification Q3)
- Max file size: 25 MB (assumption, aligns with industry standard)

**Scale/Scope**:
- Per-lesson file association (1:1)
- Supports Arabic and English content with RTL preservation
- Instructor-initiated migration (no bulk migration)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Code Quality & Maintainability** | ✅ PASS | Extraction logic in `service/`, upload route in `app/api/`, model in `model/`. Zod schemas at all boundaries. Reuses existing patterns (video upload route, docx-extractor). |
| **II. Testing Standards** | ✅ PASS | Integration tests for upload API route with real MongoDB. Authorization tests for instructor-only upload, student-only view. Legacy path tested alongside new path. |
| **III. User Experience Consistency** | ✅ PASS | Upload UI mirrors existing `VideoUploadField` pattern. All strings via i18n. Uses shared `Toast`, `Skeleton`, embedding status components. Accessible file input with keyboard support. |
| **IV. Performance Requirements** | ✅ PASS | Upload returns within 600ms write budget. Extraction + embedding runs async (background). Extracted HTML served as pre-rendered content (read ≤ 300ms). Images served via optimized loader. |
| **Tech Stack Lock** | ✅ PASS | No new runtime dependencies. `mammoth` already in `package.json`. File storage uses existing local filesystem pattern. |

**Post-Phase-1 Re-check**: All gates remain satisfied. Design uses `mammoth.convertToHtml` (existing dep) for HTML extraction + `mammoth.extractRawText` (existing) for plain text. File storage follows `uploads/videos/` local pattern. DOCX validation uses Node.js built-in `zlib` or lightweight ZIP library. No new runtime dependencies added. DOMPurify for HTML sanitization is a minimal, standard security library (same category as Zod for input validation — not a new "layer" per constitution). |

## Project Structure

### Documentation (this feature)

```text
specs/004-docx-lesson-source/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── lesson-file-api.md
└── tasks.md             # Phase 2 output (created by /speckit-tasks)
```

### Source Code (repository root)

```text
model/
├── lesson.model.js              # MODIFY: Add docx file fields (filename, url, size, extractedHtml, extractedText)
└── lecture-chunk-model.js       # UNCHANGED: Chunks now originate from file extraction

service/
├── docx-extractor.js            # MODIFY: Add convertToHtml extraction + image extraction alongside existing extractRawText
├── lecture-embedder.js           # MODIFY: extractLessonContent reads from extractedText field (file-sourced) instead of description; legacy fallback
├── docx-validator.js             # NEW: MIME validation, OOXML structure check, macro stripping
└── vector-store.js               # UNCHANGED

lib/
├── validations.js                # MODIFY: Update lessonSchema—remove description requirement, add docx file validation
└── constants.js                  # MODIFY: Add DOCX upload constants (max size, allowed MIME, upload dir)

app/
├── api/
│   └── upload/
│       └── lesson-docx/
│           └── route.js          # NEW: POST/DELETE for lesson .docx upload
└── [locale]/
    ├── dashboard/
    │   └── courses/
    │       └── [courseId]/
    │           └── modules/
    │               └── [moduleId]/
    │                   └── _components/
    │                       ├── lesson-description-form.jsx    # DELETE: Remove entirely
    │                       ├── lesson-docx-upload.jsx         # NEW: File upload component replacing description form
    │                       ├── lesson-modal.jsx               # MODIFY: Swap description form for docx upload
    │                       └── lesson-embedding-status.jsx    # MODIFY: Add retry button on failed status
    └── (main)/
        └── courses/
            └── [id]/
                └── lesson/
                    └── _components/
                        └── video-description.jsx     # MODIFY: Rename to lecture-content.jsx, render extractedHtml under "Lecture" heading

components/
└── ui/
    └── file-upload.jsx           # UNCHANGED (may be referenced but not modified)

messages/
├── en.json                       # MODIFY: Add lesson file upload strings, rename "Description" → "Lecture"
└── ar.json                       # MODIFY: Add lesson file upload strings, rename "Description" → "Lecture"

app/
└── actions/
    └── lesson.js                 # MODIFY: Update updateLesson to trigger embedding from file content, add retry action

tests/
├── integration/
│   ├── lesson-docx-upload.test.js       # NEW: Upload API tests (auth, validation, storage, replace, delete)
│   └── lecture-embedder-file.test.js    # NEW: Embedding from file-extracted content
└── unit/
    ├── docx-validator.test.js           # NEW: MIME, OOXML, macro stripping tests
    └── docx-extractor-html.test.js      # NEW: HTML + image extraction tests
```

**Structure Decision**: Feature integrates into the existing LMS structure following established patterns. Modifies existing services and models rather than creating parallel infrastructure. Upload route follows the `app/api/upload/video/route.js` pattern. UI follows the `VideoUploadField` component pattern.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Dual content pipeline (legacy description + new file) | Clarification Q1: instructors migrate individually, no bulk migration | Hard cutover would break all existing lessons; bulk migration risky for production data |
| HTML extraction + image handling | Clarification Q2: images must be displayed in "Lecture" section | Plain text extraction (current `extractRawText`) loses all formatting and images, degrading student experience |
