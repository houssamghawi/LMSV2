# Research: Context-Bound AI Tutor

**Feature**: 003-context-bound-ai-tutor  
**Date**: 2026-07-06  
**Status**: Complete

## Overview

This document captures research findings and technical decisions for implementing a context-bound AI tutor in the LMS. The tutor must answer questions strictly from lecture content, never hallucinate, and cite sources directly.

---

## 1. Vector Store Selection

### Decision: ChromaDB (self-hosted)

### Rationale
- **Purpose-built for RAG**: ChromaDB is designed specifically for retrieval-augmented generation workflows
- **Free and open-source**: No licensing costs, aligns with project constraints
- **Simple deployment**: Runs as a Docker container alongside the existing MongoDB container
- **JavaScript/TypeScript support**: Official `chromadb` npm package with good API ergonomics
- **Persistence**: Supports persistent storage for production use

### Alternatives Considered

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| MongoDB Atlas Vector Search | Single database, no new infra | Requires paid M10+ tier; not available on free tier | Rejected: Cost |
| Pinecone | Managed, scalable | Paid service, vendor lock-in | Rejected: Cost |
| pgvector (PostgreSQL) | Good performance | Would require adding PostgreSQL to stack | Rejected: New DB |
| Qdrant | Excellent performance | More complex deployment | Rejected: Complexity |
| In-memory (no vector store) | Simple | No semantic search, only keyword matching | Rejected: Insufficient |

### Implementation Notes
- ChromaDB runs as external infrastructure (Docker), not bundled in Next.js
- Connection via `chromadb` npm package
- Collection per course for isolation and performance
- Embeddings generated via Google Gemini's embedding model (`text-embedding-004`)

---

## 2. Embedding Strategy

### Decision: Per-lesson chunking with overlapping windows

### Rationale
- Lecture content is already scoped to lessons in the LMS
- Chunk size of ~500 tokens with 50-token overlap provides good context without exceeding model limits
- Overlapping prevents losing context at chunk boundaries

### Chunking Parameters
```
CHUNK_SIZE_TOKENS: 500
CHUNK_OVERLAP_TOKENS: 50
MIN_CHUNK_SIZE_TOKENS: 100
```

### Embedding Model
- **Model**: Google Gemini `text-embedding-004`
- **Dimensions**: 768
- **Why**: Already have Gemini API key for quiz generation; consistent provider reduces complexity

---

## 3. Context Retrieval Strategy

### Decision: Top-K semantic search with relevance threshold

### Rationale
- Retrieve top 5 chunks by cosine similarity
- Apply relevance threshold (0.7) to filter low-confidence matches
- If no chunks pass threshold, return out-of-context response

### Parameters
```
TOP_K_CHUNKS: 5
RELEVANCE_THRESHOLD: 0.7
MAX_CONTEXT_TOKENS: 2000
```

### Context Assembly
1. Query embedding generated from student question
2. Semantic search against lesson's chunk collection
3. Filter chunks below relevance threshold
4. Concatenate remaining chunks (up to token limit)
5. If empty after filtering → out-of-context response

---

## 4. AI Response Generation

### Decision: Gemini with strict system prompt

### Rationale
- Reuse existing `@google/genai` integration from quiz generation
- System prompt enforces context-bound behavior
- Response format includes mandatory citation field

### Model Selection
- **Primary**: `gemini-2.0-flash` (fast, cost-effective)
- **Fallback**: `gemini-1.5-flash` (if primary unavailable)

### System Prompt Strategy
The system prompt must:
1. Explicitly forbid using external knowledge
2. Require direct textual citations from provided context
3. Specify exact out-of-context response format
4. Enforce formal academic tone
5. Match response language to question language

### Response Schema (JSON mode)
```json
{
  "answer": "string",
  "citation": "string | null",
  "isWithinContext": "boolean",
  "detectedLanguage": "ar | en"
}
```

---

## 5. Language Detection

### Decision: Simple heuristic + Gemini fallback

