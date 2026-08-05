# تقرير البنية المعمارية لنظام إدارة التعلم (LMS)

## نظرة عامة على النظام

### الغرض الرئيسي
نظام إدارة تعلم (Learning Management System) متكامل مبني على Next.js 14+ مع App Router وقاعدة بيانات MongoDB. يتيح النظام:
- **للطلاب**: الالتحاق بالدورات، مشاهدة الدروس، حل الاختبارات، تتبع التقدم، الحصول على الشهادات
- **للمدرسين (Instructors)**: إنشاء وإدارة الدورات، الوحدات، الدروس، الاختبارات، تحميل الفيديوهات، متابعة الطلاب
- **للمسؤولين (Admins)**: إدارة المستخدمين، التصنيفات، الدورات، المراجعات، المدفوعات، التحليلات

### الأدوار (Roles)
- **Student**: المستخدم الأساسي، يستهلك المحتوى
- **Instructor**: يملك دورات ويديرها، لا يمكنه الوصول لدورات الآخرين
- **Admin**: وصول كامل لكل شيء، يمكنه تجاوز فحوصات الملكية

---

## الأسلوب المعماري (Architectural Style)

### التصنيف: **Modular Monolith مع نمط Layered Architecture**

#### المبررات:
1. **Monolith واحد**: كل الكود في تطبيق Next.js واحد (App Router)
2. **طبقات واضحة**: 
   - UI Layer (Server/Client Components)
   - Actions Layer (Server Actions)
   - API Layer (Route Handlers)
   - Data Access Layer (Queries)
   - Model Layer (Mongoose Schemas)
   - Database (MongoDB)
3. **عزل واضح**: كل طبقة لها مسؤوليات محددة
4. **إمكانية التوسع المستقبلي**: يمكن فصل الطبقات إلى Microservices لاحقاً

---

## تفصيل المكونات (Component Breakdown)

### 1. UI Layer (Server & Client Components)

#### المسارات الرئيسية (Main Routes)

**Public Routes (لا تحتاج مصادقة)**
```
app/(main)/
  - page.js                       // الصفحة الرئيسية
  - login/page.jsx                // تسجيل الدخول
  - register/[role]/page.jsx      // تسجيل حساب جديد (student/instructor)
  - courses/page.jsx              // كتالوج الدورات العام
  - courses/[id]/page.jsx         // صفحة تفاصيل الدورة
  - categories/[id]/page.jsx      // دورات حسب التصنيف
  - inst-profile/[id]/page.jsx    // صفحة ملف المدرس
  - setup/admin/page.jsx          // إنشاء حساب مسؤول أول (مرة واحدة فقط)
```

**Protected Routes - Student Area**
```
app/(main)/
  - account/                      // حساب الطالب
    - @tabs/page.jsx              // نظرة عامة
    - @tabs/enrolled-courses/     // الدورات المسجل بها
  - courses/[id]/lesson/          // مشاهدة الدروس (بعد الالتحاق)
  - courses/[id]/quizzes/         // صفحات الاختبارات
    - [quizId]/page.jsx           // واجهة الاختبار
    - [quizId]/result/page.jsx    // نتيجة المحاولة
  - checkout/mock/page.jsx        // صفحة الدفع (Mock Payment)
  - enroll-success/page.jsx       // صفحة النجاح بعد الالتحاق
```

**Protected Routes - Instructor Dashboard**
```
app/dashboard/
  - page.jsx                      // لوحة المدرس الرئيسية
  - courses/
    - page.jsx                    // قائمة دورات المدرس
    - add/page.jsx                // إضافة دورة جديدة
    - [courseId]/page.jsx         // تفاصيل وإعدادات الدورة
    - [courseId]/modules/[moduleId]/page.jsx  // إدارة الوحدة
    - [courseId]/reviews/page.jsx             // مراجعات الدورة
    - [courseId]/enrollments/page.jsx         // طلاب الدورة
    - [courseId]/quizzes/                     // إدارة الاختبارات
      - page.jsx                              // قائمة الاختبارات
      - new/page.jsx                          // اختبار جديد
      - [quizId]/page.jsx                     // تحرير الاختبار
      - [quizId]/questions/page.jsx           // إدارة الأسئلة
      - [quizId]/attempts/page.jsx            // محاولات الطلاب
  - lives/                        // البث المباشر (Live Sessions)
    - page.jsx
    - add/page.jsx
    - [liveId]/page.jsx
```

**Protected Routes - Admin Panel**
```
app/admin/
  - page.jsx                      // لوحة الإدارة الرئيسية
  - users/page.jsx                // إدارة المستخدمين
  - courses/page.jsx              // إدارة جميع الدورات
  - categories/page.jsx           // إدارة التصنيفات
  - enrollments/page.jsx          // عرض جميع التسجيلات
  - reviews/page.jsx              // إدارة وموافقة المراجعات
  - payments/page.jsx             // عرض المدفوعات
  - quizzes/page.jsx              // عرض جميع الاختبارات
  - analytics/page.jsx            // التحليلات والإحصائيات
```

---

### 2. Server Actions Layer (`app/actions/**`)

**الوظيفة**: معالجة طلبات النماذج والتفاعلات من الـ UI بشكل server-side.

**الملفات الرئيسية**:
- `account.js`: تحديث الملف الشخصي، تغيير كلمة المرور
- `course.js`: إنشاء/تحديث/حذف الدورات (مع فحص الملكية)
- `module.js`: إدارة الوحدات
- `lesson.js`: إدارة الدروس (مع تحقق الملكية عبر module → course)
- `enrollment.js`: الالتحاق بدورة مجانية
- `review.js`: إضافة مراجعة
- `quizv2.js`: جميع عمليات الاختبارات (CRUD للمدرس + Start/Resume/Submit للطالب)
- `quizProgressv2.js`: تحديث تقدم الاختبارات في Report
- `admin.js`: إدارة المستخدمين (تغيير الدور، الحالة، الحذف)
- `admin-courses.js`: عمليات المسؤول على الدورات
- `admin-categories.js`: إدارة التصنيفات
- `admin-setup.js`: إنشاء حساب مسؤول أول

