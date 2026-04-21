/**
 * Auto-migration runner.
 * Runs all SQL migrations in order on first startup (idempotent — uses IF NOT EXISTS).
 * Called once from storage.ts before the first DB read.
 */
import { query } from "./postgres";

let migrated = false;

const MIGRATIONS = [
  // 001 — audit log
  `CREATE EXTENSION IF NOT EXISTS pgcrypto;
   CREATE TABLE IF NOT EXISTS audit_log (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id text, user_name text, action text NOT NULL, module text,
     description text, old_values jsonb, new_values jsonb,
     ip_address text, user_agent text, error text, hash text,
     readonly boolean DEFAULT true,
     created_at timestamptz NOT NULL DEFAULT now()
   );
   CREATE TABLE IF NOT EXISTS audit_log_archive (LIKE audit_log INCLUDING ALL);
   CREATE INDEX IF NOT EXISTS idx_audit_log_user_id    ON audit_log (user_id);
   CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON audit_log (action);
   CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at);`,

  // 002 — core ERP tables
  `CREATE TABLE IF NOT EXISTS erp_saas_state (
     id         INT PRIMARY KEY DEFAULT 1,
     data       JSONB NOT NULL DEFAULT '{}',
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     CONSTRAINT single_row CHECK (id = 1)
   );
   CREATE TABLE IF NOT EXISTS erp_tenant_state (
     company_id  TEXT PRIMARY KEY,
     data        JSONB NOT NULL DEFAULT '{}',
     updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   CREATE INDEX IF NOT EXISTS idx_tenant_updated ON erp_tenant_state (updated_at DESC);
   CREATE TABLE IF NOT EXISTS erp_email_log (
     id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     company_id   TEXT NOT NULL,
     date         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     direction    TEXT NOT NULL,
     from_addr    TEXT NOT NULL,
     to_addr      TEXT NOT NULL,
     subject      TEXT NOT NULL DEFAULT '',
     body         TEXT,
     related_type TEXT,
     related_id   TEXT,
     status       TEXT NOT NULL DEFAULT 'delivered',
     created_by   TEXT NOT NULL DEFAULT '',
     created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   CREATE INDEX IF NOT EXISTS idx_email_log_company ON erp_email_log (company_id);
   CREATE INDEX IF NOT EXISTS idx_email_log_date    ON erp_email_log (date DESC);`,

  // 003 — token revocation + refresh tokens
  `CREATE TABLE IF NOT EXISTS revoked_tokens (
     jti        TEXT        PRIMARY KEY,
     revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     expires_at TIMESTAMPTZ NOT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens (expires_at);
   CREATE TABLE IF NOT EXISTS refresh_tokens (
     jti        TEXT        PRIMARY KEY,
     user_id    TEXT        NOT NULL,
     email      TEXT        NOT NULL,
     company_id TEXT,
     issued_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     expires_at TIMESTAMPTZ NOT NULL,
     revoked    BOOLEAN     NOT NULL DEFAULT FALSE,
     user_agent TEXT,
     ip_address TEXT
   );
   CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user    ON refresh_tokens (user_id);
   CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens (expires_at);`,
];

export async function runMigrations(): Promise<void> {
  if (migrated) return;
  migrated = true;
  try {
    for (const sql of MIGRATIONS) {
      await query(sql);
    }
  } catch (err) {
    console.error("[migrate] Migration failed:", err);
    migrated = false; // allow retry on next request
    throw err;
  }
}
