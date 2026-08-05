# Context-Bound AI Tutor

Feature specification: [`specs/003-context-bound-ai-tutor/spec.md`](../specs/003-context-bound-ai-tutor/spec.md)

The AI tutor answers student questions using **only** indexed lecture content for the current lesson. Answers include direct citations when found in the material; otherwise the tutor returns a configurable out-of-context message. It never uses external knowledge or guesses.

## Architecture

```text
Student UI (lesson page)
    │
    ▼
POST /api/tutor/ask
    │
    ├── Enrollment + rate-limit checks
    ├── Embed question (Gemini text-embedding-004)
    ├── Query ChromaDB (course collection, lesson filter)
    ├── Generate answer (Gemini, JSON schema)
    └── Log TutorInteraction (MongoDB)
```

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Models | `model/tutor-*-model.js` | Interactions, config, chunks, reports |
| Services | `service/ai-tutor.js`, `service/lecture-embedder.js`, `service/vector-store.js` | RAG pipeline, embedding sync, ChromaDB |
| Queries | `queries/tutor-interactions.js` | CRUD, history, config resolution |
| API | `app/api/tutor/*` | Ask, history, feedback, config, report |
| UI | `app/[locale]/(main)/courses/.../ai-tutor-panel.jsx` | Student chat panel |
| Admin | `app/[locale]/admin/tutor-settings/` | Global tutor configuration |
| Instructor | `app/[locale]/dashboard/courses/[courseId]/tutor-analytics/` | Interaction logs |

## Prerequisites

1. **MongoDB** — same instance as the rest of the LMS
2. **ChromaDB** — vector store for lecture chunk embeddings
3. **Gemini API key** — answer generation and embeddings

```bash
# Start ChromaDB
docker run -d --name chromadb -p 8000:8000 chromadb/chroma:latest

# Verify
curl http://localhost:8000/api/v1/heartbeat
```

### Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `GEMINI_API_KEY` | Yes (when tutor is used) | — | Generation + embeddings |
| `CHROMA_URL` | Yes (when tutor is used) | `http://localhost:8000` | ChromaDB HTTP endpoint |
| `GEMINI_TUTOR_MODEL` | No | `gemini-2.0-flash` | Preferred tutor model |
| `MONGODB_URI` | Yes | — | Interaction logs and config |

See `.env.example` for the full list.

## Setup

### 1. Seed global tutor configuration

Creates the institution-wide default config (out-of-context messages, rate limits, retrieval settings):

```bash
npm run seed-tutor-config
```

Use `--force` to upsert defaults over an existing global config.

### 2. Index lecture content

Lessons must have a description (rich text) and be embedded before the tutor is enabled for students:

```bash
npm run embed-lesson -- --lessonId=<mongo_lesson_id> [--courseId=<mongo_course_id>]
```

Embedding runs automatically when instructors save lesson descriptions in the dashboard; the CLI is for manual re-indexing or troubleshooting.

### 3. Verify

Run the automated tutor test suite (covers quickstart scenarios):

```bash
npm test -- tests/integration/tutor-
```

Manual validation steps: [`specs/003-context-bound-ai-tutor/quickstart.md`](../specs/003-context-bound-ai-tutor/quickstart.md)

## API endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/tutor/ask` | Enrolled student | Submit a question |
| `GET` | `/api/tutor/history` | Student (own) / Instructor (course) / Admin | Paginated interaction log |
| `POST` | `/api/tutor/feedback` | Interaction owner | Thumbs up/down |
| `POST` | `/api/tutor/report` | Interaction owner | Report incorrect/inappropriate response |
| `GET` | `/api/tutor/config` | Admin | Read configuration |
| `PUT` | `/api/tutor/config` | Admin | Update configuration |

Full contract: [`specs/003-context-bound-ai-tutor/contracts/ai-tutor-api.md`](../specs/003-context-bound-ai-tutor/contracts/ai-tutor-api.md)

## User roles

| Role | Capabilities |
|------|--------------|
| **Student** | Ask questions on enrolled lesson pages, view own history, feedback, report issues |
| **Instructor** | View all interactions for owned courses, filter by status/lesson/date |
| **Admin** | Configure global tutor settings (messages, rate limits, relevance threshold) |

## Error handling

| Scenario | User message | Log code |
|----------|--------------|----------|
| ChromaDB down | AI tutor temporarily unavailable | `VECTOR_STORE_ERROR` |
| Gemini failure | AI tutor temporarily unavailable | `AI_SERVICE_ERROR` |
| No lecture content | AI tutor unavailable—no lecture content uploaded | — |
| Question > 1000 chars | Your question is too long… | — |
| Rate limit | Too many requests… | `RATE_LIMIT_EXCEEDED` |

## Performance

Success criterion **SC-001** requires responses within **5 seconds** under normal load. The service records `metadata.responseTimeMs` on each interaction for monitoring. Integration tests assert this budget with mocked external services.

## Troubleshooting

### ChromaDB connection failed

```bash
docker ps | grep chromadb
docker logs chromadb
docker restart chromadb
```

### Embeddings not created

```bash
# Check chunk metadata in MongoDB
db.lecturechunks.countDocuments({ lessonId: ObjectId("<lesson_id>") })

# Re-embed manually
npm run embed-lesson -- --lessonId=<lesson_id>
```

### Gemini API errors

Verify the API key and model availability in Google AI Studio. Check server logs for `AI_SERVICE_ERROR`.

## Related documentation

- [Quickstart validation scenarios](../specs/003-context-bound-ai-tutor/quickstart.md)
- [Data model](../specs/003-context-bound-ai-tutor/data-model.md)
- [Implementation plan](../specs/003-context-bound-ai-tutor/plan.md)
