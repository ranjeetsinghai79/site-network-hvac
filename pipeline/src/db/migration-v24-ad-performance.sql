-- Migration v24: daily ad performance snapshots for published campaigns
-- Idempotent — safe to re-run

CREATE TABLE IF NOT EXISTS ad_performance_daily (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id      uuid NOT NULL REFERENCES ad_campaign_drafts(id) ON DELETE CASCADE,
  platform      text NOT NULL,
  date          date NOT NULL,
  impressions   integer NOT NULL DEFAULT 0,
  clicks        integer NOT NULL DEFAULT 0,
  spend         numeric(10,2) NOT NULL DEFAULT 0,
  conversions   numeric(10,2) NOT NULL DEFAULT 0,
  raw           jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ad_performance_daily_draft_date_idx
  ON ad_performance_daily (draft_id, date);
CREATE INDEX IF NOT EXISTS ad_performance_daily_draft_idx
  ON ad_performance_daily (draft_id, date DESC);

SELECT 'Migration v24 ad performance complete.' AS result;
