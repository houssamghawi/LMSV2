# Quickstart Validation Guide: AI Quiz Generation from Lecture Notes

**Date**: 2026-06-26 | **Spec**: [spec.md](./spec.md) | **Contracts**: [contracts/quiz-generation-api.md](./contracts/quiz-generation-api.md) | **Data Model**: [data-model.md](./data-model.md)

---

## Prerequisites

1. **Running LMS instance** with `npm run dev` and MongoDB connected
2. **OpenAI API key** in `.env`:
   ```
   OPENAI_API_KEY=sk-...
   OPENAI_QUIZ_MODEL=gpt-4.1
   ```
3. **New dependencies installed**: `npm install openai mammoth`
4. **Seed data**: at least one instructor user, one course owned by that instructor, and one lesson in the course
5. **Sample `.docx` file**: a lecture document with ≥5 paragraphs of substantive text (for meaningful question generation)
6. **Admin user**: for admin-specific validation scenarios

---

## Scenario 1: End-to-End Quiz Generation (P1 Core Flow)

**Goal**: Instructor uploads a `.docx`, system generates a quiz draft, instructor saves it.

### Steps

1. **Log in** as an instructor who owns a course with at least one lesson
2. **Navigate** to the course's quiz section (e.g., `/dashboard/courses/{courseId}/quizzes`)
3. **Consent banner**: On first use, a consent banner appears stating text will be sent to a third-party AI provider. Click "I understand" to acknowledge
4. **Click "Generate from document"** (or equivalent entry point on the lesson editor)
5. **Upload** a sample `.docx` lecture file (≤10 MB)
6. **Configure mix** (or accept defaults: 5 MCQ, 3 True/False, 2 Short Answer, difficulty 4/4/2)
7. **Click "Generate"** — the POST to `/api/quiz-generation/jobs` should return `202` with a `jobId`
8. **Observe polling** — the UI should show a progress/loading state, polling `GET /api/quiz-generation/jobs/{jobId}` every 2 seconds
9. **Draft appears** — within 60 seconds, the draft should render with 10 questions, each showing:
   - Question text, type badge, difficulty tag
   - Options (for MCQ/TF) or model answer field (for Short Answer)
   - Correct answer indicator
   - Explanation text
   - Verbatim source quote (≤30 words)
10. **Click "Save as quiz"** — configure quiz title, pass percentage, etc.
11. **Verify**: quiz appears in the course's quiz list, marked "AI-generated", status unpublished

### Expected Results

- [ ] Consent banner shown on first use, not on subsequent uses
- [ ] Generation completes within 60 seconds for a ≤30-page document
- [ ] All 10 questions have type, difficulty, answer, explanation, and source quote
- [ ] Source quotes are ≤30 words and appear verbatim in the uploaded document
- [ ] Saved quiz is unpublished by default
- [ ] Quiz is marked "AI-generated" in the instructor's quiz list

---

## Scenario 2: Edit, Delete, and Regenerate Draft Questions (P2)

**Goal**: Instructor modifies the generated draft before saving.

### Steps

1. Starting from a completed draft (Scenario 1, step 9)
2. **Edit** one question's text and options → verify the change persists (PATCH endpoint)
3. **Delete** one question → verify it's removed from the draft
4. **Regenerate single question** → click "Regenerate" on one question → verify only that question changes, others are untouched
5. **Change mix** (e.g., 8 MCQ, 0 TF, 2 SA) and **regenerate all** → confirm the new draft matches the requested mix
6. **Save** the modified draft

### Expected Results

- [ ] Edited questions show `instructorState: "edited"`
- [ ] Deleted questions are excluded from the saved quiz
- [ ] Single-question regeneration doesn't affect other questions
- [ ] Full regeneration replaces the entire draft (with confirmation prompt)
- [ ] Saved quiz reflects the post-edit state exactly

---

## Scenario 3: Short Answer Grading Flow (P1 — SA Subsystem)

**Goal**: Student submits a quiz with SA questions; instructor grades them; score finalizes.

### Steps