**ملاحظة**: كل Server Action تطبق:
- فحص المصادقة عبر `auth()` من `next-auth`
- فحص الصلاحيات/الملكية عبر `lib/authorization.js`
- التحقق من المدخلات عبر Zod schemas في `lib/validations.js`
- Rate Limiting عبر `lib/rate-limit.js`
- Logging عبر `lib/logger.js`

---

### 3. API Routes Layer (`app/api/**/route.js`)

**الوظيفة**: نقاط نهاية RESTful للعمليات المتخصصة (ملفات، بث، webhooks).

**قائمة الـ Endpoints**:

| المسار | Method | الوظيفة | الحماية |
|--------|---------|---------|----------|
| `/api/auth/[...nextauth]/route.js` | GET/POST | NextAuth handler | Public |
| `/api/register/route.js` | POST | تسجيل مستخدم جديد | Public |
| `/api/me/route.js` | GET | بيانات المستخدم الحالي | Auth Required |
| `/api/upload/route.js` | POST | تحميل صور (thumbnails/avatars) | Auth + Ownership |
| `/api/upload/video/route.js` | POST | تحميل فيديوهات الدروس | Auth + Ownership |
| `/api/videos/[filename]/route.js` | GET | بث الفيديو (مع Range Support) | Auth + Enrollment |
| `/api/lesson-watch/route.js` | POST | تسجيل مشاهدة/إتمام درس | Auth + Enrollment |
| `/api/certificates/[courseId]/route.js` | GET | توليد شهادة PDF | Auth + 100% Complete |
| `/api/payments/mock/confirm/route.js` | POST | دفع تجريبي (Mock Payment) | Auth |
| `/api/payments/status/route.js` | GET | حالة الدفع | Auth |
| `/api/profile/avatar/route.js` | POST | تحديث صورة الملف الشخصي | Auth |
| `/api/quizv2/attempts/[attemptId]/route.js` | GET | تفاصيل محاولة اختبار | Auth + Ownership |

**خصائص أمنية مطبقة**:
- Rate Limiting على جميع الـ endpoints
- Path Traversal Prevention في `/api/videos` و `/api/upload`
- File Type & Size Validation في `/api/upload`
- MIME Type verification
- Ownership & Enrollment checks قبل السماح بالوصول

---

### 4. Data Access Layer (Queries - `queries/**`)

**الوظيفة**: طبقة الوصول للبيانات، تُخفي تفاصيل Mongoose وتوفر واجهة نظيفة.

**الملفات**:
- `users.js`: عمليات المستخدمين (getUserByEmail, getUserById, getAllUsers, etc.)
- `courses.js`: استعلامات الدورات (getCourseDetails, getPublishedCourses, getUserEnrolledCourses)
- `modules.js`: استعلامات الوحدات
- `lessons.js`: استعلامات الدروس
- `enrollments.js`: فحص الالتحاق، إنشاء التسجيلات
- `categories.js`: استعلامات التصنيفات
- `quizv2.js`: استعلامات معقدة للاختبارات (getQuizWithQuestions, getInProgressAttempt)
- `reports.js`: تقارير التقدم (createWatchReport, updateQuizCompletion, getCourseProgress)
- `payments.js` / `payments-admin.js`: استعلامات المدفوعات
- `testimonials.js`: المراجعات والشهادات
- `admin.js`: إحصائيات وتحليلات لوحة الإدارة
- `admin-setup.js`: فحص وجود مسؤول

**مثال على الهيكل**:
```javascript
// queries/courses.js
export async function getCourseDetails(id) {
  await dbConnect();
  const course = await Course.findById(id)
    .populate('instructor')
    .populate('category')
    .lean();
  return replaceMongoIdInObject(course);
}
```

---

### 5. Model Layer (Mongoose Schemas - `model/**`)

**الوظيفة**: تعريفات الـ Schema وواجهة MongoDB.

**النماذج الرئيسية**:

| الملف | الوصف | العلاقات |
|------|--------|----------|
| `user-model.js` | المستخدمون (admin/instructor/student) | - |
| `course-model.js` | الدورات | → instructor (User), → category, → modules, → testimonials |
| `module.model.js` | الوحدات | → course, → lessonIds[] |
| `lesson.model.js` | الدروس | (مرتبط عبر module.lessonIds) |
| `category-model.js` | التصنيفات | - |
| `enrollment-model.js` | التسجيلات | → student (User), → course, → payment |
| `payment-model.js` | المدفوعات | → user, → course |
| `testimonial-model.js` | المراجعات | → course, → user |
| `watch-model.js` | سجل المشاهدة | → user, → lesson, → module |
| `report-model.js` | تقارير التقدم | → student, → course, completedLessons[], quizResults[] |
| `quizv2-model.js` | الاختبارات | → courseId, → lessonId (optional) |
| `questionv2-model.js` | الأسئلة | → quizId |
| `attemptv2-model.js` | محاولات الاختبارات | → quizId, → studentId, answers[] |
| `assessment-model.js` | التقييمات (نظام قديم؟) | - |

**ميزات النماذج**:
- Indexes على الحقول المستعلمة كثيراً (email, student+course)
- Unique constraints (email, student+course في Enrollment)
- Schema Validation (enum للأدوار والحالات)
- Pre-save hooks (تحديث modifiedOn في Course)
- select: false للحقول الحساسة (password)

---

### 6. Database Connection (`service/mongo.js`)

**التقنية**: Connection pooling مع caching في global scope.

**الميزات**:
- منع Multiple connections في Serverless
- Reuse existing connection
- Proper error handling
- Connection timeout configuration
- Ready state checking (0=disconnected, 1=connected, 2=connecting)

```javascript
// Cached connection to prevent multiple connections in Next.js
let cached = global.mongoose;

export async function dbConnect() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  // ... connection logic with retry handling
}
```

---

### 7. Auth & Security Layer

#### 7.1 Authentication (`auth.js` + `auth.config.js`)

**المكتبة**: NextAuth.js v5 (Auth.js)

**الإستراتيجية**:
- **JWT-based sessions** (strategy: 'jwt')
- Session duration: 30 days, update every 24h
- CredentialsProvider فقط (email + password)

