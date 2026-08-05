# Non-Functional Requirements (NFR) Report
## Learning Management System (LMS)

**Document Version:** 1.0  
**Date:** 2024  
**System:** Next.js App Router + MongoDB/Mongoose + NextAuth + Server Actions

---

## Executive Summary

This document presents a comprehensive analysis of Non-Functional Requirements (NFRs) for the Learning Management System (LMS). The system is built using Next.js 15 with App Router, MongoDB for data persistence, NextAuth v5 for authentication, and Server Actions for business logic.

**System Context:**
- **Architecture:** Server-side rendered Next.js application with API routes and Server Actions
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** NextAuth.js with JWT sessions and Credentials provider
- **Authorization:** Role-Based Access Control (RBAC) with three roles: Admin, Instructor, Student
- **Key Features:** Course management, video streaming, quiz system, certificate generation, enrollment management

**Why NFRs Matter:**
Non-functional requirements define the quality attributes of the system that ensure it is secure, performant, reliable, and maintainable. For an LMS handling educational content, student data, and payments, these requirements are critical for:
- Protecting student privacy and course content
- Ensuring system availability during peak usage
- Maintaining data integrity for academic records
- Supporting scalability as user base grows
- Enabling effective monitoring and troubleshooting

---

## 1. Security & Privacy

### 1.1 Authentication Security

**Requirement:** The system SHALL authenticate users securely using industry-standard practices.

**Rationale:** Prevents unauthorized access to student records, course content, and instructor materials.

**Acceptance Criteria:**
- Passwords are hashed using bcrypt with appropriate salt rounds
- Login attempts are rate-limited (5 attempts per 15 minutes per email)
- Session tokens use secure, httpOnly cookies in production
- Inactive/suspended users cannot authenticate
- Timing attack prevention during authentication

**Evidence:**
- Password hashing: `auth.js` (line 71) - uses `bcrypt.compare()`
- Rate limiting: `auth.js` (line 38) - `rateLimit('login:${email}', 5, 15 * 60 * 1000)`
- Session security: `auth.config.js` (lines 46-80) - secure cookies, httpOnly, sameSite: 'lax'
- Status check: `auth.js` (lines 64-68) - prevents inactive users from logging in
- Timing attack prevention: `auth.js` (lines 58-60, 66) - dummy hash comparison

**Gaps/Recommendations:**
- Consider implementing account lockout after repeated failed attempts (currently only rate-limited)
- Add password strength meter during registration
- Implement password expiration policy for administrative accounts
- Consider MFA (Multi-Factor Authentication) for admin/instructor roles

---

### 1.2 Authorization & Access Control

**Requirement:** The system SHALL enforce role-based access control (RBAC) and prevent Insecure Direct Object Reference (IDOR) vulnerabilities.

**Rationale:** Ensures users can only access resources they are authorized to view or modify.

**Acceptance Criteria:**
- Middleware enforces route-level access control
- Server Actions verify ownership before resource modification
- API routes check enrollment/ownership before serving content
- Admin override exists for administrative operations
- Students cannot access instructor/admin routes

**Evidence:**
- Route protection: `middleware.js` (lines 49-83) - role-based route guards
- Ownership verification: `lib/authorization.js` - `assertInstructorOwnsCourse()`, `assertInstructorOwnsModule()`, `assertInstructorOwnsLesson()`
- Enrollment check: `app/api/videos/[filename]/route.js` (lines 98-107) - verifies enrollment before video access
- Permission system: `lib/permissions.js` - centralized RBAC definitions
- Video access control: `app/api/videos/[filename]/route.js` (lines 66-110) - multi-level access verification

**Gaps/Recommendations:**
- Add audit logging for sensitive authorization decisions
- Implement permission caching to reduce database queries
- Consider fine-grained permissions beyond role-based (e.g., course-level permissions)

---

### 1.3 Data Protection & Privacy

**Requirement:** The system SHALL protect Personally Identifiable Information (PII) and sensitive data.

**Rationale:** Compliance with privacy regulations (GDPR, FERPA) and protection of student data.

**Acceptance Criteria:**
- Passwords are never returned in API responses (select: false in schema)
- Error messages do not leak sensitive information in production
- User emails are stored in lowercase and validated
- Profile data is only accessible to authorized users
- Payment information is handled securely (mock payment currently)

