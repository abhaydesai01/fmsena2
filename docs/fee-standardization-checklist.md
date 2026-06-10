# Fee Management & Installment Standardization Checklist

## Enrollment Form Enhancement

- [x] Add mandatory `joining_date` on enrollment form.
- [x] Add separate `registration_date` on enrollment form.
- [x] Persist both fields in student profile data.
- [x] Keep legacy `admission_date` synced to `joining_date` for compatibility.

## Fee Structure Workflow

- [x] Record registration fee as a dedicated installment row (`is_registration=true`).
- [x] Mark registration fee installment as paid at enrollment time.
- [x] Continue creating course installments separately from registration fee.
- [ ] Add dedicated registration receipt generation workflow.

## Automatic Installment Schedule Generation

- [x] Introduce standardized day offsets: `0, 60, 120, 150, 180`.
- [x] Drive installment due dates from `joining_date`.
- [x] Apply standardized schedule builder in enrollment flow.
- [ ] Replace all legacy month-label assumptions in old migrations and backfill scripts.

## Residential Student Plan

- [x] Add admission type selector (`residential` / `non_residential`).
- [x] Force residential schedule to 5 installments from joining date.
- [x] Lock residential plan selection to standardized `plan_5`.

## Fee Dashboard

- [x] Add student-level metrics: total fee, registration paid, installments paid.
- [x] Add pending installments count, upcoming due date, overdue amount.
- [x] Add due tracker summary cards on dashboard.
- [ ] Add dedicated student payment history export from student profile.

## Alerts & Notifications

- [x] Add automated reminder sweep function for:
  - 7 days before due
  - on due date
  - 7 days after due (if unpaid)
- [x] Store reminder events in `reminders` collection with idempotent key.
- [ ] Integrate external SMS/WhatsApp/email delivery provider.
- [x] Add scheduler/cron trigger outside dashboard page load (via `npm run cron:reminders` script).

## Reports

- [x] Add due tracker backend buckets:
  - due today
  - due this week
  - overdue
- [x] Add Due Tracker tab in Reports UI.
- [x] Keep campus-wise and course-wise pending fee reports operational.
- [x] Keep student-wise payment history available via Collections report.
- [x] Add separate "Student Payment History" report tab with filters.

## Data / Ops Hardening

- [x] Add migration to backfill `joining_date` and `registration_date` for old students.
- [x] Add indexes for reminder sweep queries (`student_id`, `due_date`, `status`, `is_registration`).
- [ ] Add tests for schedule generation and reminder deduplication.