**عملية المصادقة**:
1. NextAuth يستدعي `authorize()` في `auth.js`
2. Rate limiting (5 محاولات / 15 دقيقة)
3. استعلام User من DB مع `select('+password')`
4. bcrypt.compare للتحقق من كلمة المرور
5. فحص status (active فقط)
6. Timing attack prevention (dummy hash عند فشل)
7. تحديث lastLogin timestamp
8. إرجاع بيانات المستخدم → تُحفظ في JWT token

**Callbacks**:
- `jwt()`: تخزين id, email, role, status, image في token
- `session()`: نسخ البيانات من token إلى session object

**أمان ملفات تعريف الارتباط (Cookies)**:
- httpOnly: true
- sameSite: 'lax'
- secure: true (في الإنتاج)
- أسماء مختلفة حسب البيئة (`__Secure-` في production)

---

#### 7.2 Middleware (`middleware.js`)

**الوظيفة**: Route protection على مستوى الطلب.

**الفحوصات المطبقة**:
1. **Public routes bypass**: `PUBLIC_ROUTES` في `lib/routes.js`
2. **Redirect authenticated users**: من /login و /register إلى لوحاتهم
3. **Status check**: منع المستخدمين inactive/suspended
4. **Require auth for protected routes**: إعادة توجيه إلى /login
5. **Role-based protection**:
   - `/admin/**` → ADMIN فقط
   - `/dashboard/**` → INSTRUCTOR أو ADMIN فقط

**Matcher config**:
```javascript
matcher: [
  "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  "/",
]
```
(يستثني API routes لأنها تطبق auth بنفسها)

---

#### 7.3 Permissions (`lib/permissions.js`)

**نظام RBAC واضح** (Role-Based Access Control):

**الأدوار**:
```javascript
ROLES = { ADMIN: 'admin', INSTRUCTOR: 'instructor', STUDENT: 'student' }
```

**الصلاحيات** (Permissions):
- `USERS_*`: إدارة المستخدمين (view/create/edit/delete/change_role/activate)
- `COURSES_VIEW_ALL`, `COURSES_EDIT_ALL`: للمسؤول
- `COURSES_VIEW_OWN`, `COURSES_EDIT_OWN`: للمدرس
- `CATEGORIES_*`, `ENROLLMENTS_*`, `REVIEWS_*`: صلاحيات إدارية
- `ANALYTICS_VIEW`, `ADMIN_ACCESS`, `AUDIT_LOG_VIEW`

**Helper Functions**:
- `hasPermission(userRole, permission)`
- `hasAnyPermission(userRole, permissions[])`
- `requireAdmin(userRole)` - throws error
- `requirePermission(userRole, permission)` - throws error

---

#### 7.4 Authorization (`lib/authorization.js`)

**الوظيفة**: منع IDOR vulnerabilities عبر فحص الملكية (Ownership Verification).

**الدوال الرئيسية**:

| الدالة | الوظيفة |
|-------|---------|
| `assertInstructorOwnsCourse(courseId, userId, options)` | يرمي AuthorizationError إذا المدرس لا يملك الدورة |
| `verifyInstructorOwnsCourse(courseId, userId, user)` | ترجع boolean (admin override) |
| `assertInstructorOwnsModule(moduleId, userId, user)` | يتحقق عبر module → course → instructor |
| `assertInstructorOwnsLesson(lessonId, userId, user)` | يتحقق عبر lesson → module → course → instructor |
| `verifyOwnsAllModules(moduleIds[], userId, user)` | للتحقق من Batch operations (reorder) |
| `verifyOwnsAllLessons(lessonIds[], userId, user)` | للتحقق من Batch operations |
| `getCourseWithOwnershipCheck(courseId, userId, user)` | ترجع Course أو null |

**Admin Override**: كل الدوال تسمح للـ Admin بالوصول (allowAdmin).

**AuthorizationError**:
```javascript
export class AuthorizationError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
  }
}
```

**استخدام في Actions**:
```javascript
// app/actions/lesson.js
export async function updateLesson(lessonId, data) {
  const user = await getLoggedInUser();
  const { assertInstructorOwnsLesson } = await import('@/lib/authorization');
  await assertInstructorOwnsLesson(lessonId, user.id, user);
  
  await Lesson.findByIdAndUpdate(lessonId, data);
}
```

---

#### 7.5 Rate Limiting (`lib/rate-limit.js`)

**التقنية**: In-memory Map (لـ development، يُنصح بـ Redis في الإنتاج).

**الاستخدام**:
```javascript
const result = rateLimit('login:user@example.com', 5, 15 * 60 * 1000);
// 5 requests per 15 minutes

if (!result.success) {
  return { error: 'Too many attempts' };
}
```

**مطبق في**:
- Login (auth.js): 5 محاولات / 15 دقيقة
- Enrollment: 20 / دقيقة
- Certificate generation: 5 / دقيقة
- File uploads: 10 / دقيقة
- جميع الـ API routes

**التنظيف التلقائي**: `setInterval` كل دقيقة لحذف السجلات القديمة.

---

#### 7.6 Validation (`lib/validations.js`)

**المكتبة**: Zod (Type-safe schema validation)

**Schemas المحددة**:
- User: `registerSchema`, `loginSchema`, `updateProfileSchema`, `changePasswordSchema`
- Course: `courseSchema`, `updateCourseStatusSchema`, `deleteCourseSchema`
- Module: `moduleSchema`
- Lesson: `lessonSchema`
- Review: `reviewSchema`
- Admin: `updateUserRoleSchema`, `updateUserStatusSchema`, `bulkActionSchema`
- Category: `createCategorySchema`, `updateCategorySchema`
- File upload: `fileUploadSchema`, `avatarUploadSchema`

**Password validation rules**:
- Min 8 chars
- At least 1 uppercase, 1 lowercase, 1 number, 1 special char

**مثال على الاستخدام**:
```javascript
const validationResult = registerSchema.safeParse(data);
if (!validationResult.success) {
  return createValidationErrorResponse(
    extractZodFieldErrors(validationResult.error)
  );
}
```

---

#### 7.7 Error Handling (`lib/errors.js`)

**نظام موحد للأخطاء**:

**Error Codes**:
- `AUTH_REQUIRED`, `FORBIDDEN`, `UNAUTHORIZED`
- `VALIDATION_ERROR`, `INVALID_INPUT`
- `NOT_FOUND`, `ALREADY_EXISTS`, `CONFLICT`
- `RATE_LIMITED`
- `INTERNAL_ERROR`, `DATABASE_ERROR`, `EXTERNAL_SERVICE_ERROR`

