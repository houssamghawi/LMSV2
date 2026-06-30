# Research: AI Quiz Generation from Lecture Notes (.docx)

**Date**: 2026-06-26 | **Spec**: [spec.md](./spec.md)

---

## 1. AI Provider for Quiz Generation

**Decision**: OpenAI GPT-4.1 via the `openai` Node SDK, using Structured Outputs (`response_format: json_schema` with `strict: true`) and `zodResponseFormat()` for direct Zod-schema integration.

**Rationale**:
- Native constrained decoding guarantees well-formed JSON matching the quiz schema — critical for FR-011 (no malformed responses) and FR-004/FR-005 (structured per-question output with source quotes).
- `zodResponseFormat()` integrates directly with the project's locked Zod 3.23.8 — no schema translation layer.
- Cost: ~$0.05–$0.10 per 10-question generation from a ≤30-page lecture ($2.00/1M input, $8.00/1M output). Well within the 20/day quota at ~$2/instructor/day worst case.
- 1M-token context window covers ≤50-page documents without chunking.
- Mature Node SDK; works in Next.js API Route Handlers and `after()` callbacks.

**Alternatives considered**:
- **Anthropic Claude Sonnet 4.x**: Strong document understanding, but structured output relies on forced `tool_use` rather than native strict JSON Schema. Higher cost ($3/$15), more retry logic at Zod boundaries. Good second choice.
- **Google Gemini 2.5 Pro**: Competitive pricing but `response_json_schema` supports only a JSON Schema subset — nested quiz schemas with enums and arrays need careful testing. Higher risk of schema-validation failures.
- **Vercel AI SDK**: Designed for streaming chat UX, not one-shot batch JSON generation. Adds abstraction without solving the core strict-schema + async-job need.

**New dependency**: `openai@^6.33.0`
**New env var**: `OPENAI_API_KEY`, optional `OPENAI_QUIZ_MODEL` (defaults to `gpt-4.1`)

---

## 2. DOCX Text Extraction

**Decision**: `mammoth` — use `mammoth.extractRawText({ buffer })` for plain-text extraction from uploaded `.docx` files.

**Rationale**:
- Extracts paragraphs, headings, list items, and table cell text — exactly what FR-002 requires.
- Accepts `{ buffer }` directly from an uploaded file; no native bindings or subprocess.
- Empty/image-only/scanned DOCX → empty string → triggers the spec's refusal path (FR-002).
- Corrupt/password-protected files → catchable error.
- ~5.6M weekly downloads, actively maintained (1.12.0, March 2026), BSD-2-Clause, minimal dependencies.
- Does not extract headers/footers — acceptable since FR-002 doesn't require them and lecture notes rarely put assessable content there.
- `result.messages` contains warnings about unsupported elements (equations, footnotes) that can be surfaced as non-blocking notices per the spec's edge cases.

**Alternatives considered**:
- **`docx4js`**: Low maintenance, complex OOXML API for rendering/inspection, poor DX for text extraction.
- **`officegen`**: Write-only (generates DOCX). Cannot read files.
- **`officeparser`**: Powerful AST + multi-format, but heavier than v1 needs. Over-engineering.
- **`word-extractor`**: Viable but less widely adopted; spec doesn't need its header/footer support.

**New dependency**: `mammoth@^1.12.0`

---

## 3. Content Hashing for Document Fingerprinting

**Decision**: SHA-256 via Node.js built-in `node:crypto` — no new dependency.

**Rationale**:
- Purpose is deduplication + audit fingerprint (FR-013, duplicate-upload edge case), not high-throughput caching.
- SHA-256 is collision-resistant, deterministic, and auditable.
- Hash the **extracted text** (not raw `.docx` bytes) after normalization (NFKC, whitespace collapse, lowercase) to prevent false negatives from Word re-saves.
- Zero new dependencies — aligned with constitution minimalism.

**Alternatives considered**:
- **xxhash**: Non-cryptographic, optimized for speed at billions of keys. Overkill; weaker audit story.
- **MD5**: Deprecated for integrity use; no advantage over SHA-256 in Node.

---

## 4. Async Job Pattern

**Decision**: API Route job creation + Next.js 15 `after()` for background processing + MongoDB `GenerationJob` status document + client polling via a GET status endpoint.

**Rationale**:
- POST returns `{ jobId, status: 'queued' }` immediately (≤600ms per Principle IV write budget).
- AI generation runs in `after()` callback — stable since Next.js 15.1; uses `waitUntil` on Vercel, works natively with `next start`.
- Job persists in MongoDB — survives navigate-away (spec edge case) and enables the instructor to return to a completed/failed draft.
- Client polls every 2s until terminal state — mirrors existing `components/enrollment-status-poll.jsx` → `GET /api/payments/status` pattern.
- `export const maxDuration = 60` on the route segment meets SC-005 (p95 ≤60s for ≤50 pages).
- API Route (not Server Action) handles the upload since the project's `serverActions.bodySizeLimit` is 2MB but the spec allows 10MB documents.

**Job states**: `queued` → `running` → `succeeded` | `failed`

**Alternatives considered**:
- **Fire-and-forget Server Action**: Unawaited promises terminate when the serverless function ends. Also blocked by 2MB body limit.
- **Server-Sent Events**: Keeps HTTP connection open for full AI duration — violates FR-007.
- **Vercel AI SDK streaming**: Couples client to long-lived connection; doesn't solve job persistence.
- **External queue (Inngest, BullMQ, QStash)**: Correct for high-volume, but violates constitution minimalism for v1 at 20 gen/day/instructor. Revisit at multi-tenant scale.

**New dependencies**: None — `after()` is built into Next.js 15; MongoDB/Mongoose already in stack.

---

## Summary

| Area | Decision | New packages | New env vars |
|------|----------|-------------|--------------|
| AI provider | OpenAI GPT-4.1 + strict Structured Outputs | `openai@^6.33.0` | `OPENAI_API_KEY`, `OPENAI_QUIZ_MODEL` |
| DOCX extraction | `mammoth.extractRawText()` | `mammoth@^1.12.0` | — |
| Content fingerprint | SHA-256 via `node:crypto` | — | — |
| Async jobs | API Route + `after()` + MongoDB + GET polling | — | — |

**Total new runtime dependencies**: 2 (`openai`, `mammoth`). Both are additive capabilities the project doesn't have; neither replaces an existing stack layer. Justified in the plan's Complexity Tracking table.