**Evidence:**
- Password exclusion: `model/user-model.js` (line 19) - `select: false`
- Error sanitization: `lib/errors.js` (lines 153-177) - `sanitizeErrorMessage()` removes sensitive patterns
- Email normalization: `model/user-model.js` (line 25) - `lowercase: true`
- Email validation: `model/user-model.js` (line 28) - regex pattern validation
- Error sanitization in production: `lib/errors.js` (lines 164-171) - hides internal errors

**Gaps/Recommendations:**
- Implement data encryption at rest for sensitive fields
- Add data retention policies and automated deletion
- Implement user data export functionality (GDPR right to data portability)
- Add consent management for data processing
- Consider encrypting video files stored on disk

---

### 1.4 Input Validation & Sanitization

**Requirement:** The system SHALL validate and sanitize all user inputs to prevent injection attacks and data corruption.

**Rationale:** Prevents XSS, SQL injection (NoSQL injection in MongoDB), path traversal, and other injection attacks.

**Acceptance Criteria:**
- All inputs are validated using Zod schemas
- File uploads are validated for type, size, and destination
- Path traversal attempts are blocked
- ObjectId validation prevents invalid database queries
- File names are sanitized before storage

**Evidence:**
- Zod validation: `lib/validations.js` - comprehensive schemas for all inputs
- File upload validation: `app/api/upload/route.js` (lines 9-64) - MIME type, size, destination checks
- Path traversal prevention: `app/api/videos/[filename]/route.js` (lines 168-193) - multiple checks
- Filename sanitization: `app/api/upload/route.js` (line 29) - `sanitizeFilename()` removes dangerous characters
- ObjectId validation: `app/actions/quizv2.js` (line 237) - `mongoose.Types.ObjectId.isValid()`

**Gaps/Recommendations:**
- Add Content Security Policy (CSP) headers
- Implement request size limits at middleware level
- Add rate limiting per IP address in addition to per-user
- Consider implementing WAF (Web Application Firewall) rules

---

### 1.5 Secure File Handling

**Requirement:** The system SHALL securely handle file uploads and prevent unauthorized file access.

**Rationale:** Prevents malicious file uploads, unauthorized access to course materials, and storage abuse.

**Acceptance Criteria:**
- File uploads are restricted to allowed MIME types
- File size limits are enforced (5MB for images)
- Upload destinations are whitelisted
- Video files are served with access control
- File paths are validated to prevent directory traversal

**Evidence:**
- MIME type validation: `app/api/upload/route.js` (lines 9-15, 107-112) - whitelist approach
- Size limits: `app/api/upload/route.js` (line 17) - `MAX_FILE_SIZE = 5MB`
- Destination whitelist: `app/api/upload/route.js` (lines 18-25, 48-64)
- Video access control: `app/api/videos/[filename]/route.js` - full access verification
- Path validation: `app/api/videos/[filename]/route.js` (lines 168-193) - multiple traversal checks

**Gaps/Recommendations:**
- Implement virus scanning for uploaded files
- Add file type verification beyond MIME type (magic number checking)
- Implement file storage quotas per instructor
- Consider moving to cloud storage (S3, Cloudinary) for scalability
- Add file expiration/cleanup policies for unused uploads

---

## 2. Performance & Scalability

### 2.1 Response Time

**Requirement:** The system SHALL respond to user requests within acceptable time limits.

**Rationale:** Ensures good user experience and supports concurrent usage.

**Acceptance Criteria:**
- Page load time < 2 seconds for server-rendered pages
- API response time < 500ms for standard operations
- Video streaming starts within 1 second
- Database queries complete within 200ms for indexed queries
- Server Actions complete within 1 second for standard operations

**Evidence:**
- Database connection pooling: `service/mongo.js` (line 41) - `maxPoolSize: 10`
- Indexed queries: Multiple models have indexes (e.g., `enrollment-model.js` lines 44-50)
- Streaming optimization: `app/api/videos/[filename]/route.js` - uses Node.js streams, Range requests
- Connection caching: `service/mongo.js` (lines 4-14) - prevents multiple connections

**Gaps/Recommendations:**
- Implement response caching for frequently accessed data (Redis)
- Add database query optimization and monitoring
- Implement CDN for static assets and video files
- Add performance monitoring (APM tools)
- Consider implementing database read replicas for scaling

---

### 2.2 Scalability

**Requirement:** The system SHALL support horizontal scaling and handle increasing load.

**Rationale:** Must accommodate growth in users, courses, and content without degradation.

**Acceptance Criteria:**
- Application is stateless (session stored in JWT)
- Database connection pooling prevents connection exhaustion
- Rate limiting prevents abuse but allows legitimate traffic
- File storage can be moved to external service
- No single point of failure in application layer