**Response Shapes**:

**Server Actions**:
```javascript
{
  ok: boolean,
  message: string,
  errorCode?: string,
  fieldErrors?: Record<string, string>,
  data?: any
}
```

**API Routes**:
```javascript
{
  message: string,
  errorCode?: string,
  details?: Record<string, any> // development only
}
```

**Helper Functions**:
- `createSuccessResponse(data, message)`
- `createErrorResponse(message, errorCode, fieldErrors)`
- `createValidationErrorResponse(fieldErrors, message)`
- `createApiErrorResponse(message, status, errorCode, details)`
- `sanitizeErrorMessage(error)` - يزيل معلومات حساسة
- `extractZodFieldErrors(zodError)` - يحول Zod errors إلى object

---

### 8. External Integrations & Services

#### 8.1 PDF Generation (Certificates)

**المكتبات**: `pdf-lib`, `@pdf-lib/fontkit`

**الملف**: `app/api/certificates/[courseId]/route.js`

**العملية**:
1. التحقق من المصادقة والتسجيل
2. `verifyCertificateAccess()`: التحقق من 100% completion
3. تحميل fonts (Kalam, Montserrat) و images (logo, sign, pattern)
4. إنشاء PDF بـ A4 landscape
5. رسم العناصر (logo, title, student name, course details, signature)
6. إرجاع binary stream مع headers:
   ```
   Content-Type: application/pdf
   Content-Disposition: attachment; filename="..."
   ```

**الأمان**:
- Rate limited (5 per minute)
- يتطلب 100% course completion
- يتحقق من الالتحاق

---

#### 8.2 Video Streaming

**الملف**: `app/api/videos/[filename]/route.js`

**الميزات**:
- **HTTP Range Support**: للسماح بـ seeking في الفيديو
- **Streaming**: استخدام `fs.createReadStream` لتجنب تحميل الملف كاملاً في الذاكرة
- **Node Stream → Web ReadableStream**: تحويل عبر `Readable.toWeb()` (Node 18+)

**العملية**:
1. التحقق من المصادقة
2. Path traversal prevention (منع `..` و `/`)
3. `verifyVideoAccess()`: 
   - البحث عن Lesson بـ videoFilename
   - إيجاد Module الذي يحتوي هذا الدرس
   - إيجاد Course
   - التحقق: Admin OR Instructor Owner OR Enrolled Student
4. قراءة Range header
5. إرسال **206 Partial Content** أو **200 OK**
6. MIME type من `lesson.videoMimeType` (افتراضياً `video/mp4`)

**Headers**:
```javascript
'Content-Range': 'bytes start-end/total'
'Accept-Ranges': 'bytes'
'Content-Type': 'video/mp4'
'Cache-Control': 'private, max-age=3600'
```

---

#### 8.3 File Uploads

**Image Upload** (`app/api/upload/route.js`):
- Allowed: jpeg/jpg/png/webp/gif
- Max size: 5MB
- Allowed destinations: `public/uploads/*`, `public/assets/images/*`
- Security: filename sanitization, path traversal prevention, ownership check (courseId)
- Rate limited: 10 uploads / minute
- Auto-update course thumbnail عند تحميل صورة دورة

**Video Upload** (`app/api/upload/video/route.js`):
- (متوقع أنه مشابه مع قيود أكبر على الحجم)

---

#### 8.4 Mock Payment System

**الملف**: `app/api/payments/mock/confirm/route.js`

**الوظيفة**: محاكاة عملية دفع لتطوير وتجربة النظام بدون Stripe حقيقي.

**العملية**:
1. التحقق من المصادقة
2. التحقق من courseId و course active
3. التحقق من course price > 0
4. فحص التسجيل المسبق (idempotency)
5. إنشاء Payment document:
   ```javascript
   {
     provider: 'mockpay',
     referenceId: 'mock_timestamp_uuid',
     status: 'succeeded',
     amount: coursePrice,
     currency: 'USD',
     paidAt: new Date()
   }
   ```
6. إنشاء Enrollment document:
   ```javascript
   {
     method: 'mockpay',
     status: 'not-started',
     payment: paymentId
   }
   ```
7. Duplicate handling (race conditions)

**Idempotency**: يتحقق من payment و enrollment موجودين قبل الإنشاء.

**ملاحظة**: يوجد `simulateFailure` parameter للاختبار.

---

#### 8.5 Email Service

(لم يتضح من الكود الحالي إذا كان مُطبَّق، ولكن يمكن إضافة Nodemailer أو AWS SES لاحقاً)

**الحالات المتوقعة**:
- إرسال إشعار بالتسجيل في دورة
- إشعار باكتمال الدورة
- إشعار للمدرس عند تسجيل طالب جديد
- إعادة تعيين كلمة المرور

---

## قواعد الاعتماديات (Dependency Rules)

### الطبقات من الأعلى إلى الأسفل:

```
UI (Server/Client Components)
       ↓ يستدعي
Server Actions  ←→  API Routes
       ↓ يستدعي      ↓ يستدعي
    Queries (Data Access)
       ↓ يستدعي
    Models (Mongoose)
       ↓ يستدعي
    MongoDB
```

### القواعد:

1. **UI → Actions/APIs فقط**: UI لا يستدعي Queries أو Models مباشرة
2. **Actions/APIs → Queries → Models**: الترتيب الصحيح
3. **Auth & Authorization على كل طبقة**: كل layer يتحقق من الصلاحيات
4. **Queries لا تطبق Business Logic**: فقط data fetching
5. **Models لا تعرف Auth**: فقط schema definitions

### هل الكود يحترم القواعد؟

**نعم بشكل عام**، مع بعض الاستثناءات:

✅ **التزام جيد**:
- Server Actions تستخدم Queries بشكل صحيح
- API Routes معزولة ولها auth منفصل
- Models بسيطة ونظيفة
- Authorization layer منفصل ومُعاد استخدامه

