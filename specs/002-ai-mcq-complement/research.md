# Research: AI MCQ Complement for Existing Quizzes

**Date**: 2026-06-27 | **Spec**: [spec.md](./spec.md)

---

## 1. MCQ-Specific Prompt Strategy

**Decision**: Create a dedicated MCQ-only prompt template (`lib/mcq-complement-prompt.js`) that reuses the same `buildQuizGenerationMessages()` interface but injects MCQ-specific constraints and existing question stems for duplicate avoidance.

**Rationale**:
- Spec 001's `lib/quiz-generation-prompt.js` generates mixed-type quizzes. Passing `trueFalseCount=0, shortAnswerCount=0` works structurally but the system prompt still describes all three question types, wasting tokens and diluting MCQ-specific quality instructions.
- A dedicated prompt can enforce spec 002's stricter MCQ requirements: exactly 4 options labeled A–D, plausible distractors that test comprehension (not absurd fillers), correct-answer letter, and 1-sentence justification.
- The prompt accepts an `existingStems` parameter — an array of question text strings already on the target quiz — and instructs the model to avoid generating questions that overlap with them. This is the first layer of duplicate prevention (the second is post-generation filtering in the validator).
- The prompt keeps the same `zodResponseFormat()` schema integration as spec 001 — the existing `generatedQuestionSchema` and `quizGenerationResponseSchema` in `service/quiz-generator.js` already support MCQ-only output.

**Alternatives considered**:
- **Reuse spec 001's prompt as-is**: Works mechanically (`mcqCount=8, trueFalseCount=0, shortAnswerCount=0`) but doesn't include MCQ-specific distractor quality instructions or duplicate-avoidance context. Risks lower acceptance rate (SC-003 target: 85%).
- **Parameterize the existing prompt with optional sections**: Viable but makes the prompt harder to read and test. Two focused prompt templates (one mixed, one MCQ-only) are clearer than one prompt with conditional blocks.

**New file**: `lib/mcq-complement-prompt.js` — exports `buildMcqComplementMessages(extractedText, params, existingStems)`.

---

## 2. Duplicate Detection Between MCQs and Existing Questions

**Decision**: Two-layer duplicate detection — prompt-level avoidance + post-generation normalized string comparison.

**Rationale**:
- **Layer 1 (prompt)**: The MCQ complement prompt includes existing question stems in the system prompt with an explicit instruction: "Do not generate questions that ask the same thing as these existing questions." This prevents most duplicates at generation time.
- **Layer 2 (post-generation filter)**: After generation, compare each new MCQ stem against existing stems using normalized string similarity. Normalization: lowercase, strip punctuation, collapse whitespace. A new MCQ is flagged as a duplicate if its normalized stem has ≥80% character overlap (Dice coefficient) with any existing stem.
- Dice coefficient is simple to implement (no new dependencies), deterministic, and handles minor rephrasing (e.g., "What is the primary function of X?" vs "What is the main function of X?"). It avoids the complexity of embedding-based semantic similarity.
- Flagged duplicates are dropped before the draft is shown to the instructor. The draft summary notes how many duplicates were removed.

**Alternatives considered**:
- **Exact string match only**: Too strict — the AI frequently rephrases slightly. Would miss obvious duplicates.
- **Embedding-based semantic similarity (OpenAI embeddings API)**: Accurate but adds latency (extra API call), cost, and complexity. Overkill for v1 where the typical quiz has 5–15 existing questions. The Dice coefficient on normalized stems catches 90%+ of practical duplicates.
- **Levenshtein distance**: Penalizes length differences disproportionately; Dice coefficient is better for partial-overlap detection in natural language strings.

**Implementation**: `service/mcq-validator.js` exports `filterDuplicateStems(newQuestions, existingStems)`.

---

## 3. MCQ Structural Validation

**Decision**: A dedicated validation pass (`service/mcq-validator.js`) runs after generation and before the draft is shown. It enforces MCQ structural rules that go beyond the existing `filterUngroundedQuestions()` in spec 001.

**Validation rules**:
1. Exactly 4 options per question — not 3, not 5.
2. All 4 option texts are distinct (case-insensitive, whitespace-normalized). If two or more are near-identical (Dice coefficient ≥0.9), the question is dropped.
3. Correct-answer letter (`correctOptionIds[0]`) maps to one of the 4 option IDs.
4. Justification is present and ≤2 sentences.
5. Existing `filterUngroundedQuestions()` still runs (sourceQuote check) — MCQ validator runs after it.

