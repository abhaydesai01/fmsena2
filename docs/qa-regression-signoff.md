# Module-wise Regression QA Sign-off

Date: 2026-06-10T07:28:21.145Z
Environment: http://localhost:8082

Summary: **11/11 passed**, **0 failed**

| Module | Scenario | Status | Details |
|---|---|---|---|
| Dashboard | Dashboard loads with quick actions | PASS | Checked heading cards. |
| Enroll | Enrollment form renders mandatory date fields | PASS | Joining/registration present. |
| Students | Student appears in listing and search | PASS | Search=QAREG/1781076483268 |
| Students | Customize plan (Re-plan Late Joiner) applies | PASS | Upgrades 0 -> 1 |
| Collect | Collect fee module loads | PASS | Collect page render. |
| Collect | Student search works in collect module | PASS | Search=QAREG/1781076483268 |
| Admission Form | Admission form opens with print action | PASS | Print button check. |
| Reports | Payment History report tab renders | PASS | Main content assertion. |
| Reports | Due Tracker report tab renders | PASS | Main content assertion. |
| Users | User management page loads | PASS | Users page render. |
| Users | Admin user visible in user listing | PASS | qa.admin.rbac@example.com |

Sign-off: ✅ Module-wise regression completed and all scenarios passed.
