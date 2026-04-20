Audit Log — Production-ready setup

Overview
--------
This project now supports a server-backed, production-ready Audit Log using PostgreSQL. The UI keeps the existing local log for immediate feedback, and the client posts records to `/api/audit` which persists them to Postgres.

What was added
--------------
- SQL migration: `db/migrations/001_create_audit_log.sql`
  - Creates `audit_log` and `audit_log_archive` tables
  - Adds indexes on `user_id`, `action`, and `created_at`
  - Adds trigger to prevent updates (and deletes unless allowed by session flag)
  - Adds `archive_old_audit_logs(retention_days)` helper
- Server DB wrapper: `src/lib/server/postgres.ts`
- API routes: `src/app/api/audit/route.ts` (POST + GET)
- Client: `src/lib/engine/helpers.ts` now posts to `/api/audit` (non-blocking)
- UI: `src/components/modules/AuditLog.tsx` uses server-side pagination/search (fallback to local)
- Archive script: `scripts/archive-audit.js`
- Scheduled GitHub Action: `.github/workflows/archive-audit.yml`

Required environment variables
------------------------------
- `DATABASE_URL` (Postgres connection string) — set in Vercel / GitHub secrets
- For CI deploy on Vercel: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (already documented elsewhere)
- Optional: `AUDIT_RETENTION_DAYS` (default 90)

How to apply migration
----------------------
1. Run the SQL in `db/migrations/001_create_audit_log.sql` against your Postgres DB. Example using `psql`:

```bash
psql "$DATABASE_URL" -f nexus-erp/db/migrations/001_create_audit_log.sql
```

2. Ensure the Postgres user can create extension `pgcrypto` (or remove the extension lines if not allowed). The migration will still work without the extension as long as the DB can accept UUIDs.

3. Set `DATABASE_URL` in your deployment environment (Vercel):
- Add it to the Project Environment Variables in Vercel dashboard or as a GitHub secret used by CI.

Running the archive script manually
----------------------------------
```bash
DATABASE_URL="postgres://..." node nexus-erp/scripts/archive-audit.js
```

Automated archive
-----------------
A GitHub Action runs `archive-audit.js` daily at 03:00 UTC. Ensure `DATABASE_URL` (and optionally `AUDIT_RETENTION_DAYS`) are set in the repository secrets.

Notes & Next steps
------------------
- For large scale, consider moving Audit Log to a dedicated database and enable partitioning by time.
- For stronger immutability, use database roles/policies and restrict access; the migration uses a session GUC to allow controlled deletes for archiving.
- Consider pushing logs to an append-only storage (WORM), or to an external SIEM for long-term retention and tamper-evidence.
