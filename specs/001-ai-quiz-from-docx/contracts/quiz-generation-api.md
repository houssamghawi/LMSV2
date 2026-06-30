# API Contracts: AI Quiz Generation

**Date**: 2026-06-26 | **Spec**: [../spec.md](../spec.md) | **Data Model**: [../data-model.md](../data-model.md)

All endpoints follow existing project conventions: Zod `.strict()` validation at boundaries, `NextResponse.json()` responses, `Cache-Control: no-store` on polling endpoints.

---

## 1. POST /api/quiz-generation/consent

Check or record user consent for AI data processing (FR-022).

**Auth**: Instructor or Admin only

**Request** (JSON):
```json
{
  "consentVersion": "1.0.0",
  "action": "check" | "acknowledge"
}
```

**Response** (`check`):
```json
{ "ok": true, "hasConsented": true, "consentVersion": "1.0.0" }
```

**Response** (`acknowledge`):
```json
{ "ok": true, "acknowledged": true, "consentVersion": "1.0.0" }
```

**Errors**: `401` unauthorized, `403` student role

---

## 2. POST /api/quiz-generation/jobs

Upload `.docx` and start an async generation job.

**Auth**: Instructor or Admin only. Must have consented to current consent version.

**Request**: `multipart/form-data`
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `file` | File | yes | `.docx`, max size per AdminQuizConfig |
| `courseId` | String | yes | Valid ObjectId, instructor must own course |
| `lessonId` | String | no | Valid ObjectId if provided |
| `totalQuestions` | Number | no | Default 10, max per AdminQuizConfig |
| `mcqCount` | Number | no | Default 5 |
| `trueFalseCount` | Number | no | Default 3 |
| `shortAnswerCount` | Number | no | Default 2 |
| `easyCount` | Number | no | Default 4 |
| `mediumCount` | Number | no | Default 4 |
| `hardCount` | Number | no | Default 2 |

