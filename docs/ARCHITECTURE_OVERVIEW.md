# نظرة عامة على وثائق البنية المعمارية

## 📋 الملفات المُنشأة

تم تحليل هذا المشروع (LMS - Learning Management System) وإنشاء وثائق البنية المعمارية التالية:

### 1. 📄 ARCHITECTURE_REPORT.md
**الوصف**: تقرير شامل بالعربية يغطي:
- نظرة عامة على النظام والأدوار (Student/Instructor/Admin)
- الأسلوب المعماري (Modular Monolith + Layered Architecture)
- تفصيل المكونات (UI, Server Actions, API Routes, Queries, Models, DB)
- قواعد الاعتماديات (Dependency Rules)
- تدفقات التشغيل الرئيسية:
  * Auth/Login Flow
  * Enrollment Flow (Free + Paid Mock)
  * Lesson Watch & Progress Tracking
  * Quiz V2 Flow (Start → Resume → Autosave → Submit → Result)
  * Certificate Generation Flow
  * Video Streaming Flow (with Range support)
- المخاوف العرضية الحرجة:
  * Authorization & Ownership Checks (IDOR prevention)
  * Validation Strategy (Zod + Mongoose)
  * Error Handling Standardization
  * Rate Limiting
  * Security Notes (XSS, Path Traversal, File Upload, Secrets)
- مخاطر البنية المعمارية (Scalability, Security, Maintainability)
- تحسينات ذات أولوية (Priority 1-4)

**الاستخدام**: اقرأ هذا التقرير لفهم شامل للنظام قبل التعديل أو التطوير.

---

### 2. 🎨 ARCHITECTURE_DIAGRAM.mmd
**الوصف**: مخطط Mermaid (C4-style) يصور:
- الطبقات المعمارية (6 طبقات من Client إلى Database)
- User Actors (Student/Instructor/Admin)
- Client Layer (Public/Student/Instructor/Admin UI)
- Next.js Layer (Middleware, Server Components, Server Actions, API Routes)
- Business Logic Layer (Auth, Authorization, Permissions, Security, Utilities)
- Data Access Layer (Queries)
- Model Layer (Mongoose Schemas)
- Database Layer (MongoDB)
- External Services (File System, PDF Generation, Mock Payment)
- تدفق البيانات بين الطبقات (arrows showing "invokes", "validates", "queries", etc.)
- Legend بألوان مميزة لكل طبقة

**الاستخدام**:

#### عرض المخطط في Markdown Viewers
معظم محررات Markdown (GitHub, GitLab, VS Code with Mermaid extension) تدعم عرض Mermaid:

```markdown
# في ملف README أو وثائق أخرى، أضف:

![Architecture Diagram](./docs/ARCHITECTURE_DIAGRAM.mmd)
```

أو استخدم:

````markdown
```mermaid
# انسخ محتويات ARCHITECTURE_DIAGRAM.mmd هنا
```
````

#### عرض المخطط عبر الأدوات:

1. **Mermaid Live Editor**: 
   - افتح https://mermaid.live/
   - الصق محتويات `ARCHITECTURE_DIAGRAM.mmd`
   - شاهد المخطط مباشرة
   - يمكنك تصدير إلى PNG/SVG/PDF

2. **VS Code**:
   - Install extension: "Markdown Preview Mermaid Support" أو "Mermaid Markdown Syntax Highlighting"
   - افتح `ARCHITECTURE_DIAGRAM.mmd` أو ملف markdown يحتوي block mermaid
   - اضغط `Ctrl+Shift+V` (Preview)

3. **GitHub/GitLab**:
   - GitHub يدعم Mermaid natively في markdown
   - GitLab أيضاً يدعمه
   - ضع المحتوى في markdown block:
     ````markdown
     ```mermaid
     graph TB
       ...
     ```
     ````

4. **Documentation Sites** (Docusaurus, MkDocs, etc.):
   - أغلب أدوات التوثيق الحديثة تدعم Mermaid plugins

---

## 🚀 كيفية استخدام هذه الوثائق

### للمطورين الجدد (Onboarding):
1. **اقرأ** `ARCHITECTURE_REPORT.md` كاملاً (خصوصاً "نظرة عامة" و "تدفقات التشغيل")
2. **شاهد** `ARCHITECTURE_DIAGRAM.mmd` لفهم الطبقات والاتصالات بصرياً
3. **راجع** قسم "قواعد الاعتماديات" لفهم architecture constraints
4. **تصفح** الكود بناءً على الطبقات الموضحة

### قبل إضافة ميزة جديدة:
1. **حدد الطبقة** المناسبة (UI? Action? API? Query?)
2. **اتبع dependency rules** (UI → Actions/APIs → Queries → Models → DB)
3. **طبق** security checks (auth, ownership, validation, rate limit)
4. **اختبر** التدفق الكامل (end-to-end)

### قبل التعديل على ميزة موجودة:
1. **اقرأ** التدفق المتعلق في قسم "تدفقات التشغيل الرئيسية"
2. **حدد** الملفات المتأثرة (Action? Query? Model?)
3. **تأكد** من عدم كسر ownership checks أو validation
4. **حدّث** الوثائق إذا تغيرت البنية

### عند مراجعة كود (Code Review):
1. **تحقق** من التزام الكود بـ Layered Architecture
2. **تأكد** من وجود Auth + Ownership checks
3. **راجع** Validation (Zod + Mongoose)
4. **تحقق** من Rate Limiting في الـ Actions/APIs الجديدة
5. **ابحث** عن IDOR vulnerabilities

