# Complete Quiz System - Implementation Guide

This document provides a comprehensive guide to the new Quiz System implementation.

---

## 📋 System Overview

The Quiz System supports:
- **Course-level quizzes**: Final exams or assessments for entire courses
- **Lesson-level quizzes**: Quizzes tied to specific lessons
- **Multiple question types**: Multiple choice (single/multiple), True/False
- **Comprehensive tracking**: Attempts, scores, statistics
- **Integration**: Progress tracking, course completion, certificates

---

## 🗄️ Database Models

### Quiz Model (`model/quiz-model.js`)
- **Course association**: Required - every quiz belongs to a course
- **Lesson association**: Optional - if set, quiz is lesson-specific
- **Settings**: Duration, pass score, attempts allowed, required flag
- **Question settings**: Shuffle questions/answers, show correct answers
- **Status**: Published/draft

### Question Model (`model/question-model.js`)
- **Types**: `multiple_choice_single`, `multiple_choice_multiple`, `true_false`, `short_text`
- **Options**: For multiple choice questions
- **Grading**: Points, correct answer indicators
- **Explanation**: Shown after submission (based on quiz settings)

### QuizAttempt Model (`model/quiz-attempt-model.js`)
- **Tracking**: Every student attempt
- **Answers**: Student responses
- **Grading**: Auto-graded scores, pass/fail status
- **Timing**: Start time, submission time, duration

---

## 🔑 Key Features

### 1. Quiz Creation Flow (Instructor)
```
1. Navigate to course/lesson
2. Click "Create Quiz"
3. Fill quiz details (title, description, settings)
4. Add questions (multiple types)
5. Publish quiz
```

### 2. Quiz Taking Flow (Student)
```
1. Access quiz (via course/lesson page)
2. Start attempt (validation: enrolled, published, attempts remaining)
3. Answer questions (timer if enabled)
4. Submit quiz
5. View results (based on showCorrectAnswers setting)
6. Retake if allowed
```

### 3. Grading System
- **Auto-grading**: For objective questions (multiple choice, true/false)
- **Manual grading**: For short text questions (future enhancement)
- **Scoring**: Points-based, converted to percentage
- **Pass/Fail**: Based on passScore threshold

### 4. Progress Integration
- **Lesson completion**: Requires passing all required lesson quizzes
- **Course completion**: Requires all lessons completed + all required course quizzes passed
- **Certificate eligibility**: Based on course completion (which includes quizzes)

---

## 📁 File Structure

```
model/
  ├── quiz-model.js           # Quiz schema
  ├── question-model.js       # Question schema
  └── quiz-attempt-model.js   # Attempt tracking schema

queries/
  └── quizzes.js              # Query functions

lib/
  └── quiz-grading.js         # Grading logic

app/
  ├── actions/
  │   └── quizzes.js          # Server actions (CRUD operations)
  ├── api/
  │   └── quizzes/            # API routes (if needed)
  ├── dashboard/
  │   └── courses/[courseId]/
  │       └── quizzes/        # Instructor quiz management UI
  └── (main)/
      └── courses/[id]/
          └── quizzes/        # Student quiz taking UI
```

---

## 🚀 Implementation Steps

### Phase 1: Core Models & Logic ✅
- [x] Create Quiz, Question, QuizAttempt models
- [x] Create query functions
- [x] Create grading logic
- [x] Create server actions

### Phase 2: Instructor UI
- [ ] Quiz list page (dashboard)
- [ ] Quiz creation form
- [ ] Question editor
- [ ] Quiz preview
- [ ] Quiz statistics/analytics
- [ ] Student attempts view

### Phase 3: Student UI
- [ ] Quiz access/list page
- [ ] Quiz taking interface
- [ ] Timer component
- [ ] Results page
- [ ] Attempt history

### Phase 4: Integration
- [ ] Progress tracking integration
- [ ] Certificate integration
- [ ] Course/lesson completion logic
- [ ] Quiz visibility in course sidebar

---

## 🔌 API Endpoints

### Server Actions (recommended approach)

**Instructor Actions:**
- `createQuiz(data)` - Create new quiz
- `updateQuiz(quizId, data)` - Update quiz
- `deleteQuiz(quizId)` - Delete quiz
- `addQuestion(quizId, questionData)` - Add question
- `updateQuestion(questionId, questionData)` - Update question
- `deleteQuestion(questionId)` - Delete question

**Student Actions:**
- `startQuizAttempt(quizId)` - Start taking quiz
- `submitQuizAttempt(attemptId, answers)` - Submit answers

**Query Functions:**
- `getQuizById(quizId)` - Get quiz with questions
- `getQuizzesForCourse(courseId, options)` - Get course quizzes
- `getQuizzesForLesson(lessonId, options)` - Get lesson quizzes
- `getStudentQuizAttempts(quizId, studentId)` - Get student's attempts
- `getQuizAttempts(quizId, options)` - Get all attempts (instructor)

---

## 📊 Quiz Statistics

