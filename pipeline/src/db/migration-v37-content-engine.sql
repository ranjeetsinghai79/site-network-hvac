-- Migration v37: reel rendering (fal.ai/Kling, native audio) + tiered content cadence
-- Idempotent — safe to re-run

ALTER TABLE video_assets
  ADD COLUMN IF NOT EXISTS source_image_url text,
  ADD COLUMN IF NOT EXISTS has_native_audio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_video_id text;

CREATE TABLE IF NOT EXISTS content_cadence_plans (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES growth_workspaces(id) ON DELETE CASCADE,
  tier                  text NOT NULL CHECK (tier IN ('weekly_lite', 'daily_premium')),
  channels              text[] NOT NULL DEFAULT '{}',
  reels_per_period      integer NOT NULL DEFAULT 1,
  carousels_per_period  integer NOT NULL DEFAULT 1,
  images_per_period     integer NOT NULL DEFAULT 2,
  period                text NOT NULL DEFAULT 'week' CHECK (period IN ('week', 'day')),
  active                boolean NOT NULL DEFAULT true,
  last_generated_at     timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS content_cadence_plans_workspace_idx ON content_cadence_plans (workspace_id);
CREATE INDEX IF NOT EXISTS video_assets_provider_status_idx ON video_assets (provider, status);

SELECT 'Migration v37 content engine complete.' AS result;
