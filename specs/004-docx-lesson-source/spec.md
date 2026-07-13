# Feature Specification: Word File as Lesson Source

**Feature Branch**: `004-docx-lesson-source`

**Created**: 2026-07-12

**Status**: Draft

**Input**: User description: "Modify the workflow of the database and RAG system. Replace the current 'Lesson Description' text field with a Word file upload within lesson settings. The uploaded file serves as the source for the database/RAG system, the basis for question generation, and the document displayed to students below the lesson video in a section labeled 'Lecture.' Remove the existing description-based system entirely and implement the new file-based method."

## Clarifications

### Session 2026-07-12

- Q: How should legacy lessons (with description-based embeddings but no uploaded file) be handled? → A: Keep the old description code path temporarily so legacy lessons continue to work as-is. Instructors migrate each lesson individually by uploading a file at their own pace. The legacy path is removed in a future release once all lessons are converted.
- Q: Should images embedded in .docx files be extracted and displayed in the student-facing "Lecture" section? → A: Yes. Extract and display images alongside text to preserve the full lecture experience (diagrams, charts, figures).
- Q: What happens to the existing `description` field on the Lesson data model? → A: Keep the field in the schema but stop using it. Old values remain for reference; new lessons leave it empty. No schema migration needed. Cleanup deferred to a future release.
- Q: How does an instructor recover when file processing (extraction/embedding) fails? → A: Show a "Retry" button alongside the failure message. Instructor clicks to re-attempt extraction and embedding without needing to re-upload the file.
- Q: Should uploaded .docx files undergo security validation beyond extension/size checks? → A: Yes. Validate MIME type and internal OOXML structure (confirm valid ZIP/OOXML package), and strip any embedded macros/ActiveX before processing.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instructor Uploads Word File as Lesson Content (Priority: P1)

An instructor is configuring a lesson within a course module. Instead of typing or pasting text into a "Lesson Description" textarea, the instructor uploads a Word (.docx) file through the lesson settings. This file becomes the single source of truth for all lesson content—powering the AI tutor, question generation, and student-facing lecture material.

**Why this priority**: This is the foundational action that replaces the existing system. Without file upload, no downstream feature (RAG, question generation, lecture display) can function under the new workflow.

**Independent Test**: Can be fully tested by uploading a .docx file in lesson settings and verifying it is stored, associated with the lesson, and the previous description textarea is no longer present.

**Acceptance Scenarios**:

1. **Given** an instructor opens the lesson settings for a lesson in their course, **When** they look at the content editing area, **Then** there is no "Lesson Description" textarea; instead there is a file upload control that accepts .docx files.

2. **Given** an instructor selects a valid .docx file (under the maximum size limit), **When** they upload the file, **Then** the system stores the file, associates it with the lesson, and displays a confirmation with the filename and upload status.

3. **Given** an instructor has previously uploaded a .docx file for a lesson, **When** they upload a new .docx file, **Then** the new file replaces the old one, old embeddings are cleared, and the new file is processed.

4. **Given** an instructor has uploaded a .docx file, **When** they want to remove it without replacing it, **Then** they can delete the current file, which clears all associated data (embeddings, extracted text) and disables downstream features until a new file is uploaded.

---

### User Story 2 - Uploaded File Feeds the RAG/AI Tutor System (Priority: P1)

After the instructor uploads a Word file, the system automatically extracts the text content, chunks it, generates embeddings, and stores them in the vector database—exactly as the old description-based pipeline worked, but now sourced from the uploaded file instead of a text field.

**Why this priority**: The RAG pipeline is the core technical backbone. The AI tutor cannot answer questions without embedded content. This is equally critical as the upload itself.

**Independent Test**: Can be fully tested by uploading a .docx file, waiting for processing to complete, then asking the AI tutor a question whose answer exists in the uploaded document and verifying a correct, cited response.

**Acceptance Scenarios**:

1. **Given** an instructor uploads a .docx file with lecture content about "cell biology", **When** the system finishes processing, **Then** the embedding status shows "ready" and the chunk count reflects the document size.

2. **Given** a .docx file has been processed and embeddings are ready, **When** a student asks the AI tutor "What is mitosis?", **Then** the AI tutor retrieves relevant chunks from the uploaded document and responds with a cited answer (identical behavior to the current description-based RAG).

3. **Given** an instructor replaces an existing .docx file with a new one, **When** the system processes the new file, **Then** old embeddings are removed and new embeddings are generated from the replacement file.

---

### User Story 3 - Student Views Uploaded Document as "Lecture" (Priority: P1)

