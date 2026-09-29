-- Daily per-key call counter for AI Studio (free-tier) Gemini Live backends.
-- Used by reception/gemini-live.ts to proactively switch to Vertex before a
-- free-tier quota wall is hit, instead of reactively failing a live phone call.
CREATE TABLE IF NOT EXISTS ai_studio_key_usage (
  key_name    text NOT NULL,
  usage_date  date NOT NULL DEFAULT CURRENT_DATE,
  call_count  integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (key_name, usage_date)
);
