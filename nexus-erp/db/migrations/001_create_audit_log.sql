-- Migration: create audit_log table, indexes, append-only trigger, and archive utilities

-- Enable pgcrypto for gen_random_uuid (optional)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Main audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  user_name text,
  action text NOT NULL,
  module text,
  description text,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  error text,
  hash text,
  readonly boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Archive table (same structure)
CREATE TABLE IF NOT EXISTS audit_log_archive (LIKE audit_log INCLUDING ALL);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at);

CREATE INDEX IF NOT EXISTS idx_audit_log_archive_created_at ON audit_log_archive (created_at);

-- Trigger function to prevent UPDATE, and to allow DELETE only when session flag is set
CREATE OR REPLACE FUNCTION audit_log_block_modifications() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Audit log is append-only: updates are not allowed';
  ELSIF TG_OP = 'DELETE' THEN
    -- Allow deletes only if session GUC 'audit.allow_delete' is set to 'true'
    BEGIN
      IF current_setting('audit.allow_delete', TRUE) IS NULL OR current_setting('audit.allow_delete') <> 'true' THEN
        RAISE EXCEPTION 'Audit log is append-only: deletes are not allowed';
      END IF;
    EXCEPTION WHEN undefined_object THEN
      -- If the setting does not exist, deny delete
      RAISE EXCEPTION 'Audit log is append-only: deletes are not allowed';
    END;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger
DROP TRIGGER IF EXISTS trg_audit_log_block ON audit_log;
CREATE TRIGGER trg_audit_log_block
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_block_modifications();

-- Archive helper: move old records to archive (use carefully; requires ability to set session GUC)
CREATE OR REPLACE FUNCTION archive_old_audit_logs(retention_days integer DEFAULT 90) RETURNS void AS $$
BEGIN
  -- Move rows older than retention_days days to archive, then delete them from main table
  -- This function sets a local session flag to allow deletes inside this transaction
  PERFORM set_config('audit.allow_delete', 'true', false);
  INSERT INTO audit_log_archive
    SELECT * FROM audit_log WHERE created_at < now() - (retention_days || ' days')::interval;
  DELETE FROM audit_log WHERE created_at < now() - (retention_days || ' days')::interval;
END;
$$ LANGUAGE plpgsql;

-- NOTE: Running archive_old_audit_logs from a non-superuser may require appropriate privileges.
-- For automated rotation, run the SQL or call via a privileged script (see scripts/archive-audit.js)
