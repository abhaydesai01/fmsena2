# PRD: Campus-Switch Payment Ops + Performance

## 1) Problem Statement

Operations staff need to switch campuses quickly while processing students and payments.
Currently, some modules do not consistently scope data by active campus, causing cross-campus noise and slower queries as data grows.

## 2) Goals

- Enable `Admin`, `Accountant`, and `Enrollment Officer` to switch campus and operate payment/student workflows campus-wise.
- Ensure student selection and payment management always respect active campus in the relevant screens.
- Improve platform responsiveness by reducing unscoped reads and adding query/index optimizations.

## 3) Non-Goals

- Multi-campus access permissions per user (all campuses are currently selectable globally).
- Cross-campus consolidated analytics toggle (this PRD scopes to active-campus behavior by default).
- Full DB migration framework changes.

## 4) User Personas

- **Admin**: Oversees all campuses, handles escalations and reporting.
- **Accountant**: Collects payments and tracks dues campus-wise.
- **Enrollment Officer**: Handles student enrollment/profile changes and may assist in payment routing/selection.

## 5) Functional Requirements

### FR-1 Campus switch visibility and usability
- Campus switch remains available in the app shell top bar for authenticated users.
- Active campus is visibly shown in the shell.

### FR-2 Payment operations must be campus-aware
- Student search for fee collection must only return students from active campus.
- Course filters in collect flow must be scoped to active campus.

### FR-3 Student listing must be campus-aware
- Student list and course filter options must be scoped by active campus.

### FR-4 Dashboard and reports must be campus-aware
- Dashboard widgets should compute values for active campus.
- Reports should load campus-scoped datasets by default.

### FR-5 Role navigation support
- `Admin`, `Accountant`, and `Enrollment Officer` can access payment module entry from navigation.

## 6) Performance Requirements

- Campus-scoped query paths should avoid full-collection scans where possible.
- Introduce/ensure indexes for high-traffic filters and sort fields.
- Keep dashboard/report interactions responsive as data grows.

## 7) UX Requirements

- Campus context is always visible near navigation/header.
- Switching campus should update downstream data queries naturally via query-key invalidation.
- No user-facing breaking changes in existing payment dialogs.

## 8) Technical Design (Implemented)

- Add campus-aware filters to server report/dashboard functions.
- Pass `campusId` from client routes into query functions and include in query keys.
- Scope `students`, `collect`, `dashboard`, and `reports` APIs/queries to active campus.
- Add `ENROLLMENT_OFFICER` to collect module navigation.
- Add MongoDB index warm-up in `getDb()` for frequently queried fields.

## 9) Acceptance Criteria

- Selecting campus A/B changes student search results in collect flow accordingly.
- Student list shows only selected-campus students.
- Dashboard totals and report tables reflect active campus.
- Enrollment Officer sees and can open collect module from sidebar.
- P95 query latency improves on campus-scoped paths after indexes warm.

## 10) Risks and Mitigations

- **Risk**: Existing reports previously expected global totals.
  - **Mitigation**: Campus-scoped behavior is explicit and consistent with active context.
- **Risk**: Index creation overhead during first run.
  - **Mitigation**: Index warm-up is one-time, non-fatal, and async-safe.

## 11) Rollout Plan

1. Deploy code with campus-scoped query changes.
2. Observe first-run index warm-up logs.
3. Validate with smoke tests on collect, students, dashboard, and reports.
4. Capture feedback from admin/accounting operators.

## 12) Test Plan

- Switch campus in shell, verify:
  - collect search results differ by campus,
  - student list differs by campus,
  - dashboard cards update by campus,
  - reports data updates by campus.
- Confirm enrollment officer can open collect screen.
- Sanity check payment recording still updates installment/receipt correctly.

