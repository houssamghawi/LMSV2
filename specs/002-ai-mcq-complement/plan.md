# Implementation Plan: AI MCQ Complement for Existing Quizzes

**Branch**: `002-ai-mcq-complement` | **Date**: 2026-06-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-ai-mcq-complement/spec.md`

## Summary

Instructors open an existing quiz (typically one containing Short Answer questions) and upload a `.docx` lecture file to generate MCQ-only questions that are appended to the quiz without touching existing questions. Each generated MCQ has exactly 4 options (A–D), a correct-answer letter, a 1-sentence justification from the source text, and a difficulty tag. The instructor reviews, edits, and approves MCQs in a draft view before the backend atomically appends them.

Technical approach: Reuses spec 001's OpenAI GPT-4.1 Structured Outputs pipeline, `mammoth` DOCX extraction, SHA-256 fingerprinting, and async job pattern. Adds an MCQ-specific prompt template with existing-question-stem injection for duplicate avoidance, MCQ structural validation (exactly 4 distinct options, plausible distractors), and an atomic append-to-quiz endpoint. The `GenerationJob` model is extended with `targetQuizId` and a `jobType` discriminator.

## Technical Context

**Language/Version**: JavaScript (ES modules) — Node.js 20+ (Next.js 15 App Router)

**Primary Dependencies**:
- All existing from spec 001: Next.js 15, React 18, Tailwind CSS, shadcn/ui, Mongoose 8.x, NextAuth v5 (beta.25), Zod 3.23, React Hook Form, next-intl 4.x, Sonner (toasts), `openai@^6.33.0`, `mammoth@^1.12.0`
- No new runtime dependencies

**Storage**: MongoDB via Mongoose — extends `GenerationJob` with 2 new fields (`targetQuizId`, `jobType`). No new collections.

**Testing**: Vitest (installed by spec 001). Integration tests against a real test MongoDB for the append flow. Per-role authorization tests for new endpoints.

**Target Platform**: Web application — Next.js running on Node.js (self-hosted or Vercel)

**Performance Goals** (per Constitution Principle IV):
- Write endpoints (start MCQ complement job, append to quiz): ≤600 ms p95
- Read endpoints (poll status): ≤300 ms p95
- AI generation: ≤45 s p95 for MCQ-only from documents up to 50 pages (faster than mixed-type)
- New routes: FCP ≤2.0 s, LCP ≤2.5 s, ≤250 KB gzipped JS per route

**Constraints**:
- Same Server Actions body limit (2 MB) and API Route upload path as spec 001
- No new runtime dependencies — full reuse of spec 001's `openai` and `mammoth`
- Shared daily generation quota with spec 001's full quiz generation
- Append must be atomic (MongoDB transaction) to prevent partial writes

**Scale/Scope**: Default 8 MCQs per complement; typical document ≤30 pages; shared 20 generations/day/instructor quota

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase 0 Evaluation

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality & Maintainability | **PASS** | New MCQ-specific logic in `lib/`, `service/`, `app/api/`. Reuses existing patterns. No business-rule duplication — prompt template is the only truly new service logic. Each new file targets <200 lines. |
| II. Testing Standards | **PASS (commitment)** | MCQ validation (4-option check, duplicate detection), authorization (instructor-only append), and append atomicity are high-risk paths requiring integration tests. Per-role tests for new endpoints. |
| III. User Experience Consistency | **PASS** | MCQ complement UI built from existing shadcn/ui + Tailwind components. Draft review reuses `draft-question-card.jsx` pattern. All strings via `messages/` i18n layer (en + ar). Keyboard-accessible. Responsive 360px–1280px. Sonner toasts for feedback. |
| IV. Performance Requirements | **PASS** | Complement-start endpoint returns within 600ms; MCQ generation runs async via `after()`. Poll endpoint within 300ms (reuses existing). Append uses MongoDB transaction (single round-trip). |
| Additional: Tech Stack Lock | **PASS** | Zero new runtime dependencies. |
| Additional: Secrets Handling | **PASS** | Uses existing `OPENAI_API_KEY`; no new secrets. |
| Additional: Documentation | **PASS (commitment)** | README.md updated with MCQ complement feature. |

### Post-Phase 1 Re-Evaluation

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | **PASS** | Model extends GenerationJob with 2 optional fields — backward-compatible. New MCQ prompt template is a pure function in `lib/`. Append endpoint follows existing route patterns. |
| II. Testing | **PASS** | API contracts define clear boundaries. Append atomicity testable with transaction abort scenarios. Duplicate detection is deterministic and unit-testable. Per-role auth specified for every endpoint. |
| III. UX Consistency | **PASS** | MCQ complement draft view reuses existing `draft-question-card.jsx` layout with MCQ-specific option display. Published-quiz warning uses existing AlertDialog. Count/difficulty config follows existing quiz-generator form pattern. |
| IV. Performance | **PASS** | Append uses a single `insertMany` inside a transaction — O(n) in question count, bounded at ~30. Existing question stem fetch for duplicate detection is a single indexed query. No new indexes needed (existing `{ quizId: 1, type: 1 }` covers it). |

**No unresolved violations. Gate passed.**

## Project Structure

### Documentation (this feature)

```text
specs/002-ai-mcq-complement/
├── plan.md                              # This file
├── spec.md                              # Feature specification
├── research.md                          # Phase 0 research decisions
├── data-model.md                        # Phase 1 data model
├── quickstart.md                        # Phase 1 validation guide
├── contracts/
│   └── mcq-complement-api.md            # Phase 1 API contracts
└── tasks.md                             # Phase 2 (generated by /speckit-tasks)
```

### Source Code (repository root)

```text
lib/
├── mcq-complement-prompt.js             # NEW: MCQ-only system + user prompts with existing-stem injection
├── validations.js                       # MODIFY: add MCQ complement schemas (startMcqComplementSchema, appendMcqsSchema)
└── constants.js                         # MODIFY: add DEFAULT_MCQ_COMPLEMENT_PARAMS, MCQ_OPTIONS_COUNT