The system provides:
- **Total attempts**: Number of submissions
- **Average score**: Mean percentage
- **Pass rate**: Percentage of passing attempts
- **Average time**: Mean time spent
- **Question-level stats**: Correctness rate per question

---

## 🔒 Authorization Rules

### Instructor
- Can create/edit/delete own quizzes
- Can view all attempts for own quizzes
- Can preview quizzes as student

### Student
- Can take quiz only if:
  - Enrolled in course
  - Quiz is published
  - Has attempts remaining (if limited)
- Can view own attempt history
- Can retake if allowed

---

## 🔄 Integration Points

### 1. Progress Tracking
```javascript
// After quiz submission
if (attempt.passed && quiz.isRequired) {
  // Update lesson/course progress
  // Mark lesson as completed if all required quizzes passed
  // Update course progress percentage
}
```

### 2. Certificate Eligibility
```javascript
// Check course completion
const requiredQuizzes = await getQuizzesForCourse(courseId, {
  published: true,
  isRequired: true
});

const passedRequiredQuizzes = await checkRequiredQuizzesPassed(
  courseId,
  studentId,
  requiredQuizzes
);

if (passedRequiredQuizzes) {
  // Course eligible for certificate
}
```

### 3. Lesson Completion
```javascript
// Check if lesson is complete
const requiredLessonQuizzes = await getQuizzesForLesson(lessonId, {
  published: true,
  isRequired: true
});

const allPassed = await checkAllQuizzesPassed(
  lessonId,
  studentId,
  requiredLessonQuizzes
);

if (allPassed) {
  // Mark lesson as completed
}
```

---

## 🧪 Testing Checklist

### Instructor Features
- [ ] Create quiz with all question types
- [ ] Edit quiz settings
- [ ] Add/remove/reorder questions
- [ ] Publish/unpublish quiz
- [ ] View statistics
- [ ] Preview quiz as student

### Student Features
- [ ] Start quiz attempt
- [ ] Answer all question types
- [ ] Submit quiz
- [ ] View results (correct answers based on settings)
- [ ] Retake quiz (if allowed)
- [ ] View attempt history

### Integration
- [ ] Quiz affects lesson completion
- [ ] Quiz affects course completion
- [ ] Required quizzes block completion
- [ ] Certificate eligibility includes quizzes
- [ ] Progress bars update correctly

---

## 📝 Next Steps

1. **Create Instructor UI Components**
   - Quiz list page
   - Quiz form (create/edit)
   - Question editor
   - Statistics dashboard

2. **Create Student UI Components**
   - Quiz taking interface
   - Results page
   - Attempt history

3. **Integrate with Existing Systems**
   - Update progress tracking
   - Update certificate logic
   - Add quiz links to course sidebar

4. **Enhancements (Future)**
   - Manual grading for short text
   - Question banks
   - Quiz templates
   - Export quiz results

---

## 🎯 Usage Examples

### Creating a Quiz
```javascript
const result = await createQuiz({
  title: "Introduction Quiz",
  description: "Test your understanding",
  courseId: "course123",
  lessonId: "lesson456", // Optional
  durationMinutes: 30,
  passScore: 70,
  attemptsAllowed: 3,
  isRequired: true,
  shuffleQuestions: true,
  shuffleAnswers: true,
  showCorrectAnswers: 'after_pass',
  published: true
});
```

### Adding a Question
```javascript
const result = await addQuestion(quizId, {
  questionText: "What is 2 + 2?",
  questionType: "multiple_choice_single",
  points: 5,
  options: [
    { text: "3", isCorrect: false, order: 0 },
    { text: "4", isCorrect: true, order: 1 },
    { text: "5", isCorrect: false, order: 2 }
  ],
  explanation: "Basic addition"
});
```

### Starting a Quiz
```javascript
const result = await startQuizAttempt(quizId);
if (result.ok) {
  // Show quiz interface with result.quiz.questions
  // Store result.attemptId for submission
}
```

### Submitting a Quiz
```javascript
const result = await submitQuizAttempt(attemptId, [
  {
    questionId: "question1",
    selectedOptions: [1] // Selected option index
  },
  {
    questionId: "question2",
    selectedOptions: [0, 2] // Multiple selections
  }
]);

if (result.ok) {
  // Show results: result.attempt
}
```

---

## ⚠️ Important Notes

1. **Model Name**: The Quiz model uses `QuizNew` to avoid conflicts with existing `Quiz` model. Update references if needed.

2. **Backward Compatibility**: Existing quiz system (QuizSet) remains intact. New system can coexist.

3. **Migration**: When ready, you can migrate existing quizzes to the new system.

4. **Performance**: Use indexes for efficient queries. All critical fields are indexed.

5. **Security**: All actions verify ownership/enrollment before allowing operations.

---

## 📚 References

- Models: `model/quiz-model.js`, `model/question-model.js`, `model/quiz-attempt-model.js`
- Queries: `queries/quizzes.js`
- Grading: `lib/quiz-grading.js`
- Actions: `app/actions/quizzes.js`

