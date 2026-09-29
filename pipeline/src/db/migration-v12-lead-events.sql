-- Lead activity timeline: email opens/clicks, SMS replies, calls, bookings.
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS lead_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    UUID        REFERENCES leads(id) ON DELETE CASCADE,
  event_type TEXT        NOT NULL,  -- email_sent | email_opened | email_clicked | email_bounced
                                     -- sms_sent | sms_replied | sms_opted_out
                                     -- call_received | call_booked | call_escalated
  detail     JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_events_lead_idx    ON lead_events (lead_id);
CREATE INDEX IF NOT EXISTS lead_events_created_idx ON lead_events (created_at DESC);
CREATE INDEX IF NOT EXISTS lead_events_type_idx    ON lead_events (event_type);

SELECT 'Migration v12 complete — lead_events ready.' AS result;
