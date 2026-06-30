<!--
Sync Impact Report
------------------
Version change: (none) → 1.0.0
Bump rationale: Initial ratification of the LMS Constitution. Previous file was an unfilled
template scaffold; this commit replaces every placeholder with concrete, enforceable rules
and adds the project's four core principles.

Modified principles:
- [PRINCIPLE_1_NAME] → I. Code Quality & Maintainability
- [PRINCIPLE_2_NAME] → II. Testing Standards (NON-NEGOTIABLE)
- [PRINCIPLE_3_NAME] → III. User Experience Consistency
- [PRINCIPLE_4_NAME] → IV. Performance Requirements
- [PRINCIPLE_5_NAME] → REMOVED (user scoped the constitution to four principles)

Added sections:
- Additional Constraints & Quality Gates (replaces [SECTION_2_NAME])
- Development Workflow & Review Process (replaces [SECTION_3_NAME])

Removed sections:
- Fifth principle slot (intentionally dropped per user request)

Templates requiring updates:
- ✅ .specify/templates/plan-template.md — Constitution Check section already references
   "[Gates determined based on constitution file]"; no edit required, gates derive from
   Principles I–IV at plan time.
- ✅ .specify/templates/spec-template.md — Aligned: no mandatory section added by this
   constitution; spec scope is unchanged.
- ✅ .specify/templates/tasks-template.md — Aligned: task categories already accommodate
   the testing, quality, performance, and polish work this constitution requires.
- ✅ .specify/templates/checklist-template.md — Aligned: no structural change required.
- ✅ .specify/templates/constitution-template.md — Source template unchanged; only the
   instantiated copy at .specify/memory/constitution.md is updated.

Follow-up TODOs:
- None. All placeholders have been resolved.
-->

# LMS Constitution

## Core Principles

### I. Code Quality & Maintainability

The codebase MUST remain readable, reviewable, and safe to change at any time. The
following rules are non-negotiable for every contribution:

- **Single source of truth**: shared logic MUST live in `lib/`, `service/`, `queries/`,
  or `hooks/`. Duplicating business rules inside `app/` route handlers or React
  components is prohibited.
- **Lint clean**: every PR MUST pass `npm run lint` with zero new warnings. Disabling
  a rule inline requires a one-line justification comment.
- **Typed boundaries**: every external boundary (API route, server action, form
  submission, database query) MUST validate inputs with a Zod schema and return a
  declared, documented shape. `any` and unchecked `as` casts are forbidden at
  boundaries.
- **Small, focused units**: a single React component, route handler, or service
  function SHOULD stay under ~200 lines and own one responsibility. Larger units
  MUST be justified in code review.
- **No dead code**: unused exports, commented-out blocks, `console.log` debug
  statements, and unreachable branches MUST be removed before merge.
- **Reviewed before merge**: every change to `main` MUST be reviewed by at least one
  engineer who did not author it; self-merge is prohibited except for documentation-
  only patches.

Rationale: this is a multi-role product (Admin, Instructor, Student) with money,
grades, and certificates flowing through it. Defects compound quickly, so the cost of
sloppy code is paid by real learners. These rules keep the diff surface small enough
for humans and AI agents to reason about safely.

### II. Testing Standards (NON-NEGOTIABLE)

Tests are a release gate, not a nice-to-have. The following rules MUST be enforced
on every PR:

- **Risk-tiered coverage**: payment flows (MockPay), authentication/authorization,
  quiz grading, enrollment, progress calculation, and certificate generation MUST
  have automated tests covering the happy path and at least the documented failure
  modes. UI-only cosmetic changes MAY ship without new tests.
- **Server logic is integration-tested**: API routes and server actions MUST be
  exercised against a real (test) MongoDB instance or a documented in-memory
  substitute — never by mocking Mongoose internals.
- **Authorization is tested explicitly**: any route that branches on role
  (`admin` / `instructor` / `student`) MUST have at least one test per role that
  asserts both allowed and denied behaviour.
