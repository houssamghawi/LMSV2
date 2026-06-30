# Data Model: AI Quiz Generation from Lecture Notes (.docx)

**Date**: 2026-06-26 | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

---

## New Collections

### 1. GenerationJob

Tracks a single quiz-generation attempt from upload through AI completion. Serves as both the async job record and the audit log (FR-013).

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `userId` | ObjectId (ref: User) | yes | — | The instructor/admin who triggered generation |
| `courseId` | ObjectId (ref: Course) | yes | — | Target course |
| `lessonId` | ObjectId (ref: Lesson) | no | null | Optional target lesson |
| `status` | String enum: `queued`, `running`, `succeeded`, `failed` | yes | `queued` | Job lifecycle state |
| `failureReason` | String | no | null | Populated on `failed`; maps to FR-011 error codes |
| `sourceFilename` | String | yes | — | Original `.docx` filename |
| `sourceByteSize` | Number | yes | — | Raw file size in bytes |
| `sourceContentHash` | String | yes | — | SHA-256 of normalized extracted text |
| `extractedTextLength` | Number | no | null | Character count of extracted text (for analytics) |
| `extractionWarnings` | [String] | no | [] | Mammoth warnings (skipped elements) |
| `params` | Object | yes | — | Generation parameters (see sub-schema below) |
| `aiProvider` | String | no | null | e.g. `openai` |
| `aiModel` | String | no | null | e.g. `gpt-4.1` |
| `aiTokensInput` | Number | no | null | Input tokens consumed |
| `aiTokensOutput` | Number | no | null | Output tokens consumed |
| `consentVersion` | String | yes | — | Version of consent text the user acknowledged (FR-022) |
| `draftQuestions` | [DraftQuestion] | no | [] | Generated question drafts (see sub-schema below) |
| `startedAt` | Date | no | null | When `running` began |
| `completedAt` | Date | no | null | When `succeeded` or `failed` |

**Timestamps**: `createdAt`, `updatedAt` (Mongoose `timestamps: true`)

#### params sub-schema

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `totalQuestions` | Number | yes | 10 |
| `mcqCount` | Number | yes | 5 |
| `trueFalseCount` | Number | yes | 3 |
| `shortAnswerCount` | Number | yes | 2 |
| `easyCount` | Number | no | 4 |
| `mediumCount` | Number | no | 4 |
| `hardCount` | Number | no | 2 |

#### DraftQuestion sub-schema

Provisional question stored on the job before the instructor saves to the Quiz/Question store.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `draftId` | String | yes | UUID for client-side keying |
| `type` | String enum: `single`, `true_false`, `short_answer` | yes | Aligns with Mongoose Question model enum |
| `difficulty` | String enum: `easy`, `medium`, `hard` | yes | FR-006 |
| `text` | String | yes | Question text |
| `options` | [{ id: String, text: String }] | yes (for `single`, `true_false`) | At least 2; empty array for `short_answer` |
| `correctOptionIds` | [String] | yes (for `single`, `true_false`) | Empty array for `short_answer` |
| `modelAnswer` | String | yes (for `short_answer`) | Expected answer text; empty string for MCQ/TF |
| `explanation` | String | yes | ≤2 sentences, plain language |
| `sourceQuote` | String | yes | Verbatim ≤30-word quote from source document |
| `instructorState` | String enum: `untouched`, `edited`, `approved`, `rejected`, `regenerated` | yes | Default: `untouched` |

