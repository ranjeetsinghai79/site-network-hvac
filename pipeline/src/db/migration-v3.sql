-- Migration v3: tier system, scheduler, API keys, webhooks, multi-location
-- Run once: psql $DATABASE_URL -f pipeline/src/db/migration-v3.sql
-- Safe: all ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS — idempotent

-- ── Client plan tier ───────────────────────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS client_plan        text DEFAULT 'launch';  -- launch | grow | scale
ALTER TABLE leads ADD COLUMN IF NOT EXISTS webhook_url        text;                   -- Zapier/CRM webhook per client
ALTER TABLE leads ADD COLUMN IF NOT EXISTS location_group_id  uuid;                   -- groups multi-location clients
ALTER TABLE leads ADD COLUMN IF NOT EXISTS vapi_assistant_id  text;                   -- Vapi voice reception agent ID
ALTER TABLE leads ADD COLUMN IF NOT EXISTS vapi_phone_number  text;                   -- assigned inbound phone number
ALTER TABLE leads ADD COLUMN IF NOT EXISTS slack_channel_id   text;                   -- dedicated Slack channel per client

-- ── API keys (Scale tier customer API access) ─────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid REFERENCES leads(id) ON DELETE CASCADE,
  key_hash     text NOT NULL UNIQUE,               -- sha256 of the actual key
  key_prefix   text NOT NULL,                      -- first 8 chars for display
  created_at   timestamptz DEFAULT now(),
  last_used_at timestamptz,
  revoked      boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS api_keys_lead_idx   ON api_keys (lead_id);
CREATE INDEX IF NOT EXISTS api_keys_hash_idx   ON api_keys (key_hash) WHERE NOT revoked;

-- ── Scheduler log (idempotency — one job per client per period) ───────────
CREATE TABLE IF NOT EXISTS scheduler_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid REFERENCES leads(id) ON DELETE CASCADE,
  job_type    text NOT NULL,           -- 'reviews' | 'analytics' | 'gbp' | 'competitor' | 'design_refresh'
  period_key  text NOT NULL,           -- e.g. '2025-05' for monthly, '2025-Q2' for quarterly
  ran_at      timestamptz DEFAULT now(),
  success     boolean DEFAULT true,
  error       text,
  UNIQUE (lead_id, job_type, period_key)
);

CREATE INDEX IF NOT EXISTS scheduler_log_lead_idx ON scheduler_log (lead_id, job_type);

-- ── Location groups (Scale tier multi-location) ───────────────────────────
CREATE TABLE IF NOT EXISTS location_groups (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,          -- e.g. "Mike's HVAC — 3 locations"
  owner_email  text NOT NULL,
  client_plan  text DEFAULT 'scale',
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS location_groups_email_idx ON location_groups (owner_email);

-- ── Webhook delivery log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid REFERENCES leads(id) ON DELETE CASCADE,
  event        text NOT NULL,          -- 'lead.deployed' | 'lead.paid' | etc.
  status_code  integer,
  delivered_at timestamptz DEFAULT now(),
  error        text
);

SELECT 'Migration v3 complete.' AS result;