**Evidence:**
- Stateless sessions: `auth.config.js` - JWT strategy (no server-side session store)
- Connection pooling: `service/mongo.js` (line 41) - `maxPoolSize: 10`
- Rate limiting: `lib/rate-limit.js` - in-memory (note: not distributed)

**Gaps/Recommendations:**
- **CRITICAL:** Replace in-memory rate limiting with Redis-based distributed rate limiting
- Implement horizontal scaling with load balancer
- Add database connection monitoring and auto-scaling
- Implement queue system for heavy operations (certificate generation, video processing)
- Consider microservices architecture for high-traffic components

---

### 2.3 Resource Efficiency

**Requirement:** The system SHALL use system resources efficiently.

**Rationale:** Reduces hosting costs and supports more concurrent users per server.

**Acceptance Criteria:**
- Database connections are reused (connection pooling)
- Large files are streamed, not loaded into memory
- Unused rate limit entries are cleaned up
- Server Actions have body size limits

**Evidence:**
- Connection reuse: `service/mongo.js` (lines 10-14) - checks existing connection
- Streaming: `app/api/videos/[filename]/route.js` (lines 233-246) - uses `createReadStream()`
- Cleanup: `lib/rate-limit.js` (lines 47-54) - periodic cleanup of old entries
- Body size limit: `next.config.mjs` (line 27) - `bodySizeLimit: '2mb'`

**Gaps/Recommendations:**
- Implement connection pool monitoring
- Add memory usage monitoring and alerts
- Optimize database indexes based on query patterns
- Implement lazy loading for large datasets

---

## 3. Availability & Reliability

### 3.1 System Uptime

**Requirement:** The system SHALL maintain high availability (target: 99.5% uptime).

**Rationale:** Students and instructors need reliable access to course materials.

**Acceptance Criteria:**
- Database connection failures are handled gracefully
- Error responses are user-friendly
- System recovers from transient failures
- Health check endpoint exists (if applicable)

**Evidence:**
- Connection error handling: `service/mongo.js` (lines 61-64) - error handling in connection
- Error responses: `lib/errors.js` - standardized error handling
- Graceful degradation: `app/api/certificates/[courseId]/route.js` (lines 32-40) - fallback fonts

**Gaps/Recommendations:**
- Implement health check API endpoint (`/api/health`)
- Add database connection retry logic with exponential backoff
- Implement circuit breaker pattern for external services
- Add monitoring and alerting (e.g., Sentry, DataDog)
- Implement automated failover for database

---

### 3.2 Error Handling

**Requirement:** The system SHALL handle errors gracefully and provide meaningful feedback.

**Rationale:** Prevents system crashes and helps users understand what went wrong.

**Acceptance Criteria:**
- All errors are caught and logged
- Error messages are sanitized for production
- Standardized error response format
- Errors include appropriate HTTP status codes
- Stack traces are hidden in production

**Evidence:**
- Error handling: `lib/errors.js` - comprehensive error handling system
- Error sanitization: `lib/errors.js` (lines 153-177) - `sanitizeErrorMessage()`
- Standardized responses: `lib/errors.js` (lines 50-87) - `createErrorResponse()`, `createSuccessResponse()`
- Status codes: Multiple API routes use appropriate status codes (401, 403, 404, 429, 500)
- Production error hiding: `lib/errors.js` (lines 164-171) - hides internal errors in production

**Gaps/Recommendations:**
- Implement centralized error tracking (Sentry integration)
- Add error rate monitoring and alerting
- Create error recovery mechanisms for transient failures
- Implement user-friendly error pages (custom error.jsx exists but can be enhanced)

---

### 3.3 Data Consistency

**Requirement:** The system SHALL maintain data consistency across operations.

**Rationale:** Prevents data corruption, duplicate enrollments, and inconsistent quiz scores.

**Acceptance Criteria:**
- Unique constraints prevent duplicate enrollments
- Quiz attempts have unique constraints for in-progress attempts
- Payment and enrollment creation is idempotent
- Database transactions are used for multi-step operations (where applicable)

**Evidence:**
- Unique enrollment: `model/enrollment-model.js` (line 44) - unique index on `{student, course}`
- Unique in-progress attempt: `model/attemptv2-model.js` (lines 70-76) - partial unique index
- Idempotent payment: `app/api/payments/mock/confirm/route.js` (lines 109-161) - checks for existing payment
- Idempotent enrollment: `app/api/payments/mock/confirm/route.js` (lines 164-184) - handles duplicate key errors

