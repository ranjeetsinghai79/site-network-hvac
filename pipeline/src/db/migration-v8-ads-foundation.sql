-- Migration v8: ads foundation for Google, Meta, and Instagram campaign drafts
-- Idempotent — safe to re-run

CREATE TABLE IF NOT EXISTS ad_campaign_drafts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid REFERENCES growth_workspaces(id) ON DELETE CASCADE,
  lead_id         uuid REFERENCES leads(id) ON DELETE SET NULL,
  platform        text NOT NULL,
  status          text NOT NULL DEFAULT 'needs_approval',
  campaign_name   text NOT NULL,
  objective       text NOT NULL,
  daily_budget    numeric(10,2) NOT NULL,
  geo_target      jsonb NOT NULL DEFAULT '{}'::jsonb,
  audience        jsonb NOT NULL DEFAULT '{}'::jsonb,
  keywords        text[] NOT NULL DEFAULT '{}',
  negative_keywords text[] NOT NULL DEFAULT '{}',
  ad_groups       jsonb NOT NULL DEFAULT '[]'::jsonb,
  creatives       jsonb NOT NULL DEFAULT '[]'::jsonb,
  landing_page_url text,
  approval_notes  text,
  external_id     text,
  published_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ad_campaign_drafts_platform_check'
  ) THEN
    ALTER TABLE ad_campaign_drafts
      ADD CONSTRAINT ad_campaign_drafts_platform_check
      CHECK (platform IN ('google_ads', 'meta_ads', 'instagram_ads'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ad_campaign_drafts_status_check'
  ) THEN
    ALTER TABLE ad_campaign_drafts
      ADD CONSTRAINT ad_campaign_drafts_status_check
      CHECK (status IN ('draft', 'needs_approval', 'approved', 'published', 'paused', 'rejected'))
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ad_campaign_drafts_workspace_idx ON ad_campaign_drafts (workspace_id, status);
CREATE INDEX IF NOT EXISTS ad_campaign_drafts_platform_idx  ON ad_campaign_drafts (platform, status);

SELECT 'Migration v8 ads foundation complete.' AS result;
