-- Migration v21: internal agency platform foundation
-- Idempotent and intentionally approval-safe: no external action is enabled here.

CREATE TABLE IF NOT EXISTS agency_accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  status      text NOT NULL DEFAULT 'active',
  settings    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agency_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   uuid NOT NULL REFERENCES agency_accounts(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'operator',
  status      text NOT NULL DEFAULT 'invited',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, email)
);

ALTER TABLE growth_workspaces
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agency_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lifecycle_stage text NOT NULL DEFAULT 'onboarding',
  ADD COLUMN IF NOT EXISTS service_tier text,
  ADD COLUMN IF NOT EXISTS onboarding_status jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS agent_definitions (
  id                        text PRIMARY KEY,
  name                      text NOT NULL,
  category                  text NOT NULL,
  description               text NOT NULL,
  version                   text NOT NULL DEFAULT '1.0.0',
  risk_level                text NOT NULL DEFAULT 'low',
  default_requires_approval boolean NOT NULL DEFAULT true,
  capabilities              jsonb NOT NULL DEFAULT '[]'::jsonb,
  status                    text NOT NULL DEFAULT 'active',
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS playbook_templates (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  niche       text NOT NULL,
  version     text NOT NULL DEFAULT '1.0.0',
  description text NOT NULL,
  definition  jsonb NOT NULL DEFAULT '{}'::jsonb,
  status      text NOT NULL DEFAULT 'draft',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_agent_installations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES growth_workspaces(id) ON DELETE CASCADE,
  agent_id         text NOT NULL REFERENCES agent_definitions(id) ON DELETE RESTRICT,
  enabled          boolean NOT NULL DEFAULT true,
  autonomy_level   integer NOT NULL DEFAULT 1,
  config           jsonb NOT NULL DEFAULT '{}'::jsonb,
  installed_by     text,
  installed_at     timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, agent_id)
);

CREATE TABLE IF NOT EXISTS workspace_playbook_installations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES growth_workspaces(id) ON DELETE CASCADE,
  playbook_id     text NOT NULL REFERENCES playbook_templates(id) ON DELETE RESTRICT,
  status          text NOT NULL DEFAULT 'installed',
  config          jsonb NOT NULL DEFAULT '{}'::jsonb,
  installed_by    text,
  installed_at    timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, playbook_id)
);

CREATE TABLE IF NOT EXISTS automation_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES growth_workspaces(id) ON DELETE CASCADE,
  agent_id         text REFERENCES agent_definitions(id) ON DELETE SET NULL,
  trigger_type     text NOT NULL,
  status           text NOT NULL DEFAULT 'queued',
  requires_approval boolean NOT NULL DEFAULT false,
  approval_event_id uuid REFERENCES approval_events(id) ON DELETE SET NULL,
  idempotency_key  text,
  input            jsonb NOT NULL DEFAULT '{}'::jsonb,
  output           jsonb,
  error            text,
  attempt_count    integer NOT NULL DEFAULT 0,
  started_at       timestamptz,
  finished_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agency_members_role_check') THEN
    ALTER TABLE agency_members ADD CONSTRAINT agency_members_role_check
      CHECK (role IN ('owner', 'operator', 'specialist', 'approver', 'client')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_definitions_risk_check') THEN
    ALTER TABLE agent_definitions ADD CONSTRAINT agent_definitions_risk_check
      CHECK (risk_level IN ('low', 'medium', 'high')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_agent_autonomy_check') THEN
    ALTER TABLE workspace_agent_installations ADD CONSTRAINT workspace_agent_autonomy_check
      CHECK (autonomy_level BETWEEN 1 AND 4) NOT VALID;
  END IF;
END $$;

INSERT INTO agency_accounts (name, slug)
VALUES ('WebCrew', 'webcrew')
ON CONFLICT (slug) DO NOTHING;

UPDATE growth_workspaces
SET agency_id = (SELECT id FROM agency_accounts WHERE slug = 'webcrew')
WHERE agency_id IS NULL;

INSERT INTO agent_definitions
  (id, name, category, description, risk_level, default_requires_approval, capabilities)
VALUES
  ('business-intelligence', 'Business Intelligence', 'intelligence', 'Builds business DNA, audits, competitor context, and growth priorities.', 'low', false, '["crawl","audit","competitor_research"]'),
  ('website-manager', 'Website Manager', 'website', 'Builds, fixes, and improves client websites.', 'high', true, '["build","edit","deploy"]'),
  ('ai-receptionist', 'AI Receptionist', 'front_office', 'Answers calls, captures intent, and supports appointment booking.', 'high', true, '["voice","lead_capture","booking"]'),
  ('lead-follow-up', 'Lead Follow-up', 'front_office', 'Drafts and sends consent-based lead follow-up.', 'high', true, '["email","sms","nurture"]'),
  ('seo-growth', 'SEO Growth', 'organic_growth', 'Plans and executes technical, local, AEO, and GEO improvements.', 'medium', true, '["seo","aeo","geo","local_search"]'),
  ('content-studio', 'Content Studio', 'content', 'Creates business-specific social, blog, image, carousel, and video drafts.', 'medium', true, '["social","blog","image","carousel","video"]'),
  ('paid-growth', 'Paid Growth', 'paid_growth', 'Creates and optimizes approval-gated Google and Meta campaigns.', 'high', true, '["google_ads","meta_ads","optimization"]'),
  ('reputation-manager', 'Reputation Manager', 'retention', 'Monitors reviews and prepares compliant response and request workflows.', 'medium', true, '["reviews","reputation","retention"]'),
  ('business-manager', 'AI Business Manager', 'management', 'Coordinates plans, approvals, outcomes, and client reporting.', 'medium', true, '["orchestration","approvals","reporting"]')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  risk_level = EXCLUDED.risk_level,
  default_requires_approval = EXCLUDED.default_requires_approval,
  capabilities = EXCLUDED.capabilities,
  updated_at = now();

INSERT INTO playbook_templates (id, name, niche, description, definition, status)
VALUES (
  'hvac-revenue-recovery-v1',
  'HVAC Revenue Recovery',
  'hvac',
  'Recover missed demand, improve local discovery, follow up leads, and book service calls.',
  '{"agents":["business-intelligence","website-manager","ai-receptionist","lead-follow-up","seo-growth","content-studio","paid-growth","reputation-manager","business-manager"],"approvalPolicy":"phase-1-safe"}',
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  definition = EXCLUDED.definition,
  status = EXCLUDED.status,
  updated_at = now();

CREATE INDEX IF NOT EXISTS agency_members_agency_idx ON agency_members (agency_id, status);
CREATE INDEX IF NOT EXISTS growth_workspaces_agency_idx ON growth_workspaces (agency_id, lifecycle_stage);
CREATE INDEX IF NOT EXISTS workspace_agents_workspace_idx ON workspace_agent_installations (workspace_id, enabled);
CREATE INDEX IF NOT EXISTS workspace_playbooks_workspace_idx ON workspace_playbook_installations (workspace_id, status);
CREATE INDEX IF NOT EXISTS automation_runs_workspace_idx ON automation_runs (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS automation_runs_status_idx ON automation_runs (status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS automation_runs_idempotency_idx
  ON automation_runs (workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

SELECT 'Migration v21 agency platform foundation complete.' AS result;