**Gaps/Recommendations:**
- Implement database transactions for multi-step operations (e.g., payment + enrollment)
- Add data validation at database level (Mongoose validators)
- Implement optimistic locking for concurrent updates
- Add data integrity checks (scheduled jobs)

---

## 4. Maintainability & Code Quality

### 4.1 Code Organization

**Requirement:** The system SHALL be organized in a maintainable structure.

**Rationale:** Facilitates team collaboration, debugging, and feature additions.

**Acceptance Criteria:**
- Clear separation of concerns (models, queries, actions, API routes)
- Reusable utility functions
- Consistent naming conventions
- Modular architecture

**Evidence:**
- Separation: Clear directory structure (`model/`, `queries/`, `app/actions/`, `app/api/`, `lib/`)
- Utilities: `lib/` directory contains reusable modules (authorization, errors, validations, logger)
- Naming: Consistent naming (e.g., `*-model.js`, `*-action.js`)
- Modularity: Authorization logic centralized in `lib/authorization.js`

**Gaps/Recommendations:**
- Add TypeScript for type safety
- Implement comprehensive unit tests
- Add integration tests for critical flows
- Document API contracts (OpenAPI/Swagger)
- Add code coverage reporting

---

### 4.2 Logging & Observability

**Requirement:** The system SHALL provide adequate logging for debugging and monitoring.

**Rationale:** Enables troubleshooting, performance analysis, and security auditing.

**Acceptance Criteria:**
- Structured logging with context (route, user, action)
- Log levels (DEBUG, INFO, WARN, ERROR)
- Sensitive data is not logged
- Logs include timestamps and request IDs

**Evidence:**
- Structured logging: `lib/logger.js` - structured log entries with context
- Log levels: `lib/logger.js` (lines 6-11) - DEBUG, INFO, WARN, ERROR
- Route logging: `lib/logger.js` (lines 117-143) - `logRoute()` function
- Action logging: `lib/logger.js` (lines 86-112) - `logAction()` function
- Timestamps: `lib/logger.js` (line 30) - ISO timestamp

**Gaps/Recommendations:**
- Integrate with centralized logging service (e.g., ELK stack, CloudWatch)
- Add request ID tracking across requests
- Implement audit logging for sensitive operations (user management, payment, certificate generation)
- Add performance metrics logging (response times, database query times)
- Implement log aggregation and search capabilities

---

### 4.3 Documentation

**Requirement:** The system SHALL have adequate documentation for developers.

**Rationale:** Reduces onboarding time and facilitates maintenance.

**Acceptance Criteria:**
- Code comments explain complex logic
- Architecture documentation exists
- API documentation is available
- Setup instructions are documented

**Evidence:**
- Architecture diagram: `docs/ARCHITECTURE_DIAGRAM.mmd`
- Code comments: Multiple files have JSDoc comments (e.g., `lib/authorization.js`)
- Function documentation: Authorization functions have parameter documentation

**Gaps/Recommendations:**
- Add comprehensive README with setup instructions
- Document environment variables
- Add API documentation (OpenAPI/Swagger)
- Create developer onboarding guide
- Document deployment procedures

---

## 5. Usability & Accessibility

### 5.1 User Experience

**Requirement:** The system SHALL provide a responsive and intuitive user interface.

**Rationale:** Ensures students and instructors can effectively use the platform.

**Acceptance Criteria:**
- Pages are responsive (mobile-friendly)
- Loading states are shown during async operations
- Error messages are user-friendly
- Forms provide validation feedback

**Evidence:**
- Loading components: `app/loading.jsx` exists
- Error components: `app/error.jsx` exists
- Form validation: Uses `react-hook-form` with Zod validation (inferred from dependencies)

**Gaps/Recommendations:**
- Implement comprehensive accessibility testing (WCAG 2.1 AA compliance)
- Add keyboard navigation support
- Implement screen reader support
- Add focus management for modals and forms
- Conduct user testing for UX improvements

---

### 5.2 Accessibility

**Requirement:** The system SHALL be accessible to users with disabilities.

**Rationale:** Legal compliance and inclusive design principles.

**Acceptance Criteria:**
- Semantic HTML is used
- ARIA labels are present where needed
- Color contrast meets WCAG standards
- Keyboard navigation is supported

**Evidence:**
- UI components: Uses Radix UI components (from `package.json`) which have accessibility features

