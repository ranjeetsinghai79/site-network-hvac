-- Migration v2: expanded Places API fields + missing sales-funnel columns
-- Run once: psql $DATABASE_URL -f migration-v2.sql
-- Safe: all ADD COLUMN IF NOT EXISTS — idempotent

-- ── Places API v1 expanded fields ─────────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS international_phone  text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS business_status      text;          -- OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY
ALTER TABLE leads ADD COLUMN IF NOT EXISTS primary_type         text;          -- e.g. 'hvac_contractor'
ALTER TABLE leads ADD COLUMN IF NOT EXISTS editorial_summary    text;          -- Google AI description
ALTER TABLE leads ADD COLUMN IF NOT EXISTS open_now             boolean;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS weekday_hours        jsonb;         -- string[]
ALTER TABLE leads ADD COLUMN IF NOT EXISTS photo_count          integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS price_level          text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS google_maps_uri      text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS latitude             numeric(10,7);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS longitude            numeric(10,7);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS zip                  text;

-- ── Sales funnel (may already exist in live DB) ───────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cloudflare_url       text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS hero_video_url       text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sms_sent             boolean     default false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sms_sent_at          timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sms_opt_out          boolean     default false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS meeting_url          text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS meeting_scheduled_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS stripe_payment_url   text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS stripe_session_id    text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS paid                 boolean     default false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS paid_at              timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS handed_off           boolean     default false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS handed_off_at        timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS niche_profile        jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tier                 text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS gbp_claimed          boolean;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_open              boolean;   -- legacy (use open_now)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rating               numeric(3,1);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS review_count         integer;

-- ── Site analysis ─────────────────────────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS site_broken        boolean     default false;  -- existing site is broken/unreachable

-- ── Sheet reporting (prevents duplicate rows on re-runs) ─────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sheet_reported_at  timestamptz;

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS leads_business_status_idx  ON leads (business_status);
CREATE INDEX IF NOT EXISTS leads_primary_type_idx     ON leads (primary_type);
CREATE INDEX IF NOT EXISTS leads_location_idx         ON leads (latitude, longitude);
CREATE INDEX IF NOT EXISTS leads_sheet_reported_idx   ON leads (sheet_reported_at) WHERE sheet_reported_at IS NULL;

-- ── Survey responses ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS survey_responses (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz DEFAULT now(),
  name          text,
  biz           text,
  phone         text,
  niche         text,
  pain          text,
  has_website   text,
  ai_want       text,
  budget        text
);
CREATE INDEX IF NOT EXISTS survey_phone_idx ON survey_responses (phone);
CREATE INDEX IF NOT EXISTS survey_created_idx ON survey_responses (created_at DESC);

SELECT 'Migration v2 complete.' AS result;

-- ── Scraper dedup: prevents re-scraping same business per tab ───────────────
-- Added: cross-run deduplication for scrape-universal.ts
CREATE TABLE IF NOT EXISTS scraped_places (
  place_id    text        NOT NULL,
  tab         text        NOT NULL,
  scraped_at  timestamptz DEFAULT now(),
  name        text,
  city        text,
  PRIMARY KEY (place_id, tab)
);
CREATE INDEX IF NOT EXISTS scraped_places_tab_idx ON scraped_places (tab);
CREATE INDEX IF NOT EXISTS scraped_places_at_idx  ON scraped_places (scraped_at DESC);

SELECT 'Migration v2 (scraped_places) complete.' AS result;
