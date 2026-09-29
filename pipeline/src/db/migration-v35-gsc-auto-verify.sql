-- Auto-verified Search Console state (gsc-agent.ts). Separate from
-- client_google_tokens (migration-v14) on purpose: that table is a client's
-- OWN OAuth connection to their Google account (needed for GBP, which
-- requires the client's own business-listing ownership). GSC doesn't have
-- that constraint — WebCrew's own service account self-verifies every
-- client site via the Site Verification API's FILE method, no client
-- action or OAuth needed. These columns track that separate, automatic path.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS gsc_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS gsc_site_url TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS gsc_verified_at TIMESTAMPTZ;

-- Admin's "Run GSC Check" button (edge runtime — can't run the Node/crypto
-- JWT flow itself) just flips this flag; gsc-verify-worker.ts (a small
-- launchd-scheduled poller, same pattern as auto-build-from-sms.ts) picks
-- up flagged rows and runs the real agent. This also covers the
-- re-verify-after-custom-domain case (add-domain.ts sets the flag too).
ALTER TABLE leads ADD COLUMN IF NOT EXISTS gsc_verify_requested BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS gsc_verify_error TEXT;
CREATE INDEX IF NOT EXISTS leads_gsc_verify_requested_idx ON leads (gsc_verify_requested) WHERE gsc_verify_requested = TRUE;