**Gaps/Recommendations:**
- Conduct accessibility audit (axe-core, WAVE)
- Add ARIA labels to interactive elements
- Ensure color contrast ratios meet WCAG AA (4.5:1 for text)
- Test with screen readers
- Add skip navigation links

---

## 6. Observability (Logging/Monitoring/Auditing)

### 6.1 Application Monitoring

**Requirement:** The system SHALL provide monitoring capabilities for system health and performance.

**Rationale:** Enables proactive issue detection and performance optimization.

**Acceptance Criteria:**
- Application metrics are collected (response times, error rates)
- Database performance is monitored
- System resource usage is tracked
- Alerts are configured for critical issues

**Evidence:**
- Logging infrastructure: `lib/logger.js` - structured logging foundation

**Gaps/Recommendations:**
- **CRITICAL:** Implement APM (Application Performance Monitoring) tool (e.g., New Relic, DataDog)
- Add health check endpoint (`/api/health`)
- Implement metrics collection (Prometheus + Grafana)
- Set up alerting for error rates, response times, database connections
- Add uptime monitoring (e.g., Pingdom, UptimeRobot)

---

### 6.2 Audit Logging

**Requirement:** The system SHALL log security-relevant events for audit purposes.

**Rationale:** Required for compliance and security incident investigation.

**Acceptance Criteria:**
- User authentication events are logged
- Authorization failures are logged
- Sensitive operations are logged (user management, payment, certificate generation)
- Logs include user ID, timestamp, action, and result

**Evidence:**
- Route logging: `lib/logger.js` - logs route access
- Action logging: `lib/logger.js` - logs server actions

**Gaps/Recommendations:**
- **CRITICAL:** Implement comprehensive audit logging for:
  - Login/logout events
  - Failed authentication attempts
  - Role changes
  - User status changes
  - Payment transactions
  - Certificate downloads
  - Course enrollment/deletion
- Store audit logs in separate, tamper-proof storage
- Implement log retention policies
- Add audit log viewing interface for admins

---

## 7. Data Integrity & Consistency

### 7.1 Data Validation

**Requirement:** The system SHALL validate data at multiple layers to ensure integrity.

**Rationale:** Prevents invalid data from entering the system and causing errors.

**Acceptance Criteria:**
- Input validation at API/Server Action level (Zod)
- Database schema validation (Mongoose)
- Business rule validation (e.g., enrollment prerequisites)
- Referential integrity is maintained

**Evidence:**
- Zod validation: `lib/validations.js` - comprehensive schemas
- Mongoose validation: Models have required fields and enums
- Business validation: `app/actions/enrollment.js` - checks course price, enrollment status
- Referential integrity: Models use ObjectId references with `ref` option

**Gaps/Recommendations:**
- Add database-level constraints where possible
- Implement data migration validation
- Add data integrity checks (scheduled jobs)
- Implement soft deletes with cascade rules

---

### 7.2 Transaction Management

**Requirement:** The system SHALL use transactions for multi-step operations to ensure atomicity.

**Rationale:** Prevents partial updates that could lead to inconsistent state.

**Acceptance Criteria:**
- Payment + enrollment creation is atomic
- Quiz attempt submission updates are atomic
- Course deletion cascades properly

**Evidence:**
- Idempotent operations: `app/api/payments/mock/confirm/route.js` - handles race conditions

**Gaps/Recommendations:**
- **CRITICAL:** Implement MongoDB transactions for:
  - Payment + enrollment creation
  - Quiz attempt submission + report updates
  - Course deletion (cascade to modules, lessons, quizzes)
- Add transaction retry logic
- Implement saga pattern for distributed transactions (if needed)

---

## 8. Compatibility & Portability

### 8.1 Browser Compatibility

**Requirement:** The system SHALL support modern browsers.

**Rationale:** Ensures broad user access.

**Acceptance Criteria:**
- Supports Chrome, Firefox, Safari, Edge (last 2 versions)
- Graceful degradation for older browsers
- Mobile browser support

**Evidence:**
- Next.js framework: Modern framework with built-in browser support
- React 18: Modern React version

**Gaps/Recommendations:**
- Define and test browser support matrix
- Add polyfills if needed for older browsers
- Test on real devices (not just emulators)

---

### 8.2 Environment Portability

**Requirement:** The system SHALL be deployable across different environments.

**Rationale:** Supports development, staging, and production deployments.

