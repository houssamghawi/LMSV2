# UML Class Diagram - LMS Repository

This document provides a complete UML Class Diagram for the Learning Management System based on actual code structure.

## Diagram File

The PlantUML class diagram is available in:
- **`CLASS_DIAGRAM.puml`** - Open in [PlantUML Online](http://www.plantuml.com/plantuml/uml/) or use PlantUML extension in VS Code

## How to Read the Diagram

### Package Organization

The diagram is organized into five main packages:

1. **Models** (Domain Layer) - Mongoose schemas representing database entities
2. **Queries** (Repository Layer) - Data access functions that interact with models
3. **Actions** (Service Layer) - Server actions containing business logic
4. **API** (Controller Layer) - HTTP route handlers (Next.js API routes)
5. **Auth/Security** - Authentication, authorization, and permission systems

### Stereotypes

| Stereotype | Meaning | Example |
|------------|---------|---------|
| `<<Model>>` | Mongoose schema/model | `User`, `Course`, `Enrollment` |
| `<<Repository>>` | Data access layer | `CoursesQuery`, `EnrollmentsQuery` |
| `<<Service>>` | Business logic layer | `CourseAction`, `EnrollmentAction` |
| `<<Controller>>` | HTTP API handler | `PaymentStatusRoute`, `QuizAttemptRoute` |
| `<<Auth>>` | Authentication system | `Auth` |
| `<<Middleware>>` | Request middleware | `Middleware` |
| `<<Permissions>>` | Permission definitions | `Permissions` |
| `<<Authorization>>` | Authorization checks | `Authorization` |

### Relationship Types

- **Solid arrow (`-->`)** - Association between models (with multiplicities like `1`, `*`, `0..1`)
- **Dashed arrow (`..>`)** - Dependency (one class uses another)
- **Multiplicities** - Show cardinality: `1` (one), `*` (many), `0..1` (zero or one)

## Class/Module to File Mapping

### Models Package

| Class Name | Source File | Key Relationships |
|------------|-------------|-------------------|
| `User` | `model/user-model.js` | → Course (instructor), → Enrollment, → Payment, → Quiz, → Attempt, → Watch, → Report, → Testimonial |
| `Category` | `model/category-model.js` | → Course (1:N) |
| `Course` | `model/course-model.js` | ← User (instructor), ← Category, → Module, → Enrollment, → Payment, → Quiz, → Report, → Testimonial |
| `Module` | `model/module.model.js` | ← Course, → Lesson |
| `Lesson` | `model/lesson.model.js` | ← Module, → Quiz (optional), → Watch |
| `Enrollment` | `model/enrollment-model.js` | ← User (student), ← Course, → Payment (optional) |
| `Payment` | `model/payment-model.js` | ← User, ← Course, ← Enrollment |
| `Quiz` | `model/quizv2-model.js` | ← Course, ← Lesson (optional), ← User (createdBy), → Question, → Attempt, → Report |
| `Question` | `model/questionv2-model.js` | ← Quiz |
| `Attempt` | `model/attemptv2-model.js` | ← Quiz, ← User (studentId) |
| `Watch` | `model/watch-model.js` | ← User, ← Lesson (optional), ← Module (optional) |
| `Report` | `model/report-model.js` | ← User (student), ← Course, ← Quiz (many), → Assessment (legacy) |
| `Testimonial` | `model/testimonial-model.js` | ← User, ← Course |
| `Assessment` | `model/assessment-model.js` | ← Report (legacy) |

### Queries Package (Repository Layer)

| Class Name | Source File | Key Methods | Dependencies |
|------------|-------------|-------------|--------------|
| `CoursesQuery` | `queries/courses.js` | getCourseList, getFeaturedCourses, getCourseDetails, create, getCoursesByCategory | Course, Category, Module, User, Testimonial |
| `EnrollmentsQuery` | `queries/enrollments.js` | getEnrollmentsForCourse, enrollForCourse, getEnrollmentsForUser, hasEnrollmentForCourse | Enrollment, Course |
| `PaymentsQuery` | `queries/payments.js` | createPayment, getPaymentBySessionId, updatePaymentStatus, getPaymentsForUser | Payment |
| `QuizV2Query` | `queries/quizv2.js` | getCourseQuizzes, getQuizWithQuestions, getInProgressAttempt, submitAttempt | Quiz, Question, Attempt |
| `ModulesQuery` | `queries/modules.js` | create, getModule, getModuleBySlug | Module |
| `LessonsQuery` | `queries/lessons.js` | getLesson, create, getLessonBySlug | Lesson |
| `ReportsQuery` | `queries/reports.js` | getReport, createWatchReport, createAssessmentReport | Report |
| `CategoriesQuery` | `queries/categories.js` | getCategories, getCategoryDetails | Category |
| `TestimonialsQuery` | `queries/testimonials.js` | getTestimonialsForCourse, getFeaturedTestimonials | Testimonial |
| `UsersQuery` | `queries/users.js` | getUserByEmail, getUserDetails, validatePassword | User |
| `AdminQuery` | `queries/admin.js` | getAdminStats, getUsers, updateUserRole, getEnrollmentAnalytics | User, Course, Enrollment |
| `PaymentsAdminQuery` | `queries/payments-admin.js` | getPaymentsForAdmin | Payment |
| `AdminSetupQuery` | `queries/admin-setup.js` | hasAdminUser, createFirstAdmin | User |

### Actions Package (Service Layer)

| Class Name | Source File | Key Methods | Dependencies |
|------------|-------------|-------------|--------------|
| `CourseAction` | `app/actions/course.js` | createCourse, updateCourse, changeCoursePublishState, deleteCourse | CoursesQuery, Authorization |
| `ModuleAction` | `app/actions/module.js` | createModule, reOrderModules, updateModule, deleteModule | ModulesQuery, Authorization |
| `LessonAction` | `app/actions/lesson.js` | createLesson, reOrderLesson, updateLesson, deleteLesson | LessonsQuery, Authorization |
| `EnrollmentAction` | `app/actions/enrollment.js` | enrollInFreeCourse | EnrollmentsQuery, CoursesQuery |
| `QuizV2Action` | `app/actions/quizv2.js` | createQuiz, updateQuiz, submitAttempt, getAttemptResult | QuizV2Query, Authorization |
| `QuizProgressV2Action` | `app/actions/quizProgressv2.js` | updateQuizCompletionInReport | ReportsQuery |
| `ReviewAction` | `app/actions/review.js` | createReview | TestimonialsQuery |
| `AccountAction` | `app/actions/account.js` | updateUserInfo, changePassword | UsersQuery |
| `AdminAction` | `app/actions/admin.js` | adminGetUsers, adminUpdateUserRole, adminDeleteUser | AdminQuery, Authorization |
| `AdminCategoriesAction` | `app/actions/admin-categories.js` | adminGetCategories, adminCreateCategory, adminDeleteCategory | CategoriesQuery, Authorization |
| `AdminCoursesAction` | `app/actions/admin-courses.js` | adminGetCourses, adminUpdateCourseStatus | CoursesQuery, Authorization |
| `AdminSetupAction` | `app/actions/admin-setup.js` | setupFirstAdmin, isAdminSetupAvailable | AdminSetupQuery |

### API Package (Controller Layer)

| Class Name | Source File | HTTP Methods | Dependencies |
|------------|-------------|--------------|--------------|
| `AuthRoute` | `app/api/auth/[...nextauth]/route.js` | GET, POST | Auth |
| `RegisterRoute` | `app/api/register/route.js` | POST | UsersQuery |
| `MeRoute` | `app/api/me/route.js` | GET | Auth |
| `PaymentStatusRoute` | `app/api/payments/status/route.js` | GET | PaymentsQuery, EnrollmentsQuery |
| `PaymentMockConfirmRoute` | `app/api/payments/mock/confirm/route.js` | POST | PaymentsQuery, EnrollmentsQuery |
| `QuizAttemptRoute` | `app/api/quizv2/attempts/[attemptId]/route.js` | GET | QuizV2Query, Authorization |
| `LessonWatchRoute` | `app/api/lesson-watch/route.js` | POST | ReportsQuery |
| `CertificateRoute` | `app/api/certificates/[courseId]/route.js` | GET | ReportsQuery, EnrollmentsQuery |
| `UploadRoute` | `app/api/upload/route.js` | POST | - |
| `UploadVideoRoute` | `app/api/upload/video/route.js` | POST, DELETE | - |
| `VideoRoute` | `app/api/videos/[filename]/route.js` | GET | - |
| `ProfileAvatarRoute` | `app/api/profile/avatar/route.js` | POST | UsersQuery |

### Auth/Security Package

| Class Name | Source File | Key Functions | Dependencies |
|------------|-------------|---------------|--------------|
| `Auth` | `auth.js` | auth, signIn, signOut, handlers | User |
| `Middleware` | `middleware.js` | default (request handler) | Auth, Permissions |
| `Permissions` | `lib/permissions.js` | hasPermission, isAdmin, requirePermission | - |
| `Authorization` | `lib/authorization.js` | assertInstructorOwnsCourse, verifyInstructorOwnsCourse | Permissions, Course, Module, Lesson |

## Key Flow Mappings

### 1. Authentication Flow

```
User Request
  → Middleware (checks auth)
    → Auth (validates credentials)
      → User Model (queries database)
        → Auth (returns session)
          → Middleware (allows/denies access)
```

**Files:**
- `middleware.js` → `auth.js` → `model/user-model.js`

### 2. Enrollment Flow

```
Student clicks "Enroll"
  → EnrollmentAction.enrollInFreeCourse()
    → CoursesQuery.getCourseDetails() (validates course)
    → EnrollmentsQuery.hasEnrollmentForCourse() (checks existing)
    → EnrollmentsQuery.enrollForCourse() (creates enrollment)
      → Enrollment Model (saves to DB)
```

**Files:**
- `app/actions/enrollment.js` → `queries/courses.js` → `queries/enrollments.js` → `model/enrollment-model.js`

**Alternative (Paid Course):**
```
Student completes payment
  → PaymentStatusRoute.GET() (checks payment status)
    → PaymentsQuery.getPaymentBySessionId()
    → EnrollmentsQuery.enrollForCourse() (if payment succeeded)
      → Enrollment Model
```

**Files:**
- `app/api/payments/status/route.js` → `queries/payments.js` → `queries/enrollments.js` → `model/enrollment-model.js`

### 3. QuizV2 Flow

#### Creating a Quiz
```
Instructor creates quiz
  → QuizV2Action.createQuiz()
    → Authorization.assertInstructorOwnsCourse() (verifies ownership)
    → QuizV2Query (creates quiz)
      → Quiz Model (saves to DB)
```

**Files:**
- `app/actions/quizv2.js` → `lib/authorization.js` → `queries/quizv2.js` → `model/quizv2-model.js`

#### Taking a Quiz
```
Student starts quiz
  → QuizV2Action.startOrResumeAttempt()
    → QuizV2Query.getInProgressAttempt() (checks existing)
    → QuizV2Query (creates attempt)
      → Attempt Model (saves to DB)

Student submits quiz
  → QuizV2Action.submitAttempt()
    → QuizV2Query.getQuizWithQuestions() (gets questions)
    → QuizV2Action (grades attempt)
    → QuizV2Query (updates attempt)
      → Attempt Model (saves score)
    → QuizProgressV2Action.updateQuizCompletionInReport()
      → ReportsQuery (updates report)
        → Report Model (marks quiz as passed)
```

**Files:**
- `app/actions/quizv2.js` → `queries/quizv2.js` → `model/attemptv2-model.js`
- `app/actions/quizProgressv2.js` → `queries/reports.js` → `model/report-model.js`

#### Viewing Attempt Results
```
Student/Instructor views attempt
  → QuizAttemptRoute.GET()
    → Authorization.verifyInstructorOwnsCourse() (if instructor)
    → QuizV2Query.getAttemptById()
      → Attempt Model (returns attempt data)
```

**Files:**
- `app/api/quizv2/attempts/[attemptId]/route.js` → `lib/authorization.js` → `queries/quizv2.js` → `model/attemptv2-model.js`

### 4. Certificate Flow

```
Student requests certificate
  → CertificateRoute.GET()
    → ReportsQuery.getReport() (checks completion)
    → EnrollmentsQuery.hasEnrollmentForCourse() (verifies enrollment)
      → Generates PDF certificate
```

**Files:**
- `app/api/certificates/[courseId]/route.js` → `queries/reports.js` → `queries/enrollments.js` → `model/report-model.js`, `model/enrollment-model.js`

### 5. Course Management Flow (Instructor)

```
Instructor creates course
  → CourseAction.createCourse()
    → Authorization (verifies instructor role)
    → CoursesQuery.create()
      → Course Model (saves to DB)

Instructor adds module
  → ModuleAction.createModule()
    → Authorization.assertInstructorOwnsCourse()
    → ModulesQuery.create()
      → Module Model (saves to DB)

Instructor adds lesson
  → LessonAction.createLesson()
    → Authorization.assertInstructorOwnsModule()
    → LessonsQuery.create()
      → Lesson Model (saves to DB)
```

**Files:**
- `app/actions/course.js` → `lib/authorization.js` → `queries/courses.js` → `model/course-model.js`
- `app/actions/module.js` → `lib/authorization.js` → `queries/modules.js` → `model/module.model.js`
- `app/actions/lesson.js` → `lib/authorization.js` → `queries/lessons.js` → `model/lesson.model.js`

### 6. Admin Management Flow

```
Admin views users
  → AdminAction.adminGetUsers()
    → Authorization.isAdmin() (verifies admin)
    → AdminQuery.getUsers()
      → User Model (returns users)

Admin updates user role
  → AdminAction.adminUpdateUserRole()
    → Authorization.requireAdmin()
    → AdminQuery.updateUserRole()
      → User Model (updates role)
```

**Files:**
- `app/actions/admin.js` → `lib/authorization.js` → `lib/permissions.js` → `queries/admin.js` → `model/user-model.js`

## Architecture Patterns

### Layered Architecture

The system follows a **layered architecture** pattern:

1. **Presentation Layer** (API Routes) - Handles HTTP requests/responses
2. **Service Layer** (Actions) - Contains business logic and validation
3. **Repository Layer** (Queries) - Provides data access abstraction
4. **Domain Layer** (Models) - Represents business entities

### Dependency Flow

```
API (Controller)
  ↓ depends on
Actions (Service)
  ↓ depends on
Queries (Repository)
  ↓ depends on
Models (Domain)
```

### Security Layers

1. **Middleware** - Route-level authentication and authorization checks
2. **Authorization** - Business logic-level ownership verification
3. **Permissions** - Role-based permission definitions

## Notes

1. **Server Actions vs API Routes**: 
   - Server Actions (`app/actions/`) are used for form submissions and client-side interactions
   - API Routes (`app/api/`) are used for external integrations, webhooks, and file serving

2. **Authorization Pattern**:
   - All instructor actions verify course/module/lesson ownership
   - Admin actions verify admin role
   - Student actions verify enrollment

3. **Query Pattern**:
   - Queries are pure data access functions
   - They handle database connections and Mongoose operations
   - They return plain JavaScript objects (using `.lean()`)

4. **Action Pattern**:
   - Actions contain business logic and validation
   - They use Zod schemas for input validation
   - They return standardized response objects

5. **Model Relationships**:
   - Most relationships use Mongoose `ref:` for population
   - Some relationships are stored as arrays (e.g., `Course.modules[]`)
   - Non-relational references exist (e.g., `Module.course` without ref)

## Generating the Diagram

To view or edit the diagram:

1. **Online**: Copy `CLASS_DIAGRAM.puml` content to [PlantUML Online Editor](http://www.plantuml.com/plantuml/uml/)
2. **VS Code**: Install "PlantUML" extension, then open `.puml` file
3. **CLI**: Use PlantUML command-line tool: `plantuml CLASS_DIAGRAM.puml`

The diagram can be exported to PNG, SVG, or PDF formats.
