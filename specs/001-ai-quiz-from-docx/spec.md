# Feature Specification: AI Quiz Generation from Lecture Notes (.docx)

**Feature Branch**: `001-ai-quiz-from-docx`

**Created**: 2026-06-26

**Status**: Draft

**Input**: User description: "You are an expert instructional designer and educational assessment assistant. Task: Analyze the attached Word document (.docx) containing the lecture notes for this lesson. Based only on the provided text, generate a comprehensive set of quiz questions. Requirements: Source Material: Strictly use the content within the uploaded document. Do not invent facts or bring outside information unless specified. Question Types: Provide a mix of Multiple-Choice Questions (MCQs), True/False, and Short Answer questions. Answer Key: Include the correct answer and a brief explanation/reference from the text for each question. Difficulty Levels: Categorize questions into Easy (recall), Medium (understanding), and Hard (application/analysis)."

## Clarifications

### Session 2026-06-26

- Q: Notification surface for "needs grading" and "graded" events? → A: Defer push notifications for v1; rely on a "needs grading" queue (instructor-pull) and a "result pending" badge on the student's result page (student-pull). A separate notification-system spec is the recorded follow-up.
- Q: May a student start a new attempt while a previous attempt on the same quiz is still `pending_grading`? → A: Allow — students may start a new attempt while a previous one is pending grading, still bounded by `maxAttempts`. The pending attempt's auto-graded subscore is final and not affected by the new attempt; both attempts are graded and recorded independently.
- Q: Partial grading save-and-resume — what happens if an instructor grades some but not all SA responses on an attempt and leaves? → A: Per-response autosave. Each SA grade and comment persists immediately when the instructor saves that response; the attempt stays in `pending_grading` until every SA response on it has been graded, at which point the system automatically finalizes the overall score, percentage, and pass/fail.
- Q: How is sensitive content / PII handled in uploaded `.docx` before sending to the third-party AI provider? → A: One-time-per-user consent banner shown before the user's first upload, explicitly stating that the document's extracted text will be sent to a third-party AI provider and that the instructor is responsible for not uploading PII or otherwise sensitive material. No automated PII redaction in v1. The consent acknowledgement (user, version, timestamp) is recorded for audit.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate a publish-ready quiz from a lecture document (Priority: P1)

An instructor opens the lesson or course they are building, uploads the lecture's Word document (`.docx`), and receives a fully drafted quiz containing a mix of Multiple-Choice, True/False, and Short Answer questions. Each question is tagged with a difficulty level and ships with the correct answer plus a short explanation that quotes the source text. The instructor reviews the draft, makes any edits, and saves it as a quiz attached to the course/lesson — without authoring questions from scratch.

**Why this priority**: This is the entire value proposition. With just this story, an instructor goes from "I have a lecture document" to "I have a published quiz" in minutes instead of hours. It is independently shippable and delivers measurable time savings on its own.

**Independent Test**: An instructor uploads a sample `.docx` lecture, clicks "Generate", and within the generation budget receives a quiz draft with the requested mix of question types, each having an answer, explanation, source quote, and difficulty tag. The instructor saves the draft and the new quiz appears in the course's quiz list and is openable as a normal quiz.

**Acceptance Scenarios**:

1. **Given** an instructor is editing a lesson and has a valid `.docx` lecture file, **When** they upload it and request generation with the default mix, **Then** the system returns a draft quiz containing the expected number of questions, each labeled with type, difficulty, correct answer, explanation, and a verbatim source quote of ≤30 words drawn from the uploaded text.
2. **Given** an instructor has reviewed and is satisfied with the generated draft, **When** they click "Save as quiz" and choose the target course (and optional lesson), **Then** the quiz is persisted to the existing quiz store, becomes visible in the course's quiz list, and is openable through the normal instructor and student quiz flows.
3. **Given** an instructor uploads a `.docx` that contains no extractable text (e.g., scanned images only), **When** generation is requested, **Then** the system refuses with a clear, actionable error message and does not create a partial quiz.
4. **Given** a logged-in student visits any URL associated with the generator, **When** they attempt to upload a document or trigger generation, **Then** the system denies access with an authorization error.
5. **Given** a published generated quiz contains a Short Answer question, **When** a student submits an attempt, **Then** the auto-graded questions are scored immediately, the attempt is marked "pending grading", the result page shows a clear "Result pending — awaiting instructor grading" state, and the owning instructor's "Needs grading" queue (and its count badge) reflects the new pending entry on next page load.
6. **Given** an instructor opens the "Needs grading" queue for a quiz, **When** they grade every pending Short Answer response on a submitted attempt, **Then** the attempt's overall score, percentage, and pass/fail are finalized automatically once the last response is graded, the student's "Result pending" badge clears on the next page view, and the model answer/explanation become visible to the student per the quiz's existing answer-reveal policy.
7. **Given** an attempt has three pending Short Answer responses, **When** the instructor grades two of them and closes the browser tab without grading the third, **Then** the two graded responses' scores and comments are persisted, the attempt remains in `pending_grading`, the third response stays visible in the "Needs grading" queue, and on the instructor's next visit they can resume grading the remaining response without re-entering the prior two grades.

---

### User Story 2 - Tune the question mix and regenerate individual questions (Priority: P2)

Before or after the first draft, the instructor adjusts the question mix (total count, per-type counts, per-difficulty counts), edits any individual question's text/options/answer/explanation/difficulty, deletes questions they don't want, or asks the system to regenerate a single question or the entire draft. This lets the instructor shape the quiz to their teaching goals without leaving the page.

**Why this priority**: Generation is rarely perfect on the first try; without this loop, instructors will silently leave the feature after one disappointing draft. This story turns "an AI demo" into a tool instructors actually keep using.

**Independent Test**: Starting from a generated draft, the instructor changes the per-type counts, regenerates, edits one question's options, deletes another question, regenerates a third question individually, and saves. The saved quiz reflects exactly the post-edit state and audit records show the per-question regenerations.

**Acceptance Scenarios**:

1. **Given** an existing draft of 10 questions, **When** the instructor changes the requested mix to 8 MCQ / 0 True-False / 2 Short Answer and re-generates, **Then** the new draft contains 8 MCQ and 2 Short Answer questions and the previous draft is replaced (with a confirmation step before discarding edits).
2. **Given** the instructor has edited 3 questions and approves 7 others, **When** they request "regenerate this question" on one of the unapproved questions, **Then** only that question is replaced and the approved/edited questions are untouched.
3. **Given** the instructor edits a question's correct answer to one not present in the original options, **When** they try to save, **Then** the system blocks the save and explains the validation rule.

---

### User Story 3 - Admin governance, quotas, and audit (Priority: P3)

An admin can see who is generating quizzes from documents, enforce a daily quota and a maximum document size per instructor, audit the source documents and parameters used for each generation, and (where retention is enabled) re-open a past source to regenerate from it.

**Why this priority**: This protects budget (AI calls cost money), reduces abuse risk, and gives the institution an audit trail for academic-integrity questions. It is not required for instructors to get value on day one but is required before broad rollout.

**Independent Test**: An admin sets a daily cap of N generations per instructor; an instructor exceeds N and is blocked with a clear message; the admin opens the audit view and sees the blocked attempt plus all successful generations from that day with source document fingerprints and parameters used.

**Acceptance Scenarios**:

1. **Given** an admin has set a daily generation quota of 20 per instructor, **When** an instructor attempts the 21st generation in 24 hours, **Then** the request is refused with a message naming the limit and the reset time, and the attempt is logged in the audit record.
2. **Given** an admin opens the quiz administration view, **When** they filter to "AI-generated", **Then** they see each AI-generated quiz with its source document filename, content fingerprint, generation parameters, AI provider/model identifier, and the user who generated it.