1. **Publish** a generated quiz that contains at least 2 Short Answer questions
2. **Log in as a student** enrolled in the course
3. **Take the quiz**: answer all MCQ/TF questions and type responses for the Short Answer questions
4. **Submit the attempt**
5. **Verify student view**: result page shows "Result pending — awaiting instructor grading"; auto-graded MCQ/TF scores are visible but overall score is not finalized
6. **Log in as the instructor**
7. **Navigate** to the quiz's "Needs grading" queue → verify the submitted attempt appears with pending count
8. **Grade one SA response**: view student's text response alongside the model answer and source quote; award points (0 to max); add an optional comment; save
9. **Verify**: pending count decrements; attempt is still `pending_grading`
10. **Close browser tab and reopen** → verify the first grade persisted (per-response autosave)
11. **Grade remaining SA response(s)**
12. **Verify auto-finalization**: attempt status becomes `submitted`; overall score, percentage, and pass/fail are computed; `finalizedAt` and `finalizedBy` are set
13. **Log in as student**: result page now shows finalized score; "Result pending" badge is gone; model answers/explanations are revealed per `showAnswersPolicy`

### Expected Results

- [ ] Auto-graded questions scored immediately at submit time
- [ ] Attempt enters `pending_grading` (not `submitted`) when SA questions exist
- [ ] Student sees "Result pending" state — no finalized score, no SA model answers
- [ ] Instructor sees pending attempt in "Needs grading" queue with count badge
- [ ] Per-response autosave works (survives tab close)
- [ ] Auto-finalization triggers when last SA response is graded
- [ ] Student sees finalized score and model answers after all grading is complete

---

## Scenario 4: Authorization and Role Boundaries (P1)

**Goal**: Verify students cannot access generation; instructors cannot access other instructors' quizzes.

### Steps

1. **As student**: attempt to hit `POST /api/quiz-generation/jobs` directly → expect `403`
2. **As student**: navigate to any generation-related UI URL → expect no visible controls or redirect
3. **As instructor B**: attempt to hit `GET /api/quiz-generation/jobs/{jobIdOwnedByInstructorA}` → expect `403`
4. **As instructor B**: attempt to grade a SA response on instructor A's quiz → expect `{ ok: false, error: "..." }`
5. **As admin**: verify access to all jobs, all grading queues, admin quiz config

### Expected Results

- [ ] Students get `403` on every generation endpoint
- [ ] Instructors cannot access other instructors' jobs or grade their quizzes
- [ ] Admins can access everything

---

## Scenario 5: Admin Quotas and Audit (P3)

**Goal**: Admin configures limits; instructor hits quota; audit trail works.

### Steps

1. **Log in as admin**
2. **Navigate** to admin quiz settings → set daily quota to 2 generations per instructor
3. **Log in as instructor** → generate quiz (1/2)
4. **Generate again** (2/2) → succeeds
5. **Generate a third time** → expect `429` with message naming the limit and reset time
6. **Log in as admin** → open admin quiz view → filter to "AI-generated" → verify all 3 attempts (2 succeeded, 1 quota-blocked) appear in the audit log with source document filename, content hash, parameters, and AI model

### Expected Results

- [ ] Quota enforcement works server-side (not just UI-hidden)
- [ ] Blocked attempt logged in audit with reason
- [ ] Audit records include all FR-013 fields
- [ ] Admin can see AI-generated filter on quiz list

---

## Scenario 6: Edge Cases

### 6a. Empty/image-only document
- Upload a `.docx` containing only images → expect rejection before AI call with clear error message

### 6b. Oversized document
- Upload a `.docx` exceeding the configured max size → expect `413` error with limit named

### 6c. Duplicate document
- Upload the same `.docx` to the same course again → expect prompt showing the prior generation with option to re-run or use existing

### 6d. AI provider failure
- (Simulate by using an invalid API key or model name) → expect specific error message, no partial draft, quota not consumed

### 6e. Navigate away mid-generation
- Start generation → navigate away → return to the quiz page → expect completed (or failed) draft to be available without re-uploading

### 6f. Student re-attempt while pending grading
- Student completes attempt #1 (goes to pending_grading) → student starts attempt #2 → verify both are independent; maxAttempts is respected

---

## Validation Checklist Summary

- [ ] All 6 scenarios pass
- [ ] All edge cases (6a–6f) handled correctly
- [ ] No hardcoded English strings in new UI (i18n verified in both `en` and `ar` locales)
- [ ] Responsive layout verified at 360px and 1280px width
- [ ] Keyboard navigation works on upload, draft review, and grading forms
- [ ] `npm run lint` passes with zero new warnings
