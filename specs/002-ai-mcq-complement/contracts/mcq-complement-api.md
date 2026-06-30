# API Contracts: MCQ Complement

**Date**: 2026-06-27 | **Spec**: [../spec.md](../spec.md) | **Data Model**: [../data-model.md](../data-model.md)

All endpoints follow existing project conventions: Zod `.strict()` validation at boundaries, `NextResponse.json()` responses, `Cache-Control: no-store` on polling endpoints.

---

## 1. POST /api/quiz-generation/jobs (MODIFIED — spec 001 endpoint)

Extended to accept MCQ complement jobs alongside existing full-quiz generation jobs.

**Auth**: Instructor or Admin only. Must have consented to current consent version.

**Request**: `multipart/form-data`
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `file` | File | yes | `.docx`, max size per AdminQuizConfig |
| `courseId` | String | yes | Valid ObjectId, instructor must own course |
| `lessonId` | String | no | Valid ObjectId if provided |
| `targetQuizId` | String | **yes for MCQ complement** | Valid ObjectId of an existing quiz on the course. Presence of this field triggers MCQ complement mode. |
| `jobType` | String | no | `"full_quiz"` (default) or `"mcq_complement"`. Inferred as `"mcq_complement"` when `targetQuizId` is provided. |
| `totalQuestions` | Number | no | Default 8 for MCQ complement, 10 for full quiz |
| `mcqCount` | Number | no | Default = `totalQuestions` for MCQ complement. Must equal `totalQuestions` when `jobType === "mcq_complement"`. |
| `trueFalseCount` | Number | no | Must be 0 for MCQ complement |
| `shortAnswerCount` | Number | no | Must be 0 for MCQ complement |
| `easyCount` | Number | no | Default 3 |
| `mediumCount` | Number | no | Default 3 |
| `hardCount` | Number | no | Default 2 |

**Additional validation for MCQ complement**:
- `targetQuizId` must reference an existing quiz on the specified `courseId`
- Instructor must own the quiz (or be admin)
- `trueFalseCount === 0` and `shortAnswerCount === 0` (enforced; MCQ-only)
- `mcqCount === totalQuestions` (enforced; all questions are MCQ)
- No active `running` complement job exists for the same `targetQuizId` (409 Conflict)

