-- Checkpoint table: tracks which city+query combos have been scraped per niche
-- Prevents re-querying same cities on daily re-runs
-- Apply once: psql $DATABASE_URL -f pipeline/src/db/migration-bulk-progress.sql

CREATE TABLE IF NOT EXISTS bulk_progress (
  niche        TEXT        NOT NULL,
  city         TEXT        NOT NULL,
  state        TEXT        NOT NULL,
  query_term   TEXT        NOT NULL,  -- Places query string, or '_maps' for Maps scraper
  result_count INT         NOT NULL DEFAULT 0,
  done_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (niche, city, state, query_term)
);

CREATE INDEX IF NOT EXISTS idx_bulk_progress_niche ON bulk_progress (niche);

SELECT 'bulk_progress table ready.' AS result;
