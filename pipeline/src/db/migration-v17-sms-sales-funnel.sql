-- v17: SMS sales funnel — build requests + conversation state tracking

-- Build requests: CF Worker enqueues when lead says YES
CREATE TABLE IF NOT EXISTS build_requests (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  phone        TEXT        NOT NULL,
  name         TEXT        NOT NULL,
  niche        TEXT        NOT NULL,
  city         TEXT        NOT NULL,
  state        TEXT,
  source       TEXT        DEFAULT 'sms_reply',  -- sms_reply | manual
  status       TEXT        DEFAULT 'pending',     -- pending | building | demo_sent | deal | rejected
  demo_url     TEXT,
  lead_price   INTEGER,   -- what lead offered (cents)
  agreed_price INTEGER,   -- final agreed price (cents)
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS build_requests_phone_idx  ON build_requests (phone);
CREATE INDEX IF NOT EXISTS build_requests_status_idx ON build_requests (status);

-- SMS conversation state per phone
CREATE TABLE IF NOT EXISTS sms_conversations (
  phone        TEXT        PRIMARY KEY,
  stage        TEXT        DEFAULT 'initial',
  -- stages: initial → interested → building → demo_sent → price_asked → negotiating → booked | dead
  lead_id      UUID        REFERENCES leads(id) ON DELETE SET NULL,
  build_req_id UUID        REFERENCES build_requests(id) ON DELETE SET NULL,
  demo_url     TEXT,
  offered_price INTEGER,
  message_count INTEGER    DEFAULT 0,
  last_message  TEXT,
  last_reply    TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Add source column to leads for sheet-sourced entries
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'pipeline';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sms_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sms_sent_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_1_sent_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_2_sent_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS outreach_sent_at TIMESTAMPTZ;

-- Phone index for fast lookup from CF Worker
CREATE INDEX IF NOT EXISTS leads_phone_idx ON leads (phone);
