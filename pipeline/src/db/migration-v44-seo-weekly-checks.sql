-- Historical record of the weekly webcrew.app SEO/AEO/GEO check (seo-weekly-check.ts).
-- Same trend-line pattern as system_health_checks (migration-v32) — each run's
-- real Search Console snapshot + week-over-week deltas get stored, not just
-- emailed, so "is this query actually improving" has real history behind it.
CREATE TABLE IF NOT EXISTS seo_weekly_checks (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  run_at     TIMESTAMPTZ DEFAULT NOW(),
  snapshot   JSONB       NOT NULL,   -- raw GSC queries/pages/sitemap/inspection for this run
  deltas     JSONB       NOT NULL,   -- computed vs previous run: {improving:[], declining:[], new:[], dropped:[]}
  findings   JSONB       NOT NULL    -- array of {area, summary, recommendation} — human-readable, not auto-applied
);

CREATE INDEX IF NOT EXISTS seo_weekly_checks_run_at_idx ON seo_weekly_checks (run_at);
