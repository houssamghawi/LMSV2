# Implementation Plan: Context-Bound AI Tutor

**Branch**: `003-context-bound-ai-tutor` | **Date**: 2026-07-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-context-bound-ai-tutor/spec.md`

## Summary

Build a strict, context-bound AI tutor that answers student questions using ONLY verified lecture content. The system retrieves relevant content chunks via semantic search, constrains the AI to cite sources directly, and returns a standardized message when answers are not found in the context. Uses existing Google Gemini integration pattern with a new vector store (ChromaDB) for semantic retrieval.

## Technical Context

**Language/Version**: TypeScript/JavaScript (Node.js 18+), Next.js 15 App Router

**Primary Dependencies**: 
- `@google/genai` (existing) - AI response generation
- `chromadb` (new) - Vector store for semantic search
- `mongoose` (existing) - MongoDB ODM for interaction logging
- `zod` (existing) - Input validation

**Storage**: 
- MongoDB (existing) - TutorInteraction logs, TutorConfiguration
- ChromaDB (new) - LectureChunk embeddings for semantic retrieval

**Testing**: Vitest (existing) with mongodb-memory-server for integration tests

**Target Platform**: Web (Next.js server + client)

**Project Type**: Web service feature (extension of existing LMS)

**Performance Goals**: 
- Response time ≤ 5 seconds (spec SC-001)
- Note: Constitution requires ≤300ms for reads, but AI generation is inherently slower; will stream response to show progress within budget

**Constraints**: 
- 100% citation accuracy or out-of-context response (spec SC-002)
- Language detection accuracy ≥95% for Arabic/English (spec SC-003)
- Data retention: course duration + 1 year (spec FR-011)

**Scale/Scope**: 
- Per-lesson context scoping
- Supports Arabic and English initially
- Paginated interaction logs for instructors

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Code Quality & Maintainability** | ✅ PASS | Service logic in `service/ai-tutor.js`, queries in `queries/`, models in `model/`. Zod schemas at boundaries. |
| **II. Testing Standards** | ✅ PASS | Integration tests for API routes with real MongoDB. Authorization tests for student/instructor/admin access. |
| **III. User Experience Consistency** | ✅ PASS | UI built with shadcn/ui components. All strings via i18n. Shared loading/error/empty states. |
| **IV. Performance Requirements** | ⚠️ JUSTIFIED | AI response exceeds 300ms read budget—justified because LLM inference is inherently slow. Mitigation: streaming responses, skeleton UI. Constitution allows justified exceptions. |
| **Tech Stack Lock** | ⚠️ REVIEW | ChromaDB is a new runtime dependency. Decision: Run as external service (not bundled in Next.js), so it's infrastructure rather than a code dependency requiring amendment. Document in README. |

**Post-Phase-1 Re-check**: All gates remain satisfied. ChromaDB treated as external infrastructure (like MongoDB), not a new code dependency.

## Project Structure

### Documentation (this feature)

```text
specs/003-context-bound-ai-tutor/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── ai-tutor-api.md
└── tasks.md             # Phase 2 output (created by /speckit-tasks)
```

### Source Code (repository root)

```text
model/
├── tutor-interaction-model.js    # NEW: Q&A exchange logs
├── tutor-config-model.js         # NEW: Admin configuration
└── lecture-chunk-model.js        # NEW: Metadata for vector chunks

service/
├── ai-tutor.js                   # NEW: Core tutor logic (RAG + generation)
├── lecture-embedder.js           # NEW: Chunk and embed lecture content
└── vector-store.js               # NEW: ChromaDB client wrapper

queries/
└── tutor-interactions.js         # NEW: Interaction log queries

lib/
├── ai-tutor-prompt.js            # NEW: System prompt for context-bound behavior
└── language-detector.js          # NEW: Arabic/English detection

app/
├── api/
│   └── tutor/
│       ├── ask/route.js          # NEW: POST /api/tutor/ask
│       ├── history/route.js      # NEW: GET /api/tutor/history
│       └── config/route.js       # NEW: GET/PUT /api/tutor/config (admin)
└── [locale]/
    └── dashboard/
        └── courses/
            └── [courseId]/
                └── lessons/
                    └── [lessonId]/
                        └── _components/
                            └── ai-tutor-panel.jsx  # NEW: Chat UI component

components/
└── ui/
    └── chat-message.jsx          # NEW: Reusable chat bubble component

messages/
├── en.json                       # UPDATE: Add tutor-related strings
└── ar.json                       # UPDATE: Add tutor-related strings

tests/
├── integration/
│   └── tutor-api.test.js         # NEW: API integration tests
└── unit/
    ├── ai-tutor.test.js          # NEW: Service unit tests
    └── language-detector.test.js # NEW: Language detection tests
```

**Structure Decision**: Feature integrates into existing LMS structure following established patterns. New models in `model/`, services in `service/`, API routes in `app/api/tutor/`, UI in lesson page components.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| ChromaDB external dependency | Semantic search requires vector embeddings; MongoDB text search insufficient for "meaning-based" retrieval | MongoDB Atlas Vector Search requires paid tier; ChromaDB is free, self-hosted, and purpose-built for RAG |
| 5-second response time vs 300ms budget | LLM inference latency is inherent to AI features | Pre-computed answers would miss the dynamic Q&A requirement; streaming mitigates perceived latency |