---

## 📊 ملخص البنية المعمارية

### النمط المعماري
**Modular Monolith + Layered Architecture**

```
┌─────────────────────────────────────┐
│  Client (Browser)                   │ ← User interactions
├─────────────────────────────────────┤
│  Next.js App Router                 │
│  - Middleware (Auth/RBAC)           │
│  - Server Components                │ ← SSR/RSC
│  - Server Actions (form handlers)   │ ← "use server"
│  - API Routes (specialized ops)     │ ← RESTful endpoints
├─────────────────────────────────────┤
│  Business Logic                     │
│  - Auth (NextAuth.js)               │
│  - Authorization (Ownership checks) │
│  - Permissions (RBAC)               │
│  - Validation (Zod)                 │
│  - Rate Limiting                    │
│  - Error Handling                   │
├─────────────────────────────────────┤
│  Data Access Layer (Queries)        │ ← Abstraction over DB
├─────────────────────────────────────┤
│  Model Layer (Mongoose)             │ ← Schemas + Validation
├─────────────────────────────────────┤
│  Database (MongoDB)                 │ ← Persistent storage
└─────────────────────────────────────┘
```

### المكونات الرئيسية

| الطبقة | الملفات | المسؤوليات |
|--------|---------|------------|
| **UI** | `app/**/*.jsx` | عرض الواجهات، form submissions |
| **Middleware** | `middleware.js` | Route protection, Role checks |
| **Server Actions** | `app/actions/**/*.js` | معالجة النماذج، business logic |
| **API Routes** | `app/api/**/route.js` | Streaming, uploads, webhooks |
| **Auth** | `auth.js`, `auth.config.js` | JWT sessions, password verification |
| **Authorization** | `lib/authorization.js` | Ownership checks, IDOR prevention |
| **Permissions** | `lib/permissions.js` | RBAC definitions |
| **Security** | `lib/rate-limit.js`, `lib/validations.js`, `lib/errors.js` | Rate limiting, Zod schemas, error handling |
| **Queries** | `queries/**/*.js` | Data access abstraction |
| **Models** | `model/**/*.js` | Mongoose schemas |
| **DB Connection** | `service/mongo.js` | Connection pooling |

### Entry Points الرئيسية

**UI Routes**:
- Public: `/`, `/login`, `/register/[role]`, `/courses`, `/courses/[id]`
- Student: `/account`, `/courses/[id]/lesson`, `/courses/[id]/quizzes/[quizId]`
- Instructor: `/dashboard`, `/dashboard/courses`, `/dashboard/courses/[courseId]/...`
- Admin: `/admin`, `/admin/users`, `/admin/courses`, `/admin/analytics`

**API Endpoints**:
- `/api/auth/[...nextauth]`: NextAuth handler
- `/api/videos/[filename]`: Video streaming (Range support)
- `/api/upload`, `/api/upload/video`: File uploads
- `/api/certificates/[courseId]`: PDF generation
- `/api/payments/mock/confirm`: Mock payment
- `/api/lesson-watch`: Progress tracking

**Server Actions**:
- `enrollInFreeCourse()`: Free enrollment
- `startOrResumeAttempt()`, `submitAttempt()`: Quiz flow
- `createCourse()`, `updateLesson()`: Content management
- `updateUserRole()`, `updateUserStatus()`: Admin operations

---

## ⚠️ نقاط حرجة يجب الانتباه لها

### 🔴 Priority 1 (Critical - يجب قبل الإنتاج)
1. **Rate Limiting**: استبدال in-memory بـ Redis/Upstash
2. **Testing**: إضافة Unit + Integration tests
3. **XSS Sanitization**: DOMPurify للـ user-generated content
4. **Audit Logging**: تسجيل جميع العمليات الحساسة

### 🟠 Priority 2 (High - مهم للاستقرار)
5. **Query Consolidation**: نقل كل DB operations إلى Queries
6. **Structured Logging**: Winston/Pino بدل console.log
7. **Error Tracking**: Sentry integration
8. **Env Validation**: Zod schema للـ environment variables

### 🟡 Priority 3 (Medium - تحسين الأداء)
9. **CDN للفيديوهات**: AWS S3 + CloudFront
10. **Query Optimization**: Indexes, Pagination, Caching
11. **Redis Caching**: للـ course details وغيرها

### 🔵 Priority 4 (Low - Nice to have)
12. **TypeScript Migration**: تدريجياً
13. **API Documentation**: OpenAPI/Swagger
14. **Monitoring**: Prometheus/Grafana
15. **Email Service**: Nodemailer/AWS SES

---

## 📖 قراءة إضافية

- **Next.js App Router**: https://nextjs.org/docs/app
- **NextAuth.js**: https://next-auth.js.org/
- **Mongoose**: https://mongoosejs.com/
- **Zod**: https://zod.dev/
- **Mermaid**: https://mermaid.js.org/
- **C4 Model**: https://c4model.com/

---

## 🤝 المساهمة

عند المساهمة في هذا المشروع:
1. **اتبع** البنية المعمارية الموثقة
2. **حدّث** هذه الوثائق إذا غيّرت البنية
3. **أضف** tests للكود الجديد
4. **راجع** security checklist قبل PR

---

**آخر تحديث**: 2026-01-27  
**الإصدار**: 1.0  
**تحليل بواسطة**: Principal Software Architect