---

### Edge Cases

- **No extractable text**: `.docx` is empty, image-only, scanned, or password-protected → reject up front with a clear message; do not call the AI; do not create a draft.
- **Document too large**: exceeds the admin-configured size cap or page count → reject before extraction with a message that names the limit.
- **Document too short**: text yields fewer candidate facts than the requested question count → return whatever could be grounded, mark the shortfall in the UI, and let the instructor decide whether to keep, reduce the requested count, or upload a richer source.
- **Non-text content (tables, equations, code snippets, footnotes)**: extract what is convertible to plain text; ignore content the extractor cannot understand and surface a non-blocking notice listing what was skipped.
- **Non-English / mixed-language source**: generated questions, answers, and explanations are produced in the same language as the dominant source language; UI chrome remains in the user's i18n locale.
- **Duplicate uploads**: re-uploading the same document (matching content fingerprint) within the same course shows the prior generation and asks the instructor to confirm before re-running, to avoid double-charging the quota.
- **AI provider failure** (timeout, rate limit, malformed JSON, content-policy refusal): no partial draft is persisted; the instructor sees a specific error, the attempt is logged, and the daily quota is not consumed for failures caused by the provider.
- **Hallucination risk**: any candidate question that cannot be tied to a verbatim quote (≤30 words) from the source is dropped before the draft is shown to the instructor.
- **Instructor navigates away mid-generation**: generation continues server-side; on return, the instructor sees the completed (or failed) draft for that source/job without restarting.
- **Role boundary**: students and unauthenticated users get an authorization error on every entry point, including any direct API path.
- **Quiz attached to a published lesson**: saving the generated quiz does not silently mutate existing student attempts on a prior quiz for that lesson; the new quiz is created as a separate, draft-by-default quiz that the instructor must explicitly publish.
- **Empty Short Answer response**: a student submits with one or more Short Answer fields left blank → the blank responses MUST be persisted as ungraded with zero points and still surface in the instructor's grading queue so the instructor can confirm rather than have them silently scored.
- **Instructor leaves the institution before grading**: pending-grading tasks tied to an unavailable instructor MUST be reassignable by an admin to another instructor so attempts don't stall indefinitely.
- **Quiz edited after submission**: if an instructor edits a Short Answer question's model answer or point value after a student has already submitted, the previously submitted student response MUST remain intact and gradable; the change MUST NOT retroactively alter already-finalized attempts.
- **Student re-attempts while previous attempt is pending grading**: starting a new attempt MUST NOT block on, mutate, or finalize the pending attempt; the new attempt MUST consume one of the `maxAttempts` slots; once instructors grade the older attempt independently, both attempts' final scores MUST be visible in the student's attempt history.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Instructors and admins MUST be able to upload a single `.docx` file from the course/lesson editor to use as the source for question generation. Students MUST NOT see or be able to invoke any part of this feature.
- **FR-002**: System MUST extract readable plain text (paragraphs, headings, list items, table cell text) from the uploaded `.docx` and MUST refuse generation with a clear message if no usable text is extracted.
- **FR-003**: System MUST allow the instructor to choose, before generation, the total number of questions and the per-type counts across three types — Multiple-Choice (single correct), True/False, and Short Answer — within an admin-configured maximum.
- **FR-004**: Generated questions MUST be derived solely from the uploaded document's extracted text; the system MUST drop any candidate question that cannot be supported by a verbatim quote from that text before showing the draft to the instructor.
- **FR-005**: Each generated question MUST include (a) the correct answer, (b) a brief explanation in plain language, and (c) a verbatim source-quote citation of ≤30 words taken from the uploaded document.
- **FR-006**: Each generated question MUST be tagged with exactly one difficulty level — Easy (recall), Medium (understanding), or Hard (application/analysis) — and the instructor MUST be able to filter the draft by difficulty and re-tag any question.
- **FR-007**: Generation MUST run asynchronously: the request that starts a generation MUST return within the standard write-response budget and MUST NOT hold the HTTP connection open for the full AI call; the UI MUST surface progress and the final result without a page reload.
- **FR-008**: Instructors MUST be able to, on the draft, edit any field of any question (text, options, correct answer, explanation, source quote, difficulty, type), delete any question, regenerate any individual question, regenerate the whole draft, and change the requested mix and re-generate.
- **FR-009**: On "Save as quiz", the system MUST persist the draft as a Quiz attached to the chosen Course (and optional Lesson) using the existing quiz and question storage, and the quiz MUST default to unpublished so the instructor explicitly publishes it when ready.
- **FR-010**: Short Answer MUST be a new, gradable question type that can be persisted on a published quiz alongside Multiple-Choice and True/False. The generated draft MUST store, for each Short Answer question, a model/expected answer plus the existing brief explanation and verbatim source quote, both visible to instructors during review and editable before save.
- **FR-011**: System MUST surface AI-side failures (timeout, malformed response, refused content, "could not ground N questions") as specific, actionable messages, MUST NOT persist a partial or invalid quiz, and MUST NOT consume the instructor's daily quota when the failure is caused by the provider.
- **FR-012**: Admins MUST be able to configure a daily generation quota per instructor and a maximum source-document size; both MUST be enforced server-side before any AI call.
- **FR-013**: System MUST keep an audit record for every generation attempt (success or failure) capturing: actor (user id, role), target (course id, optional lesson id), source document (filename, byte size, content hash), generation parameters (counts per type, counts per difficulty, total), AI provider/model identifier and version, token/cost figures if available from the provider, outcome (success/failure with reason), and timestamps.
- **FR-014**: All instructor-facing and admin-facing UI strings, validation messages, toasts, and emails introduced by this feature MUST be served through the existing i18n layer and MUST render in the user's locale.
- **FR-015**: Source documents MUST be discarded after text extraction by default; an admin-controlled retention toggle MAY enable temporary retention for audit or regeneration, in which case retention duration and access controls MUST be admin-visible.
- **FR-016**: Generated quizzes MUST be visibly marked as "AI-generated" in both the instructor's quiz list and the admin quiz administration view so reviewers can prioritize them for spot-checks.
- **FR-017**: When a student attempts a quiz that contains Short Answer questions, the system MUST accept and persist a free-text response per Short Answer question (subject to a defined maximum length per response). Auto-graded questions on the same attempt (Multiple-Choice, True/False) MUST continue to be scored automatically at submit time exactly as today.
- **FR-018**: A submitted attempt that contains one or more Short Answer responses MUST be placed into a "pending grading" state in which the auto-graded subscore is final but the overall score, percentage, and pass/fail outcome are explicitly marked as not yet finalized. The instructor (or admin) MUST be able to open each pending response from a per-quiz "needs grading" queue, view the student's response alongside the model answer and source quote, and award a per-question score within the question's point range with an optional written comment. Each individual Short Answer grade and comment MUST persist immediately when the grader saves that response (per-response autosave); the system MUST NOT require the grader to grade every response in a single session, and partially graded attempts MUST remain in `pending_grading` and reappear in the queue exactly as they were left. Once the last remaining ungraded Short Answer response on an attempt has been graded, the system MUST automatically finalize the overall score, percentage, and pass/fail outcome and timestamp the finalization without requiring an explicit "Finalize" action from the grader.
- **FR-019**: Awareness of pending-grading and grading-complete events MUST be delivered via pull surfaces — no new push/email/in-app notification module is introduced by this feature. Specifically: (a) the responsible instructor MUST see new pending-grading items in a "Needs grading" queue (per-quiz and aggregate), with a visible count badge on the quiz list and instructor dashboard that updates on page load; (b) the student MUST see a clearly labeled "Result pending — awaiting instructor grading" state on the quiz result page (and a small pending-result badge in their attempt history) until the attempt is finalized, after which the badge clears and the result page shows the finalized score on next view. Short Answer model answers and explanations MUST NOT be revealed to the student before the instructor has graded that response, regardless of the quiz's existing `showAnswersPolicy`; after grading, reveal MUST follow the same policy as the other question types on the quiz.
- **FR-020**: The "needs grading" queue MUST be scoped by role: instructors MUST see only attempts for quizzes they own; admins MUST be able to see all pending-grading attempts across the platform.
- **FR-021**: A student MUST be permitted to start a new attempt on a quiz while a previous attempt on the same quiz is in the `pending_grading` state, subject only to the quiz's existing `maxAttempts` limit (where each `pending_grading` or `finalized` attempt counts as one used attempt). The two attempts MUST be independent records: grading or finalization of one MUST NOT mutate the other, and the student's display MUST list both with their respective statuses.
- **FR-022**: Before a user's first upload of a `.docx` to the generator, the system MUST display a consent banner that explicitly states (a) the document's extracted text will be sent to a third-party AI provider for processing, (b) the user is responsible for not uploading personally identifiable information or otherwise sensitive material, and (c) the user must acknowledge to proceed. The acknowledgement (user id, consent-text version, timestamp) MUST be persisted and surfaced in the per-generation audit record. Subsequent uploads by the same user MUST NOT show the banner unless the consent text changes, in which case re-acknowledgement MUST be required.
- **FR-023**: This feature MUST NOT, in v1, perform automated PII/sensitive-content scanning or redaction on the uploaded document text. Future automated redaction is explicitly deferred to a follow-up spec; no part of v1 may depend on it.

