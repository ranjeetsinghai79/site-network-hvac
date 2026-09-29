-- Migration v19: social publishing readiness
-- Idempotent — safe to re-run

ALTER TABLE social_assets
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS asset_url text,
  ADD COLUMN IF NOT EXISTS publish_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS publish_error text;

CREATE INDEX IF NOT EXISTS social_assets_platform_status_idx ON social_assets (platform, status);

SELECT 'Migration v19 social publishing complete.' AS result;
