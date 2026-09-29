-- Migration v11: per-client GBP credentials on leads row
-- Idempotent — safe to re-run
-- Run: psql $DATABASE_URL -f pipeline/src/db/migration-v11-gbp-per-client.sql

ALTER TABLE leads ADD COLUMN IF NOT EXISTS gbp_account_id  text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS gbp_location_id text;

COMMENT ON COLUMN leads.gbp_account_id  IS 'Google My Business account ID for this client (overrides env var)';
COMMENT ON COLUMN leads.gbp_location_id IS 'Google My Business location ID for this client (overrides env var)';

CREATE INDEX IF NOT EXISTS leads_gbp_idx ON leads (gbp_location_id) WHERE gbp_location_id IS NOT NULL;

SELECT 'Migration v11 complete: per-client GBP fields added.' AS result;