A student navigating to a lesson page sees the uploaded Word file's content displayed below the lesson video in a section labeled "Lecture" (replacing the previous "Description" section). The content is rendered in a readable format that preserves the document's structure (headings, paragraphs, lists, tables, bold/italic formatting).

**Why this priority**: Students must be able to read the lecture material directly on the lesson page. This is part of the core requirement and is essential for the learning experience alongside the video.

**Independent Test**: Can be fully tested by uploading a .docx file with formatted content (headings, lists, bold text), navigating to the lesson page as a student, and verifying the content appears under a "Lecture" label with formatting preserved.

**Acceptance Scenarios**:

1. **Given** an instructor has uploaded a .docx file for a lesson, **When** a student navigates to that lesson page, **Then** the document content is displayed below the video in a section with the heading "Lecture".

2. **Given** the uploaded .docx file contains headings, bullet lists, numbered lists, bold text, italic text, tables, and embedded images/diagrams, **When** the student views the "Lecture" section, **Then** the formatting and images are faithfully rendered in the browser.

3. **Given** no .docx file has been uploaded for a lesson, **When** a student views that lesson page, **Then** the "Lecture" section is either hidden or displays a message indicating no lecture material is available.

---

### User Story 4 - Uploaded File Serves as Source for Quiz Question Generation (Priority: P2)

The uploaded Word file replaces the lesson description as the content source for AI-generated quiz questions. When quiz generation is triggered for a lesson, the system uses the extracted text from the uploaded file.

**Why this priority**: Important for the full content pipeline, but quiz generation can function independently and is not needed for the core upload-to-RAG-to-display loop.

**Independent Test**: Can be fully tested by uploading a .docx file, triggering quiz question generation for that lesson, and verifying the generated questions are based on the uploaded file content.

**Acceptance Scenarios**:

1. **Given** a .docx file has been uploaded and processed for a lesson, **When** the instructor triggers AI quiz generation for that lesson, **Then** the system uses the extracted text from the uploaded file as the source material for generating questions.

2. **Given** no .docx file has been uploaded for a lesson, **When** the instructor attempts to generate quiz questions, **Then** the system informs them that lecture content must be uploaded first.

---

### User Story 5 - Existing Description System Is Fully Removed (Priority: P1)

All traces of the old "Lesson Description" workflow are removed: the textarea in lesson settings, the description field's role as RAG source, and the "Description" display on the student lesson page. The description field on the data model may be repurposed or deprecated, but it no longer participates in the RAG pipeline or content display.

**Why this priority**: The user explicitly requires the old system to be removed. Leaving it in place creates confusion, dual pathways, and maintenance burden.

**Independent Test**: Can be fully tested by verifying the lesson settings no longer show a description textarea, the student page no longer shows a "Description" tab/section sourced from the old field, and the embedding pipeline no longer reads from the description field.

**Acceptance Scenarios**:

1. **Given** an instructor opens lesson settings, **When** they look for the "Lesson Description" textarea, **Then** it is not present; only the file upload control is available for providing lesson content.

2. **Given** a lesson has an old description value in the database, **When** the student views the lesson page after the migration, **Then** the old description is NOT displayed; only the uploaded file content (if any) appears under "Lecture".

3. **Given** the embedding pipeline processes a lesson, **When** it extracts content for embedding, **Then** it reads from the uploaded file only—never from the lesson's description field.

---

### Edge Cases

