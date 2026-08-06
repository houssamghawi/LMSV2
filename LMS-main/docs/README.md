# 📚 LMS Architecture Documentation

Welcome to the comprehensive architecture documentation for the Learning Management System (LMS).

## 📋 Quick Start

### For New Developers
1. Start with **[ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)** - Quick introduction
2. Read **[ARCHITECTURE_REPORT.md](./ARCHITECTURE_REPORT.md)** - Complete analysis (Arabic)
3. View **[ARCHITECTURE_DIAGRAM.mmd](./ARCHITECTURE_DIAGRAM.mmd)** - Visual representation

### For Code Review
- Reference **[ARCHITECTURE_REPORT.md](./ARCHITECTURE_REPORT.md)** sections:
  - "قواعد الاعتماديات" (Dependency Rules)
  - "Authorization & Ownership Checks"
  - "Security Notes"

### For Feature Development
- Consult "تدفقات التشغيل الرئيسية" (Key Runtime Flows) in **[ARCHITECTURE_REPORT.md](./ARCHITECTURE_REPORT.md)**

---

## 📂 Documentation Files

### Architecture Documentation (NEW ✨)
- **ARCHITECTURE_OVERVIEW.md** - Quick reference and usage guide
- **ARCHITECTURE_REPORT.md** - Full architecture analysis (Arabic)
- **ARCHITECTURE_DIAGRAM.mmd** - Mermaid diagram (C4-style)

### Existing Documentation
- **ERD.md** / **ERD_CHEN.md** - Entity Relationship Diagrams
- **CLASS_DIAGRAM.md** / **CLASS_DIAGRAM.puml** - Class diagrams
- **QUIZ_SYSTEM_IMPLEMENTATION_GUIDE.md** - Quiz feature documentation
- **MOCKPAY_IMPLEMENTATION_SUMMARY.md** - Payment system docs
- **STRIPE_REMOVAL_CLEANUP_PLAN.md** - Migration notes

---

## 🎨 Viewing the Architecture Diagram

### Option 1: Mermaid Live Editor
1. Visit https://mermaid.live/
2. Copy contents of `ARCHITECTURE_DIAGRAM.mmd`
3. Paste and view
4. Export to PNG/SVG/PDF if needed

### Option 2: VS Code
1. Install extension: "Markdown Preview Mermaid Support"
2. Open any `.md` file with mermaid code block
3. Press `Ctrl+Shift+V` to preview

### Option 3: GitHub/GitLab
- Both platforms support Mermaid natively in markdown files
- Just wrap the diagram in a mermaid code block:

````markdown
```mermaid
graph TB
  ...
```
````

---

## 🏗️ Architecture Summary

**Style**: Modular Monolith + Layered Architecture

**Layers**:
1. Client (Browser UI)
2. Next.js (Middleware, Server Components, Server Actions, API Routes)
3. Business Logic (Auth, Authorization, Validation, Rate Limiting)
4. Data Access (Queries)
5. Models (Mongoose Schemas)
6. Database (MongoDB)

**Key Components**:
- **Routes**: 39 page routes (Public, Student, Instructor, Admin)
- **API Endpoints**: 12 specialized routes (streaming, uploads, certificates)
- **Server Actions**: 13 action modules (CRUD, enrollment, quizzes)
- **Queries**: 13 data access modules
- **Models**: 14 Mongoose schemas

---

## 🔐 Security Highlights

✅ **Implemented**:
- JWT-based authentication (NextAuth.js)
- Role-based access control (RBAC)
- Ownership verification (IDOR prevention)
- Zod validation + Mongoose validation
- Rate limiting (in-memory)
- Path traversal prevention
- File upload security

⚠️ **Needs Improvement**:
- Rate limiting → Redis-based (Priority 1)
- XSS sanitization for user content (Priority 1)
- Audit logging (Priority 1)
- Comprehensive testing (Priority 1)

---

## 📊 Key Metrics

| Metric | Count |
|--------|-------|
| Total Page Routes | 39 |
| API Endpoints | 12 |
| Server Actions | 13 |
| Queries Modules | 13 |
| Mongoose Models | 14 |
| User Roles | 3 (Student, Instructor, Admin) |
| Main Features | Courses, Modules, Lessons, Quizzes, Enrollments, Certificates, Video Streaming |

---

## 🚀 Deployment Checklist

Before production deployment, ensure:

- [ ] Replace in-memory rate limiting with Redis/Upstash
- [ ] Add comprehensive test coverage (unit + integration)
- [ ] Implement XSS sanitization (DOMPurify)
- [ ] Set up audit logging system
- [ ] Configure structured logging (Winston/Pino)
- [ ] Integrate error tracking (Sentry)
- [ ] Validate all environment variables at startup
- [ ] Move video storage to CDN (S3 + CloudFront)
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure secrets manager (AWS Secrets Manager / Vault)

---

## 📞 Support

For questions about the architecture:
1. Review the documentation in this folder
2. Check existing code comments
3. Consult with the development team

---

**Last Updated**: 2026-01-27  
**Version**: 1.0  
**Status**: ✅ Complete