**Acceptance Criteria:**
- Environment variables are used for configuration
- No hardcoded environment-specific values
- Database connection is configurable
- File storage paths are configurable

**Evidence:**
- Environment variables: `auth.js` (line 8) - checks `NEXTAUTH_SECRET`
- Database config: `service/mongo.js` (line 47) - uses `MONGODB_CONNECTION_STRING`
- Configurable URLs: `app/api/certificates/[courseId]/route.js` (line 18) - uses `NEXT_PUBLIC_BASE_URL`

**Gaps/Recommendations:**
- Document all required environment variables
- Add environment variable validation on startup
- Use configuration management tool (e.g., dotenv with validation)
- Implement configuration schema validation

---

## 9. Compliance

### 9.1 Data Privacy Compliance

**Requirement:** The system SHALL comply with data privacy regulations (GDPR, FERPA).

**Rationale:** Legal requirement and trust-building with users.

**Acceptance Criteria:**
- User data can be exported (GDPR right to data portability)
- User data can be deleted (GDPR right to erasure)
- Consent is obtained for data processing
- Privacy policy is accessible

**Evidence:**
- Password protection: Passwords are hashed and not exposed

**Gaps/Recommendations:**
- **CRITICAL:** Implement user data export functionality
- **CRITICAL:** Implement user data deletion functionality
- Add consent management system
- Implement privacy policy acceptance during registration
- Add data processing agreement documentation
- Implement data retention policies

---

### 9.2 Security Compliance

**Requirement:** The system SHALL follow security best practices and standards.

**Rationale:** Protects against security breaches and meets industry standards.

**Acceptance Criteria:**
- Passwords meet complexity requirements
- HTTPS is enforced in production
- Security headers are set (CSP, HSTS, X-Frame-Options)
- Regular security audits are conducted

**Evidence:**
- Password complexity: `lib/validations.js` (lines 17-23) - regex validation for uppercase, lowercase, number, special character
- Secure cookies: `auth.config.js` (line 55) - `secure: process.env.NODE_ENV === 'production'`

**Gaps/Recommendations:**
- **CRITICAL:** Implement security headers middleware (helmet.js)
- Enforce HTTPS redirects in production
- Implement Content Security Policy (CSP)
- Add HSTS (HTTP Strict Transport Security) header
- Conduct regular security audits and penetration testing
- Implement dependency vulnerability scanning (npm audit, Snyk)

---

## NFR Matrix

| ID | Category | Requirement | Priority | Current Support | Evidence | How to Verify |
|---|---|---|---|---|---|---|
| NFR-1.1 | Security | Authentication Security | High | Yes | `auth.js`, `auth.config.js` | Test login rate limiting, password hashing, session security |
| NFR-1.2 | Security | Authorization & Access Control | High | Yes | `middleware.js`, `lib/authorization.js` | Test unauthorized access attempts, IDOR prevention |
| NFR-1.3 | Security | Data Protection & Privacy | High | Partial | `model/user-model.js`, `lib/errors.js` | Test error message sanitization, password exclusion |
| NFR-1.4 | Security | Input Validation | High | Yes | `lib/validations.js`, `app/api/upload/route.js` | Test XSS, injection, path traversal attempts |
| NFR-1.5 | Security | Secure File Handling | High | Yes | `app/api/upload/route.js`, `app/api/videos/[filename]/route.js` | Test file upload restrictions, video access control |
| NFR-2.1 | Performance | Response Time | Medium | Partial | `service/mongo.js`, connection pooling | Load testing, measure response times |
| NFR-2.2 | Performance | Scalability | High | Partial | `lib/rate-limit.js` (in-memory) | Load testing, horizontal scaling test |
| NFR-2.3 | Performance | Resource Efficiency | Medium | Yes | `app/api/videos/[filename]/route.js` (streaming) | Monitor memory usage, connection pool |
| NFR-3.1 | Availability | System Uptime | High | Partial | `service/mongo.js` (error handling) | Uptime monitoring, failover testing |
| NFR-3.2 | Availability | Error Handling | High | Yes | `lib/errors.js` | Test error scenarios, verify user-friendly messages |
| NFR-3.3 | Availability | Data Consistency | High | Partial | `model/enrollment-model.js` (unique index) | Test concurrent operations, duplicate prevention |
| NFR-4.1 | Maintainability | Code Organization | Medium | Yes | Directory structure | Code review, maintainability metrics |
| NFR-4.2 | Maintainability | Logging & Observability | Medium | Partial | `lib/logger.js` | Verify log structure, test log levels |
| NFR-4.3 | Maintainability | Documentation | Low | Partial | `docs/ARCHITECTURE_DIAGRAM.mmd` | Review documentation completeness |
| NFR-5.1 | Usability | User Experience | Medium | Partial | `app/loading.jsx`, `app/error.jsx` | User testing, UX audit |
| NFR-5.2 | Usability | Accessibility | Medium | Partial | Radix UI components | Accessibility audit (axe-core, WAVE) |
| NFR-6.1 | Observability | Application Monitoring | High | No | None | Implement APM, set up metrics |
| NFR-6.2 | Observability | Audit Logging | High | Partial | `lib/logger.js` | Verify audit log coverage, test log retention |
| NFR-7.1 | Data Integrity | Data Validation | High | Yes | `lib/validations.js`, Mongoose schemas | Test invalid inputs, verify validation |
| NFR-7.2 | Data Integrity | Transaction Management | High | No | None | Implement transactions, test atomicity |
| NFR-8.1 | Compatibility | Browser Compatibility | Low | Partial | Next.js framework | Browser testing matrix |
| NFR-8.2 | Compatibility | Environment Portability | Medium | Yes | Environment variables | Test deployment across environments |
| NFR-9.1 | Compliance | Data Privacy Compliance | High | No | None | Implement GDPR features, test data export/deletion |
| NFR-9.2 | Compliance | Security Compliance | High | Partial | Password validation, secure cookies | Security audit, header testing |

