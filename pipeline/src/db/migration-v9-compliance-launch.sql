-- Migration v9: compliance, approval events, and launch readiness guardrails
-- Idempotent — safe to re-run

ALTER TABLE social_assets
  ADD COLUMN IF NOT EXISTS compliance_warnings jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE ad_campaign_drafts
  ADD COLUMN IF NOT EXISTS compliance_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE TABLE IF NOT EXISTS consent_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid REFERENCES leads(id) ON DELETE SET NULL,
  workspace_id    uuid REFERENCES growth_workspaces(id) ON DELETE SET NULL,
  channel         text NOT NULL,
  contact         text NOT NULL,
  consent_type    text NOT NULL,
  source          text NOT NULL,
  consent_text    text NOT NULL,
  ip_address      text,
  user_agent      text,
  revoked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approval_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid REFERENCES growth_workspaces(id) ON DELETE SET NULL,
  entity_type     text NOT NULL,
  entity_id       text NOT NULL,
  action          text NOT NULL,
  actor_email     text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_limits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid REFERENCES growth_workspaces(id) ON DELETE CASCADE,
  tier            text NOT NULL,
  voice_minutes   integer NOT NULL DEFAULT 0,
  sms_segments    integer NOT NULL DEFAULT 0,
  social_drafts   integer NOT NULL DEFAULT 0,
  ad_drafts       integer NOT NULL DEFAULT 0,
  max_daily_ad_budget numeric(10,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, tier)
);

CREATE INDEX IF NOT EXISTS consent_events_contact_idx ON consent_events (channel, contact);
CREATE INDEX IF NOT EXISTS approval_events_entity_idx ON approval_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS usage_limits_workspace_idx ON usage_limits (workspace_id);

SELECT 'Migration v9 compliance launch complete.' AS result;