⚠️ **نقاط تحتاج تحسين**:
- بعض Actions تستدعي Models مباشرة بدون Queries (مثال: `lesson.js` يستدعي `Lesson.findByIdAndUpdate` مباشرة)
- بعض API routes تستدعي Models مباشرة (مثال: `/api/lesson-watch/route.js`)
- Rate limiting مطبق بشكل غير متسق (بعض Actions ليس لديها)

**توصية**: توحيد كل عمليات DB في Queries، إضافة rate limiting على كل Actions.

---

## تدفقات التشغيل الرئيسية (Key Runtime Flows)

### 1. Auth/Login Flow

1. المستخدم يزور `/login`
2. يملأ email & password
3. Submit → استدعاء NextAuth `signIn('credentials', credentials)`
4. NextAuth يستدعي `authorize()` في `auth.js`:
   - Rate limiting (5/15min)
   - `dbConnect()`
   - `User.findOne({ email }).select('+password')`
   - `bcrypt.compare(password, user.password)`
   - Status check (active فقط)
   - Update `lastLogin`
   - إرجاع `{ id, email, name, role, status, image }`
5. NextAuth ينشئ JWT token مع البيانات
6. JWT يُحفظ في cookie (`next-auth.session-token`)
7. Middleware يقرأ session من cookie
8. إعادة توجيه حسب role:
   - Admin → `/admin`
   - Instructor → `/dashboard`
   - Student → `/account`

---

### 2. Enrollment Flow

#### 2.1 Free Course Enrollment

1. الطالب في صفحة `/courses/[id]`
2. يضغط "Enroll for Free"
3. Form submit → استدعاء `enrollInFreeCourse()` (Server Action)
4. Flow:
   - `auth()` للتحقق من تسجيل الدخول
   - Rate limit (20/min)
   - Zod validation على courseId
   - `getCourseDetails(courseId)` للتحقق من وجود الدورة
   - فحص `course.price === 0`
   - فحص `course.active === true`
   - `hasEnrollmentForCourse(courseId, userId)` للتحقق من التسجيل المسبق
   - `enrollForCourse(courseId, userId, 'free', null)` ← Queries
   - إرجاع `{ ok: true, message: 'Successfully enrolled' }`
5. UI تعيد التوجيه إلى `/enroll-success` أو `/courses/[id]/lesson`

#### 2.2 Paid Course Enrollment (Mock)

1. الطالب يضغط "Buy Course" (price > 0)
2. Redirect إلى `/checkout/mock?courseId=...`
3. صفحة Checkout تعرض تفاصيل الدورة
4. يضغط "Confirm Payment"
5. `fetch('/api/payments/mock/confirm', { method: 'POST', body: { courseId } })`
6. Flow في API:
   - `auth()` للتحقق
   - فحص courseId valid
   - `getCourseDetails(courseId)`
   - فحص `course.price > 0` و `course.active`
   - فحص Enrollment موجود؟
   - إنشاء `Payment` document (provider: 'mockpay', status: 'succeeded')
   - إنشاء `Enrollment` document (method: 'mockpay', payment: paymentId)
   - إرجاع `{ ok: true, referenceId, courseId }`
7. Redirect إلى `/enroll-success?courseId=...&referenceId=...`

---

### 3. Lesson Watch Flow

1. الطالب مسجل في دورة، يدخل `/courses/[id]/lesson?name=...`
2. Component تحمل بيانات الدرس
3. فحص enrollment عبر `hasEnrollmentForCourse()`
4. عرض VideoPlayer component مع `<video src="/api/videos/[filename]">`
5. عند بدء المشاهدة:
   - `fetch('/api/lesson-watch', { method: 'POST', body: { courseId, lessonId, moduleSlug, state: 'started' } })`
6. Flow في API:
   - Validation (ObjectId formats)
   - `getLoggedInUser()`
   - `getLesson(lessonId)`, `getModuleBySlug(moduleSlug)`
   - التحقق من أن lesson belongs to module
   - `hasEnrollmentForCourse()` (إلا إذا admin أو instructor)
   - إنشاء أو تحديث `Watch` document: `{ user, lesson, module, state: 'started', lastTime }`
7. عند إتمام المشاهدة (state: 'completed'):
   - تحديث `Watch` document
   - استدعاء `createWatchReport(userId, courseId, moduleId, lessonId)` ← تحديث `Report` document
   - حساب `completion_rate` في Report

---

### 4. Quiz V2 Flow (Start → Resume → Autosave → Submit → Result)

#### 4.1 Start Quiz Attempt

1. الطالب يدخل `/courses/[id]/quizzes/[quizId]`
2. Component يستدعي `startOrResumeAttempt(quizId)` (Server Action)
3. Flow:
   - `auth()`
   - `Quiz.findById(quizId)`
   - فحص `quiz.published` (إلا للمدرس/مسؤول)
   - `hasEnrollmentForCourse(quiz.courseId, userId)` (إلا للمدرس/مسؤول)
   - فحص `maxAttempts`: عدد المحاولات المكتملة < maxAttempts
   - `getInProgressAttempt(quizId, userId)`:
     - إذا وجد attempt in_progress:
       - فحص `expiresAt` → إذا منتهي، mark as expired وإنشاء جديد
       - إذا لا، إرجاع `{ ok: true, attemptId, resumed: true }`
     - إذا لا، إنشاء Attempt جديد:
       - `expiresAt = now + quiz.timeLimitSec`
       - `status: 'in_progress'`
       - إرجاع `{ ok: true, attemptId, resumed: false }`

#### 4.2 Quiz UI & Autosave

1. UI تعرض `getQuizWithQuestions(quizId)`:
   - Quiz metadata
   - Questions[] (مرتبة حسب order)
   - Options[] لكل question
2. أثناء الإجابة، كل 30 ثانية (أو onChange):
   - استدعاء `autosaveAttempt(attemptId, answers)` (Server Action)
   - answers: `{ [questionId]: selectedOptionIds[] }`
   - Flow:
     - `Attempt.findById(attemptId)`
     - فحص ownership (attemptStudentId === userId)
     - فحص `status === 'in_progress'`
     - `attempt.answers = answerArray` (convert to Mongoose format)
     - `attempt.save()`

#### 4.3 Submit Attempt

