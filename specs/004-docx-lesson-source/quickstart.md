# Quickstart: Word File as Lesson Source

**Feature**: 004-docx-lesson-source
**Date**: 2026-07-12
**Purpose**: Validation guide for end-to-end feature testing

## Prerequisites

### Environment Setup

1. **MongoDB** running locally or accessible via `MONGODB_URI`
2. **ChromaDB** running via Docker:
   ```bash
   docker run -d --name chromadb -p 8000:8000 chromadb/chroma:latest
   ```
3. **Environment variables** in `.env.local`:
   ```
   GEMINI_API_KEY=your_gemini_api_key
   CHROMA_URL=http://localhost:8000
   MONGODB_URI=mongodb://localhost:27017/lms
   ```
4. **Upload directories** exist (created automatically by upload route, but verify):
   ```bash
   mkdir -p uploads/lessons uploads/lesson-images
   ```

### Test Data

- A course with at least one module and one lesson (created by an instructor)
- A test .docx file with text, headings, lists, and at least one embedded image
- A student account enrolled in the course

---

## Validation Scenarios

### Scenario 1: Upload .docx File (P1)

**Objective**: Verify instructor can upload a .docx file and it is processed successfully.

**Setup**:
1. Login as an instructor who owns a course
2. Navigate to a lesson's settings modal

**Steps**:
1. Open the lesson settings modal
2. Verify no "Lesson Description" textarea is present
3. Locate the file upload control
4. Upload a valid .docx file (under 25 MB)
5. Observe the processing status

**Expected Outcome**:
- File is accepted and stored
- Status progresses: uploading → extracting → embedding → ready
- Filename and file size are displayed
- Chunk count is shown once embedding completes

**API Validation**:
```bash
curl -X POST http://localhost:3000/api/upload/lesson-docx \
  -H "Cookie: <instructor_session_cookie>" \
  -F "file=@/path/to/lecture.docx" \
  -F "lessonId=<lesson_id>"
```

**Expected Response** (200):
```json
{
  "success": true,
  "data": {
    "lessonId": "<lesson_id>",
    "filename": "<lesson_id>.docx",
    "originalName": "lecture.docx",
    "embeddingStatus": "pending"
  }
}
```

---

### Scenario 2: Student Views "Lecture" Section (P1)

**Objective**: Verify students see formatted lecture content below the video.

**Setup**: A lesson with a processed .docx file (embedding status "ready")

**Steps**:
1. Login as an enrolled student
2. Navigate to the lesson page
3. Look below the video player

**Expected Outcome**:
- A "Lecture" heading is displayed below the video
- Document content is rendered with formatting (headings, lists, bold, italic)
- Embedded images from the .docx are displayed inline
- No "Description" tab/section is visible

---

### Scenario 3: AI Tutor Answers from File Content (P1)

**Objective**: Verify the AI tutor retrieves context from the uploaded file, not the description field.

**Setup**: A lesson with a processed .docx file about "cell biology"

**Steps**:
1. Login as an enrolled student
2. Navigate to the lesson page
3. Open the AI tutor panel
4. Ask: "What is mitosis?"

**Expected Outcome**:
- AI tutor responds with an answer sourced from the uploaded file
- Citation references specific text from the document
- `contextStatus: "answered"` in the response

**API Validation**:
```bash
curl -X POST http://localhost:3000/api/tutor/ask \
  -H "Content-Type: application/json" \
  -H "Cookie: <student_session_cookie>" \
  -d '{
    "lessonId": "<lesson_id>",
    "courseId": "<course_id>",
    "question": "What is mitosis?"
  }'
```

---

### Scenario 4: Replace Uploaded File (P1)

**Objective**: Verify replacing a .docx file clears old data and processes the new file.

**Setup**: A lesson with an existing processed .docx file

**Steps**:
1. Login as instructor
2. Open lesson settings
3. Upload a new .docx file with different content
4. Wait for processing to complete

**Expected Outcome**:
- Old file is removed from disk
- Old images directory is cleared
- Old embeddings are removed from ChromaDB
- New content is extracted and embedded
- Student page shows new content under "Lecture"
- AI tutor answers from new content

---

### Scenario 5: Delete Uploaded File (P1)

**Objective**: Verify deleting a file clears all associated data.

**Steps**:
1. Login as instructor
2. Open lesson settings for a lesson with an uploaded file
3. Click delete/remove on the file

**Expected Outcome**:
- File removed from disk, images directory cleared
- Embeddings removed from ChromaDB and MongoDB
- Embedding status set to "none"
- Student page shows no lecture content (or "No lecture material available" message)
- AI tutor is disabled for this lesson

