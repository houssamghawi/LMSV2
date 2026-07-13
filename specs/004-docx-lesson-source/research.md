# Research: Word File as Lesson Source

**Feature**: 004-docx-lesson-source
**Date**: 2026-07-12
**Status**: Complete

## Overview

This document resolves all technical unknowns from the plan's Technical Context. Each section records the decision, rationale, and alternatives considered.

---

## 1. DOCX-to-HTML Conversion (Formatted Extraction)

**Decision**: Use `mammoth.convertToHtml()` from the existing `mammoth` dependency (v1.12+) for formatted HTML extraction. Continue using `mammoth.extractRawText()` for plain text extraction (RAG pipeline + quiz generation).

**Rationale**: mammoth is already installed and used for plain text extraction in `service/docx-extractor.js`. The `convertToHtml` API produces semantic HTML (headings as `<h1>`–`<h6>`, lists as `<ul>`/`<ol>`, tables as `<table>`, bold as `<strong>`, italic as `<em>`) from the OOXML document model. This eliminates the need for a new dependency.

**Alternatives considered**:
- `docx` (npm) — Lower-level XML manipulation; requires manually building HTML from parsed tree. More effort, no formatting advantage.
- `libreoffice-convert` — Spawns LibreOffice headless for conversion. Heavy dependency, slow, requires system install. Overkill for text-and-image documents.
- `pdf2html` / multi-format converters — Out of scope; the spec requires .docx only.

**Key API details**:
- `mammoth.convertToHtml({ buffer })` → `{ value: htmlString, messages: warnings[] }`
- Default image handling: images embedded as base64 data URIs in `<img>` tags
- Custom image handler via `mammoth.images.imgElement(fn)` for saving to disk

---

## 2. Image Extraction and Storage Strategy

**Decision**: Extract images from .docx during conversion and save them as individual files under `uploads/lesson-images/{lessonId}/`. Reference them in the HTML via a serving route `/api/lesson-images/{lessonId}/{filename}`. This replaces the default base64 data URI approach.

**Rationale**: Base64 data URIs bloat the stored HTML (33% overhead) and defeat browser caching. Lecture documents with many diagrams could produce megabytes of inline data. Saving images as files follows the existing `uploads/videos/` pattern and allows the constitution's `next/image` or optimized loader requirements to be met.

**Implementation approach**:
```javascript
mammoth.convertToHtml({ buffer }, {
  convertImage: mammoth.images.imgElement(async (image) => {
    const buf = await image.readAsBuffer();
    const ext = image.contentType.split("/")[1] || "png";
    const filename = `${crypto.randomUUID()}.${ext}`;
    await writeFile(join(uploadDir, filename), buf);
    return { src: `/api/lesson-images/${lessonId}/${filename}` };
  })
});
```

**Alternatives considered**:
- Base64 inline (default mammoth behavior) — Simpler but bloats HTML, breaks caching, violates constitution's asset hygiene rule.
- Cloud storage (S3/GCS) — No cloud storage in the current stack; local filesystem is the established pattern.

---

## 3. DOCX File Validation and Security

**Decision**: Implement a three-layer validation pipeline in a new `service/docx-validator.js`:

1. **MIME type check**: Verify `Content-Type` is `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (already defined as `DOCX_MIME_TYPE` in `lib/constants.js`).
2. **OOXML structure check**: Attempt to read the buffer as a ZIP archive and verify `[Content_Types].xml` and `word/document.xml` exist — these are mandatory for a valid .docx.
3. **Macro stripping**: Check for `word/vbaProject.bin` or `word/vbaData.xml` entries in the ZIP. If found, strip them before passing to mammoth. True `.docx` files should not contain VBA macros (that's `.docm`), but malicious files may include them.

**Rationale**: Extension-only validation is trivially bypassable. The OOXML structure check confirms the file is a real Word document, not a renamed archive or executable. Macro stripping addresses the spec's security requirement (clarification Q5).

**Alternatives considered**:
- External antivirus scanning — Not available in the current infrastructure; would add latency and a new dependency.
- Reject any file with macros entirely — Chosen against because some legitimate .docx files may have harmless embedded metadata; stripping is safer than rejection.

**Library**: Node.js built-in `node:zlib` or lightweight `adm-zip` (already available as a transitive dependency of mammoth which reads ZIP internally). If not available, use `jszip` — a zero-dependency ZIP library.

---

## 4. File Storage and Serving Pattern

**Decision**: Store uploaded .docx files under `uploads/lessons/{lessonId}.docx` on the local filesystem. Serve via a new API route with RBAC (instructor or enrolled student can access).

**Rationale**: Mirrors the existing `uploads/videos/` pattern used by video upload. One file per lesson (1:1 association) simplifies naming and replacement — overwriting the file on re-upload.

**Storage layout**:
```
uploads/
├── videos/          # Existing video uploads
├── lessons/         # NEW: .docx files
│   └── {lessonId}.docx
└── lesson-images/   # NEW: Extracted images
    └── {lessonId}/
        ├── {uuid}.png
        ├── {uuid}.jpg
        └── ...
