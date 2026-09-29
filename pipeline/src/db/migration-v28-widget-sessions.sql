-- Per-IP daily session cap for the public browser avatar widget (webcrew.app).
-- Unlike phone calls, the widget has no Twilio number gating it — anyone who
-- loads webcrew.app can open a Gemini Live session, so this is the abuse guard.
-- Used by reception/db.ts (getWidgetSessionCountToday / incrementWidgetSessionCount)
-- and reception/browser-relay.ts.
CREATE TABLE IF NOT EXISTS widget_session_usage (
  ip_address    text NOT NULL,
  usage_date    date NOT NULL DEFAULT CURRENT_DATE,
  session_count integer NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ip_address, usage_date)
);
