# Repository Tree (Full)

**Generated:** 2025-01-27

This document contains the complete repository tree structure with all files and directories. This is an exhaustive listing of every file in the LMS repository, excluding build artifacts, dependencies, and OS-specific files.

## Excluded Paths

The following paths are excluded from this tree:

- `node_modules/` - Node.js dependencies (managed by package.json)
- `.next/` - Next.js build output directory
- `dist/` - Distribution/build output (if present)
- `out/` - Next.js static export output (if present)
- `.DS_Store` - macOS system files
- `Thumbs.db` - Windows thumbnail cache
- `.git/` - Git version control directory (excluded as it's not part of the source code)

All other files, including hidden configuration files (e.g., `.env`, `.gitignore`), are included.

---

```
LMS-main/
├── .env                                    # Environment variables (database, API keys, secrets)
├── .gitignore                              # Git ignore patterns (excludes build files, dependencies)
├── app/                                    # Next.js App Router directory - all routes, pages, and API endpoints
│   ├── (main)/                             # Route group for public/main routes (parentheses make it not part of URL)
│   │   ├── account/                        # Student account management pages
│   │   │   ├── @tabs/                      # Parallel routes for account tabs (Next.js parallel routes)
│   │   │   │   ├── enrolled-courses/       # Tab: View enrolled courses
│   │   │   │   │   └── page.jsx            # Enrolled courses list page
│   │   │   │   └── page.jsx                # Default account tab page
│   │   │   ├── component/                  # Account page components
│   │   │   │   ├── account-menu.jsx        # Account dropdown menu component
│   │   │   │   ├── account-sidebar.jsx     # Account sidebar navigation
│   │   │   │   ├── change-password.jsx     # Password change form component
│   │   │   │   ├── contact-info.jsx        # Contact information edit form
│   │   │   │   ├── enrolled-coursecard.jsx # Course card for enrolled courses list
│   │   │   │   ├── personal-details.jsx    # Personal information edit form
│   │   │   │   └── profile-image-upload.jsx # Profile picture upload component
│   │   │   ├── layout.jsx                  # Account section layout wrapper
│   │   │   └── loading.jsx                 # Loading skeleton for account pages
│   │   ├── categories/                     # Category browsing pages
│   │   │   └── [id]/                       # Dynamic route: category detail page
│   │   │       └── page.jsx                # Category page showing courses in category
│   │   ├── checkout/                       # Payment checkout flow
│   │   │   └── mock/                       # MockPay checkout (simulated payment system)
│   │   │       ├── _components/            # Private component folder (underscore = not a route)
│   │   │       │   └── checkout-form.jsx   # Checkout form component for MockPay
│   │   │       └── page.jsx                # Checkout page
│   │   ├── courses/                        # Course browsing and detail pages
│   │   │   ├── [id]/                       # Dynamic route: individual course detail page
│   │   │   │   ├── _components/            # Course detail page components
│   │   │   │   │   ├── CourseCurriculam.jsx # Course curriculum/modules display component
│   │   │   │   │   ├── CourseDetails.jsx   # Main course details component
│   │   │   │   │   ├── CourseDetailsIntro.jsx # Course introduction section
│   │   │   │   │   ├── CourseInstructor.jsx # Instructor profile component
│   │   │   │   │   ├── CourseOverview.jsx  # Course overview section
│   │   │   │   │   ├── module/             # Module-related components
│   │   │   │   │   │   ├── CourseLessonList.jsx # List of lessons in module
│   │   │   │   │   │   └── CourseModuleList.jsx # List of course modules
│   │   │   │   │   ├── RelatedCourses.jsx  # Related courses suggestion component
│   │   │   │   │   └── Testimonials.jsx    # Course reviews/testimonials component
│   │   │   │   ├── lesson/                 # Lesson player page (requires enrollment)
│   │   │   │   │   ├── _components/        # Lesson player components
│   │   │   │   │   │   ├── course-sidebar.jsx # Desktop course navigation sidebar
│   │   │   │   │   │   ├── course-sidebar-mobile.jsx # Mobile course navigation
│   │   │   │   │   │   ├── download-certificate.jsx # Certificate download button/component
│   │   │   │   │   │   ├── give-review.jsx # Review submission component
│   │   │   │   │   │   ├── lesson-video.jsx # Lesson video player wrapper
│   │   │   │   │   │   ├── review-modal.jsx # Review submission modal dialog
│   │   │   │   │   │   ├── sidebar-lesson-items.jsx # Individual lesson items in sidebar
│   │   │   │   │   │   ├── sidebar-lessons.jsx # Lessons list in sidebar
│   │   │   │   │   │   ├── sidebar-modules.jsx # Modules list in sidebar
│   │   │   │   │   │   ├── video-description.jsx # Video lesson description component
│   │   │   │   │   │   └── video-player.jsx # Video player component (react-player wrapper)
│   │   │   │   │   ├── layout.jsx          # Lesson page layout (includes sidebar)
│   │   │   │   │   └── page.jsx            # Main lesson player page
│   │   │   │   ├── quizzes/                # Quiz pages for course
│   │   │   │   │   ├── [quizId]/           # Dynamic route: individual quiz taking page
│   │   │   │   │   │   ├── _components/    # Quiz taking components
│   │   │   │   │   │   │   └── quiz-taking-interface.jsx # Main quiz taking interface component
│   │   │   │   │   │   ├── page.jsx        # Quiz taking page
│   │   │   │   │   │   └── result/         # Quiz result page
│   │   │   │   │   │       └── page.jsx    # Quiz result display page (score, answers)
│   │   │   │   │   └── page.jsx            # Quiz list page for course
│   │   │   │   └── page.jsx                # Main course detail page
│   │   │   ├── _components/                # Course listing page components
│   │   │   │   ├── ActiveFilters.jsx       # Active filter tags display component
│   │   │   │   ├── CourseCard.jsx          # Individual course card component
│   │   │   │   ├── FilterCourse.jsx        # Course filtering component (desktop)
│   │   │   │   ├── FilterCourseMobile.jsx  # Course filtering component (mobile)
│   │   │   │   ├── SearchCourse.jsx        # Course search input component
│   │   │   │   └── SortCourse.jsx          # Course sorting dropdown component
│   │   │   └── page.jsx                    # Course catalog/listing page
│   │   ├── enroll-success/                 # Post-enrollment success confirmation page
│   │   │   └── page.jsx                    # Enrollment success page
│   │   ├── error.jsx                       # Error boundary component for (main) route group
│   │   ├── inst-profile/                   # Instructor public profile pages
│   │   │   └── [id]/                       # Dynamic route: instructor profile by ID
│   │   │       └── page.jsx                # Instructor public profile page
│   │   ├── layout.js                       # Layout wrapper for (main) route group
│   │   ├── loading.jsx                     # Loading skeleton for (main) routes
│   │   └── page.js                         # Homepage/landing page
│   ├── actions/                            # Server Actions directory (Next.js server-side functions)
│   │   ├── account.js                      # Account-related server actions (profile update, password change)
│   │   ├── admin-categories.js             # Admin category management server actions
│   │   ├── admin-courses.js                # Admin course oversight server actions
│   │   ├── admin-setup.js                  # First admin account setup server actions
│   │   ├── admin.js                        # Admin user management server actions
│   │   ├── course.js                       # Instructor course management server actions
│   │   ├── enrollment.js                   # Student enrollment server actions
│   │   ├── index.js                        # Shared server actions and exports
│   │   ├── lesson.js                       # Lesson management server actions (CRUD)
│   │   ├── module.js                       # Module management server actions (CRUD, reordering)
│   │   ├── quizProgressv2.js               # Quiz progress tracking server actions
│   │   ├── quizv2.js                       # Quiz V2 management server actions (create, update, submit attempts)
│   │   └── review.js                       # Course review/testimonial creation server actions
│   ├── admin/                              # Admin dashboard routes (requires admin role)
│   │   ├── _components/                    # Shared admin components
│   │   │   ├── admin-navbar.jsx            # Admin dashboard top navigation bar
│   │   │   └── admin-sidebar.jsx           # Admin dashboard sidebar navigation
│   │   ├── analytics/                      # Analytics dashboard page
│   │   │   ├── _components/                # Analytics components
│   │   │   │   └── analytics-charts.jsx    # Charts component for analytics visualization
│   │   │   ├── loading.jsx                 # Analytics page loading skeleton
│   │   │   └── page.jsx                    # Main analytics dashboard page
│   │   ├── categories/                     # Category management page
│   │   │   ├── _components/                # Category management components
│   │   │   │   └── categories-table.jsx    # Categories data table component
│   │   │   ├── loading.jsx                 # Categories page loading skeleton
│   │   │   └── page.jsx                    # Category management page
│   │   ├── courses/                        # Course oversight page (view all courses)
│   │   │   ├── _components/                # Course oversight components
│   │   │   │   └── courses-table.jsx       # Courses data table component
│   │   │   ├── loading.jsx                 # Courses page loading skeleton
│   │   │   └── page.jsx                    # Course oversight page
│   │   ├── enrollments/                    # Enrollment management page
│   │   │   ├── _components/                # Enrollment management components
│   │   │   │   └── enrollments-table.jsx   # Enrollments data table component
│   │   │   ├── loading.jsx                 # Enrollments page loading skeleton
│   │   │   └── page.jsx                    # Enrollment management page
│   │   ├── error.jsx                       # Error boundary for admin routes
│   │   ├── layout.jsx                      # Admin dashboard layout (includes sidebar, navbar)
│   │   ├── loading.jsx                     # Global admin loading skeleton
│   │   ├── page.jsx                        # Admin dashboard homepage/overview
│   │   ├── payments/                       # Payment overview page
│   │   │   └── page.jsx                    # Payment transactions overview page
│   │   ├── quizzes/                        # Quiz oversight page
│   │   │   └── page.jsx                    # Quiz management overview page
│   │   ├── reviews/                        # Review moderation page
│   │   │   ├── _components/                # Review moderation components
│   │   │   │   └── reviews-table.jsx       # Reviews data table component (approve/delete)
│   │   │   ├── loading.jsx                 # Reviews page loading skeleton
│   │   │   └── page.jsx                    # Review moderation page
│   │   └── users/                          # User management page
│   │       ├── _components/                # User management components
│   │       │   ├── delete-user-dialog.jsx  # User deletion confirmation dialog
│   │       │   ├── user-role-dialog.jsx    # User role change dialog
│   │       │   ├── user-status-dialog.jsx  # User status change dialog (active/inactive/suspended)
│   │       │   └── users-table.jsx         # Users data table component
│   │       ├── loading.jsx                 # Users page loading skeleton
│   │       └── page.jsx                    # User management page
│   ├── api/                                # API Route Handlers (Next.js API routes)
│   │   ├── auth/                           # Authentication API routes
│   │   │   └── [...nextauth]/              # NextAuth catch-all route (handles all auth endpoints)
│   │   │       └── route.js                # NextAuth API route handler (GET, POST)
│   │   ├── certificates/                   # Certificate generation API
│   │   │   └── [courseId]/                 # Dynamic route: generate certificate for course
│   │   │       └── route.js                # Certificate PDF generation endpoint (GET)
│   │   ├── lesson-watch/                   # Lesson viewing progress tracking API
│   │   │   └── route.js                    # Track lesson watch progress endpoint (POST)
│   │   ├── me/                             # Current user API endpoint
│   │   │   └── route.js                    # Get current authenticated user (GET)
│   │   ├── payments/                       # Payment-related API routes
│   │   │   ├── mock/                       # MockPay payment webhook
│   │   │   │   └── confirm/                # Payment confirmation endpoint
│   │   │   │       └── route.js            # MockPay webhook handler (creates enrollment)
│   │   │   └── status/                     # Payment status check endpoint
│   │   │       └── route.js                # Check payment status by referenceId (GET)
│   │   ├── profile/                        # User profile API routes
│   │   │   └── avatar/                     # Profile picture upload endpoint
│   │   │       └── route.js                # Avatar upload handler (POST)
│   │   ├── quizv2/                         # Quiz V2 API routes
│   │   │   └── attempts/                   # Quiz attempt API
│   │   │       └── [attemptId]/            # Dynamic route: get attempt details
│   │   │           └── route.js            # Get quiz attempt details endpoint (GET)
│   │   ├── register/                       # User registration API endpoint
│   │   │   └── route.js                    # User registration handler (POST)
│   │   ├── upload/                         # File upload API routes
│   │   │   ├── route.js                    # General file upload endpoint (images, documents)
│   │   │   └── video/                      # Video upload endpoint
│   │   │       └── route.js                # Video file upload handler (POST, handles large files)
│   │   └── videos/                         # Video streaming API
│   │       └── [filename]/                 # Dynamic route: stream video file
│   │           └── route.js                # Video streaming endpoint (GET, supports Range requests)
│   ├── dashboard/                          # Instructor dashboard routes (requires instructor/admin role)
│   │   ├── _components/                    # Shared dashboard components
│   │   │   ├── mobile-sidebar.jsx          # Mobile responsive sidebar component
│   │   │   ├── navbar.jsx                  # Dashboard top navigation bar
│   │   │   ├── sidebar.jsx                 # Dashboard sidebar navigation component
│   │   │   ├── sidebar-item.jsx            # Individual sidebar menu item component
│   │   │   └── sidebar-routes.jsx          # Sidebar route configuration
│   │   ├── courses/                        # Instructor course management pages
│   │   │   ├── [courseId]/                 # Dynamic route: individual course editor
│   │   │   │   ├── _components/            # Course editor components
│   │   │   │   │   ├── category-form.jsx   # Course category selection form
│   │   │   │   │   ├── course-action.jsx   # Course actions (publish/delete) component
│   │   │   │   │   ├── description-form.jsx # Course description edit form
│   │   │   │   │   ├── image-form.jsx      # Course thumbnail upload form
│   │   │   │   │   ├── module-form.jsx     # Module creation form
│   │   │   │   │   ├── module-list.jsx     # Modules list with drag-and-drop reordering
│   │   │   │   │   ├── price-form.jsx      # Course price edit form
│   │   │   │   │   ├── subtitle-form.jsx   # Course subtitle edit form
│   │   │   │   │   └── title-form.jsx      # Course title edit form
│   │   │   │   ├── enrollments/            # Course enrollments list page
│   │   │   │   │   ├── _components/        # Enrollment list components
│   │   │   │   │   │   ├── columns.jsx     # Table column definitions for enrollments
│   │   │   │   │   │   └── data-table.jsx  # Enrollments data table component
│   │   │   │   │   └── page.jsx            # Enrollments list page
│   │   │   │   ├── modules/                # Module management pages
│   │   │   │   │   └── [moduleId]/         # Dynamic route: individual module editor
│   │   │   │   │       ├── _components/    # Module/lesson editor components
│   │   │   │   │       │   ├── lesson-access-form.jsx # Lesson access level form (private/public)
│   │   │   │   │       │   ├── lesson-action.jsx # Lesson actions (publish/delete) component
│   │   │   │   │       │   ├── lesson-description-form.jsx # Lesson description edit form
│   │   │   │   │       │   ├── lesson-form.jsx # Lesson creation/edit form
│   │   │   │   │       │   ├── lesson-list.jsx # Lessons list with drag-and-drop reordering
│   │   │   │   │       │   ├── lesson-modal.jsx # Lesson creation/edit modal dialog
│   │   │   │   │       │   ├── lesson-title-form.jsx # Lesson title edit form
│   │   │   │   │       │   ├── module-action.jsx # Module actions (publish/delete) component
│   │   │   │   │       │   ├── module-title-form.jsx # Module title edit form
│   │   │   │   │       │   ├── video-upload-field.jsx # Video file upload component
│   │   │   │   │       │   └── video-url-form.jsx # External video URL input form
│   │   │   │   │       └── page.jsx        # Module editor page
│   │   │   │   ├── page.jsx                # Course editor main page
│   │   │   │   ├── quizzes/                # Quiz management pages for course
│   │   │   │   │   ├── [quizId]/           # Dynamic route: individual quiz editor
│   │   │   │   │   │   ├── _components/    # Quiz editor components
│   │   │   │   │   │   │   └── quiz-edit-form.jsx # Quiz settings edit form
│   │   │   │   │   │   ├── attempts/       # Student quiz attempts list page
│   │   │   │   │   │   │   └── page.jsx    # Quiz attempts overview page
│   │   │   │   │   │   ├── page.jsx        # Quiz editor main page
│   │   │   │   │   │   └── questions/      # Question management page
│   │   │   │   │   │       ├── _components/ # Question management components
│   │   │   │   │   │       │   ├── add-question-form.jsx # Question creation form
│   │   │   │   │   │       │   ├── edit-question-modal.jsx # Question edit modal dialog
│   │   │   │   │   │       │   ├── question-form-dialog.jsx # Question form dialog wrapper
│   │   │   │   │   │       │   ├── question-list.jsx # Questions list with drag-and-drop reordering
│   │   │   │   │   │       │   └── questions-manager.jsx # Questions manager container component
│   │   │   │   │   │       └── page.jsx    # Questions management page
│   │   │   │   │   ├── _components/        # Quiz list components
│   │   │   │   │   │   └── quiz-actions.jsx # Quiz actions (create, edit, delete) component
│   │   │   │   │   ├── new/                # Create new quiz page
│   │   │   │   │   │   ├── _components/    # Quiz creation components
│   │   │   │   │   │   │   └── quiz-form.jsx # Quiz creation form component
│   │   │   │   │   │   └── page.jsx        # Create quiz page
│   │   │   │   │   └── page.jsx            # Quiz list page for course
│   │   │   │   └── reviews/                # Course reviews list page
│   │   │   │       ├── _components/        # Reviews list components
│   │   │   │       │   ├── columns.jsx     # Table column definitions for reviews
│   │   │   │       │   └── data-table.jsx  # Reviews data table component
│   │   │   │       └── page.jsx            # Reviews list page
│   │   │   ├── _components/                # Course list components
│   │   │   │   ├── columns.jsx             # Table column definitions for courses
│   │   │   │   └── data-table.jsx          # Courses data table component
│   │   │   ├── add/                        # Create new course page
│   │   │   │   └── page.jsx                # Course creation page
│   │   │   └── page.jsx                    # Instructor courses list page
│   │   ├── error.jsx                       # Error boundary for dashboard routes
│   │   ├── layout.jsx                      # Dashboard layout wrapper (includes sidebar, navbar)
│   │   ├── lives/                          # Live sessions management (placeholder feature)
│   │   │   ├── [liveId]/                   # Dynamic route: individual live session editor
│   │   │   │   └── page.jsx                # Live session editor page
│   │   │   ├── _components/                # Live sessions components
│   │   │   │   ├── columns.jsx             # Table column definitions for live sessions
│   │   │   │   └── data-table.jsx          # Live sessions data table component
│   │   │   ├── add/                        # Create new live session page
│   │   │   │   └── page.jsx                # Create live session page
│   │   │   └── page.jsx                    # Live sessions list page
│   │   ├── loading.jsx                     # Global dashboard loading skeleton
│   │   └── page.jsx                        # Dashboard homepage/overview
│   ├── error.jsx                           # Global error boundary for app directory
│   ├── favicon.ico                         # Site favicon
│   ├── fonts/                              # Local font files (Next.js font optimization)
│   │   ├── GeistMonoVF.woff                # Geist Mono variable font (monospace)
│   │   └── GeistVF.woff                    # Geist variable font (sans-serif)
│   ├── globals.css                         # Global CSS styles
│   ├── layout.js                           # Root layout component (wraps entire app)
│   ├── loading.jsx                         # Global loading skeleton component
│   ├── login/                              # Login page
│   │   ├── _components/                    # Login page components
│   │   │   └── login-form.jsx              # Login form component
│   │   └── page.jsx                        # Login page
│   ├── not-found.jsx                       # 404 not found page component
│   ├── register/                           # User registration pages
│   │   ├── [role]/                         # Dynamic route: register as student/instructor
│   │   │   └── page.jsx                    # Role-specific registration page
│   │   └── _components/                    # Registration components
│   │       └── signup-form.jsx             # Registration form component
│   └── setup/                              # Initial setup pages
│       └── admin/                          # First admin account setup (only works if no admin exists)
│           ├── _components/                # Admin setup components
│           │   └── admin-setup-form.jsx    # Admin setup form component
│           └── page.jsx                    # Admin setup page
├── assets/                                 # Additional static assets (outside public)
│   └── easylogo.png                        # Application logo image
├── auth.config.js                          # NextAuth configuration export (session settings, callbacks)
├── auth.js                                 # NextAuth main configuration file (providers, handlers)
├── components.json                         # shadcn/ui components configuration file
├── components/                             # Reusable React components directory
│   ├── alert-banner.jsx                    # Alert banner component (site-wide notifications)
│   ├── course-progress.jsx                 # Course progress bar/indicator component
│   ├── element.jsx                         # Generic element wrapper component
│   ├── enroll-course.jsx                   # Course enrollment button/component
│   ├── enrollment-status-poll.jsx          # Polling component for enrollment status (after payment)
│   ├── file-upload.jsx                     # File upload component (drag-and-drop)
│   ├── icon-badge.jsx                      # Icon with badge component
│   ├── logo.jsx                            # Logo component
│   ├── main-nav.jsx                        # Main navigation component (header)
│   ├── mobile-nav.jsx                      # Mobile navigation component
│   ├── money-back.jsx                      # Money-back guarantee component
│   ├── safe-image.jsx                      # Safe image component (error handling, fallbacks)
│   ├── section-title.jsx                   # Section title component
│   ├── site-footer.jsx                     # Site footer component
│   ├── start-rating.jsx                    # Star rating component (for reviews)
│   ├── support.jsx                         # Support/help component
│   ├── ui/                                 # shadcn/ui component library (Radix UI primitives)
│   │   ├── accordion.jsx                   # Accordion component (collapsible sections)
│   │   ├── alert-dialog.jsx                # Alert dialog component (confirmation modals)
│   │   ├── alert.jsx                       # Alert/notification component
│   │   ├── avatar.jsx                      # Avatar component (user profile pictures)
│   │   ├── badge.jsx                       # Badge component (labels, tags)
│   │   ├── button.jsx                      # Button component
│   │   ├── calendar.jsx                    # Calendar/date picker component
│   │   ├── card.jsx                        # Card container component
│   │   ├── carousel.jsx                    # Carousel/slider component
│   │   ├── checkbox.jsx                    # Checkbox input component
│   │   ├── combobox.jsx                    # Combobox/autocomplete component
│   │   ├── command.jsx                     # Command palette component
│   │   ├── dialog.jsx                      # Modal dialog component
│   │   ├── dropdown-menu.jsx               # Dropdown menu component
│   │   ├── empty-state.jsx                 # Empty state component (no data)
│   │   ├── error-state.jsx                 # Error state component
│   │   ├── form.jsx                        # Form wrapper component (react-hook-form integration)
│   │   ├── input.jsx                       # Text input component
│   │   ├── label.jsx                       # Form label component
│   │   ├── popover.jsx                     # Popover component
│   │   ├── progress.jsx                    # Progress bar component
│   │   ├── radio-group.jsx                 # Radio button group component
│   │   ├── select.jsx                      # Select dropdown component
│   │   ├── separator.jsx                   # Horizontal/vertical separator component
│   │   ├── sheet.jsx                       # Sheet/side panel component
│   │   ├── skeleton.jsx                    # Loading skeleton component
│   │   ├── sonner.jsx                      # Sonner toast notification component (import)
│   │   ├── table.jsx                       # Table component
│   │   ├── tabs.jsx                        # Tabs component
│   │   ├── textarea.jsx                    # Textarea input component
│   │   ├── toast.jsx                       # Toast notification component
│   │   └── toaster.jsx                     # Toast notification provider/container
│   └── video-player.jsx                    # Video player component wrapper
├── docs/                                   # Documentation files
│   ├── MOCKPAY_COMPLETE_TESTING_CHECKLIST.md # MockPay testing checklist documentation
│   ├── MOCKPAY_IMPLEMENTATION_SUMMARY.md   # MockPay implementation summary
│   ├── MOCKPAY_TESTING_CHECKLIST.md        # MockPay testing guide
│   ├── QUIZ_SYSTEM_IMPLEMENTATION_GUIDE.md # Quiz V2 system implementation guide
│   ├── QUIZ_SYSTEM_STATUS.md               # Quiz system status documentation
│   ├── STRIPE_REMOVAL_CLEANUP_PLAN.md      # Stripe payment removal cleanup plan
│   └── WEBHOOK_FIX_VERIFICATION.md         # Webhook fix verification documentation
├── hooks/                                  # Custom React hooks directory
│   ├── use-lock-body.js                    # Hook to lock body scroll (for modals)
│   └── use-toast.js                        # Toast notification hook
├── jsconfig.json                           # JavaScript/TypeScript path aliases configuration (@/*)
├── lib/                                    # Utility libraries and helper functions
│   ├── action-wrapper.js                   # Server action error handling wrapper
│   ├── admin-utils.js                      # Admin-specific utility functions
│   ├── auth-helpers.js                     # Authentication helper functions (getCurrentUser, requireAuth, etc.)
│   ├── auth-redirect.js                    # Authentication redirect utilities (role-based redirects)
│   ├── authorization.js                    # Ownership verification and authorization checks (prevents IDOR)
│   ├── certificate-helpers.js              # Certificate generation and verification logic
│   ├── constants.js                        # Application constants
│   ├── convertData.js                      # Data transformation utilities
│   ├── dashboard-helper.js                 # Dashboard-specific helper functions
│   ├── date.js                             # Date formatting utilities
│   ├── errors.js                           # Standardized error handling system (error codes, response shapes)
│   ├── formatPrice.js                      # Price formatting utility (currency formatting)
│   ├── image-utils.js                      # Image processing utilities
│   ├── loggedin-user.js                    # Get current logged-in user from database (full user object)
│   ├── logger.js                           # Action/route logging utility
│   ├── permissions.js                      # RBAC permission system definitions (roles, permissions mapping)
│   ├── rate-limit.js                       # In-memory rate limiting utility
│   ├── routes.js                           # Route constants and public routes definition
│   ├── toast-helpers.js                    # Toast notification helper functions
│   ├── utils.js                            # General utility functions (cn() for class merging)
│   └── validations.js                      # Zod validation schemas for forms
├── middleware.js                           # Next.js middleware (route protection, authentication checks)
├── model/                                  # Mongoose schema definitions (database models)
│   ├── assessment-model.js                 # Legacy assessment model (deprecated, replaced by Quiz V2)
│   ├── attemptv2-model.js                  # Quiz attempt tracking model (quiz submissions, scores)
│   ├── category-model.js                   # Course category model
│   ├── course-model.js                     # Course model (title, description, price, instructor, etc.)
│   ├── enrollment-model.js                 # Student course enrollment model
│   ├── lesson.model.js                     # Lesson model (title, video URL, duration, access level)
│   ├── module.model.js                     # Course module model (contains lessons, order)
│   ├── payment-model.js                    # Payment transaction model (Stripe/MockPay)
│   ├── questionv2-model.js                 # Quiz question model (type, options, correct answers)
│   ├── quizv2-model.js                     # Quiz model V2 (settings, requirements, pass percent)
│   ├── report-model.js                     # Course progress report model (completed lessons/modules, quiz tracking)
│   ├── testimonial-model.js                # Course review/testimonial model
│   ├── user-model.js                       # User model (email, password, role, status, profile info)
│   └── watch-model.js                      # Lesson viewing progress tracking model
├── next.config.mjs                         # Next.js configuration file
├── package.json                            # Node.js package dependencies and scripts
├── package-lock.json                       # NPM lock file (exact dependency versions)
├── playground-1.mongodb.js                 # MongoDB playground/script file (development/testing)
├── postcss.config.mjs                      # PostCSS configuration (for Tailwind CSS)
├── public/                                 # Public static assets (served directly by Next.js)
│   ├── assets/                             # Additional static assets
│   │   ├── file.svg                        # File icon SVG
│   │   ├── globe.svg                       # Globe icon SVG
│   │   ├── images/                         # Image assets
│   │   │   ├── categories/                 # Category thumbnail images
│   │   │   │   ├── design.jpg              # Design category thumbnail
│   │   │   │   ├── development.jpg         # Development category thumbnail
│   │   │   │   ├── it_software.jpg         # IT/Software category thumbnail
│   │   │   │   ├── marketing.jpg           # Marketing category thumbnail
│   │   │   │   ├── music.jpg               # Music category thumbnail
│   │   │   │   ├── personal_development.jpg # Personal Development category thumbnail
│   │   │   │   ├── photography.jpg         # Photography category thumbnail
│   │   │   │   └── programming.jpg         # Programming category thumbnail
│   │   │   ├── courses/                    # Course thumbnail images
│   │   │   │   ├── ____________2023-07-13_030045_1767280832208.png # Course thumbnail
│   │   │   │   ├── 3 Food Delivery Website with Laravel 11..png # Course thumbnail
│   │   │   │   ├── 3_Food_Delivery_Website_with_Laravel_11._1767806882413.png # Course thumbnail
│   │   │   │   ├── 3_Food_Delivery_Website_with_Laravel_11._1767976605104.png # Course thumbnail
│   │   │   │   ├── 332864992_1353288891880221_6265369911952554532_n_1767280797751.jpg # Course thumbnail
│   │   │   │   ├── course_1.png            # Course thumbnail
│   │   │   │   ├── course_1_1766254319143.png # Course thumbnail
│   │   │   │   ├── course_1_1767791447224.png # Course thumbnail
│   │   │   │   ├── default.jpg             # Default course thumbnail
│   │   │   │   ├── learn_js_thumbnail.jpeg # JavaScript course thumbnail
│   │   │   │   ├── python_thumbnail.png    # Python course thumbnail
│   │   │   │   ├── python_thumbnail_1767878663188.png # Python course thumbnail variant
│   │   │   │   ├── python_thumbnail_1767878663188_1767878727164.png # Python course thumbnail variant
│   │   │   │   ├── python_thumbnail_1767968881246.png # Python course thumbnail variant
│   │   │   │   └── Screenshot 2022-11-23 at 7.34.30 PM.png # Course thumbnail
│   │   │   ├── default.jpg                 # Default image placeholder
│   │   │   ├── money.png                   # Money-back guarantee icon
│   │   │   ├── one.png                     # Number/step icon
│   │   │   ├── profile.jpg                 # Default profile picture
│   │   │   ├── profile-banner.jpg          # Default profile banner
│   │   │   ├── support.png                 # Support icon
│   │   │   ├── support1.png                # Support icon variant
│   │   │   └── two.png                     # Number/step icon
│   │   ├── next.svg                        # Next.js logo SVG
│   │   ├── star.svg                        # Star icon SVG
│   │   ├── vercel.svg                      # Vercel logo SVG
│   │   └── window.svg                      # Window icon SVG
│   ├── file.svg                            # File icon SVG
│   ├── fonts/                              # Web fonts directory
│   │   ├── kalam/                          # Kalam font family (used in certificates)
│   │   │   ├── Kalam-Bold.ttf              # Kalam Bold font
│   │   │   ├── Kalam-Light.ttf             # Kalam Light font
│   │   │   └── Kalam-Regular.ttf           # Kalam Regular font
│   │   └── montserrat/                     # Montserrat font family (used in certificates)
│   │       ├── Montserrat-Black.ttf        # Montserrat Black font
│   │       ├── Montserrat-BlackItalic.ttf  # Montserrat Black Italic font
│   │       ├── Montserrat-Bold.ttf         # Montserrat Bold font
│   │       ├── Montserrat-BoldItalic.ttf   # Montserrat Bold Italic font
│   │       ├── Montserrat-ExtraBold.ttf    # Montserrat ExtraBold font
│   │       ├── Montserrat-ExtraBoldItalic.ttf # Montserrat ExtraBold Italic font
│   │       ├── Montserrat-ExtraLight.ttf   # Montserrat ExtraLight font
│   │       ├── Montserrat-ExtraLightItalic.ttf # Montserrat ExtraLight Italic font
│   │       ├── Montserrat-Italic.ttf       # Montserrat Italic font
│   │       ├── Montserrat-Light.ttf        # Montserrat Light font
│   │       ├── Montserrat-LightItalic.ttf  # Montserrat Light Italic font
│   │       ├── Montserrat-Medium.ttf       # Montserrat Medium font
│   │       ├── Montserrat-MediumItalic.ttf # Montserrat Medium Italic font
│   │       ├── Montserrat-Regular.ttf      # Montserrat Regular font
│   │       ├── Montserrat-SemiBold.ttf     # Montserrat SemiBold font
│   │       ├── Montserrat-SemiBoldItalic.ttf # Montserrat SemiBold Italic font
│   │       ├── Montserrat-Thin.ttf         # Montserrat Thin font
│   │       └── Montserrat-ThinItalic.ttf   # Montserrat Thin Italic font
│   ├── globe.svg                           # Globe icon SVG
│   ├── logo.png                            # Application logo (used in certificates)
│   ├── next.svg                            # Next.js logo SVG
│   ├── pattern.jpg                         # Background pattern image (used in certificates)
│   ├── sign.png                            # Signature image (used in certificates)
│   ├── uploads/                            # User-uploaded content directory
│   │   └── avatars/                        # User profile picture uploads
│   │       ├── avatar_adeeb2002alsalh_gmail_com_1766157021530.jpg # User avatar
│   │       ├── avatar_student2002student_gmail_com_1766170500638.jpg # User avatar
│   │       └── avatar_student2002student_gmail_com_1767279907882.jpg # User avatar
│   ├── vercel.svg                          # Vercel logo SVG
│   └── window.svg                          # Window icon SVG
├── queries/                                # Database query functions (data access layer)
│   ├── admin-setup.js                      # Admin setup verification queries
│   ├── admin.js                            # Admin dashboard queries (stats, user management)
│   ├── categories.js                       # Category CRUD queries
│   ├── courses.js                          # Course queries (get, create, update, list)
│   ├── enrollments.js                      # Enrollment queries (create, get, check enrollment)
│   ├── lessons.js                          # Lesson queries (CRUD, reordering)
│   ├── modules.js                          # Module queries (CRUD, reordering)
│   ├── payments-admin.js                   # Admin payment queries (revenue, transactions)
│   ├── payments.js                         # Payment queries (create, get status)
│   ├── quizv2.js                           # Quiz V2 queries (get quiz, questions, attempts, status)
│   ├── reports.js                          # Progress report queries (course completion tracking)
│   ├── testimonials.js                     # Review/testimonial queries (CRUD, filtering)
│   └── users.js                            # User queries (get by email/ID, create, update)
├── README.md                               # Project README file
├── REPOSITORY_CLEANUP_SUMMARY.md           # Repository cleanup summary documentation
├── REPOSITORY_DOCUMENTATION.md             # Main repository documentation file
├── REPOSITORY_TREE.md                      # Original repository tree (summary version)
├── service/                                # External service integrations
│   └── mongo.js                            # MongoDB connection manager (connection pooling, caching)
└── tailwind.config.js                      # Tailwind CSS configuration file
```

---

## Statistics

- **Total Files:** 375 files (excluding excluded paths)
- **Total Directories:** Approximately 150+ directories

## Notes

- Hidden files (starting with `.`) are included (e.g., `.env`, `.gitignore`)
- All source code files are included
- Configuration files are included (e.g., `package.json`, `tailwind.config.js`, `next.config.mjs`)
- Documentation files are included (Markdown files in `docs/` and root)
- Static assets (images, fonts, SVGs) in `public/` are included
- Uploaded user content in `public/uploads/` is included