**Server flow** (additions to spec 001's flow at steps 4–11):
1–3. Same as spec 001 (auth, consent, quota)
4. If `targetQuizId` provided: validate quiz exists, instructor owns it, set `jobType = "mcq_complement"`
5. Enforce MCQ-only params (`trueFalseCount=0, shortAnswerCount=0, mcqCount=totalQuestions`)
6. Check for concurrent running complement job on same quiz
7–11. Same as spec 001 (file validation, extraction, hashing, dedup, create job, register `after()`)
12. Pass `targetQuizId` and existing question stems to the orchestrator via options

**Response** (202 Accepted):
```json
{
  "ok": true,
  "jobId": "665abc123def...",
  "status": "queued",
  "jobType": "mcq_complement",
  "targetQuizId": "665def456abc...",
  "isDuplicate": false
}
```

**Additional errors**:
- `404` — `targetQuizId` quiz not found
- `403` — Instructor does not own the target quiz
- `409` — A complement job is already running for this quiz

---

## 2. GET /api/quiz-generation/jobs/[jobId] (NO CHANGE)

Polling endpoint is used as-is from spec 001. The response already includes `draftQuestions` when the job succeeds. The client distinguishes MCQ complement jobs by the presence of `jobType: "mcq_complement"` in the response (added to the response payload).

**Response addition** (job succeeded, MCQ complement):
```json
{
  "ok": true,
  "jobId": "665abc123def...",
  "status": "succeeded",
  "jobType": "mcq_complement",
  "targetQuizId": "665def456abc...",
  "sourceFilename": "lecture-notes-ch5.docx",
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
      "correctOptionIds": ["a"],
      "modelAnswer": "",
      "explanation": "The text states that...",
      "sourceQuote": "The primary function is to regulate...",
      "instructorState": "untouched"
    }
  ],
  "mcqValidationSummary": {
    "generated": 10,
    "droppedUngrounded": 1,
    "droppedInvalidStructure": 0,
    "droppedDuplicate": 1,
    "included": 8
  }
}
```

---

## 3. PATCH /api/quiz-generation/jobs/[jobId]/questions/[draftId] (NO CHANGE)

Edit endpoint is used as-is from spec 001. MCQ complement drafts follow the same edit flow — the instructor can modify stem, options, correct answer, justification, difficulty, and instructorState.

---

## 4. POST /api/quiz-generation/jobs/[jobId]/regenerate (NO CHANGE)

Regeneration endpoint is used as-is. For MCQ complement jobs, single-question regeneration produces a replacement MCQ (the orchestrator routes to the MCQ-specific prompt when `jobType === "mcq_complement"`). Full-draft regeneration replaces all MCQs.

---

## 5. POST /api/quiz-generation/jobs/[jobId]/append (NEW)

Append approved MCQs from a completed MCQ complement job to the target quiz.

**Auth**: Job owner (instructor) or admin. Job must be in `succeeded` status. Job `jobType` must be `"mcq_complement"`.

**Request** (JSON):
```json
{
  "confirmPublishedAppend": false
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `confirmPublishedAppend` | Boolean | no | Must be `true` if the target quiz is published and has existing attempts. Default `false`. |

**Server flow**:
1. Auth + ownership check (job owner or admin)
2. Validate `job.status === "succeeded"` and `job.jobType === "mcq_complement"`
3. Load target quiz (`job.targetQuizId`), verify it exists
4. Check if quiz is published and has attempts:
   - If published with attempts and `confirmPublishedAppend !== true`: return `{ ok: false, requiresConfirmation: true, reason: "..." }` with status `200`
   - If published with attempts and `confirmPublishedAppend === true`: proceed with warning acknowledged
5. Filter draft questions: include only those with `instructorState !== "rejected"`
6. If no questions remain after filtering: return `400` error
7. Count existing questions on the quiz (`Question.countDocuments({ quizId })`)
8. Build Question documents from filtered drafts with `order` starting from existing count
9. Insert in a MongoDB transaction (atomic append)
10. Forget extracted text (clean up in-memory store)
11. Return success response

**Response** (200 OK — confirmation required):
```json
{
  "ok": false,
  "requiresConfirmation": true,
  "reason": "This quiz is published and has 12 existing student attempts. New MCQs will only appear on future attempts.",
  "existingAttemptCount": 12
}
```

**Response** (201 Created — success):
```json
{
  "ok": true,
  "quizId": "665def456abc...",
  "appendedCount": 8,
  "totalQuestionCount": 13,
  "aiGenerated": true
}
```

**Errors**:
- `401` — Not authenticated
- `403` — Not job owner and not admin
- `400` — Job not in succeeded state, or jobType is not mcq_complement, or no questions to append
- `404` — Job not found, or target quiz not found
- `500` — Transaction failure

---

## 6. GET /api/quiz-generation/jobs/[jobId] (RESPONSE EXTENSION)

The existing poll endpoint is extended to include `jobType`, `targetQuizId`, and `mcqValidationSummary` in the response when the job is an MCQ complement job. See contract §2 above for the full response shape.

---

## Query Contracts

### 7. getExistingQuestionStems (queries/quiz-generation.js — NEW)

Fetch question stems for all questions on a quiz, used for duplicate detection.

**Signature**:
```js
async function getExistingQuestionStems(quizId)
```

**Returns**: `string[]` — array of `text` values from all Question documents where `quizId` matches.

**Used by**: The MCQ complement orchestrator (before calling the AI) and the MCQ validator (post-generation duplicate filtering).

**Performance**: Uses existing `{ quizId: 1, type: 1 }` index with a projection (`{ text: 1, _id: 0 }`). Typical quiz has ≤30 questions — single indexed query, sub-1ms.
