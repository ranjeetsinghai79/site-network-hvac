-- Landing-page "paste your URL, get an instant AI SalesPerson preview" flow.
-- preview_jobs tracks one visitor submission through the staged async pipeline
-- (reading -> understanding -> building -> ready/failed); reception_configs
-- gets a way to mark a row as a temporary anonymous preview (vs a real
-- onboarded client) so it can be cleaned up and never mistaken for one.
CREATE TABLE IF NOT EXISTS preview_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url           text NOT NULL,
  ip_address    text,
  stage         text NOT NULL DEFAULT 'reading', -- reading | understanding | building | ready | failed
  progress_pct  int  NOT NULL DEFAULT 0,
  config_id     uuid REFERENCES reception_configs(id),
  lead_id       uuid,
  error         text,
  display_config jsonb, -- { tagline, theme } — preview-page presentation, deliberately separate from reception_configs.brain_json (which is pure BusinessBrain, what the AI says, not how the preview page looks)
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT now() + interval '48 hours'
);

ALTER TABLE reception_configs ADD COLUMN IF NOT EXISTS is_preview boolean NOT NULL DEFAULT false;
ALTER TABLE reception_configs ADD COLUMN IF NOT EXISTS preview_expires_at timestamptz;

SELECT 'Migration v46 (preview jobs) complete.' AS result;