---

## Risks & Gaps

### Critical Gaps (Must Address Before Production)

1. **Distributed Rate Limiting:** Current in-memory rate limiting (`lib/rate-limit.js`) will not work in a multi-instance deployment. **Risk:** Rate limits can be bypassed, leading to abuse. **Recommendation:** Implement Redis-based rate limiting.

2. **Transaction Management:** Multi-step operations (payment + enrollment, quiz submission) lack atomic transactions. **Risk:** Partial failures can lead to inconsistent state (payment without enrollment). **Recommendation:** Implement MongoDB transactions.

3. **Audit Logging:** Comprehensive audit logging for security events is missing. **Risk:** Cannot investigate security incidents or comply with audit requirements. **Recommendation:** Implement audit logging system.

4. **Application Monitoring:** No APM or health monitoring. **Risk:** Issues go undetected until users report them. **Recommendation:** Implement monitoring and alerting.

5. **GDPR Compliance:** Data export and deletion features are missing. **Risk:** Legal non-compliance, user trust issues. **Recommendation:** Implement GDPR features.

6. **Security Headers:** Security headers (CSP, HSTS) are not implemented. **Risk:** Vulnerable to XSS, clickjacking attacks. **Recommendation:** Implement security headers middleware.

### High-Priority Gaps

7. **Certificate Generation Abuse:** Rate limiting exists (5 per minute) but no additional abuse prevention. **Risk:** Certificate generation could be abused. **Recommendation:** Add certificate generation tracking and limits.

8. **Video Streaming Performance:** No CDN or caching layer for videos. **Risk:** High bandwidth costs, slow streaming under load. **Recommendation:** Implement CDN for video delivery.

9. **Database Query Optimization:** Limited query optimization and monitoring. **Risk:** Performance degradation as data grows. **Recommendation:** Add query monitoring and optimization.

10. **Error Tracking:** No centralized error tracking (e.g., Sentry). **Risk:** Errors go unnoticed, difficult to debug. **Recommendation:** Integrate error tracking service.

---

## Verification Plan

### Security Testing

1. **Authentication Security:**
   - Test rate limiting: Attempt 6 logins within 15 minutes, verify 6th is blocked
   - Verify password hashing: Check database, ensure passwords are hashed
   - Test session security: Verify httpOnly, secure flags in production
   - Test inactive user login: Create inactive user, verify login is blocked

2. **Authorization Testing:**
   - Test IDOR prevention: Attempt to access another user's course as instructor
   - Test enrollment check: Attempt to access video without enrollment
   - Test admin override: Verify admin can access all resources
   - Test route protection: Attempt to access `/admin` as student

3. **Input Validation:**
   - Test XSS: Submit `<script>alert('XSS')</script>` in forms, verify sanitization
   - Test path traversal: Attempt `../../../etc/passwd` in file uploads
   - Test SQL injection: Attempt MongoDB injection in search fields
   - Test file upload: Upload invalid file types, oversized files

### Performance Testing