- **Regressions become tests**: every bug fixed in production MUST land with a
  failing test (or a new assertion in an existing test) that would have caught it.
- **Fast feedback**: the full test suite MUST run in CI on every PR and SHOULD
  complete in under 10 minutes. Flaky tests MUST be quarantined or fixed within
  one sprint of being reported; silently re-running flaky tests is forbidden.
- **No skipped tests on `main`**: `it.skip`, `describe.skip`, or commented-out
  tests MUST NOT be merged. If a test is wrong, fix it or delete it.

Rationale: this product touches grades, payments, and credentials. Untested
regressions in those paths damage user trust in ways no hotfix can repair, so the
constitution makes the gate explicit rather than aspirational.

### III. User Experience Consistency

Every learner-, instructor-, and admin-facing surface MUST feel like one product.
The following rules apply to every UI change:

- **Design system first**: UI MUST be built from shadcn/ui primitives and Tailwind
  utility classes already in use. Introducing a new component pattern (new modal
  style, new button variant, new form layout) requires updating the shared
  component in `components/` so the rest of the app can adopt it.
- **Consistent layouts per role**: Admin, Instructor, and Student dashboards MUST
  share navigation, page header, breadcrumb, and empty-state patterns. Role-specific
  screens MUST NOT invent new chrome.
- **Internationalization (i18n) is mandatory**: every user-visible string MUST come
  from `messages/` via the i18n layer. Hard-coded English (or any language) strings
  in JSX, toasts, validation messages, or emails are prohibited.
- **Accessibility floor**: every interactive element MUST be keyboard-reachable, have
  an accessible name, and meet WCAG 2.1 AA color-contrast requirements. Forms MUST
  surface validation errors programmatically (via `aria-describedby` or equivalent),
  not by color alone.
- **Responsive by default**: every page MUST be usable at 360px width (mobile) and
  1280px width (desktop). Tables MUST degrade to a stacked or scrollable view on
  mobile; horizontal page scroll is a defect.
- **Feedback is predictable**: loading, success, error, and empty states MUST use
  the shared `Toast`, `Skeleton`, and empty-state components. Silent failures and
  bespoke spinners are prohibited.

Rationale: learners and instructors move between course, quiz, and dashboard
screens dozens of times per session. Inconsistent UI forces them to re-learn the
product on every page and disproportionately hurts non-English speakers and users
with assistive technology.

### IV. Performance Requirements

Performance is a feature, and these budgets MUST hold on every release. A change that
exceeds a budget is a regression that MUST be fixed or explicitly justified in the
PR before merge.

- **Server response budgets** (p95, measured on representative production-like
  data):
  - Read endpoints (list courses, list lessons, dashboard summaries): ≤ 300 ms.
  - Write endpoints (enroll, submit quiz, mark lesson complete): ≤ 600 ms.
  - Background jobs (certificate PDF generation, email send): MUST run
    asynchronously; the originating request MUST return within the read/write
    budgets above.
- **Database discipline**: every query that runs in a request path MUST be indexed
  for its filter and sort keys. N+1 query patterns (looping over results to fetch
  related documents one at a time) are prohibited; use Mongoose `populate`,
  aggregation, or a single batched query instead.
- **Frontend budgets** (per route, production build):
  - First Contentful Paint ≤ 2.0 s on a 4G connection.
  - Largest Contentful Paint ≤ 2.5 s on a 4G connection.
  - Initial JavaScript shipped to the browser per route ≤ 250 KB gzipped.
  - Routes exceeding these budgets MUST use dynamic imports, server components, or
    streaming to recover before merge.
- **Asset hygiene**: images served to learners MUST use `next/image` (or an
  equivalent optimized loader) with explicit `width`/`height`. Raw `<img>` tags
  pointing at unoptimized uploads in user-facing pages are prohibited.