1. الطالب يضغط "Submit"
2. استدعاء `submitAttempt(attemptId, answers)` (Server Action)
3. Flow:
   - `Attempt.findById(attemptId)`
   - فحص ownership
   - فحص `status === 'in_progress'`
   - فحص `expiresAt` (إذا منتهي → mark expired وإرجاع error)
   - `getQuizWithQuestions()` لجلب الأسئلة
   - Validation: فقط answers لأسئلة موجودة في Quiz
   - **Grading**:
     - `gradeAttempt(quiz, questions, answers)`:
       - لكل سؤال: مقارنة selectedOptionIds مع correctOptionIds
       - حساب totalScore, scorePercent
       - تحديد passed (scorePercent >= quiz.passPercent)
   - تحديث Attempt:
     - `answers`, `score`, `scorePercent`, `passed`, `status: 'submitted'`, `submittedAt`
   - إذا `passed && quiz.required`:
     - `updateQuizCompletionInReport(courseId, userId, quizId, lessonId)` ← تحديث Report
4. إرجاع `{ ok: true, attempt }`
5. Redirect إلى `/courses/[id]/quizzes/[quizId]/result?attemptId=...`

#### 4.4 View Result

1. UI تستدعي `getAttemptResult(attemptId)` (Server Action)
2. Flow:
   - `Attempt.findById(attemptId).populate('quizId')`
   - فحص ownership (student OR instructor of course OR admin)
   - إرجاع `{ ok: true, attempt: {...} }`
3. عرض:
   - Score, scorePercent, passed
   - إذا `quiz.showAnswersPolicy === 'after_submit'`: عرض الإجابات الصحيحة/الخاطئة
   - Explanation لكل سؤال

---

### 5. Certificate Generation Flow

1. الطالب أكمل 100% من الدورة
2. في صفحة `/courses/[id]` أو `/account`: يظهر زر "Download Certificate"
3. Click → `window.open('/api/certificates/[courseId]')`
4. Flow في API:
   - `auth()`
   - Rate limit (5/min)
   - Validate courseId (ObjectId)
   - **CRITICAL**: `verifyCertificateAccess(courseId, userId)`:
     - `getCourseDetails(courseId)`
     - `hasEnrollmentForCourse(courseId, userId)` ← يجب enrolled
     - `getReport(userId, courseId)` ← Report document
     - Calculate progress:
       - `totalLessons = course.modules[].lessons.length`
       - `completedLessons = report.completedLessons.length`
       - `totalQuizzes = Quiz.count({ courseId, required: true })`
       - `passedQuizzes = report.quizResults.filter(passed).length`
       - `completion = (completedLessons + passedQuizzes) / (totalLessons + totalQuizzes) * 100`
     - إذا `completion < 100`: `return { allowed: false, error: '...' }`
     - إذا `completion === 100`: `return { allowed: true, completionDate }`
   - تحميل fonts (Kalam, Montserrat) من `/public/fonts/`
   - تحميل images (logo, sign, pattern) من `/public/`
   - `generateCertificate(completionInfo, fonts, images)`:
     - PDFDocument.create()
     - رسم pattern background
     - رسم logo
     - رسم "Certificate Of Completion"
     - رسم اسم الطالب بخط Kalam
     - رسم تفاصيل (course, date, instructor)
     - رسم signature + sign image
     - `pdfDoc.save()` → pdfBytes
   - إرجاع Response:
     ```javascript
     new NextResponse(pdfBytes, {
       headers: {
         'Content-Type': 'application/pdf',
         'Content-Disposition': 'attachment; filename="certificate-..."',
         'Content-Length': pdfBytes.length
       }
     })
     ```
5. المتصفح يحمّل ملف PDF

---

### 6. Video Streaming Flow (with Seek Support)

1. UI تعرض `<video src="/api/videos/[filename]" controls />`
2. المتصفح يرسل GET request إلى `/api/videos/[filename]`
3. Flow في API:
   - `auth()`
   - Path traversal prevention
   - `verifyVideoAccess(filename, userId, userRole)`:
     - `Lesson.findOne({ videoFilename: filename })`
     - `Module.findOne({ lessonIds: lesson._id })`
     - `Course.findById(module.course)`
     - فحص: Admin OR Instructor owner OR Enrolled student
   - `filepath = join(UPLOAD_DIR, filename)`
   - فحص file exists
   - `statAsync(filepath)` → fileSize
   - **Range header handling**:
     - إذا `range` موجود:
       - `parseRange(range, fileSize)` → { start, end }
       - `createReadStream(filepath, { start, end })` ← Node stream
       - `nodeStreamToWeb(nodeStream)` → Web ReadableStream
       - إرجاع **206 Partial Content**:
         ```javascript
         headers: {
           'Content-Range': 'bytes start-end/fileSize',
           'Accept-Ranges': 'bytes',
           'Content-Length': chunkSize,
           'Content-Type': mimeType
         }
         ```
     - إذا لا:
       - `createReadStream(filepath)` ← full file stream
       - إرجاع **200 OK** مع full stream
4. المتصفح يستقبل chunks ويعرض الفيديو
5. عند seek في الفيديو:
   - المتصفح يرسل Range header جديد (مثال: `bytes=5000000-`)
   - الخطوة 3 تتكرر مع range جديد

---

## المخاوف العرضية الحرجة (Critical Cross-Cutting Concerns)

### 1. Authorization & Ownership Checks

**التحدي**: منع IDOR (Insecure Direct Object Reference).

**الحل المطبق**:
- `lib/authorization.js`: دوال مركزية للتحقق من الملكية
- كل Server Action/API route تستدعي هذه الدوال
- Ownership chain verification:
  - Lesson → Module → Course → Instructor
  - Module → Course → Instructor
  - Quiz → Course → Instructor
  - Attempt → Student (owner) OR Instructor (course owner) OR Admin

**مثال**:
```javascript
// قبل حذف درس
await assertInstructorOwnsLesson(lessonId, user.id, user);
// إذا المدرس لا يملك، ترمي AuthorizationError
```

**نقاط القوة**:
- Centralized logic
- Admin override في كل مكان
- ObjectId validation

**نقاط تحتاج انتباه**:
- بعض queries لا تطبق ownership (يجب التحقق قبل استدعائها)
- لا يوجد audit log لمحاولات الوصول غير المصرح بها

---

### 2. Validation Strategy

**الطبقات**:

