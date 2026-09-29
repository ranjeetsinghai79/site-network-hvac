-- Adds recording/sentiment capture to call_logs (both were previously either
-- unwired or entirely unbuilt — see CLAUDE.md's "Call-Gap Latency Fix" +
-- session notes on the WebCrew HVAC call-ad funnel work). Also adds a
-- per-phone rate limit table for the new start_trial Gemini tool, mirroring
-- migration-v29's public_form_submissions (IP-keyed) but phone-keyed since
-- this gates an in-call SMS send rather than a public HTTP endpoint.

ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS call_sid       TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS recording_url  TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS sentiment      TEXT; -- 'positive' | 'neutral' | 'negative'

CREATE INDEX IF NOT EXISTS call_logs_call_sid_idx ON call_logs (call_sid);

CREATE TABLE IF NOT EXISTS trial_start_attempts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trial_start_attempts_phone_idx ON trial_start_attempts (phone, created_at);

SELECT 'Migration v38 complete.' AS result;
