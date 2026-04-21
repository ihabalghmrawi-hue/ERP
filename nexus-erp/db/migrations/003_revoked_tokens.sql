-- Revoked JWT tokens (for logout + forced session invalidation)
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti        TEXT        PRIMARY KEY,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index to speed up the lookup-by-jti query in auth middleware
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_jti     ON revoked_tokens (jti);

-- Index for the periodic cleanup job (delete where expires_at < NOW())
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens (expires_at);

-- Refresh tokens table (tracks issued refresh tokens for revocation / active-session listing)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  jti        TEXT        PRIMARY KEY,
  user_id    TEXT        NOT NULL,
  email      TEXT        NOT NULL,
  company_id TEXT,                         -- NULL for superadmin
  issued_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked    BOOLEAN     NOT NULL DEFAULT FALSE,
  user_agent TEXT,
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user    ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens (expires_at);
