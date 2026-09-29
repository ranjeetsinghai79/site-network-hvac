-- Voice-usage cap alert dedup — one row per (config, month) so the
-- over-cap email fires once per client per month, not once per call.
-- Used by reception/db.ts (markCapAlertSent) + reception/twilio-relay.ts.
CREATE TABLE IF NOT EXISTS reception_cap_alerts (
  config_id     text NOT NULL,
  alert_month   date NOT NULL,  -- first-of-month marker (date_trunc('month', NOW()))
  minutes_used  integer NOT NULL,
  sent_at       timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (config_id, alert_month)
);
