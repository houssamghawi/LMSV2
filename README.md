# Learning Management System (LMS)

A modern Learning Management System built with Next.js 15, supporting course creation, student enrollment, quiz management, progress tracking, and certificate generation. Designed for educational institutions and online learning platforms.

## Key Features

- **Role-based Access Control**: Admin, Instructor, and Student roles with appropriate permissions
- **Course Management**: Create courses with modules, lessons, and video content
- **Quiz System**: Create quizzes for courses and lessons with multiple question types and auto-grading
- **AI Quiz Generation**: Instructors upload a `.docx` lecture document and receive an AI-generated quiz draft (MCQ / True-False / Short-Answer) tagged with difficulty, answer, explanation, and a verbatim source-quote citation. Short-Answer responses are routed to a per-instructor "Needs grading" queue with auto-finalization. Admin governance provides daily quotas, document size limits, and an audit trail. Requires `GEMINI_API_KEY` (see `.env.example`). Optional: `GEMINI_QUIZ_MODEL` (defaults to `gemini-2.5-flash`).
- **Context-Bound AI Tutor**: Students ask questions about a lesson and receive answers grounded exclusively in lecture content, with direct citations—or a standardized out-of-context message when the answer is not found. Instructors review interaction logs; admins configure tutor behavior. Requires `GEMINI_API_KEY` and a ChromaDB instance (see `.env.example` and `specs/003-context-bound-ai-tutor/`).
- **AI MCQ Complement for Existing Quizzes**: Instructors open an existing quiz (typically one containing Short-Answer questions), upload a `.docx` lecture file, and generate MCQ-only questions that are appended to the quiz without disturbing existing questions. Each generated MCQ has exactly 4 options (A–D), a correct-answer letter, a 1-sentence justification from the source text, and a difficulty tag (Easy / Medium / Hard). The instructor reviews, edits, deletes, regenerates, and selectively approves MCQs in a draft view before the backend atomically appends them via a MongoDB transaction. A Dice-coefficient duplicate filter (≥0.8 against existing question stems) prevents re-asking questions already on the quiz. Published quizzes with existing attempts require explicit confirmation before append. Reuses spec 001's OpenAI pipeline, `mammoth` extraction, consent, and shared daily quota — zero new runtime dependencies, zero new env vars. See `specs/002-ai-mcq-complement/`.
- **Enrollment & Payments**: MockPay integration for simulated payments (demo/testing)
- **Progress Tracking**: Monitor student progress through courses and lessons
- **Certificates**: Generate PDF certificates upon course completion
- **Dashboards**: Comprehensive admin and instructor dashboards with analytics

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 18, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Server Actions
- **Database**: MongoDB with Mongoose
- **Authentication**: NextAuth v5
- **Validation**: Zod, React Hook Form
- **Other**: PDF generation, Video player, Rich text editor, Email service (Resend)

## Quick Start

1. Clone the repository and install dependencies:
```bash
git clone <repository-url>
cd LMS-main
npm install
```

2. Create a `.env` file (see `.env.example` for the full list):
```env
MONGODB_CONNECTION_STRING=mongodb://localhost:27017/lms
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000
RESEND_API_KEY=your-resend-api-key  # Optional

# AI Quiz Generation (see specs/001-ai-quiz-from-docx)
GEMINI_API_KEY=your-gemini-api-key
# Optional — defaults to gemini-2.5-flash
GEMINI_QUIZ_MODEL=gemini-2.5-flash

# AI Tutor (see specs/003-context-bound-ai-tutor)
CHROMA_URL=http://localhost:8000
```

> The `GEMINI_API_KEY` is required only when the **AI Quiz Generation** feature is used. `GEMINI_QUIZ_MODEL` defaults to `gemini-2.5-flash` if unset (`gemini-1.5-*` models are no longer available on the API). Never commit real API keys — `.env*` is gitignored.

3. Run the development server:
```bash
npm run dev
```

