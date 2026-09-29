-- Migration v16: GSC traffic snapshots + client reviews store
-- Powers client dashboard: traffic trend + reviews feed
-- Idempotent — safe to re-run.

-- Weekly GSC snapshots (saved by analytics-agent after each report)
CREATE TABLE IF NOT EXISTS gsc_snapshots (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID        REFERENCES leads(id) ON DELETE CASCADE,
  period_start      DATE        NOT NULL,
  period_end        DATE        NOT NULL,
  total_clicks      INT         NOT NULL DEFAULT 0,
  total_impressions INT         NOT NULL DEFAULT 0,
  avg_position      NUMERIC(5,2),
  ctr_pct           NUMERIC(5,2),
  top_keywords      JSONB,      -- [{keyword, clicks, impressions}]
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (lead_id, period_start)
);

CREATE INDEX IF NOT EXISTS gsc_snapshots_lead_idx    ON gsc_snapshots (lead_id);
CREATE INDEX IF NOT EXISTS gsc_snapshots_created_idx ON gsc_snapshots (created_at DESC);

-- Individual Google reviews + reply tracking
CREATE TABLE IF NOT EXISTS client_reviews (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID        REFERENCES leads(id) ON DELETE CASCADE,
  review_id     TEXT        NOT NULL,   -- Google review ID (reviewId from GBP API)
  reviewer_name TEXT,
  rating        INT         NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  our_reply     TEXT,
  replied_at    TIMESTAMPTZ,
  review_date   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (lead_id, review_id)
);

CREATE INDEX IF NOT EXISTS client_reviews_lead_idx    ON client_reviews (lead_id);
CREATE INDEX IF NOT EXISTS client_reviews_created_idx ON client_reviews (created_at DESC);

SELECT 'Migration v16 complete — gsc_snapshots + client_reviews ready.' AS result;
