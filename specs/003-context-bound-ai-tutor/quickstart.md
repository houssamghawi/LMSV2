# Quickstart: Context-Bound AI Tutor

**Feature**: 003-context-bound-ai-tutor  
**Date**: 2026-07-06  
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

### Test Data

Create a test course with a lesson containing lecture content. The lecture content must be uploaded and embedded before the AI tutor can be used.

---

## Validation Scenarios

### Scenario 1: Student Asks Question Within Context (P1)

**Objective**: Verify the AI tutor answers from lecture content with citations.

**Setup**:
1. Create/use an existing course with an instructor
2. Add a lesson with lecture content (e.g., "Photosynthesis occurs in the chloroplasts of plant cells.")
3. Embed the lecture content (trigger embedding job)
4. Enroll a test student in the course

**Steps**:
```bash
# 1. Login as student
# 2. Navigate to the lesson
# 3. Open AI tutor panel
# 4. Ask: "Where does photosynthesis occur?"
```

**Expected Outcome**:
- Response contains "chloroplasts" or equivalent from lecture
- Citation is displayed with quoted text
- Response language matches question language (English)
- Interaction is logged with `contextStatus: "answered"`

**API Validation**:
```bash
curl -X POST http://localhost:3000/api/tutor/ask \
  -H "Content-Type: application/json" \
  -H "Cookie: <session_cookie>" \
  -d '{
    "lessonId": "<lesson_id>",
    "courseId": "<course_id>",
    "question": "Where does photosynthesis occur?"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "contextStatus": "answered",
    "citation": "\"Photosynthesis occurs in the chloroplasts...\"",
    "detectedLanguage": "en"
  }
}
```

---

### Scenario 2: Student Asks Question Outside Context (P1)

**Objective**: Verify the AI tutor returns the out-of-context message.

**Setup**: Same as Scenario 1

**Steps**:
```bash
# 1. Login as student
# 2. Navigate to the lesson (about Cell Biology)
# 3. Open AI tutor panel
# 4. Ask: "What is the capital of France?"
```

**Expected Outcome**:
- Response is the exact out-of-context message configured
- No citation is displayed
- Interaction is logged with `contextStatus: "out_of_context"`

**API Validation**:
```bash
curl -X POST http://localhost:3000/api/tutor/ask \
  -H "Content-Type: application/json" \
  -H "Cookie: <session_cookie>" \
  -d '{
    "lessonId": "<lesson_id>",
    "courseId": "<course_id>",
    "question": "What is the capital of France?"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "contextStatus": "out_of_context",
    "citation": null,
    "answer": "I cannot find the answer to your question in the lecture materials..."
  }
}
```

---

### Scenario 3: Arabic Language Support

**Objective**: Verify the AI tutor detects Arabic and responds in Arabic.

**Setup**: Same course with Arabic lecture content or mixed content

**Steps**:
```bash
# 1. Login as student
# 2. Navigate to the lesson
# 3. Open AI tutor panel
# 4. Ask in Arabic: "أين يحدث التمثيل الضوئي؟"
```

**Expected Outcome**:
- Response is in Arabic
- `detectedLanguage: "ar"` in response
- If out-of-context, Arabic version of message is used

---

### Scenario 4: Empty Lecture Content

**Objective**: Verify the AI tutor is disabled when no content is uploaded.

**Setup**: Create a lesson WITHOUT lecture content

**Steps**:
```bash
# 1. Login as student enrolled in course
# 2. Navigate to lesson without lecture content
# 3. Try to access AI tutor panel
```

**Expected Outcome**:
- AI tutor input is disabled
- Message displayed: "AI tutor unavailable—no lecture content uploaded."

**API Validation**:
```bash
curl -X POST http://localhost:3000/api/tutor/ask \
  -H "Content-Type: application/json" \
  -H "Cookie: <session_cookie>" \
  -d '{
    "lessonId": "<empty_lesson_id>",
    "courseId": "<course_id>",
    "question": "Test question"
  }'
```

**Expected Response** (400):
```json
{
  "success": false,
  "error": "AI tutor unavailable—no lecture content uploaded.",
  "code": "NO_LECTURE_CONTENT"
}
```

---

### Scenario 5: Instructor Views Interaction Logs (P2)

**Objective**: Verify instructors can view and filter student interactions.

**Setup**: 
1. Have multiple students ask questions (both answered and out-of-context)
2. Login as the course instructor

**Steps**:
```bash
# 1. Login as instructor
# 2. Navigate to course dashboard
# 3. Access AI tutor interaction logs
# 4. Filter by "out-of-context" responses
```