### Key Entities *(include if feature involves data)*

- **Lecture Source Document**: The uploaded `.docx`, its extracted plain-text content, content hash/fingerprint, byte size, original filename, and the user/course/lesson it was uploaded under.
- **Generation Job**: A single attempt to generate questions; holds the requesting user, target course/lesson, parameters (totals and per-type/per-difficulty counts), status (queued/running/succeeded/failed), failure reason if any, AI provider/model identifier, and links to the produced draft.
- **Generated Question Draft**: A provisional question carrying its type (MCQ / True-False / Short Answer), difficulty (Easy / Medium / Hard), text, options where applicable, correct answer, explanation, verbatim source-quote citation, and an "instructor state" (untouched / edited / approved / rejected / regenerated).
- **Generated Quiz Draft**: The in-review container that groups the question drafts for one generation job and, on accept, becomes a Quiz attached to a Course (and optional Lesson) using the existing quiz storage.
- **Generation Audit Record**: A persistent log entry per generation attempt — successful or failed — containing actor, target, source fingerprint, parameters, provider/model, outcome, cost figures (if available), the consent-text version the user had acknowledged at submission time, and timestamps; used for the admin audit view and for quota enforcement.
- **AI Processing Consent Record**: A per-user, per-consent-version acknowledgement that the user has been told their uploaded document text will be sent to a third-party AI provider. Captures user id, consent-text version, acknowledgement timestamp, and (optionally) IP/user-agent for audit. Re-acknowledgement is required whenever the consent text is materially updated.
- **Short Answer Response**: A student's free-text response to a Short Answer question on an attempt, including the response text, submission timestamp, a graded/ungraded flag, the points awarded (once graded), the grader, the grading timestamp, and an optional grader comment.
- **Pending-Grading Task**: The view of an attempt (or an individual Short Answer response) that is awaiting instructor grading; surfaced as a per-quiz queue for the owning instructor and as an aggregate queue for admins, with filters by quiz, student, and age.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An instructor can go from "open the lesson editor" to "save a generated 10-question quiz" in under 5 minutes for a typical lecture document (≤30 pages), compared to a ~30-minute manual baseline.
- **SC-002**: In pilot use, at least 90% of generated questions are accepted by the instructor without text edits (measured as accepted-without-edit ÷ total generated, across a rolling 7-day window).
- **SC-003**: 100% of generated questions carry a verbatim source quote of ≤30 words drawn from the uploaded document (automated check at draft time; any candidate failing this is dropped before the draft is shown).
- **SC-004**: Zero generated questions reference facts that cannot be located in the source document (measured by instructor "ungrounded" rejections; target: <1% of all generated questions over a rolling 30-day window).
- **SC-005**: Generation completes — or fails with a specific error message — within 60 seconds at the 95th percentile for documents up to 50 pages.
- **SC-006**: Instructor "time to first published quiz" on a new lesson drops by ≥60% compared to the fully manual authoring baseline.
- **SC-007**: Zero unauthorized accesses: students and unauthenticated visitors cannot trigger generation through any UI or API entry point (verified by per-role authorization tests for every new endpoint).
- **SC-008**: AI-driven cost stays within the admin-configured quota: no instructor exceeds the configured daily generation limit in production (enforced server-side; verified by audit log).
- **SC-009**: At least 95% of pending Short Answer responses are graded by the responsible instructor within 72 hours of student submission, and the "Result pending" badge on the student's result page clears (showing the finalized score) on the next page view after the instructor's final grading action.