**API Validation**:
```bash
curl -X DELETE "http://localhost:3000/api/upload/lesson-docx?lessonId=<lesson_id>" \
  -H "Cookie: <instructor_session_cookie>"
```

---

### Scenario 6: Invalid File Rejection (P1)

**Objective**: Verify non-.docx files are rejected with clear error messages.

**Steps**:
1. Attempt to upload a .pdf file
2. Attempt to upload a .txt file
3. Attempt to upload a file larger than 25 MB
4. Attempt to upload a .docx file that contains only images (no text)

**Expected Outcome per attempt**:
1. Rejected: "Invalid file type. Only .docx files are accepted."
2. Rejected: "Invalid file type. Only .docx files are accepted."
3. Rejected: "File exceeds maximum size of 25 MB."
4. Rejected: "No text content could be extracted from the file."

---

### Scenario 7: Retry on Failure (P1)

**Objective**: Verify the retry button re-attempts processing after a failure.

**Setup**: Simulate a failure (e.g., disconnect ChromaDB temporarily during embedding)

**Steps**:
1. Upload a .docx file while ChromaDB is down
2. Observe "failed" status with error message
3. Restart ChromaDB
4. Click the "Retry" button

**Expected Outcome**:
- Status changes from "failed" to "pending"
- Processing completes to "ready"
- Embeddings are created successfully

---

### Scenario 8: Legacy Lesson Fallback (P1)

**Objective**: Verify old lessons with description-based content continue to work.

**Setup**: A lesson with existing `description` text and description-based embeddings, but NO uploaded .docx file

**Steps**:
1. Navigate to the lesson page as a student
2. Ask the AI tutor a question about the description content

**Expected Outcome**:
- Description content is displayed (legacy path)
- AI tutor answers from description-based embeddings
- No errors or degraded experience

---

### Scenario 9: Quiz Generation from Uploaded File (P2)

**Objective**: Verify quiz generation uses the uploaded file content.

**Setup**: A lesson with a processed .docx file

**Steps**:
1. Login as instructor
2. Navigate to quiz generation
3. Select the lesson with uploaded content
4. Trigger quiz generation

**Expected Outcome**:
- Quiz questions are generated from the uploaded file content
- No need to separately upload a .docx for quiz generation

---

## Automated Test Commands

```bash
# Run all feature-related tests
npm test -- --grep "lesson-docx\|lecture-embedder-file\|docx-validator"

# Run upload API integration tests
npm test -- tests/integration/lesson-docx-upload.test.js

# Run embedding integration tests
npm test -- tests/integration/lecture-embedder-file.test.js

# Run validation unit tests
npm test -- tests/unit/docx-validator.test.js

# Run HTML extraction unit tests
npm test -- tests/unit/docx-extractor-html.test.js
```

---

## Checklist Summary

| Scenario | Priority | Automated Test File |
|----------|----------|-------------------|
| Upload .docx file | P1 | `lesson-docx-upload.test.js` |
| Student views "Lecture" | P1 | Manual (UI) + API assertions |
| AI tutor from file content | P1 | `lecture-embedder-file.test.js` |
| Replace uploaded file | P1 | `lesson-docx-upload.test.js` |
| Delete uploaded file | P1 | `lesson-docx-upload.test.js` |
| Invalid file rejection | P1 | `docx-validator.test.js` |
| Retry on failure | P1 | `lesson-docx-upload.test.js` |
| Legacy fallback | P1 | `lecture-embedder-file.test.js` |
| Quiz generation | P2 | `lesson-docx-upload.test.js` |

---

## Troubleshooting

### Upload Fails Silently
```bash
# Check upload directory permissions
ls -la uploads/lessons/
ls -la uploads/lesson-images/

# Check Next.js body size limit in next.config.mjs
# Ensure experimental.serverActions.bodySizeLimit is >= 25MB
```

### Extracted HTML Missing Images
```bash
# Check lesson-images directory for the lesson
ls uploads/lesson-images/<lessonId>/

# Verify the image serving route is working
curl http://localhost:3000/api/lesson-images/<lessonId>/<filename>
```

### Embeddings Not Created After Upload
```bash
# Check lesson embedding status
db.lessons.findOne({ _id: ObjectId("<lessonId>") }, { tutorEmbeddingStatus: 1, tutorEmbeddingError: 1 })

# Check lecture chunk count
db.lecturechunks.countDocuments({ lessonId: ObjectId("<lessonId>") })

# Verify ChromaDB is running
docker ps | grep chromadb
```

### Legacy Lesson Not Working
```bash
# Check if lesson has description content
db.lessons.findOne({ _id: ObjectId("<lessonId>") }, { description: 1, extractedText: 1 })

# If extractedText is null and description exists, legacy path should activate
```