- **Invalid file format**: Instructor uploads a non-.docx file (PDF, .doc, .txt, image); the system rejects the upload with a clear error message specifying that only .docx files are accepted.
- **Corrupt or empty .docx file**: The system detects that no text could be extracted and informs the instructor that the file appears empty or unreadable.
- **Very large .docx file**: Files exceeding the maximum size limit are rejected at upload time with a message indicating the size limit.
- **File with only images/charts (no text)**: The system extracts no text, warns the instructor that no textual content was found, and does not generate embeddings.
- **Concurrent upload**: If an instructor uploads a new file while the previous one is still being processed, the system cancels or supersedes the previous processing and begins with the new file.
- **Legacy data migration**: Lessons with existing description-based embeddings continue to function via the retained legacy code path. No bulk migration is performed. Each instructor migrates their lessons individually by uploading a .docx file, which switches that lesson to the new pipeline. The legacy code path is removed in a future release after full adoption.
- **RTL and multilingual content**: Word files containing Arabic or mixed Arabic/English text are processed correctly with preserved reading direction.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a file upload control in the lesson settings that accepts only .docx files and replaces the existing "Lesson Description" textarea.
- **FR-002**: System MUST store the uploaded .docx file persistently and associate it with the lesson record.
- **FR-003**: System MUST extract all textual content and embedded images from the uploaded .docx file upon upload, preserving structural elements (headings, paragraphs, lists, tables, emphasis, inline images, and figures).
- **FR-004**: System MUST feed the extracted text into the existing RAG pipeline (chunking, embedding, vector store) as the sole content source, replacing the description-based extraction.
- **FR-005**: System MUST display the extracted and formatted content of the uploaded .docx file to students below the lesson video in a section labeled "Lecture".
- **FR-006**: System MUST make the extracted text from the uploaded .docx file available as the source for AI quiz question generation, replacing the description field for this purpose.
- **FR-007**: System MUST remove the "Lesson Description" textarea from the lesson settings interface entirely.
- **FR-008**: System MUST remove the old "Description" display section from the student-facing lesson page and replace it with the "Lecture" section.
- **FR-009**: System MUST allow instructors to replace an uploaded file with a new one, clearing old embeddings and reprocessing the new file automatically.
- **FR-010**: System MUST allow instructors to delete the uploaded file, which clears all associated embeddings and extracted content.
- **FR-011**: System MUST validate uploaded files: verify MIME type and internal OOXML structure (valid ZIP/OOXML package), reject non-.docx formats, reject files exceeding the maximum size limit, strip any embedded macros or ActiveX controls before processing, and reject files that yield no extractable text.
- **FR-012**: System MUST display processing status to the instructor (uploading, extracting, embedding, ready, failed) consistent with the existing embedding status UI. When status is "failed", a "Retry" button MUST be shown allowing the instructor to re-attempt extraction and embedding without re-uploading the file.
- **FR-013**: System MUST stop reading the lesson description field for RAG content extraction; the uploaded .docx file is the exclusive source.
- **FR-014**: System MUST preserve formatting fidelity when rendering the uploaded document's content to students—headings, lists, tables, bold, italic, paragraph structure, and embedded images/figures must be visually intact.
- **FR-015**: System MUST retain the existing description-based content pipeline as a temporary legacy path so that lessons without an uploaded file continue to function using their description-based embeddings. The legacy path is maintained until all lessons are migrated to file-based content, at which point it is removed in a future release.

### Key Entities

- **LessonFile**: Represents the uploaded .docx file associated with a lesson—includes the stored file path/reference, original filename, file size, upload timestamp, extracted HTML/text content, and reference to the parent lesson. Lifecycle: exists as long as the lesson exists; replaced on re-upload; deleted when explicitly removed or lesson is deleted.
- **Lesson (modified)**: The existing Lesson entity gains a reference to the uploaded file and loses its role as RAG content source via the description field. The `description` field is retained in the schema (old values preserved for reference, new lessons leave it empty) but is no longer read by the content pipeline, the student display, or quiz generation. Schema removal is deferred to a future release.
- **LectureChunk (unchanged)**: Continues to represent chunks in the vector database, but chunks now originate from the uploaded file's extracted text rather than the description field.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Instructors can upload a .docx file and see the processing complete to "ready" status within 30 seconds for typical lecture documents (up to 50 pages).
- **SC-002**: 100% of AI tutor responses are sourced from the uploaded file content—no responses draw from the deprecated description field.
- **SC-003**: Students can read the full lecture content on the lesson page with formatting intact, requiring zero additional clicks beyond navigating to the lesson.
- **SC-004**: Quiz question generation produces questions derived from the uploaded file content with the same quality as the previous description-based approach.
- **SC-005**: The lesson settings interface contains zero references to "Lesson Description" as a content entry mechanism—only file upload is available.
- **SC-006**: Legacy lessons with existing description-based data continue to function without data loss until instructors transition to the new upload workflow.

## Assumptions

- The existing DOCX text extraction capability (`service/docx-extractor.js`, used for quiz generation) can be extended or reused for extracting content from uploaded lesson files.
- The existing file upload infrastructure (used for video uploads) can be adapted for .docx file storage.
- The existing RAG pipeline (chunking, embedding via Gemini, ChromaDB storage) remains unchanged in architecture—only the content source input changes from description text to file-extracted text.
- Maximum file size for .docx uploads follows industry-standard limits (e.g., 25 MB), sufficient for typical lecture documents.
- Instructors are comfortable uploading Word files; this is standard practice in academic settings.
- The transition from description-based to file-based content can be handled without a mandatory bulk migration—instructors transition lessons individually.
- The existing embedding status UI and polling mechanism are reusable for the file-based workflow.
- Document rendering on the student page uses HTML converted from the .docx structure, styled consistently with the LMS design system.
