-- v33: real Cal.com slots in Sofia's SMS booking stage (was a static Calendly
-- link) + multi-SKU pricing/budget-negotiation state.
ALTER TABLE sms_conversations ADD COLUMN IF NOT EXISTS pending_slots JSONB;

-- Tracks which negotiation-ladder rung a lead is on per plan, and which plan
-- they last expressed interest in (Gemini doesn't always restate desiredPlan
-- every turn — persisting the last known value lets resolveOffer() keep
-- stepping the same ladder forward instead of resetting to list price).
ALTER TABLE sms_conversations ADD COLUMN IF NOT EXISTS price_pushback_count INTEGER DEFAULT 0;
ALTER TABLE sms_conversations ADD COLUMN IF NOT EXISTS desired_plan TEXT;

-- Demand capture for the two not-yet-built SKUs (everything / marketing_only)
-- — Sofia/voice/webcrew.app write here instead of ever quoting a price for
-- either. Read by admin/src/app/mrr's waitlist count.
CREATE TABLE IF NOT EXISTS waitlist_signups (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  phone      TEXT,
  email      TEXT,
  plan_key   TEXT        NOT NULL,
  source     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS waitlist_signups_plan_idx ON waitlist_signups (plan_key);
