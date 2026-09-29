-- Migration v14: per-client Google OAuth tokens (GBP + GSC)
-- Allows retention agents to post GBP updates, reply to reviews, and pull GSC data
-- using each client's own Google account tokens (OAuth 2.0).
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS client_google_tokens (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID        REFERENCES leads(id) ON DELETE CASCADE,
  email         TEXT        NOT NULL,   -- Google account email of the client
  access_token  TEXT        NOT NULL,
  refresh_token TEXT        NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  scopes        TEXT[]      NOT NULL DEFAULT '{}',
  gbp_account_id   TEXT,               -- my/accounts/{id}
  gbp_location_id  TEXT,               -- my/accounts/{id}/locations/{id}
  gsc_site_url     TEXT,               -- https://example.com/
  connected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS client_google_tokens_lead_idx
  ON client_google_tokens(lead_id);

-- Add column to leads for quick "google connected?" check
ALTER TABLE leads ADD COLUMN IF NOT EXISTS google_connected     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS google_connected_at  TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reception_phone      TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS stripe_customer_id   TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS subscription_active  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS subscription_plan    TEXT;