### Rationale
- Arabic script detection is reliable via Unicode range check
- Most questions will be clearly Arabic or English
- Edge cases (mixed, transliterated) handled by Gemini's language understanding

### Implementation
```javascript
function detectLanguage(text) {
  const arabicPattern = /[\u0600-\u06FF]/;
  const arabicChars = (text.match(arabicPattern) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  
  if (arabicChars / totalChars > 0.3) return 'ar';
  return 'en';
}
```

---

## 6. Data Retention & Cleanup

### Decision: Scheduled cleanup job with course completion tracking

### Rationale
- Spec requires: course duration + 1 year post-completion, then auto-delete
- Need to track course completion status per enrollment
- Background job runs daily to identify and delete expired interactions

### Implementation Approach
1. `TutorInteraction` stores `courseId` and `createdAt`
2. Query joins with `Enrollment` to find course completion date
3. Delete interactions where `completedAt + 1 year < now()`
4. Use MongoDB TTL index as secondary safeguard (set to 2 years max)

---

## 7. Citation Format

### Decision: Inline quote with lesson reference

### Rationale
- Students need to see the exact source text
- Lesson reference helps them navigate back to original material
- Format consistent with academic citation practices

### Format
```
"[quoted text from lecture]"
— Lesson: [Lesson Title]
```

### Example
```
"Photosynthesis occurs in the chloroplasts of plant cells."
— Lesson: Introduction to Cell Biology
```

---

## 8. Error Handling Strategy

### Decision: Graceful degradation with user-friendly messages

### Scenarios & Responses

| Scenario | User Message | Logged Error |
|----------|--------------|--------------|
| ChromaDB unavailable | "AI tutor is temporarily unavailable. Please try again later." | `VECTOR_STORE_ERROR` |
| Gemini API failure | "AI tutor is temporarily unavailable. Please try again later." | `AI_SERVICE_ERROR` |
| Rate limit exceeded | "Too many requests. Please wait a moment before asking again." | `RATE_LIMIT_EXCEEDED` |
| Empty lecture content | "AI tutor unavailable—no lecture content uploaded." | (Not logged as error) |
| Question too long | "Your question is too long. Please keep it under 1000 characters." | (Not logged as error) |

---

## 9. Security Considerations

### Prompt Injection Mitigation
- User question is clearly delimited in system prompt
- Context chunks are marked as "LECTURE CONTENT" separate from instructions
- Response validation ensures citation matches provided context

### Data Access Control
- Students can only query lessons in courses they're enrolled in
- Students can only view their own interaction history
- Instructors can view all interactions for their courses
- Admins can configure system-wide settings

### Rate Limiting
- Leverage existing LMS rate limiting infrastructure
- Additional per-student limit: 20 questions per hour per course

---

## 10. Performance Optimization

### Embedding Caching
- Lecture chunks embedded once on upload/update
- Stored in ChromaDB with lesson metadata
- Re-embedded only when lecture content changes

### Response Streaming
- Use Gemini's streaming API to show response progressively
- Reduces perceived latency from 5s to <1s first token

### Database Indexing
```javascript
// TutorInteraction indexes
{ lessonId: 1, studentId: 1, createdAt: -1 }  // Student history lookup
{ courseId: 1, contextStatus: 1, createdAt: -1 }  // Instructor filtering
{ createdAt: 1 }  // TTL cleanup
```

---

## Summary of Decisions

| Area | Decision |
|------|----------|
| Vector Store | ChromaDB (self-hosted Docker) |
| Embedding Model | Gemini text-embedding-004 (768 dims) |
| Chunk Size | 500 tokens, 50 overlap |
| Retrieval | Top-5, 0.7 relevance threshold |
| Generation Model | Gemini 2.0 Flash |
| Language Detection | Unicode heuristic + Gemini fallback |
| Data Retention | Course + 1 year, daily cleanup job |
| Citation Format | Inline quote with lesson reference |
| Rate Limit | 20 questions/hour/course/student |

---

## Open Questions (Resolved)

All research questions have been resolved. No NEEDS CLARIFICATION items remain.
