-- Migration 002: Core ERP schema for persistent server-side storage
-- Replaces localStorage/file-based storage with PostgreSQL
-- Run once before starting the application in production

-- ─── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── SaaS Global State ───────────────────────────────────────
-- Stores companies + superAdmins + global counters as a single JSONB document.
-- Only one row ever exists (id = 1).
CREATE TABLE IF NOT EXISTS erp_saas_state (
  id         INT PRIMARY KEY DEFAULT 1,
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- ─── Per-Tenant ERP State ─────────────────────────────────────
-- One row per company. Stores the full DatabaseState as JSONB.
CREATE TABLE IF NOT EXISTS erp_tenant_state (
  company_id  TEXT PRIMARY KEY,
  data        JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_updated ON erp_tenant_state (updated_at DESC);

-- ─── Email Log (normalized) ───────────────────────────────────
-- Separate table for fast querying across all companies.
CREATE TABLE IF NOT EXISTS erp_email_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   TEXT NOT NULL,
  date         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  direction    TEXT NOT NULL CHECK (direction IN ('sent', 'received')),
  from_addr    TEXT NOT NULL,
  to_addr      TEXT NOT NULL,
  subject      TEXT NOT NULL DEFAULT '',
  body         TEXT,
  related_type TEXT CHECK (related_type IN ('invoice', 'po', 'customer', 'supplier', 'other')),
  related_id   TEXT,
  status       TEXT NOT NULL DEFAULT 'delivered' CHECK (status IN ('delivered', 'failed', 'pending')),
  created_by   TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_company    ON erp_email_log (company_id);
CREATE INDEX IF NOT EXISTS idx_email_log_date       ON erp_email_log (date DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_direction  ON erp_email_log (direction);

-- ─── Helper: update updated_at on upsert ─────────────────────
CREATE OR REPLACE FUNCTION erp_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_saas_updated_at  ON erp_saas_state;
DROP TRIGGER IF EXISTS trg_tenant_updated_at ON erp_tenant_state;

CREATE TRIGGER trg_saas_updated_at
  BEFORE INSERT OR UPDATE ON erp_saas_state
  FOR EACH ROW EXECUTE FUNCTION erp_set_updated_at();

CREATE TRIGGER trg_tenant_updated_at
  BEFORE INSERT OR UPDATE ON erp_tenant_state
  FOR EACH ROW EXECUTE FUNCTION erp_set_updated_at();
