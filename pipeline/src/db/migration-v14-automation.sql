-- migration-v14-automation.sql
-- Adds follow-up drip tracking, missed-call logging, review request tracking,
-- and Cal.com booking store. All idempotent (IF NOT EXISTS / DO NOTHING).

-- ── Follow-up drip columns on leads ──────────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_1_sent_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_2_sent_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS missed_call_sms_sent_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_missed_call_at TIMESTAMPTZ;

-- ── Cal.com bookings (post-appointment review requests) ───────────────────────
CREATE TABLE IF NOT EXISTS cal_bookings (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_uid            TEXT UNIQUE NOT NULL,
  lead_id                UUID REFERENCES leads(id) ON DELETE SET NULL,
  config_id              UUID,                   -- reception_configs.id if routed via AI Reception
  attendee_name          TEXT,
  attendee_email         TEXT,
  attendee_phone         TEXT,
  business_name          TEXT,
  event_type_id          TEXT,
  start_time             TIMESTAMPTZ NOT NULL,
  end_time               TIMESTAMPTZ NOT NULL,
  status                 TEXT DEFAULT 'confirmed',
  review_request_sent_at TIMESTAMPTZ,
  review_link            TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cal_bookings_lead_idx ON cal_bookings (lead_id);
CREATE INDEX IF NOT EXISTS cal_bookings_review_idx ON cal_bookings (end_time) WHERE review_request_sent_at IS NULL;

-- ── Missed call log ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS missed_calls (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id    TEXT,           -- reception_configs.id
  lead_id      UUID REFERENCES leads(id) ON DELETE SET NULL,
  caller       TEXT NOT NULL,
  business_name TEXT,
  call_sid     TEXT,
  call_status  TEXT,           -- no-answer | busy | failed
  sms_sent     BOOLEAN DEFAULT FALSE,
  sms_sent_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