**Validation rules**:
- `mcqCount + trueFalseCount + shortAnswerCount === totalQuestions`
- `easyCount + mediumCount + hardCount === totalQuestions`
- File MIME type: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- File size ≤ AdminQuizConfig.maxDocumentSizeBytes
- User daily quota not exceeded (count today's GenerationJobs for this userId)
- Instructor owns `courseId` (via `assertInstructorOwnsCourse`)

**Server flow**:
1. Auth + role check
2. Consent version check
3. Quota check (query GenerationJob count for userId today)
4. File validation (MIME, size)
5. Extract text via mammoth
6. Reject if extracted text is empty (FR-002)
7. Compute SHA-256 content hash
8. Check for duplicate (same courseId + contentHash with recent succeeded job) → return prior jobId with `isDuplicate: true`
9. Insert GenerationJob with `status: queued`
10. Register `after()` callback for AI generation
11. Return response

**Response** (202 Accepted):
```json
{
  "ok": true,
  "jobId": "665abc123def...",
  "status": "queued",
  "isDuplicate": false
}
```

**Duplicate response** (200 OK):
```json
{
  "ok": true,
  "jobId": "665abc123def...",
  "status": "succeeded",
  "isDuplicate": true,
  "message": "This document was previously processed for this course."
}
```

**Errors**:
- `401` — Not authenticated
- `403` — Student role / consent not given / not course owner
- `400` — Validation failure (bad MIME, counts don't sum, empty text)
- `413` — File too large
- `429` — Daily quota exceeded (include `retryAfter` timestamp)

---

## 3. GET /api/quiz-generation/jobs/[jobId]

Poll job status and retrieve draft when complete.

**Auth**: The requesting user must be the job's `userId` or an admin.

**Response** (job in progress):
```json
{
  "ok": true,
  "jobId": "665abc123def...",
  "status": "running",
  "createdAt": "2026-06-26T14:30:00.000Z"
}
```

**Response** (job succeeded):
```json
{
  "ok": true,
  "jobId": "665abc123def...",
  "status": "succeeded",
  "sourceFilename": "lecture-notes-ch5.docx",
  "extractionWarnings": ["Image at paragraph 12 was ignored"],
  "aiModel": "gpt-4.1",
  "draftQuestions": [
    {
      "draftId": "uuid-1",
      "type": "single",
      "difficulty": "easy",
      "text": "What is the primary function of...",
      "options": [
        { "id": "a", "text": "Option A" },
        { "id": "b", "text": "Option B" },
        { "id": "c", "text": "Option C" },
        { "id": "d", "text": "Option D" }
      ],
      "correctOptionIds": ["b"],
      "modelAnswer": "",
      "explanation": "The text states that...",
      "sourceQuote": "The primary function is to regulate...",
      "instructorState": "untouched"
    },
    {
      "draftId": "uuid-2",
      "type": "short_answer",
      "difficulty": "hard",
      "text": "Explain the relationship between...",
      "options": [],
      "correctOptionIds": [],
      "modelAnswer": "The relationship involves...",
      "explanation": "According to the lecture...",
      "sourceQuote": "These two concepts are interrelated because...",
      "instructorState": "untouched"
    }
  ]
}
```

**Response** (job failed):
```json
{
  "ok": true,
  "jobId": "665abc123def...",
  "status": "failed",
  "failureReason": "AI provider timeout after 60 seconds"
}
```

**Headers**: `Cache-Control: no-store`

**Errors**: `401`, `403` (not job owner and not admin), `404` job not found

---

## 4. PATCH /api/quiz-generation/jobs/[jobId]/questions/[draftId]

Update a single draft question (instructor edit). Persists to the DraftQuestion sub-document on GenerationJob.

**Auth**: Job owner (instructor) or admin.

**Request** (JSON, partial update):
```json
{
  "text": "Updated question text...",
  "options": [{ "id": "a", "text": "Updated A" }, { "id": "b", "text": "Updated B" }],
  "correctOptionIds": ["a"],
  "modelAnswer": "Updated model answer",
  "explanation": "Updated explanation...",
  "sourceQuote": "Updated quote...",
  "difficulty": "medium",
  "type": "single",
  "instructorState": "edited"
}
```

**Validation**: Same rules as Question creation — options ≥ 2 for MCQ/TF, correctOptionIds subset of option ids, etc.

**Response** (200):
```json
{ "ok": true, "draftId": "uuid-1", "instructorState": "edited" }
```

---

## 5. POST /api/quiz-generation/jobs/[jobId]/regenerate

Regenerate one question or the entire draft. Calls AI again with the same source text.

**Auth**: Job owner or admin. Consumes one quota slot only for full regeneration.

**Request** (JSON):
```json
{
  "scope": "single" | "all",
  "draftId": "uuid-1",
  "params": {
    "totalQuestions": 10,
    "mcqCount": 8,
    "trueFalseCount": 0,
    "shortAnswerCount": 2
  }
}
```

- `scope: "single"`: regenerate only the question identified by `draftId`; `params` optional.
- `scope: "all"`: regenerate entire draft with new `params`; `draftId` ignored. Requires confirmation (client-side).

**Response** (202 Accepted):
```json
{ "ok": true, "jobId": "665abc123def...", "status": "running" }
```

Client polls GET /api/quiz-generation/jobs/[jobId] for the updated draft.

---

## 6. POST /api/quiz-generation/jobs/[jobId]/save

Save the current draft as a Quiz + Questions in the existing store (FR-009).

**Auth**: Job owner or admin. Job must be in `succeeded` status.

**Request** (JSON):
```json
{
  "courseId": "...",
  "lessonId": "..." ,
  "title": "Chapter 5 Quiz",
  "description": "Auto-generated from lecture notes",
  "passPercent": 70,
  "timeLimitSec": null,
  "maxAttempts": null,
  "shuffleQuestions": false,
  "shuffleOptions": false,
  "showAnswersPolicy": "after_submit"
}
```

**Server flow**:
1. Auth + ownership check
2. Validate job status is `succeeded` and has draft questions
3. Filter draft questions: include only those with `instructorState !== "rejected"`
4. Create Quiz document with `aiGenerated: true`, `generationJobId`, `published: false`
5. Create Question documents from filtered draft questions
6. Return created quiz ID

**Response** (201 Created):
```json
{
  "ok": true,
  "quizId": "665def456abc...",
  "questionCount": 10,
  "aiGenerated": true
}
```

---

## Server Action Contracts (app/actions/)

These follow the existing quiz v2 Pattern B: `{ ok: true, ...data }` / `{ ok: false, error: "..." }`.

### 7. gradeShortAnswerResponse (app/actions/quizv2.js)

Grade a single Short Answer response on a pending-grading attempt (FR-018).

**Signature**:
```js
async function gradeShortAnswerResponse(attemptId, questionId, { awardedPoints, graderComment })
```

**Auth**: `getLoggedInUser()` → must be the quiz owner (instructor) or admin.

**Validation** (Zod):
- `awardedPoints`: Number, 0 ≤ value ≤ question.points
- `graderComment`: String, max 1000 chars, optional

**Flow**:
1. Load attempt, verify `status === "pending_grading"`
2. Find the answer sub-doc matching `questionId`
3. Verify `answer.graded === false` (idempotency: if already graded, return current state)
4. Set `answer.graded = true`, `answer.awardedPoints`, `answer.gradedBy`, `answer.gradedAt = new Date()`, `answer.graderComment`
5. Decrement `attempt.pendingGradingCount`
6. If `pendingGradingCount === 0`: finalize attempt (recompute `score`, `scorePercent`, `passed`; set `status: "submitted"`, `finalizedAt`, `finalizedBy`)
7. Save attempt
8. Return `{ ok: true, finalized: boolean, attempt summary }`

**Response**:
```js
{ ok: true, finalized: false, pendingGradingCount: 2 }
// or
{ ok: true, finalized: true, score: 85, scorePercent: 85, passed: true }
```

---

### 8. getPendingGradingAttempts (queries/quizv2.js)

Fetch attempts awaiting grading, scoped by role (FR-020).

**Signature**:
```js
async function getPendingGradingAttempts({ quizId, courseId, page, limit, userId })
```

- Instructor: filtered to quizzes they own
- Admin: all quizzes, optional filters by course/quiz/instructor

**Returns**: Paginated array of attempts with student name, quiz title, submission date, pending count, partially graded answers.

---

### 9. getPendingGradingCount (queries/quizv2.js)

Badge count for the instructor dashboard and quiz list (FR-019).

**Signature**:
```js
async function getPendingGradingCount(userId, role)
```

- Instructor: count of `pending_grading` attempts across their quizzes
- Admin: total count across all quizzes

**Returns**: `{ total: Number, byQuiz: [{ quizId, quizTitle, count }] }`

---

### 10. adminUpdateQuizConfig (app/actions/admin.js)

Update admin quiz generation settings (FR-012).

**Signature**:
```js
async function adminUpdateQuizConfig(data)
```

**Auth**: Admin only via `requireAdminPermission('quiz:configure')`.

**Validation** (Zod `.strict()`):
- `dailyQuotaPerInstructor`: Number, min 1, max 1000
- `maxDocumentSizeBytes`: Number, min 1048576 (1MB), max 52428800 (50MB)
- `maxQuestionsPerGeneration`: Number, min 1, max 50
- `sourceRetentionEnabled`: Boolean
- `sourceRetentionDays`: Number, min 1, max 365

**Returns**: `{ ok: true, config: updatedConfig }`