```

**Cleanup on delete/replace**: When an instructor deletes or replaces a file, the old .docx and its entire `lesson-images/{lessonId}/` directory are removed.

**Alternatives considered**:
- Storing the file in MongoDB GridFS — Adds complexity; local filesystem is simpler and already the pattern.
- Storing only extracted content (not the original file) — Loses the ability to re-extract or re-process; keeping the original .docx is safer.

---

## 5. Dual Extraction Pipeline

**Decision**: On file upload, run two extractions from the same buffer:

1. **HTML extraction** (`mammoth.convertToHtml`) → Store as `extractedHtml` on the Lesson document. Used for student-facing "Lecture" rendering.
2. **Plain text extraction** (`mammoth.extractRawText` → `normalizeText`) → Store as `extractedText` on the Lesson document. Fed into the RAG chunking/embedding pipeline and quiz generation.

**Rationale**: The RAG pipeline needs clean plain text for accurate embedding and chunking (HTML tags would pollute semantic search). The student display needs formatted HTML. The two outputs serve different consumers and must be stored separately.

**Flow**:
```
Upload .docx → validate → save file to disk
  ├─→ convertToHtml (with image extraction) → store extractedHtml on Lesson
  ├─→ extractRawText → normalizeText → store extractedText on Lesson
  └─→ syncLessonEmbeddings(extractedText) → chunk → embed → ChromaDB
```

---

## 6. Legacy Description Fallback Path

**Decision**: The `extractLessonContent()` function in `service/lecture-embedder.js` is modified to check for file-based content first, then fall back to description:

```
if lesson.extractedText exists and is non-empty → use extractedText
else if lesson.description exists and is non-empty → use description (legacy)
else → return empty (no content available)
```

**Rationale**: Clarification Q1 requires that old lessons keep working without migration. This conditional check is the minimal change to support both pipelines. The legacy branch is removed in a future release.

**Impact on existing code**: Only `extractLessonContent()` changes — the rest of the embedding pipeline (chunking, embedding, ChromaDB upsert) is unchanged.

---

## 7. Quiz Generation Integration

**Decision**: Modify quiz generation to optionally read from the lesson's stored `extractedText` when a `lessonId` is provided, falling back to the existing multipart .docx upload if no stored text is available.

**Rationale**: Currently, quiz generation requires the instructor to upload a separate .docx file every time (the file is not persisted). With lesson file uploads, the text is already extracted and stored. This eliminates redundant uploads and provides a better UX.

**Backward compatibility**: The existing multipart upload path remains available for instructors who want to generate quizzes from standalone documents not associated with a lesson.

---

## 8. Student-Facing "Lecture" Rendering

**Decision**: Render the `extractedHtml` from the Lesson document using `dangerouslySetInnerHTML` with sanitization via a whitelist approach. The existing `video-description.jsx` component is renamed to `lecture-content.jsx` and refactored.

**Rationale**: mammoth produces semantic HTML with a limited set of tags (`h1`–`h6`, `p`, `ul`, `ol`, `li`, `table`, `tr`, `td`, `th`, `strong`, `em`, `img`, `a`, `br`). This is safe to render with sanitization that allows only these tags and strips any others.

**Sanitization**: Use `DOMPurify` (or equivalent) to whitelist allowed tags and attributes before rendering. This prevents XSS even if mammoth output includes unexpected content.

**RTL support**: The Lecture section inherits the page's `dir` attribute. Arabic content in the .docx renders correctly because mammoth preserves the text content and the LMS already handles RTL at the layout level.

**Alternatives considered**:
- Render as Markdown — Would lose table structure and image positioning.
- Render in an iframe — Isolation adds complexity and breaks responsive layout.
- Use a custom React component tree — Over-engineered for semantic HTML rendering.

---

## 9. Upload Size Limit

**Decision**: 25 MB maximum file size for .docx uploads.

**Rationale**: Typical lecture documents with text, images, and diagrams range from 1–15 MB. 25 MB provides comfortable headroom while preventing abuse. This aligns with the spec's industry-standard assumption and is within Next.js body parser limits (configurable).

**Configuration**: Defined as `MAX_LESSON_DOCX_SIZE` in `lib/constants.js` (value: `25 * 1024 * 1024`).

---

## Summary of Resolved Unknowns

| Unknown | Resolution |
|---------|-----------|
| HTML extraction library | mammoth `convertToHtml` (existing dependency) |
| Image extraction approach | Save to `uploads/lesson-images/{lessonId}/`, serve via API route |
| File validation/security | 3-layer: MIME check → OOXML structure → macro strip |
| File storage location | `uploads/lessons/{lessonId}.docx` (local filesystem) |
| Dual extraction strategy | HTML for display, plain text for RAG/quiz |
| Legacy fallback | Conditional check in `extractLessonContent()` |
| Quiz generation change | Optionally read stored `extractedText` by `lessonId` |
| Student rendering | Sanitized `dangerouslySetInnerHTML` from `extractedHtml` |
| Max file size | 25 MB |
