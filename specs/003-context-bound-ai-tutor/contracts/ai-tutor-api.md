# API Contract: AI Tutor

**Feature**: 003-context-bound-ai-tutor  
**Date**: 2026-07-06  
**Version**: 1.0.0

## Overview

This document defines the HTTP API contracts for the context-bound AI tutor feature. All endpoints require authentication via NextAuth session.

---

## Base URL

```
/api/tutor
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

### 1. Ask Question

Submit a question to the AI tutor for a specific lesson.

**Endpoint**: `POST /api/tutor/ask`

**Authorization**: Student must be enrolled in the course containing the lesson.

#### Request

```typescript
interface AskRequest {
  lessonId: string;    // MongoDB ObjectId
  courseId: string;    // MongoDB ObjectId
  question: string;    // Max 1000 characters
}
```

**Headers**:
```
Content-Type: application/json
```

**Example**:
```json
{
  "lessonId": "6479a1b2c3d4e5f6a7b8c9d0",
  "courseId": "6479a1b2c3d4e5f6a7b8c9d1",
  "question": "Where does photosynthesis occur?"
}
```

#### Response (Success - Within Context)

**Status**: `200 OK`

```typescript
interface AskResponseSuccess {
  success: true;
  data: {
    interactionId: string;
    answer: string;
    citation: string | null;
    contextStatus: "answered";
    detectedLanguage: "ar" | "en";
    lessonTitle: string;
  };
}
```

**Example**:
```json
{
  "success": true,
  "data": {
    "interactionId": "6479a1b2c3d4e5f6a7b8c9d2",
    "answer": "Photosynthesis occurs in the chloroplasts of plant cells.",
    "citation": "\"Photosynthesis occurs in the chloroplasts of plant cells.\"\n— Lesson: Introduction to Cell Biology",
    "contextStatus": "answered",
    "detectedLanguage": "en",
    "lessonTitle": "Introduction to Cell Biology"
  }
}
```

#### Response (Success - Out of Context)

**Status**: `200 OK`

```json
{
  "success": true,
  "data": {
    "interactionId": "6479a1b2c3d4e5f6a7b8c9d3",
    "answer": "I cannot find the answer to your question in the lecture materials. Please refer to your instructor or course resources.",
    "citation": null,
    "contextStatus": "out_of_context",
    "detectedLanguage": "en",
    "lessonTitle": "Introduction to Cell Biology"
  }
}
```

#### Response (Error - No Lecture Content)

**Status**: `400 Bad Request`

```json
{
  "success": false,
  "error": "AI tutor unavailable—no lecture content uploaded.",
  "code": "NO_LECTURE_CONTENT"
}
```

#### Response (Error - Rate Limited)

**Status**: `429 Too Many Requests`

```json
{
  "success": false,
  "error": "Too many requests. Please wait a moment before asking again.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 120
}
```

**Headers**:
```
Retry-After: 120
```

#### Response (Error - Not Enrolled)

**Status**: `403 Forbidden`

```json
{
  "success": false,
  "error": "You must be enrolled in this course to use the AI tutor.",
  "code": "NOT_ENROLLED"
}
```

#### Response (Error - Tutor Disabled)

**Status**: `503 Service Unavailable`

```json
{
  "success": false,
  "error": "AI tutor is currently disabled for this course.",
  "code": "TUTOR_DISABLED"
}
```

#### Response (Error - Service Unavailable)

**Status**: `503 Service Unavailable`

```json
{
  "success": false,
  "error": "AI tutor is temporarily unavailable. Please try again later.",
  "code": "SERVICE_UNAVAILABLE"
}
```

---

### 2. Get Interaction History

Retrieve the student's own AI tutor interaction history for a course.

**Endpoint**: `GET /api/tutor/history`

**Authorization**: 
- Students: Can only view their own history
- Instructors: Can view all interactions for courses they teach
- Admins: Can view all interactions

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `courseId` | string | Yes | MongoDB ObjectId |
| `lessonId` | string | No | Filter by specific lesson |
| `contextStatus` | string | No | Filter: "answered" or "out_of_context" |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20, max: 100) |

#### Response (Success)

**Status**: `200 OK`

```typescript
interface HistoryResponse {
  success: true;
  data: {
    interactions: Array<{
      id: string;
      question: string;
      response: string;
      citation: string | null;
      contextStatus: "answered" | "out_of_context";
      detectedLanguage: "ar" | "en";
      feedback: "helpful" | "not_helpful" | null;
      lessonId: string;
      lessonTitle: string;
      createdAt: string;  // ISO 8601
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}
```

**Example**:
```json
{
  "success": true,
  "data": {
    "interactions": [
      {
        "id": "6479a1b2c3d4e5f6a7b8c9d2",
        "question": "Where does photosynthesis occur?",
        "response": "Photosynthesis occurs in the chloroplasts of plant cells.",
        "citation": "\"Photosynthesis occurs in the chloroplasts of plant cells.\"\n— Lesson: Introduction to Cell Biology",
        "contextStatus": "answered",
        "detectedLanguage": "en",
        "feedback": "helpful",
        "lessonId": "6479a1b2c3d4e5f6a7b8c9d0",
        "lessonTitle": "Introduction to Cell Biology",
        "createdAt": "2026-07-06T18:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

---

### 3. Submit Feedback

Submit feedback (thumbs up/down) for an interaction.

**Endpoint**: `POST /api/tutor/feedback`

**Authorization**: Student who created the interaction.

#### Request

```typescript
interface FeedbackRequest {
  interactionId: string;
  feedback: "helpful" | "not_helpful";
}
```

**Example**:
```json
{
  "interactionId": "6479a1b2c3d4e5f6a7b8c9d2",
  "feedback": "helpful"
}
```

#### Response (Success)

**Status**: `200 OK`

```json
{
  "success": true,
  "data": {
    "interactionId": "6479a1b2c3d4e5f6a7b8c9d2",
    "feedback": "helpful"
  }
}
```

#### Response (Error - Not Owner)

**Status**: `403 Forbidden`

```json
{
  "success": false,
  "error": "You can only provide feedback for your own interactions.",
  "code": "FORBIDDEN"
}
```

---

### 4. Get Configuration (Admin)

Retrieve AI tutor configuration.

**Endpoint**: `GET /api/tutor/config`

**Authorization**: Admin only.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `courseId` | string | No | Get course-specific config (omit for global) |

#### Response (Success)

**Status**: `200 OK`

```typescript
interface ConfigResponse {
  success: true;
  data: {
    courseId: string | null;
    outOfContextMessage: {
      en: string;
      ar: string;
    };
    enabled: boolean;
    rateLimitPerHour: number;
    relevanceThreshold: number;
    maxContextChunks: number;
    updatedAt: string;
    updatedBy: {
      id: string;
      name: string;
    } | null;
  };
}
```

---

### 5. Update Configuration (Admin)

Update AI tutor configuration.

**Endpoint**: `PUT /api/tutor/config`

**Authorization**: Admin only.

#### Request

```typescript
interface ConfigUpdateRequest {
  courseId?: string | null;  // null for global config
  outOfContextMessage?: {
    en?: string;
    ar?: string;
  };
  enabled?: boolean;
  rateLimitPerHour?: number;  // 1-100
  relevanceThreshold?: number;  // 0.5-0.95
  maxContextChunks?: number;  // 1-10
}
```

**Example**:
```json
{
  "courseId": null,
  "outOfContextMessage": {
    "en": "Sorry, I could not find an answer in the course materials.",
    "ar": "عذرًا، لم أتمكن من العثور على إجابة في مواد الدورة."
  },
  "rateLimitPerHour": 30
}
```

#### Response (Success)

**Status**: `200 OK`

```json
{
  "success": true,
  "data": {
    "courseId": null,
    "outOfContextMessage": {
      "en": "Sorry, I could not find an answer in the course materials.",
      "ar": "عذرًا، لم أتمكن من العثور على إجابة في مواد الدورة."
    },
    "enabled": true,
    "rateLimitPerHour": 30,
    "relevanceThreshold": 0.7,
    "maxContextChunks": 5,
    "updatedAt": "2026-07-06T19:00:00.000Z",
    "updatedBy": {
      "id": "6479a1b2c3d4e5f6a7b8c9d9",
      "name": "Admin User"
    }
  }
}
```

---

### 6. Report Issue

Report an issue with an AI tutor response.

**Endpoint**: `POST /api/tutor/report`

**Authorization**: Student who created the interaction.

#### Request

```typescript
interface ReportRequest {
  interactionId: string;
  reason: "incorrect" | "inappropriate" | "other";
  details?: string;  // Max 500 characters
}
```

**Example**:
```json
{
  "interactionId": "6479a1b2c3d4e5f6a7b8c9d2",
  "reason": "incorrect",
  "details": "The answer contradicts what was said in the video at 5:30."
}
```

#### Response (Success)

**Status**: `201 Created`

```json
{
  "success": true,
  "data": {
    "reportId": "6479a1b2c3d4e5f6a7b8c9e0",
    "message": "Thank you for your feedback. The issue has been reported."
  }
}
```

---

## Error Codes Summary

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTH_REQUIRED` | 401 | No valid session |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_ENROLLED` | 403 | Student not enrolled in course |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NO_LECTURE_CONTENT` | 400 | Lesson has no embedded content |
| `QUESTION_TOO_LONG` | 400 | Question exceeds 1000 chars |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `TUTOR_DISABLED` | 503 | Feature disabled for course |
| `SERVICE_UNAVAILABLE` | 503 | AI/vector service down |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Rate Limiting

- Default: 20 requests per student per hour per course
- Configurable per course by admin
- Rate limit headers included in all responses:

```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1720293600
```

---

## Streaming Support (Future)

The `/api/tutor/ask` endpoint may support streaming responses in a future version using Server-Sent Events:

```
Accept: text/event-stream
```

This is not included in v1.0.0 scope but the API is designed to accommodate it.
