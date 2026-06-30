# Quickstart Validation Guide: MCQ Complement

**Date**: 2026-06-27 | **Spec**: [spec.md](./spec.md) | **Contracts**: [contracts/mcq-complement-api.md](./contracts/mcq-complement-api.md) | **Data Model**: [data-model.md](./data-model.md)

---

## Prerequisites

1. Spec 001 (AI Quiz Generation from Lecture Notes) is fully implemented and functional.
2. MongoDB running locally or via connection string in `.env`.
3. `OPENAI_API_KEY` set in `.env` with a valid key.
4. `npm install` completed (no new dependencies for this feature).
5. Dev server running: `npm run dev`.
6. At least one instructor user account with a course and a quiz containing Short Answer questions.
7. A sample `.docx` file with extractable lecture text (≥2 pages recommended).

---

## Scenario 1: Generate and Append MCQs (Happy Path)

**Validates**: FR-001, FR-002, FR-003, FR-004, FR-006, FR-008, FR-010, SC-001, SC-002, SC-005, SC-006

### Steps

1. **Log in as instructor**. Navigate to the quiz editor for a quiz that contains Short Answer questions.

2. **Trigger MCQ complement**. Click "Generate MCQs" button. The MCQ complement dialog opens.

3. **Configure generation**.
   - Upload a `.docx` file.
   - Accept the default MCQ count (8) and difficulty distribution (3 Easy / 3 Medium / 2 Hard), or customize.
   - If this is the first upload, acknowledge the AI processing consent banner.

4. **Start generation**. Click "Generate". The UI shows a polling progress indicator.
   - **Expected**: The job is created with `jobType: "mcq_complement"` and `targetQuizId` set. The endpoint returns `202 Accepted` within 600ms.

5. **Wait for completion**. The UI polls every 2 seconds.
   - **Expected**: Job reaches `succeeded` within 45 seconds (p95) for a ≤50-page document.

6. **Review the MCQ draft**. Each draft MCQ shows:
   - Question stem
   - 4 options (A–D)
   - Correct answer letter highlighted
   - 1-sentence justification
   - Difficulty tag (Easy / Medium / Hard)
   - **Expected**: All MCQs have exactly 4 distinct options. The `mcqValidationSummary` in the response shows counts for generated, dropped (ungrounded, invalid, duplicate), and included.

7. **Confirm append**. Click "Append to Quiz".
   - **Expected**: `POST /api/quiz-generation/jobs/[jobId]/append` returns `201 Created` with `appendedCount` and `totalQuestionCount`. The quiz editor refreshes and shows the original SA questions followed by the new MCQs.

8. **Verify quiz integrity**. Open the quiz in the editor.
   - **Expected**: Original Short Answer questions are present, unmodified, and in their original order. New MCQs appear after them. Total question count = original count + appended count.

9. **Student attempt**. Log in as a student, start an attempt on the quiz.
   - **Expected**: The student sees both Short Answer and MCQ questions. MCQs show 4 options. Submitting the attempt auto-grades the MCQs and marks SA responses for grading.

---

## Scenario 2: Edit and Delete Draft MCQs Before Append

**Validates**: FR-007, FR-008, User Story 2

### Steps

1. Complete steps 1–6 from Scenario 1.

2. **Edit an MCQ**. Change one MCQ's stem text and correct answer.
   - **Expected**: `PATCH /api/quiz-generation/jobs/[jobId]/questions/[draftId]` returns `200` with `instructorState: "edited"`.

3. **Delete an MCQ**. Set one MCQ's `instructorState` to `"rejected"`.
   - **Expected**: The rejected MCQ is visually removed from the draft.

4. **Regenerate an MCQ**. Click "Regenerate" on one MCQ.
   - **Expected**: `POST /api/quiz-generation/jobs/[jobId]/regenerate` with `scope: "single"` returns `202`. After polling, the MCQ is replaced with a new one grounded in the source text. All other MCQs are untouched.

5. **Append**. Confirm append.
   - **Expected**: The appended count is `total draft - rejected`. Edited MCQs retain their edits. The regenerated MCQ uses its new content.

---

## Scenario 3: Published Quiz Warning

**Validates**: FR-011, spec edge case "Quiz is published / has active attempts"

### Steps

1. Use a quiz that is published and has at least one student attempt.

2. Generate MCQs and review the draft (steps 1–6 from Scenario 1).

3. **Attempt append without confirmation**.
   - Call `POST /api/quiz-generation/jobs/[jobId]/append` with `{ "confirmPublishedAppend": false }`.
   - **Expected**: Response is `200` with `{ "ok": false, "requiresConfirmation": true, "reason": "...", "existingAttemptCount": N }`.

4. **Confirm append**.
   - Call again with `{ "confirmPublishedAppend": true }`.
   - **Expected**: Response is `201 Created`. New MCQs are appended. Existing student attempts are not retroactively modified.

---