1. **Client-side (UI)**:
   - React Hook Form + Zod (غير مرئي في الكود لكن متوقع)
   - تحسين تجربة المستخدم

2. **Server-side (Actions/APIs)**:
   - Zod schemas في `lib/validations.js`
   - `safeParse()` للتحقق
   - `extractZodFieldErrors()` لتحويل إلى field-level errors

3. **Database-level**:
   - Mongoose schema validation (required, enum, unique, regex)
   - Indexes (unique على email, student+course)

**مثال تطبيق كامل**:
```javascript
// Server Action
export async function registerUser(data) {
  // 1. Zod validation
  const result = registerSchema.safeParse(data);
  if (!result.success) {
    return createValidationErrorResponse(
      extractZodFieldErrors(result.error)
    );
  }
  
  // 2. Business logic validation
  const existingUser = await User.findOne({ email: data.email });
  if (existingUser) {
    return createErrorResponse('Email already exists', ERROR_CODES.ALREADY_EXISTS);
  }
  
  // 3. Mongoose validation (automatic عند .save())
  await User.create(data); // يرمي ValidationError إذا فشل
}
```

**ObjectId Validation**:
```javascript
if (!mongoose.Types.ObjectId.isValid(courseId)) {
  return { error: 'Invalid course ID' };
}
```

**نقاط القوة**:
- Multi-layer validation
- Type-safe (Zod)
- Clear error messages

**تحسينات ممكنة**:
- إضافة custom validators (مثال: courseSlug uniqueness في Zod)
- Sanitization أفضل للـ input (XSS prevention)

---

### 3. Error Handling Standardization

**النظام المطبق** (`lib/errors.js`):

**Server Actions** تُرجع:
```javascript
{
  ok: boolean,
  message: string,
  errorCode?: string,
  fieldErrors?: Record<string, string>,
  data?: any
}
```

**API Routes** تُرجع:
```javascript
{
  message: string,
  errorCode?: string,
  details?: any // development only
}
```

**استخدام**:
```javascript
try {
  // ... business logic
  return createSuccessResponse(data, 'Operation successful');
} catch (error) {
  if (error instanceof AuthorizationError) {
    return createErrorResponse(error.message, ERROR_CODES.FORBIDDEN);
  }
  return createErrorResponse(
    sanitizeErrorMessage(error),
    getErrorCode(error)
  );
}
```

**Error Sanitization**:
- إزالة stack traces
- إخفاء كلمات حساسة (password, token, secret)
- رسائل عامة في الإنتاج للـ database errors

**نقاط القوة**:
- Consistent shape
- Error code system
- Sanitization لمنع info leak

**تحسينات**:
- Logging مركزي لجميع الأخطاء (حالياً `console.error`)
- Error tracking service (Sentry, Rollbar)
- Structured logging (Winston, Pino)

---

### 4. Rate Limiting

**التنفيذ الحالي**:
- In-memory Map في `lib/rate-limit.js`
- `rateLimit(key, maxRequests, windowMs)`
- Cleanup interval كل دقيقة

**مطبق في**:
- Login: 5 / 15 minutes (per email)
- Enrollment: 20 / minute (per userId+IP)
- Certificate: 5 / minute
- Upload: 10 / minute
- معظم API routes

**المشكلة**:
- In-memory ≠ scalable (في multi-instance deployment، كل instance لها map منفصل)
- يُفقد عند restart

**الحل الموصى به**:
- استخدام Redis/Upstash للـ production
- Middleware-based rate limiting (مثل `@upstash/ratelimit`)

**مثال استبدال**:
```javascript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});

const { success } = await ratelimit.limit(identifier);
```

---

### 5. Security Notes

#### 5.1 IDOR Prevention ✅

- Ownership checks في كل عملية تعديل/حذف
- `assertInstructorOwnsCourse/Module/Lesson` قبل أي تعديل
- Enrollment check قبل الوصول للمحتوى

#### 5.2 Path Traversal Prevention ✅

- Filename sanitization في `/api/upload`
- `path.basename()` لاستخراج اسم الملف فقط
- فحص `..` و `/` و `\\` في `/api/videos`
- `filepath.startsWith(UPLOAD_DIR)` double-check

#### 5.3 File Upload Security ✅

- MIME type whitelist (ALLOWED_MIME_TYPES)
- File size limits (5MB للصور)
- Destination path validation (ALLOWED_DESTINATIONS)
- Ownership check قبل upload لدورة

#### 5.4 Secrets Management ⚠️

**موجود في .env** (يجب عدم commit):
- `NEXTAUTH_SECRET`
- `MONGODB_CONNECTION_STRING`
- `NEXTAUTH_URL`

**نقطة ضعف محتملة**: لا يوجد validation في startup للـ env vars (يوجد فحص `NEXTAUTH_SECRET` فقط).

**توصية**: إضافة `envSchema` (Zod) للتحقق من جميع المتغيرات عند البدء.

#### 5.5 SQL/NoSQL Injection Prevention ✅

- استخدام Mongoose parameterized queries
- ObjectId validation قبل الاستعلامات
- Zod validation للمدخلات

#### 5.6 XSS Prevention ⚠️

- Next.js يطبق auto-escaping في JSX
- User-generated content (reviews, bio) يجب sanitization
- **توصية**: استخدام `DOMPurify` للـ rich text content

#### 5.7 CSRF Protection ✅

- NextAuth يطبق CSRF tokens تلقائياً
- Server Actions محمية (POST-only + same-origin)

#### 5.8 Rate Limiting ⚠️

- مطبق لكن in-memory (غير scalable)
- **توصية**: Redis-based rate limiting

#### 5.9 Authentication Security ✅

- Password hashing (bcrypt)
- Timing attack prevention (dummy hash عند فشل)
- Status checks (active فقط)
- JWT-based sessions (httpOnly cookies)

#### 5.10 Video Access Control ✅

- Authentication required
- Enrollment verification
- Instructor/Admin override
- Proper streaming (no full file load)

---

## مخاطر البنية المعمارية (Architecture Risks)

### 1. Scalability Risks