**Questions failing any rule are silently dropped and the shortfall is noted in the draft summary.**

**Rationale**: The AI occasionally returns 3 or 5 options, duplicates an option, or maps the correct answer to a non-existent option ID. Post-generation validation catches these without retrying the full AI call (which would be slow and consume tokens).

**New file**: `service/mcq-validator.js` — pure functions, no I/O.

---

## 4. Append-to-Quiz Architecture

**Decision**: New API endpoint `POST /api/quiz-generation/jobs/[jobId]/append` that atomically inserts approved MCQs into the target quiz using a MongoDB transaction.

**Rationale**:
- Spec 001's save endpoint (`POST /api/quiz-generation/jobs/[jobId]/save`) creates a **new** Quiz document. Spec 002 needs to **add questions to an existing quiz**. These are fundamentally different operations with different authorization checks (spec 001: instructor + course ownership; spec 002: instructor + quiz ownership + published-quiz warning).
- A separate endpoint is cleaner than branching inside the existing save endpoint. It also makes per-endpoint authorization tests straightforward (Constitution Principle II).
- The append operation:
  1. Loads the target quiz and its current question count.
  2. Validates the quiz exists, the instructor owns it, and the job's `targetQuizId` matches.
  3. If the quiz is published and has attempts, returns a warning payload requiring client confirmation.
  4. Filters draft questions: include only those with `instructorState !== "rejected"`.
  5. Assigns `order` starting from `existingQuestionCount` (so new MCQs appear after existing questions).
  6. Inserts Question documents in a MongoDB transaction.
  7. Returns the count of appended questions and the updated total.

**Key difference from save**: No Quiz document is created. The existing Quiz document is not modified (no fields change). Only new Question documents are inserted with the existing quiz's `_id` as their `quizId`.

**Alternatives considered**:
- **Extend the save endpoint with a `mode: "append"` flag**: Works but violates single-responsibility — save-as-new-quiz and append-to-existing-quiz have different authorization, validation, and response shapes. Testing is cleaner with separate endpoints.
- **Server Action instead of API Route**: The file upload still goes through the existing POST /api/quiz-generation/jobs route (spec 001). The append itself doesn't involve file upload, so a Server Action is technically possible. However, keeping it as an API Route maintains consistency with the rest of the quiz-generation API tree and keeps authorization testing uniform.

**New file**: `app/api/quiz-generation/jobs/[jobId]/append/route.js`.

---

## 5. Job Creation Flow Extension

**Decision**: Extend the existing `POST /api/quiz-generation/jobs` endpoint to accept an optional `targetQuizId` and `jobType` field. When `jobType === "mcq_complement"`, the route validates quiz ownership, enforces MCQ-only params (`trueFalseCount=0, shortAnswerCount=0`), and passes the target quiz context to the orchestrator.

**Rationale**:
- Reusing the same job creation endpoint avoids duplicating consent checks, quota enforcement, file upload handling, and text extraction. These are identical for both job types.
- The `jobType` discriminator (`"full_quiz"` | `"mcq_complement"`) lets the orchestrator branch to the MCQ-specific prompt and validation pipeline.
- The `targetQuizId` is stored on the GenerationJob for audit and for the append endpoint to verify consistency.

**Alternatives considered**:
- **Separate POST endpoint for MCQ complement jobs**: Duplicates ~80% of the existing job creation logic (auth, consent, quota, extraction, hashing). Violates DRY.
- **Client sends MCQ params to the existing endpoint without a jobType flag**: Works but the orchestrator can't distinguish intent, and the audit log can't differentiate full-quiz from MCQ-complement generations.

---

## Summary

| Area | Decision | New files | Modified files |
|------|----------|-----------|----------------|
| MCQ prompt | Dedicated MCQ-only template with existing-stem injection | `lib/mcq-complement-prompt.js` | — |
| Duplicate detection | Prompt-level avoidance + Dice coefficient post-filter | `service/mcq-validator.js` | — |
| MCQ validation | 4-option check, distinct options, correct-answer mapping | `service/mcq-validator.js` (same file) | — |
| Append architecture | New append endpoint, atomic insert | `app/api/quiz-generation/jobs/[jobId]/append/route.js` | — |
| Job creation | Extend existing POST with targetQuizId + jobType | — | `app/api/quiz-generation/jobs/route.js`, `model/generation-job-model.js` |
| Orchestrator | MCQ complement job runner | — | `service/generation-orchestrator.js` |

**Total new runtime dependencies**: 0. All new logic uses existing project packages and Node.js built-ins.