## Scenario 4: Duplicate Detection

**Validates**: FR-009, spec edge case "Duplicate questions across SA and MCQ"

### Steps

1. Use a quiz with 5 Short Answer questions. Upload the same `.docx` that was used to generate those SA questions.

2. Generate MCQs.
   - **Expected**: The `mcqValidationSummary.droppedDuplicate` count is > 0 if any generated MCQ stems overlap with existing SA stems. The draft shows only non-duplicate MCQs.

3. Verify none of the draft MCQs ask the same question as an existing SA question.

---

## Scenario 5: Authorization Enforcement

**Validates**: FR-012, SC-007

### Steps

1. **Student role**. Log in as a student. Attempt to call `POST /api/quiz-generation/jobs` with `targetQuizId` set.
   - **Expected**: `403 Forbidden`.

2. **Non-owner instructor**. Log in as an instructor who does NOT own the target quiz. Attempt the same call.
   - **Expected**: `403 Forbidden` (does not own the quiz).

3. **Unauthenticated**. Call the endpoint without a session.
   - **Expected**: `401 Unauthorized`.

---

## Scenario 6: Quota and Size Enforcement

**Validates**: FR-014

### Steps

1. Set `AdminQuizConfig.dailyQuotaPerInstructor` to 1 (via admin settings).

2. Generate one MCQ complement job successfully.

3. Attempt a second MCQ complement job.
   - **Expected**: `429 Too Many Requests` with `retryAfter` timestamp. The MCQ complement generation counts against the same quota as full quiz generation.

4. Upload a `.docx` that exceeds `AdminQuizConfig.maxDocumentSizeBytes`.
   - **Expected**: `413 Payload Too Large`.

---

## Validation Checklist

| # | Scenario | Key Acceptance Criteria | Status |
|---|----------|------------------------|--------|
| 1 | Happy path | MCQs generated, 4 options each, appended atomically, SA questions preserved | [X] Covered by `tests/integration/mcq-complement.test.js` T014 ("creates an mcq_complement job", "appends approved MCQs atomically and preserves existing questions") — 202 + jobType, 4 options per draft, atomic append, original SA order 0..4 preserved, MCQ order continues at 5,6, total count 7 |
| 2 | Edit/delete/regenerate | Draft editable, rejected MCQs excluded, regeneration replaces single MCQ | [X] Covered by `tests/integration/mcq-complement.test.js` T014 ("excludes rejected drafts from the append", "returns 400 when no approved MCQs remain") and `tests/integration/quiz-regeneration.test.js` for the single-question regeneration flow |
| 3 | Published quiz | Warning shown, confirmation required, past attempts unaffected | [X] Covered by `tests/integration/mcq-complement.test.js` T014 ("published-quiz warning: returns requiresConfirmation, then appends on confirm") — 200 + requiresConfirmation + existingAttemptCount on first call, 201 + appendedCount on confirm |
| 4 | Duplicate detection | Overlapping stems detected and dropped, draft shows only unique MCQs | [X] Covered by `tests/integration/mcq-complement.test.js` T014 ("duplicate detection: drops MCQs whose stems overlap existing SA stems") and T023 ("filterDuplicateStems drops near-duplicate stems at Dice ≥ 0.8 but keeps distinct stems") — exact-match and near-identical dropped, distinct kept |
| 5 | Authorization | Student/non-owner/unauthenticated denied at every endpoint | [X] Covered by `tests/integration/mcq-complement-auth.test.js` T015 — student 403, non-owner instructor 403, unauthenticated 401 on both job creation with targetQuizId and append endpoint |
| 6 | Quota/size | Shared quota enforced, oversized documents rejected | [X] Covered by `tests/integration/quiz-generation.test.js` (shared quota, 429 + retryAfter) and `tests/integration/admin-quiz-config.test.js` (maxDocumentSizeBytes, 413). MCQ complement reuses the same `checkQuota` and size-limit code path verified in `app/api/quiz-generation/jobs/route.js` |

### Automated Validation Run (2026-06-27)

```bash
npx vitest run tests/integration/mcq-complement.test.js tests/integration/mcq-complement-auth.test.js
# Result: Test Files 2 passed (2) | Tests 25 passed (25)
```

Notes:
- Scenarios 1–5 are exercised end-to-end against an in-memory MongoDB with OpenAI and `mammoth` mocked — no external network calls.
- Scenario 6 (quota/size) is shared with spec 001's full-quiz generation path; the MCQ complement endpoint uses the same `checkQuota` and `maxDocumentSizeBytes` checks (see `app/api/quiz-generation/jobs/route.js` lines 184–189 and 222–255), so the existing `quiz-generation.test.js` quota/429 and the `admin-quiz-config.test.js` size-limit tests cover this scenario transitively.
- Manual UI validation (clicking "Generate MCQs" in the browser) is out of scope for the automated suite and should be performed before release per `quickstart.md` Scenario 1 step 1–9.
