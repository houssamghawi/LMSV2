# Entity Relationship Diagram (ERD) - Chen Notation

This document provides a Chen notation ERD for the Learning Management System based on actual Mongoose schemas in the `model/` directory.

## Diagram File

The visual Chen notation diagram is available in:
- **`ERD_CHEN.drawio`** - Open in [diagrams.net](https://app.diagrams.net/) (formerly draw.io) for interactive viewing and editing

## Entity List

| Entity | Primary Key | 주요 Attributes | Notes |
|--------|-------------|-----------------|-------|
| **User** | `_id` | `email` (unique), `firstName`, `lastName`, `password`, `role`, `status`, `phone`, `bio`, `profilePicture`, `designation`, `lastLogin`, `createdAt`, `updatedAt` | Core user entity. Supports admin, instructor, student roles. |
| **Category** | `_id` | `title`, `description`, `thumbnail` | Course categorization taxonomy. |
| **Course** | `_id` | `title`, `subtitle`, `description`, `thumbnail`, `price`, `active`, `learning[]`, `createdOn`, `modifiedOn` | Main course entity. Contains modules array (non-relational). |
| **Module** | `_id` | `title`, `description`, `active`, `slug`, `order` | Course section/chapter. Contains lessonIds array. |
| **Lesson** | `_id` | `title`, `description`, `duration`, `video_url`, `videoProvider`, `videoFilename`, `videoUrl`, `videoMimeType`, `videoSize`, `active`, `slug`, `access`, `order` | Individual lesson content. Supports local and external video. |
| **Enrollment** | `_id` | `enrollment_date`, `status`, `completion_date`, `method` | Junction entity for User-Course enrollment. Unique constraint on (student, course). |
| **Payment** | `_id` | `sessionId`, `paymentIntentId`, `customerId`, `referenceId`, `amount`, `currency`, `status`, `provider`, `metadata`, `refundedAmount`, `refundReason`, `paidAt`, `refundedAt`, `createdAt`, `updatedAt` | Payment transaction records. Supports Stripe and MockPay providers. |
| **Quiz** | `_id` | `title`, `description`, `published`, `required`, `passPercent`, `timeLimitSec`, `maxAttempts`, `shuffleQuestions`, `shuffleOptions`, `showAnswersPolicy`, `createdAt`, `updatedAt` | Quiz/assessment definition (V2 system). Can be course-level or lesson-specific. |
| **Question** | `_id` | `type`, `text`, `options[]` (embedded), `correctOptionIds[]`, `explanation`, `points`, `order`, `createdAt`, `updatedAt` | Quiz question definition. Embedded options schema. |
| **Attempt** | `_id` | `status`, `startedAt`, `expiresAt`, `submittedAt`, `answers[]` (embedded), `score`, `scorePercent`, `passed`, `createdAt`, `updatedAt` | Student quiz attempt. Embedded answers schema. |
| **Watch** | `_id` | `state`, `created_at`, `modified_at`, `lastTime` | Lesson viewing progress tracking. Tracks video watch state and playback position. |
| **Report** | `_id` | `totalCompletedLessons[]`, `totalCompletedModules[]`, `passedQuizIds[]`, `latestQuizAttemptByQuiz` (Map), `completion_date` | Course completion/progress aggregation. Unique constraint on (course, student). |
| **Testimonial** | `_id` | `content`, `rating` | Course reviews/ratings. |
| **Assessment** | `_id` | `assessments[]`, `otherMarks` | **LEGACY**: Deprecated model. Referenced by Report but no active relationships. |

## Relationship List

| Relationship | Entity A (Cardinality) | Entity B (Cardinality) | FK Field(s) | Notes |
|--------------|------------------------|------------------------|-------------|-------|
| **INSTRUCTS** | User (1) | Course (N) | `Course.instructor` | One user (instructor) creates many courses |
| **ENROLLS_IN** | User (1) | Enrollment (N) | `Enrollment.student` | One user can have many enrollments |
| **ENROLLED_FOR** | Course (1) | Enrollment (N) | `Enrollment.course` | One course can have many enrollments |
| **MAKES_PAYMENT** | User (1) | Payment (N) | `Payment.user` | One user can make many payments |
| **PAYMENT_FOR** | Course (1) | Payment (N) | `Payment.course` | One course can have many payments |
| **LINKED_TO_PAYMENT** | Enrollment (1) | Payment (0..1) | `Enrollment.payment` | Optional: enrollment may link to payment |
| **CATEGORIZES** | Category (1) | Course (N) | `Course.category` | One category contains many courses |
| **CONTAINS_MODULE** | Course (1) | Module (N) | `Course.modules[]` (array, non-relational) | One course contains many modules (stored as array) |
| **BELONGS_TO_COURSE** | Module (N) | Course (1) | `Module.course` (non-relational ObjectId) | Module references course (no explicit ref) |
| **CONTAINS_LESSON** | Module (1) | Lesson (N) | `Module.lessonIds[]` | One module contains many lessons |
| **CREATES_QUIZ** | User (1) | Quiz (N) | `Quiz.createdBy` | One user creates many quizzes |
| **HAS_QUIZ** | Course (1) | Quiz (N) | `Quiz.courseId` | One course can have many quizzes |
| **QUIZ_FOR_LESSON** | Lesson (0..1) | Quiz (N) | `Quiz.lessonId` | Optional: quiz can be lesson-specific |
| **CONTAINS_QUESTION** | Quiz (1) | Question (N) | `Question.quizId` | One quiz contains many questions |
| **TAKES_ATTEMPT** | User (1) | Attempt (N) | `Attempt.studentId` | One user can take many quiz attempts |
| **ATTEMPT_OF_QUIZ** | Quiz (1) | Attempt (N) | `Attempt.quizId` | One quiz can have many attempts |
| **WATCHES_LESSON** | User (1) | Watch (N) | `Watch.user` | One user can watch many lessons |
| **WATCHED_IN_LESSON** | Lesson (0..1) | Watch (N) | `Watch.lesson` | Optional: watch tracks lesson |
| **WATCHED_IN_MODULE** | Module (0..1) | Watch (N) | `Watch.module` | Optional: watch tracks module |
| **HAS_PROGRESS** | User (1) | Report (N) | `Report.student` | One user can have many progress reports |
| **TRACKED_IN_COURSE** | Course (1) | Report (N) | `Report.course` | One course can have many progress reports |
| **PASSED_QUIZ** | Quiz (1) | Report (N) | `Report.passedQuizIds[]` | One quiz can be passed by many reports (many-to-many via array) |
| **WRITES_REVIEW** | User (1) | Testimonial (N) | `Testimonial.user` | One user can write many testimonials |
| **REVIEW_FOR_COURSE** | Course (1) | Testimonial (N) | `Testimonial.courseId` | One course can have many testimonials |
| **REFERENCES_LEGACY** | Report (N) | Assessment (0..1) | `Report.quizAssessment` | **LEGACY**: Optional reference to deprecated Assessment model |

## Relationship Cardinalities

### One-to-Many (1:N)
- User → Course (via INSTRUCTS)
- User → Enrollment (via ENROLLS_IN)
- User → Payment (via MAKES_PAYMENT)
- User → Quiz (via CREATES_QUIZ)
- User → Attempt (via TAKES_ATTEMPT)
- User → Watch (via WATCHES_LESSON)
- User → Report (via HAS_PROGRESS)
- User → Testimonial (via WRITES_REVIEW)
- Category → Course (via CATEGORIZES)
- Course → Enrollment (via ENROLLED_FOR)
- Course → Payment (via PAYMENT_FOR)
- Course → Quiz (via HAS_QUIZ)
- Course → Report (via TRACKED_IN_COURSE)
- Course → Testimonial (via REVIEW_FOR_COURSE)
- Module → Lesson (via CONTAINS_LESSON)
- Quiz → Question (via CONTAINS_QUESTION)
- Quiz → Attempt (via ATTEMPT_OF_QUIZ)

### Many-to-Many (M:N) via Junction Entities
- **User ↔ Course** via `Enrollment` (with unique constraint on student+course)
- **User ↔ Course** via `Payment` (multiple payments possible)
- **User ↔ Quiz** via `Attempt` (multiple attempts allowed)
- **Quiz ↔ Report** via `Report.passedQuizIds[]` array (many-to-many stored as array)

### Optional Relationships (0..1 or 0..N)
- Enrollment → Payment (0..1) via LINKED_TO_PAYMENT
- Lesson → Quiz (0..N) via QUIZ_FOR_LESSON
- Lesson → Watch (0..N) via WATCHED_IN_LESSON
- Module → Watch (0..N) via WATCHED_IN_MODULE
- Report → Assessment (0..1) via REFERENCES_LEGACY (legacy)

### Non-Relational References
- `Module.course` - ObjectId without `ref:` declaration. Relationship exists but is not enforced at schema level.
- `Course.modules[]` - Array of ObjectIds without explicit refs. Reverse relationship maintained via array.

## Notes

1. **Primary Keys**: All entities use `_id` (ObjectId) as primary key, which is automatically generated by MongoDB/Mongoose.

2. **Foreign Keys**: Marked as `(FK)` in the diagram. All foreign keys are ObjectId references unless noted as "non-relational".

3. **Embedded Documents**: 
   - `Question.options[]` - Embedded option schema (id, text)
   - `Attempt.answers[]` - Embedded answer schema (questionId, selectedOptionIds[])

4. **Array Relationships**: Some relationships are stored as arrays:
   - `Course.modules[]` - Array of Module ObjectIds
   - `Course.testimonials[]` - Array of Testimonial ObjectIds
   - `Module.lessonIds[]` - Array of Lesson ObjectIds
   - `Report.passedQuizIds[]` - Array of Quiz ObjectIds

5. **Legacy Model**: `Assessment` is marked as legacy/deprecated. It's referenced by `Report.quizAssessment` but has no active relationships.

6. **Unique Constraints**:
   - `User.email` - Unique
   - `Enrollment(student, course)` - Unique composite
   - `Payment.referenceId` - Unique (sparse, for MockPay)
   - `Report(course, student)` - Unique composite
   - `Attempt(quizId, studentId)` - Unique for in-progress status only

7. **Diagram Style**: The Chen notation diagram uses:
   - Rectangles for entities
   - Diamonds for relationships
   - Ovals for attributes
   - Underlined text for primary keys
   - `(FK)` suffix for foreign key attributes
