# Data Model: AI MCQ Complement for Existing Quizzes

**Date**: 2026-06-27 | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

---

## Modifications to Existing Collections

This feature introduces **zero new collections**. All changes are backward-compatible extensions to the `GenerationJob` model established by spec 001.

### 1. GenerationJob (model/generation-job-model.js)

**Changes**:

| Change | Detail |
|--------|--------|
| New field: `targetQuizId` | `ObjectId` (ref: Quiz), default `null`. Set when `jobType === "mcq_complement"`. References the existing quiz to which MCQs will be appended. Null for `full_quiz` jobs (spec 001 behavior preserved). |
| New field: `jobType` | `String`, enum `["full_quiz", "mcq_complement"]`, default `"full_quiz"`. Discriminates between spec 001's create-new-quiz flow and spec 002's append-to-existing-quiz flow. Existing jobs default to `"full_quiz"` — fully backward-compatible. |
| `params` sub-schema: no change | MCQ complement jobs use the existing params sub-schema with `trueFalseCount: 0` and `shortAnswerCount: 0`. No new fields needed — the existing `mcqCount`, `easyCount`, `mediumCount`, `hardCount` already support MCQ-only distributions. |

**New index**: `{ targetQuizId: 1, createdAt: -1 }` with `partialFilterExpression: { targetQuizId: { $ne: null } }` — supports lookup of complement jobs for a specific quiz (audit view, concurrent-request detection).

**Backward compatibility**: Both new fields have defaults (`null` and `"full_quiz"`), so existing documents and spec 001 code paths are unaffected. No migration script required.

---

### 2. Question (model/questionv2-model.js)

**No schema changes**. MCQs appended by the complement feature use the existing Question schema with `type: "single"`, `options` (4 items), `correctOptionIds` (1 item), `explanation`, `sourceQuote`, and `difficulty`. The `order` field is set to continue from the highest existing `order` value on the target quiz.

---

### 3. Quiz (model/quizv2-model.js)

**No schema changes**. The append operation inserts new Question documents referencing the existing quiz's `_id`. No Quiz-level fields are modified. The quiz is not marked `aiGenerated: true` by the complement feature — it retains whatever value it already had (it may or may not have been originally AI-generated).

---

## MCQ Complement Params (via existing sub-schema)

MCQ complement jobs populate the existing `generationParamsSchema` as follows:

| Field | MCQ Complement Value | Notes |
|-------|---------------------|-------|
| `totalQuestions` | User-specified, default 8 | Max bounded by AdminQuizConfig.maxQuestionsPerGeneration |
| `mcqCount` | Equal to `totalQuestions` | All questions are MCQ |
| `trueFalseCount` | 0 | Not applicable for complement |
| `shortAnswerCount` | 0 | Not applicable for complement |
| `easyCount` | User-specified, default 3 | |
| `mediumCount` | User-specified, default 3 | |
| `hardCount` | User-specified, default 2 | |

**Validation**: `easyCount + mediumCount + hardCount === totalQuestions` (enforced by Zod schema in `lib/validations.js`).

---

## Entity Relationships (additions to spec 001)

```
GenerationJob (jobType: "mcq_complement")
    │
    ├── targetQuizId ──> Quiz (existing, not created by this job)
    │
    └── embeds [DraftQuestion] (MCQ-only, type: "single")
          │
          └── becomes ──> Question (on append, added to existing Quiz)
```

The existing spec 001 relationships are unchanged:

```
GenerationJob (jobType: "full_quiz") ──1:1──> Quiz (on save, creates new)
```

---

## State Machine

### GenerationJob.status (no change)

The MCQ complement job uses the same state machine as spec 001:

```
queued ──(after() starts)──> running ──(AI succeeds)──> succeeded
                                     └──(AI fails)───> failed
```

The only behavioral difference: when `jobType === "mcq_complement"` and status reaches `succeeded`, the instructor uses the **append** endpoint (not save) to finalize.

---

## Concurrent Request Detection

To prevent duplicate appends (spec edge case: concurrent complement requests on the same quiz), the append endpoint checks:

1. Is there already a `GenerationJob` with `targetQuizId === quizId` and `status === "running"`? If so, return `409 Conflict`.
2. The job creation endpoint performs the same check before inserting a new `queued` job.

This uses the new `{ targetQuizId: 1, createdAt: -1 }` partial index.
