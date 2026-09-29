-- Migration v3: audits table + beauty/wellness agency fields
-- Run once: psql $DATABASE_URL -f migration-v3-audits.sql
-- Safe: idempotent

-- ── AI Growth Audit reports ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audits (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id              UUID        REFERENCES leads(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),

  -- Context
  website_url          TEXT        NOT NULL,
  business_name        TEXT        NOT NULL,
  niche                TEXT,
  city                 TEXT,

  -- Composite scores (0–100)
  overall_score        INT,
  website_score        INT,        -- PageSpeed mobile
  seo_score            INT,
  reputation_score     INT,
  phone_score          INT,
  booking_score        INT,

  -- PageSpeed raw
  mobile_score         INT,
  desktop_score        INT,
  site_issues          JSONB       DEFAULT '[]',
  site_broken          BOOLEAN     DEFAULT FALSE,

  -- SEO signals
  meta_title           TEXT,
  meta_description     TEXT,
  has_schema           BOOLEAN     DEFAULT FALSE,
  h1_content           TEXT,
  seo_issues           JSONB       DEFAULT '[]',

  -- Contact / booking
  phone_found          BOOLEAN     DEFAULT FALSE,
  has_booking_link     BOOLEAN     DEFAULT FALSE,
  booking_url          TEXT,
  has_reviews_on_site  BOOLEAN     DEFAULT FALSE,

  -- Competition
  competitors          JSONB       DEFAULT '[]',

  -- AI recommendations
  recommendations      JSONB       DEFAULT '[]',

  -- Delivery tracking
  report_viewed        BOOLEAN     DEFAULT FALSE,
  report_viewed_at     TIMESTAMPTZ,
  outreach_sent        BOOLEAN     DEFAULT FALSE,
  outreach_sent_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS audits_lead_id_idx    ON audits (lead_id);
CREATE INDEX IF NOT EXISTS audits_created_idx    ON audits (created_at DESC);
CREATE INDEX IF NOT EXISTS audits_url_idx        ON audits (website_url);

-- ── Leads: agency plan + client_plan columns ─────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS client_plan        TEXT;    -- 'starter' | 'growth' | 'scale'
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reception_config_id UUID;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reception_phone    TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS slack_channel_id   TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS webhook_url        TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS location_group_id  UUID;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS audit_id           UUID REFERENCES audits(id) ON DELETE SET NULL;

-- ── Call logs (AI Reception) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS call_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID        REFERENCES leads(id) ON DELETE CASCADE,
  reception_config_id UUID,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  caller_number     TEXT,
  duration_seconds  INT,
  summary           TEXT,        -- Gemini-generated call summary
  escalated         BOOLEAN     DEFAULT FALSE,
  escalation_reason TEXT,
  message_taken     TEXT,        -- voicemail / callback message
  transcript        TEXT
);

CREATE INDEX IF NOT EXISTS call_logs_lead_idx    ON call_logs (lead_id);
CREATE INDEX IF NOT EXISTS call_logs_created_idx ON call_logs (created_at DESC);

SELECT 'Migration v3 complete.' AS result;