- **Pagination over unbounded reads**: any endpoint returning a collection
  (courses, students, enrollments, quiz attempts) MUST paginate. Returning the full
  collection is permitted only for admin export endpoints and MUST be explicitly
  documented.
- **Measurement is required**: any PR claiming to improve performance MUST include
  before/after numbers (lab measurement, query timing, or bundle analyzer output);
  vibes are not evidence.

Rationale: the LMS is used during live classes and graded assessments where slow
pages directly cost learners time and instructors trust. Hard budgets — rather than
"try to be fast" — let reviewers reject regressions objectively.

## Additional Constraints & Quality Gates

- **Tech stack lock**: the production stack is Next.js 15 (App Router), React 18,
  Tailwind CSS, shadcn/ui, MongoDB via Mongoose, NextAuth v5, Zod, and React Hook
  Form. Introducing a new runtime dependency in any of these layers (alternative
  ORM, alternative UI library, alternative auth provider) requires a constitutional
  amendment, not just a PR.
- **Secrets handling**: secrets MUST be read from environment variables only.
  Committing `.env`, API keys, database URIs, or NextAuth secrets to the repository
  is a constitutional violation regardless of branch.
- **Data integrity**: schema changes that alter or remove existing fields MUST ship
  with a migration script in `scripts/` (or equivalent) and MUST be tested against
  a copy of representative data before merge.
- **Payment posture**: real payment-gateway integrations MUST NOT be merged onto
  `main` while MockPay is the documented system. Switching from MockPay to a real
  provider requires an amendment because it changes user-facing risk.
- **Documentation in sync**: when a change affects developer onboarding (new env
  var, new script, new architectural module), `README.md` and the relevant doc in
  `docs/` MUST be updated in the same PR.

## Development Workflow & Review Process

- **Feature flow**: all work follows the spec-kit loop —
  `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
  Skipping the spec or plan phase for a change that touches more than one module
  is prohibited.
- **Constitution Check gate**: the plan template's Constitution Check MUST be
  evaluated against Principles I–IV before Phase 0 research begins and again after
  Phase 1 design. Unresolved violations block implementation until they are
  justified in the Complexity Tracking table or the design is changed.
- **CI gates on every PR**: lint, type/schema checks, and the test suite MUST be
  green before merge. A red CI cannot be overridden by review approval.
- **Pull request hygiene**: every PR MUST link to the spec or plan it implements
  (or explain in the description why none is needed), describe user-visible impact,
  and call out any budget (Principle IV) or accessibility (Principle III)
  implications.
- **Post-merge ownership**: the author of a merged change is responsible for
  monitoring it for 48 hours and rolling it back or fixing forward if it breaks a
  principle in production.

## Governance

- This constitution supersedes any conflicting practice, README note, or informal
  team agreement. When in doubt, the constitution wins.
- **Amendments**: changes to this document require (1) a pull request that edits
  this file, (2) a version bump consistent with the rules below, (3) review and
  approval by at least one maintainer who did not author the change, and (4) a
  Sync Impact Report at the top of the file describing what moved.
- **Versioning policy** (semantic):
  - **MAJOR** — a principle is removed, redefined in a backward-incompatible way,
    or the governance/amendment process itself changes.
  - **MINOR** — a new principle or new mandatory section is added, or an existing
    principle is materially expanded (new MUST/SHOULD rules).
  - **PATCH** — wording, typo, clarification, or non-semantic refinement that does
    not change what the rules require.
- **Compliance review**: every reviewer MUST verify that the PR they approve does
  not violate Principles I–IV. Violations that ship are tracked as defects and the
  fix is prioritized over new feature work.
- **Runtime guidance**: day-to-day development guidance (commands, structure,
  conventions) lives in `README.md`, `PROJECT_ARCHITECTURE.md`, and
  `API_IMPLEMENTATION_GUIDE.md`. Those documents MUST defer to this constitution
  if they ever disagree.

**Version**: 1.0.0 | **Ratified**: 2026-06-26 | **Last Amended**: 2026-06-26
