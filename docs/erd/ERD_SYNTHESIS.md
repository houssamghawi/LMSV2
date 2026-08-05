# MongoDB Logical ERD — Synthesis

**Source:** `model/*.js` in LMSV2-main (excluding nested `LMS-main/`).  
**Notation:** Crow’s Foot · MongoDB collections as entities · embeds as nested attributes.  
**Date:** 2026-07-24

## Collections (22)

| Model | Collection | Key uniqueness |
|-------|------------|----------------|
| User | users | email UK |
| Category | categories | — |
| Course | courses | — |
| Module | modules | — |
| Lesson | lessons | — |
| Enrollment | enrollments | UK (student, course) |
| Payment | payments | UK sparse referenceId |
| Testimonial | testimonials | — |
| Watch | watches | — |
| Report | reports | UK (course, student) |
| Assessment | assessments | — |
| Quiz | quizzes | — |
| Question | questions | — |
| Attempt | attempts | partial UK (quizId, studentId) where status=in_progress |
| GenerationJob | generationjobs | — |
| AdminQuizConfig | adminquizconfigs | — |
| AIProcessingConsent | aiprocessingconsents | UK (userId, consentVersion) |
| TutorConfiguration | tutorconfigurations | UK sparse courseId |
| TutorInteraction | tutorinteractions | — |
| TutorReport | tutorreports | UK (interactionId, studentId) |
| UserActivityLog | useractivitylogs | — |
| DashboardPreference | dashboardpreferences | UK (user, role) |

## Embedded documents

| Parent | Embed | Fields (summary) |
|--------|-------|------------------|
| Question | options[] | id, text |
| Attempt | answers[] | questionId (ObjectId, no ref), selectedOptionIds[], textResponse, graded, awardedPoints, graderComment, gradedBy→User, gradedAt |
| GenerationJob | params | totalQuestions, mcqCount, trueFalseCount, easy/medium/hardCount |
| GenerationJob | draftQuestions[] | draftId, type, difficulty, text, options[], correctOptionIds[], … |
| GenerationJob | mcqValidationSummary | generated, dropped*, included |
| TutorConfiguration | outOfContextMessage | en, ar |
| TutorInteraction | metadata | modelUsed, tokens*, responseTimeMs, relevanceScores[] |
| DashboardPreference | layout[] | id, position, size, visible |
| DashboardPreference | customDateRange | start, end |

## Relationship inventory (code-backed)

| From | To | Cardinality | Evidence |
|------|-----|-------------|----------|
| User | Course | 1:N | Course.instructor ref + populate |
| Category | Course | 1:N | Course.category ref + populate |
| Course | Module | 1:N | Course.modules[] ref + Module.course ObjectId |
| Module | Lesson | 1:N | Module.lessonIds[] ref + nested populate |
| User↔Course | Enrollment | M:N assoc | Enrollment.student+course UK |
| Enrollment | Payment | 0..1:0..1 | Enrollment.payment ref |
| User/Course | Payment | 1:N | Payment.user/course refs |
| User/Course | Testimonial | 1:N | Testimonial refs + Course.testimonials[] |
| User/Lesson/Module | Watch | 1:N | Watch refs |
| User+Course | Report | 1:1 pair | UK (course,student) |
| Assessment | Report | 0..1 | Report.quizAssessment |
| Quiz | Report | M:N | Report.passedQuizIds[] |
| Course/Lesson/User | Quiz | 1:N / 0..1:N | Quiz refs |
| Quiz | Question | 1:N | Question.quizId |
| Quiz/User | Attempt | 1:N | Attempt refs |
| User/Course/Lesson/Quiz | GenerationJob | 1:N | GenerationJob refs |
| GenerationJob | Quiz | 0..1:0..1 | Quiz.generationJobId |
| User | AdminQuizConfig | 1:N | updatedBy |
| User | AIProcessingConsent | 1:N | UK with consentVersion |
| Course | TutorConfiguration | 0..1:0..1 | sparse UK courseId |
| User/Course/Lesson | TutorInteraction | 1:N | refs |
| TutorInteraction/User | TutorReport | 1:N | UK interaction+student |
| User | UserActivityLog | 1:N | ref |
| User | DashboardPreference | 1:N | UK user+role |

## Inferred (no Mongoose `ref`, included from ObjectId usage)

1. **Module.course** → Course  
2. **Attempt.answers[].questionId** → Question  

## Virtuals

- Report.`totalCompletedModeules` → alias for `totalCompletedModules`

## Explicit non-relationships

- ChromaDB chunk IDs in `TutorInteraction.contextChunkIds` are **String[]**, not ObjectId refs to a Mongoose collection.
- No model declares `collection:` override.