**Expected Outcome**:
- Instructor sees all interactions for their course
- Can filter by context status
- Can see which students asked which questions
- Pagination works correctly

**API Validation**:
```bash
curl "http://localhost:3000/api/tutor/history?courseId=<course_id>&contextStatus=out_of_context&page=1&limit=20" \
  -H "Cookie: <instructor_session_cookie>"
```

---

### Scenario 6: Admin Configures Out-of-Context Message (P3)

**Objective**: Verify admin can customize the out-of-context message.

**Setup**: Login as admin

**Steps**:
```bash
# 1. Login as admin
# 2. Navigate to AI tutor settings
# 3. Update the out-of-context message for English
# 4. Save changes
# 5. As a student, trigger an out-of-context response
```

**Expected Outcome**:
- New message is saved
- Subsequent out-of-context responses use the new message

**API Validation**:
```bash
# Update config
curl -X PUT http://localhost:3000/api/tutor/config \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin_session_cookie>" \
  -d '{
    "courseId": null,
    "outOfContextMessage": {
      "en": "Custom message: Answer not found in materials."
    }
  }'

# Verify config
curl "http://localhost:3000/api/tutor/config" \
  -H "Cookie: <admin_session_cookie>"
```

---

### Scenario 7: AI Service Unavailability

**Objective**: Verify graceful error handling when AI service is down.

**Setup**: Temporarily break the Gemini API connection (invalid key or mock failure)

**Steps**:
```bash
# 1. Set GEMINI_API_KEY to invalid value
# 2. Restart server
# 3. Login as student
# 4. Try to ask a question
```

**Expected Outcome**:
- User-friendly error message displayed
- Error logged with `AI_SERVICE_ERROR` code
- No crash or stack trace exposed to user

---

### Scenario 8: Student Interaction History

**Objective**: Verify students can view their own Q&A history.

**Setup**: Student has asked multiple questions

**Steps**:
```bash
# 1. Login as student
# 2. Navigate to course
# 3. Access "My AI Tutor History" (or equivalent)
# 4. View past questions and answers
```

**Expected Outcome**:
- Student sees only their own interactions
- Interactions are paginated
- Can provide feedback on past interactions

---

### Scenario 9: Rate Limiting

**Objective**: Verify rate limiting prevents abuse.

**Setup**: Configure rate limit to 5/hour for testing

**Steps**:
```bash
# Run 6 requests in quick succession
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/tutor/ask \
    -H "Content-Type: application/json" \
    -H "Cookie: <session_cookie>" \
    -d '{
      "lessonId": "<lesson_id>",
      "courseId": "<course_id>",
      "question": "Test question '$i'"
    }'
  echo ""
done
```

**Expected Outcome**:
- First 5 requests succeed
- 6th request returns 429 with `RATE_LIMIT_EXCEEDED`
- `Retry-After` header indicates wait time

---

## Automated Test Commands

```bash
# Run all tutor-related tests
npm test -- --grep "tutor"

# Run integration tests only
npm test -- tests/integration/tutor-api.test.js

# Run with coverage
npm test -- --coverage tests/integration/tutor-api.test.js
```

---

## Checklist Summary

| Scenario | Priority | Status |
|----------|----------|--------|
| Question within context | P1 | ✓ (automated: tutor-ask-context.test.js) |
| Question outside context | P1 | ✓ (automated: tutor-ask-nocontext.test.js) |
| Arabic language support | P1 | ✓ (automated: language-detector.test.js) |
| Empty lecture content | P1 | ✓ (automated: tutor-ask-nocontext.test.js) |
| Instructor views logs | P2 | ✓ (automated: tutor-history-instructor.test.js) |
| Admin configures message | P3 | ✓ (automated: tutor-config.test.js) |
| AI service unavailability | P1 | ✓ (automated: ai-tutor.test.js) |
| Student history access | P2 | ✓ (automated: tutor-history-student.test.js) |
| Rate limiting | P2 | ✓ (covered by ask route + config) |

---

## Troubleshooting

### ChromaDB Connection Failed
```bash
# Check if ChromaDB is running
docker ps | grep chromadb

# Check logs
docker logs chromadb

# Restart if needed
docker restart chromadb
```

### Embeddings Not Created
```bash
# Check lecture chunk count for a lesson
db.lecturechunks.countDocuments({ lessonId: ObjectId("<lesson_id>") })

# Manually trigger embedding (if applicable)
npm run embed-lesson -- --lessonId=<lesson_id>
```

### Gemini API Errors
```bash
# Verify API key
curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY"

# Check rate limits in Google Cloud Console
```