| الخطر | الشدة | التفاصيل |
|-------|-------|----------|
| In-memory rate limiting | 🔴 High | لا يعمل مع multiple instances |
| Video streaming من file system | 🟠 Medium | يجب نقل إلى CDN/S3 للإنتاج |
| PDF generation synchronous | 🟡 Low | يمكن أن يبطئ API، اعتبار background job |
| MongoDB connection pooling | 🟢 OK | مُطبَّق بشكل صحيح |

### 2. Security Risks

| الخطر | الشدة | التفاصيل |
|-------|-------|----------|
| XSS في user-generated content | 🟠 Medium | bio, reviews تحتاج sanitization |
| No audit logging | 🟠 Medium | لا يوجد تتبع لمن فعل ماذا |
| Secrets في .env | 🟡 Low | يجب استخدام Secrets Manager (AWS/Vault) |
| Rate limiting غير كافي | 🟠 Medium | in-memory ≠ production-ready |

### 3. Maintainability Risks

| الخطر | الشدة | التفاصيل |
|-------|-------|----------|
| بعض Actions تستدعي Models مباشرة | 🟡 Low | يجب توحيد في Queries |
| Logging غير موحد | 🟠 Medium | بعض الأماكن `console.log`، بعضها `lib/logger` |
| No TypeScript | 🟠 Medium | يزيد احتمال الأخطاء |
| Test coverage غير واضح | 🔴 High | لا يوجد ملفات test مرئية |

### 4. Performance Risks

| الخطر | الشدة | التفاصيل |
|-------|-------|----------|
| N+1 queries محتملة | 🟠 Medium | بعض queries تستدعي populate متعددة |
| Large file uploads blocking | 🟡 Low | video uploads يمكن أن تكون بطيئة |
| Certificate generation blocking | 🟡 Low | font/image loading في runtime |

### 5. Data Consistency Risks

| الخطر | الشدة | التفاصيل |
|-------|-------|----------|
| Race conditions في Enrollment | 🟢 OK | Unique constraint تمنع duplicates |
| Report consistency | 🟠 Medium | لا يوجد transactional updates (MongoDB لا يدعم multi-document transactions بشكل كامل) |
| Watch/Report sync | 🟡 Low | إذا `createWatchReport` فشل، Watch تُحفظ لكن Report لا يُحدّث |

---

## تحسينات ذات أولوية (Prioritized Improvements)

### Priority 1 - Critical (يجب تطبيقها قبل الإنتاج)

1. **استبدال Rate Limiting بـ Redis**
   ```javascript
   // استخدام Upstash أو Redis
   import { Ratelimit } from "@upstash/ratelimit";
   ```

2. **إضافة Tests (Unit + Integration)**
   ```bash
   # Jest + Testing Library
   npm install --save-dev jest @testing-library/react
   ```
   - Test critical flows: enrollment, quiz submit, certificate
   - Test authorization functions
   - Test API routes

3. **XSS Sanitization لـ User Content**
   ```javascript
   import DOMPurify from 'isomorphic-dompurify';
   const clean = DOMPurify.sanitize(dirtyHTML);
   ```

4. **Audit Logging System**
   ```javascript
   // lib/audit-log.js
   export async function logAudit(action, userId, resourceType, resourceId, details) {
     await AuditLog.create({ action, userId, resourceType, resourceId, details, timestamp: new Date() });
   }
   ```

---

### Priority 2 - High (مهم للاستقرار)

5. **توحيد Queries (منع استدعاء Models مباشرة)**
   - نقل كل `Model.find/update/delete` إلى `queries/**`

6. **Structured Logging (Winston/Pino)**
   ```javascript
   import winston from 'winston';
   const logger = winston.createLogger({ level: 'info', transports: [...] });
   ```

7. **Error Tracking Service (Sentry)**
   ```javascript
   import * as Sentry from "@sentry/nextjs";
   Sentry.captureException(error);
   ```

8. **Environment Variables Validation**
   ```javascript
   // lib/env.js
   const envSchema = z.object({
     MONGODB_CONNECTION_STRING: z.string().url(),
     NEXTAUTH_SECRET: z.string().min(32),
     // ...
   });
   envSchema.parse(process.env);
   ```

---

### Priority 3 - Medium (تحسينات الأداء)

9. **نقل الفيديوهات إلى CDN/S3**
   - استخدام AWS S3 + CloudFront
   - Pre-signed URLs للوصول

10. **Query Optimization**
    - إضافة indexes على حقول مستعلمة كثيراً
    - استخدام `lean()` في كل مكان (موجود بالفعل في معظم الأماكن)
    - Pagination للقوائم الطويلة

11. **Caching Layer (Redis)**
    - Cache `getCourseDetails` (invalidate عند update)
    - Cache `getPublishedCourses`

---

### Priority 4 - Low (Nice to have)

12. **التحويل إلى TypeScript**
    - تدريجياً، بدءاً من `lib/**` و `model/**`

13. **API Documentation (OpenAPI/Swagger)**
    - توثيق كل API endpoints

14. **Monitoring & Observability**
    - Prometheus/Grafana metrics
    - Health check endpoint (`/api/health`)

15. **Email Service Integration**
    - Nodemailer / AWS SES / SendGrid
    - إشعارات الالتحاق، الاكتمال، إعادة تعيين كلمة المرور

---

## الخلاصة

### نقاط القوة الرئيسية

✅ **بنية واضحة**: Layered architecture محترمة بشكل عام  
✅ **أمان جيد**: Authorization, Ownership checks, Rate limiting  
✅ **Modular**: يمكن فصل الطبقات لاحقاً  
✅ **Modern Stack**: Next.js 14, App Router, Server Actions  
✅ **Feature-complete**: جميع الميزات الأساسية لـ LMS موجودة  

### نقاط تحتاج تحسين

⚠️ **Rate Limiting**: in-memory (غير scalable)  
⚠️ **Testing**: غير موجود  
⚠️ **Logging**: غير موحد  
⚠️ **XSS**: user content needs sanitization  
⚠️ **Video Storage**: file system (يجب CDN للإنتاج)  

### التوصية النهائية

النظام **جاهز للتطوير والاختبار** (Development/Staging)، لكن يحتاج **التحسينات Priority 1-2** قبل الإطلاق في الإنتاج (Production).

---

**آخر تحديث**: {{date}}  
**الإصدار**: 1.0  
**المؤلف**: Principal Software Architect (Analysis based on codebase)