4. Visit [http://localhost:3000](http://localhost:3000) and create an admin account at `/setup/admin`

## AI MCQ Complement (Spec 002)

Extend an existing quiz with AI-generated multiple-choice questions.

### Prerequisites

- Spec 001 (AI Quiz Generation) is configured: `GEMINI_API_KEY` is set, an `AdminQuizConfig` document exists, and the instructor has acknowledged the AI processing consent.
- At least one quiz with existing questions (typically Short-Answer) on a course the instructor owns.

### Usage

1. Sign in as an instructor and open the quiz editor for the target quiz.
2. Click **Generate MCQs** to open the MCQ complement dialog.
3. Upload a `.docx` lecture file, pick the MCQ count (default 8) and the Easy / Medium / Hard distribution (defaults 3 / 3 / 2; the three counts must sum to the total).
4. Click **Generate**. The UI polls the job status every ~2 s; generation typically completes in ≤45 s for documents up to 50 pages.
5. Review the draft MCQs. Each card shows the stem, 4 options (A–D) with the correct answer highlighted, a 1-sentence justification, and a difficulty badge. The validation summary reports how many MCQs were generated, dropped (ungrounded / invalid structure / duplicate of an existing stem), and included.
6. Optionally edit any MCQ field (stem, option text, correct answer, justification, difficulty), remove individual MCQs, or regenerate a single MCQ.
7. Click **Append to Quiz**. If the quiz is published and already has student attempts, a confirmation dialog explains that the new MCQs will only appear on future attempts; confirm to proceed.
8. The original questions are preserved in their original order; the new MCQs are appended after them, atomically, in a single MongoDB transaction.

### New Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/quiz-generation/jobs` (extended) | Accepts `targetQuizId` to start an MCQ complement job (`jobType: "mcq_complement"`). Returns `202` with `jobId`. |
| `GET`  | `/api/quiz-generation/jobs/[jobId]` (extended) | Polls status; the response includes `jobType`, `targetQuizId`, and `mcqValidationSummary` for complement jobs. |
| `POST` | `/api/quiz-generation/jobs/[jobId]/append` (new) | Atomically appends approved MCQs to the target quiz. Returns `201` with `appendedCount` and `totalQuestionCount`, or `200` with `requiresConfirmation: true` when the quiz is published with existing attempts. |
| `PATCH` | `/api/quiz-generation/jobs/[jobId]/questions/[draftId]` (reused) | Edits a draft MCQ or marks it `rejected`. |
| `POST` | `/api/quiz-generation/jobs/[jobId]/regenerate` (reused) | Regenerates a single MCQ (`scope: "single"`) or the whole draft. |

### Conflict, Duplicate, and Quota Behavior

- **Concurrent jobs**: starting a second complement job for the same quiz while one is `queued` or `running` returns `409 Conflict`.
- **Duplicate detection**: generated MCQ stems are compared against existing question stems on the target quiz using a normalized Dice coefficient; stems at ≥0.8 similarity are dropped before the draft is shown.
- **Shared quota**: MCQ complement jobs count against the same per-instructor daily generation quota as full-quiz generation. Exceeding the quota returns `429 Too Many Requests` with a `retryAfter` timestamp.
- **Size limit**: uploads above `AdminQuizConfig.maxDocumentSizeBytes` return `413 Payload Too Large`.

### New Env Vars and Dependencies

None. The feature reuses spec 001's OpenAI client, `mammoth` DOCX extractor, NextAuth auth, and the existing `GenerationJob` model (extended with two optional, backward-compatible fields: `targetQuizId` and `jobType`).

## Context-Bound AI Tutor (Spec 003)

A strict, context-bound AI tutor embedded in lesson pages. Students ask questions scoped to a single lesson; the system retrieves relevant lecture chunks via semantic search (ChromaDB) and generates answers with citations using Gemini. When no answer exists in the lecture material, the tutor returns a configurable out-of-context message—never guessing or using external knowledge.

### Prerequisites

- **MongoDB** running (same as the rest of the LMS)
- **ChromaDB** running via Docker for vector storage:
  ```bash
  docker run -d --name chromadb -p 8000:8000 chromadb/chroma:latest
  ```
- **`GEMINI_API_KEY`** set in `.env` (reuses the existing Gemini integration)
- **`CHROMA_URL`** set in `.env` (defaults to `http://localhost:8000`)

### Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `GEMINI_API_KEY` | Yes (when tutor is used) | — | Answer generation and text embeddings |
| `CHROMA_URL` | Yes (when tutor is used) | `http://localhost:8000` | ChromaDB HTTP endpoint for lecture chunk vectors |

See `.env.example` for the full list. Never commit real API keys—`.env*` is gitignored.

### ChromaDB Setup

ChromaDB runs as an external service (like MongoDB), not bundled in the Next.js app:

```bash
# Start ChromaDB
docker run -d --name chromadb -p 8000:8000 chromadb/chroma:latest

# Verify it is running
curl http://localhost:8000/api/v1/heartbeat

# Stop / remove (when needed)
docker stop chromadb && docker rm chromadb
```

Lecture content must be embedded into ChromaDB before the tutor can answer questions for a lesson. See `docs/ai-tutor.md` and `specs/003-context-bound-ai-tutor/quickstart.md` for setup and validation.

### New Dependencies

| Package | Purpose |
|---------|---------|
| `chromadb` | JavaScript client for ChromaDB vector store |

### New Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/tutor/ask` | Submit a question; returns cited answer or out-of-context message |
| `GET` | `/api/tutor/history` | Paginated interaction history (student own / instructor course-wide) |
| `POST` | `/api/tutor/feedback` | Thumbs up/down on an interaction |
| `GET` | `/api/tutor/config` | Admin: read tutor configuration |
| `PUT` | `/api/tutor/config` | Admin: update tutor configuration |
| `POST` | `/api/tutor/report` | Student: report an issue with a response |

Full API contract: `specs/003-context-bound-ai-tutor/contracts/ai-tutor-api.md`

## Payment System

The system uses **MockPay**, a virtual payment system for demonstration and testing. MockPay simulates payment processing without real payment credentials, making it ideal for development and demonstrations. The architecture is designed to easily integrate real payment gateways when needed.

## Project Structure

```
app/          # Next.js pages and routes
  ├── (main)/    # Public pages
  ├── admin/     # Admin dashboard
  ├── dashboard/ # Instructor dashboard
  ├── actions/   # Server actions
  └── api/       # API routes (incl. app/api/quiz-generation/* for AI quiz flow
                 #  — POST /jobs, GET /jobs/[jobId], PATCH /jobs/[jobId]/questions/[draftId],
                 #    POST /jobs/[jobId]/regenerate, POST /jobs/[jobId]/append [spec 002])
components/   # React components
lib/          # Utilities, validations, constants, quiz-generation + MCQ-complement prompts
model/        # Mongoose models (incl. generation-job [spec 001+002], ai-consent, admin-quiz-config)
queries/      # Database queries (incl. quiz-generation with getExistingQuestionStems)
service/      # Services (incl. docx-extractor, quiz-generator, generation-orchestrator, mcq-validator)
specs/        # Feature specs, plans, data models, contracts, tasks (Spec Kit)
```

## License

MIT