## Assumptions

- **In-scope file format**: Only `.docx` is supported in v1. PDF, plain text, slides, image-only documents, and OCR are explicitly out of scope and may be addressed in a later spec.
- **AI provider is a downstream choice**: Selection of the specific AI provider/model is deferred to `/speckit-plan`; this spec is provider-agnostic. Per the constitution, introducing a new runtime dependency at this layer is governed by the existing amendment process.
- **Default generation mix** (instructor may override): 10 questions total — 5 MCQ, 3 True/False, 2 Short Answer; difficulty distribution roughly 4 Easy / 4 Medium / 2 Hard.
- **Authoring surface**: The generator is invoked from the existing instructor lesson and course editors; no new dashboard chrome is introduced.
- **Storage reuse**: Accepted generated quizzes are written to the existing Quiz and Question stores; the existing automatic-grading flow for Multiple-Choice and True/False questions is preserved. Short Answer is added as a new gradable question type that extends — rather than replaces — the existing attempt flow (per FR-010 and FR-017–FR-020).
- **Short Answer length cap**: Student Short Answer responses are bounded at a reasonable default (e.g., 2,000 characters) to keep grading manageable; the cap is enforced server-side and surfaced in the UI.
- **Notifications**: This feature does NOT introduce a push/email/in-app notification module. Instructors discover pending grading work via a "Needs grading" queue and count badge; students discover grading completion via a "Result pending" badge that clears on the next page view after the instructor finalizes the score. A dedicated cross-feature notification system is a recorded follow-up spec and is out of scope here.
- **Language**: Generated questions, answers, explanations, and source quotes are produced in the same language as the uploaded document's dominant language; surrounding UI text remains in the user's selected i18n locale.
- **"Brief explanation/reference from the text"** is interpreted as: an explanation of ≤2 sentences, plus a verbatim source quote of ≤30 words taken from the uploaded document.
- **Quota defaults**: Default daily generation quota is 20 generations per instructor and a default maximum document size of 10 MB; both are tunable by admins.
- **Retention default**: Uploaded `.docx` content is deleted after extraction; an admin opt-in MAY enable temporary retention for re-generation and audit purposes.
- **Authorization**: Only users with `instructor` or `admin` role may invoke generation; `student` and unauthenticated users are denied at the server, not only in the UI.
- **Third-party AI data handling**: The instructor is the responsible party for what they upload; the system shows a one-time-per-user (per consent-text version) banner before the first upload that names the third-party AI provider relationship and records acknowledgement. No automated PII scanning or redaction is performed in v1; both are explicit out-of-scope candidates for a follow-up spec.
