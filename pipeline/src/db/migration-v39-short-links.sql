-- Short-link redirect table for SMS-texted checkout links (Stripe URLs are
-- long; SMS needs short). Served via GET /s/:code on the api.webcrew.app
-- Worker. expires_at mirrors Stripe Checkout Session's own default 24h
-- expiry — a stale short link should die with the session it points at.
CREATE TABLE IF NOT EXISTS short_links (
  code        TEXT PRIMARY KEY,
  target_url  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_short_links_expires_at ON short_links (expires_at);
