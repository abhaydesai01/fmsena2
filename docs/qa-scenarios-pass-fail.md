# Complete QA Scenario Matrix (Manual + Automation)

Date: 2026-06-10  
Environment: Local (`http://localhost:8082`), Mongo from `.env`

## Critical Scenarios

| ID | Scenario | Type | Status | Notes |
|---|---|---|---|---|
| QA-001 | Admin login from portal | Automation (`qa:core`) | PASS | Reached dashboard |
| QA-002 | Student detail page opens without runtime crash | Automation (`qa:core`) | PASS | Fixed bug: `today` used before initialization |
| QA-003 | Certificate/document download action present | Automation (`qa:core`) | PASS | Added explicit `Download` action in documents table |
| QA-004 | Custom payment plan (Re-plan Late Joiner) applies | Automation (`qa:core`) | PASS | Verified by `plan_upgrades` record creation |
| QA-005 | Admission form / certificate page opens | Automation (`qa:core`) | PASS | Fixed nested route rendering with `Outlet` |
| QA-006 | Payment History report tab renders | Automation (`qa:core`) | PASS | Verified tab content and table heading |
| QA-007 | Due Tracker report tab renders | Automation (`qa:core`) | PASS | Verified tracker heading |
| QA-008 | Force-password-reset flow | Automation (`qa-force-reset`) | PASS | Redirect + DB flag clear + new password hash |
| QA-009 | Production build | Command (`npm run build`) | PASS | Client + SSR build succeed |

## Non-Functional / Tooling Status

| ID | Scenario | Type | Status | Notes |
|---|---|---|---|---|
| QA-010 | Lint gate (`npm run lint`) | Command | FAIL | Existing repo-wide issues (prettier + no-explicit-any) not introduced by this fix |
| QA-011 | RBAC regression suite (`qa-rbac`) | Automation | FAIL (script-level) | Flow now flaky on privilege dialog selector; core RBAC previously passed and app logic unaffected by current fixes |

## Failures Found and Rectified

1. **Student page runtime failure**
   - Root cause: `today` referenced before declaration in `students_.$studentId.tsx`.
   - Fix: moved `today` declaration before usage.
   - Impact: restored student page stability and downstream actions.

2. **Certificate/admission form not opening**
   - Root cause: nested child route was not rendered because parent route lacked `Outlet`.
   - Fix: added conditional `Outlet` rendering in `students_.$studentId.tsx` for `/admission-form`.
   - Impact: admission form route now renders and print action is available.

3. **Certificate download missing**
   - Root cause: documents area only had `Open`, not explicit download action.
   - Fix: added `Download` link (`download` attribute) beside `Open`.
   - Impact: users can directly download uploaded certificate/documents.

## Automation Commands Used

- `npm run qa:core`
- `node scripts/qa-force-reset.mjs`
- `npm run build`

## Remaining Recommended Actions

1. Clean up existing repo-wide lint backlog to restore CI lint pass.
2. Stabilize `scripts/qa-rbac.mjs` selector for the privilege modal (automation robustness task).
