# Reminder Cron Setup

## Commands

- Backfill old student dates (one-time):
  - `npm run migrate:dates`
- Run reminder sweep manually:
  - `npm run cron:reminders`
- Dry-run reminder sweep:
  - `DRY_RUN=1 npm run cron:reminders`

## Environment Variables

- `MONGO_URI` (required)
- `MONGO_DB_NAME` (optional, default `fmsena`)
- `CAMPUS_ID` (optional, run for one campus only)
- `TODAY` (optional, `YYYY-MM-DD` for replay/testing)
- `DRY_RUN` (optional, `1` to simulate inserts)

## Cron Wiring Examples

- Linux crontab (daily 08:00):
  - `0 8 * * * cd /path/to/fmsena2 && /usr/bin/env MONGO_URI=... npm run cron:reminders >> /var/log/fmsena-reminders.log 2>&1`
- CI scheduler:
  - Run `npm ci` then `npm run cron:reminders` once daily with repo secrets.