service/
├── quiz-generator.js                    # EXISTING: reused as-is — MCQ-only generation is already supported
├── docx-extractor.js                    # EXISTING: reused as-is
├── generation-orchestrator.js           # MODIFY: add runMcqComplementJob() — thin wrapper that fetches existing stems, builds MCQ prompt, calls generateQuizDraft, validates MCQ structure, filters duplicates
└── mcq-validator.js                     # NEW: MCQ structural validation (4 options, distinct options, correct answer in options, plausible distractors check)

model/
└── generation-job-model.js              # MODIFY: add targetQuizId (ObjectId, optional), jobType (enum, optional, default "full_quiz")

queries/
└── quiz-generation.js                   # MODIFY: add getExistingQuestionStems(quizId) for duplicate detection

app/
├── api/
│   └── quiz-generation/
│       ├── jobs/route.js                # MODIFY: accept targetQuizId + jobType="mcq_complement" in POST
│       └── jobs/[jobId]/
│           └── append/route.js          # NEW: POST — append approved MCQs to target quiz (atomic)
├── [locale]/
│   └── dashboard/
│       └── courses/[courseId]/quizzes/
│           └── _components/
│               ├── mcq-complement-trigger.jsx  # NEW: "Generate MCQs" button + config dialog (client)
│               └── mcq-complement-draft.jsx    # NEW: MCQ-specific draft review with append action (client)

messages/
├── en.json                              # MODIFY: add "McqComplement" namespace
└── ar.json                              # MODIFY: add "McqComplement" namespace
```

**Structure Decision**: Follows spec 001's layout exactly — no new top-level directories. New MCQ prompt in `lib/`, MCQ validator in `service/`, append route under the existing `quiz-generation/` API tree. UI components co-located with the existing quiz editor `_components/` folder. The existing `quiz-generator.js` and `generation-orchestrator.js` are extended, not replaced.

## Complexity Tracking

> No Constitution Check violations — this section is intentionally empty.
> Zero new runtime dependencies. All new code extends existing patterns.
