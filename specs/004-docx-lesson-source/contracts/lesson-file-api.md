# API Contract: Lesson File Upload

**Feature**: 004-docx-lesson-source
**Date**: 2026-07-12
**Version**: 1.0.0

## Overview

This document defines the HTTP API contracts for uploading, replacing, deleting, and serving .docx lesson files and their extracted images. All endpoints require authentication via NextAuth session.

---

## Base URLs

```
/api/upload/lesson-docx      # Upload/delete operations
/api/lesson-images            # Image serving
```

---

## Authentication

All endpoints require a valid NextAuth session. Unauthenticated requests return:

```json
{
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED"
}
```

**Status**: `401 Unauthorized`

---

## Endpoints

### 1. Upload Lesson DOCX

Upload or replace a .docx file for a lesson.

**Endpoint**: `POST /api/upload/lesson-docx`

**Authorization**: User must be the instructor of the course containing the lesson, or an admin.

#### Request

**Headers**:
```
Content-Type: multipart/form-data
```

**Body** (FormData):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | The .docx file (max 25 MB) |
| `lessonId` | String | Yes | MongoDB ObjectId of the target lesson |

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "lessonId": "665a1b2c3d4e5f6789012345",
    "filename": "665a1b2c3d4e5f6789012345.docx",
    "originalName": "Lecture_3_Cell_Biology.docx",
    "size": 2457600,
    "extractedTextLength": 15420,
    "imageCount": 4,
    "embeddingStatus": "pending",
    "warnings": ["Footnote 3 was skipped"]
  }
}
```

#### Error Responses

**400 Bad Request** — Invalid file:
```json
{
  "success": false,
  "error": "Invalid file type. Only .docx files are accepted.",
  "code": "INVALID_FILE_TYPE"
}
```

**400 Bad Request** — File too large:
```json
{
  "success": false,
  "error": "File exceeds maximum size of 25 MB.",
  "code": "FILE_TOO_LARGE"
}
```

**400 Bad Request** — No extractable text:
```json
{
  "success": false,
  "error": "No text content could be extracted from the file. The document may contain only images or be empty.",
  "code": "NO_EXTRACTABLE_TEXT"
}
```

**400 Bad Request** — Corrupt file:
```json
{
  "success": false,
  "error": "The file could not be processed. It may be corrupt or password-protected.",
  "code": "DOCX_PARSE_FAILED"
}
```

**400 Bad Request** — Invalid OOXML structure:
```json
{
  "success": false,
  "error": "The file is not a valid Word document.",
  "code": "INVALID_OOXML"
}
```

**403 Forbidden** — Not authorized:
```json
{
  "success": false,
  "error": "You do not have permission to modify this lesson.",
  "code": "FORBIDDEN"
}
```

**404 Not Found** — Lesson not found:
```json
{
  "success": false,
  "error": "Lesson not found.",
  "code": "LESSON_NOT_FOUND"
}
```

---

### 2. Delete Lesson DOCX

Remove the uploaded .docx file from a lesson without replacing it.

**Endpoint**: `DELETE /api/upload/lesson-docx`

**Authorization**: User must be the instructor of the course containing the lesson, or an admin.

#### Request

**Query Parameters**:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `lessonId` | String | Yes | MongoDB ObjectId of the target lesson |

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "lessonId": "665a1b2c3d4e5f6789012345",
    "embeddingStatus": "none"
  }
}
```

#### Error Responses

**404 Not Found** — No file uploaded:
```json
{
  "success": false,
  "error": "No file uploaded for this lesson.",
  "code": "NO_FILE_UPLOADED"
}
```

**403 Forbidden** / **404 Not Found** — Same as upload endpoint.

---

### 3. Retry Embedding

Re-attempt extraction and embedding for an already-uploaded file that failed.

**Endpoint**: `POST /api/upload/lesson-docx/retry`

**Authorization**: User must be the instructor of the course containing the lesson, or an admin.

#### Request

```json
{
  "lessonId": "665a1b2c3d4e5f6789012345"
}
```

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "lessonId": "665a1b2c3d4e5f6789012345",
    "embeddingStatus": "pending"
  }
}
```

#### Error Responses

**400 Bad Request** — No file to retry:
```json
{
  "success": false,
  "error": "No uploaded file found for this lesson. Upload a file first.",
  "code": "NO_FILE_UPLOADED"
}
```

**409 Conflict** — Not in failed state:
```json
{
  "success": false,
  "error": "Embedding is not in a failed state. Current status: ready.",
  "code": "NOT_FAILED"
}
```

---

### 4. Serve Lesson Image

Serve an extracted image from a lesson's .docx file.

**Endpoint**: `GET /api/lesson-images/{lessonId}/{filename}`

**Authorization**: User must be enrolled in the course (student), the course instructor, or an admin.

#### Success Response (200)

Binary image data with appropriate `Content-Type` header (`image/png`, `image/jpeg`, etc.).

**Headers**:
```
Content-Type: image/png
Cache-Control: public, max-age=31536000, immutable
```

#### Error Responses

**404 Not Found** — Image not found:
```json
{
  "success": false,
  "error": "Image not found.",
  "code": "IMAGE_NOT_FOUND"
}
```

**403 Forbidden** — Not authorized to view this lesson's content.

---

## Server Actions (Non-API)

The following server actions are modified (not new API routes):

### `updateLesson` (modified)

- No longer triggers embedding from `description` field when a .docx file is uploaded.
- Embedding is triggered by the upload route instead.

### `getLessonEmbeddingStatusAction` (unchanged)

- Returns the same shape; now reflects file-based embedding progress.

### `retryLessonEmbeddingAction` (new)

- Server action wrapper for the retry endpoint; called by the UI retry button.

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/upload/lesson-docx` | 10 requests | per minute per user |
| `DELETE /api/upload/lesson-docx` | 10 requests | per minute per user |
| `POST /api/upload/lesson-docx/retry` | 5 requests | per minute per user |
| `GET /api/lesson-images/*` | No limit | (static asset serving) |