**Indexes**:
- `{ userId: 1, createdAt: -1 }` — quota enforcement (count today's jobs per user)
- `{ courseId: 1, sourceContentHash: 1 }` — duplicate upload detection
- `{ status: 1 }` — admin queue/monitoring
- `{ courseId: 1, lessonId: 1, createdAt: -1 }` — per-lesson job history

---

### 2. AIProcessingConsent

Tracks per-user acknowledgement of the third-party AI data processing banner (FR-022).

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `userId` | ObjectId (ref: User) | yes | — | Unique per (userId, consentVersion) |
| `consentVersion` | String | yes | — | Semantic version of the consent text |
| `acknowledgedAt` | Date | yes | — | When the user clicked "I understand" |
| `userAgent` | String | no | null | Browser UA at acknowledgement time |

**Timestamps**: `createdAt` (Mongoose `timestamps: true`)

**Indexes**:
- `{ userId: 1, consentVersion: 1 }` — unique compound; fast lookup for "has user consented to current version?"

---

### 3. AdminQuizConfig

Stores admin-tunable settings for quiz generation (FR-012). Single-document collection (one doc, upserted).

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `dailyQuotaPerInstructor` | Number | yes | 20 | Max generations per instructor per 24h |
| `maxDocumentSizeBytes` | Number | yes | 10485760 | 10 MB default |
| `maxQuestionsPerGeneration` | Number | yes | 30 | Upper bound on `params.totalQuestions` |
| `sourceRetentionEnabled` | Boolean | yes | false | Whether to keep extracted text after job completes |
| `sourceRetentionDays` | Number | no | 30 | Days to retain if enabled |
| `updatedBy` | ObjectId (ref: User) | yes | — | Admin who last changed settings |

**Timestamps**: `createdAt`, `updatedAt`

---

## Modifications to Existing Collections

### 4. Question (model/questionv2-model.js)

**Changes**:

| Change | Detail |
|--------|--------|
| `type` enum expanded | Add `"short_answer"` → enum becomes `["single", "multi", "true_false", "short_answer"]` |
| New field: `modelAnswer` | `String`, default `""`. Stores the expected answer for Short Answer questions. Empty for MCQ/TF. |
| New field: `explanation` | Already exists (default `""`). No schema change needed — just ensure it's populated by the generator. |
| New field: `sourceQuote` | `String`, default `""`. Verbatim ≤30-word citation from the source document. Populated for AI-generated questions; empty for manually authored ones. |
| New field: `difficulty` | `String`, enum `["easy", "medium", "hard"]`, default `null`. Optional — only populated for AI-generated questions. |
| `options` validation | Relax `min: 2` for `short_answer` type — SA questions have 0 options. Add a conditional validator: `options.length >= 2` when type is `single`/`multi`/`true_false`; `options.length === 0` when type is `short_answer`. |
| `correctOptionIds` validation | Relax for `short_answer` — allow empty array when type is `short_answer`. |

**New index**: `{ quizId: 1, type: 1 }` — supports filtering questions by type for grading queue queries.

**Zod schema update** (`lib/validations.js`): Add `"short_answer"` to the `questionSchema.type` enum. Add `modelAnswer` field. Update conditional validation for options/correctOptionIds based on type. Keep `.strict()`.

---

### 5. Quiz (model/quizv2-model.js)

**Changes**:

| Change | Detail |
|--------|--------|
| New field: `aiGenerated` | `Boolean`, default `false`. Set to `true` when a draft is saved as a quiz (FR-016). |
| New field: `generationJobId` | `ObjectId` (ref: GenerationJob), default `null`. Links back to the job that produced this quiz. |

**New index**: `{ aiGenerated: 1, courseId: 1 }` — supports admin "filter to AI-generated" view (FR-016).

---

### 6. Attempt (model/attemptv2-model.js)

**Changes**:

| Change | Detail |
|--------|--------|
| `status` enum expanded | Add `"pending_grading"` → enum becomes `["in_progress", "submitted", "expired", "pending_grading"]` |
| `answers` sub-schema expanded | Add `textResponse` (String, default `null`, max 2000 chars) for Short Answer responses. Add `graded` (Boolean, default `false`). Add `awardedPoints` (Number, default `null`). Add `graderComment` (String, default `""`) Add `gradedBy` (ObjectId ref: User, default `null`). Add `gradedAt` (Date, default `null`). |
| New field: `hasShortAnswers` | `Boolean`, default `false`. Set to `true` at submit time if the quiz contains any SA questions. Enables fast filtering for the grading queue without joining to Question. |
| New field: `pendingGradingCount` | `Number`, default `0`. Count of ungraded SA responses on this attempt. Decremented per-response as the instructor grades. When it reaches 0, finalization triggers automatically. |
| New field: `finalizedAt` | `Date`, default `null`. Timestamp when the overall score was finalized after all SA responses were graded. |
| New field: `finalizedBy` | `ObjectId` (ref: User), default `null`. The grader who graded the last SA response, triggering finalization. |
| Partial unique index update | The existing partial unique index `{ quizId: 1, studentId: 1 }` with `partialFilterExpression: { status: "in_progress" }` remains unchanged — it correctly allows a new `in_progress` attempt while another is `pending_grading` (FR-021). |

**New indexes**:
- `{ status: 1, quizId: 1 }` with `partialFilterExpression: { status: "pending_grading" }` — grading queue per quiz
- `{ status: 1, submittedAt: -1 }` with `partialFilterExpression: { status: "pending_grading" }` — admin aggregate grading queue ordered by age

---

## Entity Relationships

```
User (instructor) ──1:N──> GenerationJob ──1:1──> Quiz (on save)
                                │
                                └── embeds [DraftQuestion]
                                      │
                                      └── becomes ──> Question (on save)

User (instructor) ──1:N──> AIProcessingConsent

Quiz ──1:N──> Question (includes short_answer type)
Quiz ──1:N──> Attempt
Attempt ── embeds [Answer] (with textResponse, grading fields for SA)

AdminQuizConfig ── singleton document (admin settings)

Course ──1:N──> Quiz (via Quiz.courseId)
Lesson ──0:N──> Quiz (via Quiz.lessonId)
```

## State Machines

### GenerationJob.status

```
queued ──(after() starts)──> running ──(AI succeeds)──> succeeded
                                     └──(AI fails)───> failed
```

### Attempt.status (updated)

```
in_progress ──(submit, no SA)──────────────> submitted
            └──(submit, has SA)──────────> pending_grading ──(all SA graded)──> submitted
            └──(timer expires)──────────> expired
```

When an attempt enters `pending_grading`:
1. Auto-graded questions (MCQ, TF) are scored immediately; their `awardedPoints` are set.
2. SA responses have `graded: false`, `awardedPoints: null`.
3. `pendingGradingCount` = number of SA questions on the quiz.
4. Each instructor grade action: set `graded: true`, `awardedPoints`, `gradedBy`, `gradedAt`, `graderComment` on the answer; decrement `pendingGradingCount`.
5. When `pendingGradingCount` reaches 0: compute final `score`, `scorePercent`, `passed`; set `status: "submitted"`, `finalizedAt`, `finalizedBy`.

### Answer sub-document grading flow

```
(submit) → graded: false, awardedPoints: null
         ↓
(instructor grades) → graded: true, awardedPoints: N, gradedBy, gradedAt, graderComment
```