1. **Load Testing:**
   - Simulate 100 concurrent users, measure response times
   - Test database connection pool under load
   - Test video streaming with multiple concurrent streams
   - Measure memory usage under load

2. **Scalability Testing:**
   - Test horizontal scaling: Deploy multiple instances, verify stateless operation
   - Test rate limiting across instances (requires Redis implementation)
   - Test database connection pooling limits

### Availability Testing

1. **Error Handling:**
   - Simulate database connection failure, verify graceful handling
   - Test error message sanitization in production mode
   - Verify error responses include appropriate status codes

2. **Data Consistency:**
   - Test concurrent enrollment attempts, verify unique constraint
   - Test payment + enrollment race condition
   - Test quiz attempt submission atomicity

### Compliance Testing

1. **GDPR Compliance:**
   - Test data export functionality (when implemented)
   - Test data deletion functionality (when implemented)
   - Verify consent management (when implemented)

2. **Security Compliance:**
   - Test security headers (when implemented)
   - Verify HTTPS enforcement
   - Test password complexity requirements

---

## Prioritized Roadmap (Top 10)

### Phase 1: Critical Security & Reliability (Weeks 1-4)

1. **Implement Redis-based Distributed Rate Limiting**
   - Priority: Critical
   - Impact: Prevents abuse in multi-instance deployments
   - Effort: Medium (2-3 days)
   - Dependencies: Redis infrastructure

2. **Implement MongoDB Transactions**
   - Priority: Critical
   - Impact: Ensures data consistency for multi-step operations
   - Effort: Medium (3-5 days)
   - Dependencies: MongoDB 4.0+ (replica set)

3. **Implement Comprehensive Audit Logging**
   - Priority: Critical
   - Impact: Security compliance, incident investigation
   - Effort: Medium (4-5 days)
   - Dependencies: Log storage solution

4. **Implement Security Headers Middleware**
   - Priority: Critical
   - Impact: Protects against XSS, clickjacking
   - Effort: Low (1 day)
   - Dependencies: None

### Phase 2: Monitoring & Observability (Weeks 5-6)

5. **Implement Application Performance Monitoring (APM)**
   - Priority: High
   - Impact: Proactive issue detection
   - Effort: Medium (2-3 days)
   - Dependencies: APM service (Sentry, DataDog)

6. **Implement Health Check Endpoint**
   - Priority: High
   - Impact: Enables load balancer health checks
   - Effort: Low (1 day)
   - Dependencies: None

7. **Implement Centralized Error Tracking**
   - Priority: High
   - Impact: Faster debugging, error visibility
   - Effort: Low (1-2 days)
   - Dependencies: Error tracking service (Sentry)

### Phase 3: Compliance & Data Management (Weeks 7-8)

8. **Implement GDPR Data Export & Deletion**
   - Priority: High
   - Impact: Legal compliance
   - Effort: Medium (4-5 days)
   - Dependencies: None

9. **Implement CDN for Video Delivery**
   - Priority: Medium
   - Impact: Performance, cost reduction
   - Effort: Medium (3-4 days)
   - Dependencies: CDN provider (Cloudflare, AWS CloudFront)

### Phase 4: Optimization & Enhancement (Weeks 9-10)

10. **Implement Database Query Optimization & Monitoring**
    - Priority: Medium
    - Impact: Performance, scalability
    - Effort: Medium (3-4 days)
    - Dependencies: Database monitoring tools

---

## Conclusion

This NFR analysis reveals a well-architected LMS with strong foundations in security, authorization, and code organization. However, several critical gaps must be addressed before production deployment, particularly around distributed systems (rate limiting), data consistency (transactions), and observability (monitoring, audit logging).

The prioritized roadmap provides a clear path to production readiness, focusing first on critical security and reliability concerns, followed by monitoring capabilities, and finally compliance and optimization features.

**Overall NFR Maturity Assessment:**
- **Security:** 7/10 (Strong foundations, needs distributed rate limiting and security headers)
- **Performance:** 6/10 (Good connection pooling, needs CDN and query optimization)
- **Availability:** 6/10 (Good error handling, needs monitoring and health checks)
- **Maintainability:** 7/10 (Good code organization, needs more documentation and tests)
- **Observability:** 4/10 (Basic logging exists, needs APM and audit logging)
- **Compliance:** 4/10 (Basic security, needs GDPR features)

**Recommendation:** Address Phase 1 (Critical Security & Reliability) before production deployment. Phases 2-4 can be implemented incrementally post-launch with appropriate monitoring in place.

---

**Document End**
