-- Client dashboard passwords (replaces emailing a magic link on every login).
--   client_accounts      one row per client login email: PBKDF2 hash, lockout counters, and a
--                        session_version that is bumped on password change / "sign out everywhere"
--                        so every previously issued cookie stops working.
--   client_reset_tokens  single-use tokens for "forgot password" and the welcome "create password"
--                        link. Only the SHA-256 of the token is stored.
CREATE TABLE IF NOT EXISTS client_accounts (
  email               TEXT        PRIMARY KEY,
  password_hash       TEXT,
  password_updated_at TIMESTAMPTZ,
  session_version     INT         NOT NULL DEFAULT 0,
  failed_attempts     INT         NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  last_login_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_reset_tokens (
  token_hash TEXT        PRIMARY KEY,
  email      TEXT        NOT NULL,
  purpose    TEXT        NOT NULL DEFAULT 'reset',     -- 'reset' | 'welcome'
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS client_reset_tokens_email_idx ON client_reset_tokens (email, created_at DESC);

SELECT 'Migration v42 (client passwords) complete.' AS result;
