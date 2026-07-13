# Data Model: Word File as Lesson Source

**Feature**: 004-docx-lesson-source
**Date**: 2026-07-12
**Status**: Complete

## Overview

This document defines the data model changes for replacing the lesson description pipeline with a .docx file upload system. The primary change is extending the existing Lesson model with file-related fields. No new Mongoose models are created — the LessonFile entity from the spec is implemented as embedded fields on the Lesson document.

---

## Entity Relationship Diagram

```
┌─────────────────┐     ┌──────────────────────────┐     ┌─────────────────┐
│     Course      │     │        Lesson             │     │      User       │
│   (existing)    │     │   (MODIFIED)              │     │   (existing)    │
└────────┬────────┘     │                          │     └────────┬────────┘
         │              │  title                   │              │
         │ 1:N          │  description (deprecated)│              │
         │              │  + docxFilename    [NEW]  │              │
         ▼              │  + docxOriginalName[NEW]  │              │
┌─────────────────┐     │  + docxSize        [NEW]  │     ┌─────────────────┐
│  TutorConfig    │     │  + docxUploadedAt  [NEW]  │     │TutorInteraction │
│  (existing)     │     │  + extractedHtml   [NEW]  │     │  (existing)     │
└─────────────────┘     │  + extractedText   [NEW]  │     └─────────────────┘
                        │  + tutorEmbedding* (exist)│
                        └────────────┬─────────────┘
                                     │
                                     │ 1:N
                                     ▼
                              ┌─────────────────┐
                              │  LectureChunk   │
                              │  (UNCHANGED)    │
                              └────────┬────────┘
                                       │ metadata ref
                                       ▼
                               ┌─────────────────┐
                               │   ChromaDB      │
                               │  (vector store) │
                               └─────────────────┘
```

---

## 1. Lesson (Modified)

The existing Lesson schema is extended with fields for the uploaded .docx file and its extracted content.

### New Fields

```javascript
// Added to model/lesson.model.js (existing schema)

// --- DOCX file metadata ---
docxFilename: {
  type: String,
  default: null
},

docxOriginalName: {
  type: String,
  default: null
},

docxSize: {
  type: Number,
  default: null
},

docxUploadedAt: {
  type: Date,
  default: null
},

// --- Extracted content (populated on upload) ---
extractedHtml: {
  type: String,
  default: null
},

extractedText: {
  type: String,
  default: null
},
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `docxFilename` | String | No | Server-side filename in `uploads/lessons/` (e.g., `{lessonId}.docx`) |
| `docxOriginalName` | String | No | Original filename as uploaded by instructor (e.g., `Lecture_3_Biology.docx`) |
| `docxSize` | Number | No | File size in bytes |
| `docxUploadedAt` | Date | No | Timestamp of most recent upload |
| `extractedHtml` | String | No | HTML produced by `mammoth.convertToHtml` with image URLs. Used for student-facing "Lecture" rendering. |
| `extractedText` | String | No | Normalized plain text produced by `mammoth.extractRawText`. Used for RAG embedding and quiz generation. |

### Existing Fields (Behavioral Change)

| Field | Change | Notes |
|-------|--------|-------|
| `description` | **Deprecated** — retained in schema, no longer written by new uploads | Old values preserved for reference. Not read by embedding pipeline when `extractedText` is present. Not displayed to students when `extractedHtml` is present. |
| `tutorEmbeddingStatus` | **Unchanged** — now tracks file-based embedding status | Same enum: `none`, `pending`, `ready`, `failed` |
| `tutorContentHash` | **Unchanged** — now computed from `extractedText` instead of `description` | SHA-256 of normalized extracted text |
| `tutorEmbeddedAt` | **Unchanged** | Timestamp of last successful embedding |
| `tutorEmbeddingError` | **Unchanged** | Error message on failure |

### Content Source Resolution (Priority Order)

The embedding pipeline and student display use this resolution:

```
1. lesson.extractedText / lesson.extractedHtml  → file-based content (new)
2. lesson.description                           → legacy content (fallback)
3. (empty)                                      → no content available
```

Once a .docx file is uploaded, the lesson uses file-based content exclusively. If the file is deleted, the lesson has no content (old description is NOT resurrected).

### Lifecycle

- **Upload**: `docxFilename`, `docxOriginalName`, `docxSize`, `docxUploadedAt`, `extractedHtml`, `extractedText` are set. `tutorEmbeddingStatus` → `pending`.
- **Replace**: Old file deleted from disk. Old `lesson-images/{lessonId}/` directory cleared. New values written. Old embeddings removed. New embedding starts.
- **Delete (file only)**: All docx fields set to `null`. `extractedHtml` and `extractedText` set to `null`. Embeddings removed. `tutorEmbeddingStatus` → `none`.
- **Delete (lesson)**: Cascade: file removed from disk, images directory removed, embeddings removed from ChromaDB and MongoDB.

---

## 2. LectureChunk (Unchanged)

No schema changes. Chunks now originate from `extractedText` (file-sourced) rather than `description`, but the chunk metadata schema is identical.

The `contentHash` field on each chunk continues to use SHA-256 of the chunk's text content. The change-detection logic in `syncLessonEmbeddings()` uses `lesson.tutorContentHash` (now computed from `extractedText`) to skip re-embedding when content hasn't changed.

---

## 3. File System Entities (Not in MongoDB)

### Uploaded .docx files

- **Path**: `uploads/lessons/{lessonId}.docx`
- **Lifecycle**: Created on upload, overwritten on replace, deleted on file removal or lesson deletion.
- **Access control**: Served via API route with RBAC (instructor of the course, enrolled student, or admin).

### Extracted images

- **Path**: `uploads/lesson-images/{lessonId}/{uuid}.{ext}`
- **Lifecycle**: Created during HTML extraction, entire directory cleared on file replace/delete.
- **Access control**: Served via API route; images are referenced in `extractedHtml` by URL.

---

## Validation Rules

### File Upload Validation

```javascript
import { z } from "zod";

export const lessonDocxUploadSchema = z.object({
  lessonId: z.string().regex(/^[a-f\d]{24}$/i)
});
```

Server-side validation (not Zod — binary validation):
- MIME type must be `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- File size must be ≤ 25 MB (`MAX_LESSON_DOCX_SIZE`)
- Buffer must pass OOXML structure check (`[Content_Types].xml` + `word/document.xml` present)
- Macros/ActiveX stripped if present
- Extracted text must be non-empty (image-only documents rejected)

### Updated Lesson Validation (for lessonSchema in lib/validations.js)

The `description` field validation is relaxed — no longer required for lesson updates. The presence of either `extractedText` or `description` is sufficient for content-dependent features (AI tutor, quiz generation).

---

## Migration Notes

### Schema Extension (Non-Breaking)

All new fields have `default: null`, making this a non-breaking additive change. No migration script is needed — existing documents will have `null` for all new fields, which is correct (they are legacy lessons using the description path).

### Index Considerations

No new indexes required on Lesson. The existing `lessonId` index on `LectureChunk` covers all chunk queries. File lookups use `_id` (the lessonId) which is already the primary key.

### Data Integrity

- The `description` field is NOT removed from the schema (clarification Q3).
- No existing data is modified or deleted by this change.
- Constitution compliance: no fields are altered or removed, so no migration script is mandated.
