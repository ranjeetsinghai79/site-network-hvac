-- Migration v22: Phase 2 platform control plane
-- Adds private-beta onboarding, auth, execution, reporting, metering, and catalog governance.

ALTER TABLE agency_accounts
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'private_beta',
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS monthly_price_usd numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_usage_cap_usd numeric(10,2) NOT NULL DEFAULT 250;

ALTER TABLE agency_members
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS invited_by text;

ALTER TABLE agent_definitions
  ADD COLUMN IF NOT EXISTS publisher_agency_id uuid REFERENCES agency_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS pricing_model text NOT NULL DEFAULT 'included',
  ADD COLUMN IF NOT EXISTS price_usd numeric(10,4) NOT NULL DEFAULT 0;

ALTER TABLE playbook_templates
  ADD COLUMN IF NOT EXISTS publisher_agency_id uuid REFERENCES agency_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';

ALTER TABLE automation_runs
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS parent_run_id uuid REFERENCES automation_runs(id) ON DELETE SET NULL;

ALTER TABLE oauth_states
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agency_accounts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES growth_workspaces(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS platform_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   uuid NOT NULL REFERENCES agency_accounts(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'operator',
  token_hash  text NOT NULL UNIQUE,
  invited_by  text,
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_schedules (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES growth_workspaces(id) ON DELETE CASCADE,
  agent_id            text NOT NULL REFERENCES agent_definitions(id) ON DELETE RESTRICT,
  trigger_type        text NOT NULL,
  interval_minutes    integer NOT NULL,
  enabled             boolean NOT NULL DEFAULT true,
  requires_approval   boolean NOT NULL DEFAULT false,
  input               jsonb NOT NULL DEFAULT '{}'::jsonb,
  next_run_at         timestamptz NOT NULL DEFAULT now(),
  last_run_at         timestamptz,
  created_by          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,agent_id,trigger_type)
);

CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id             uuid NOT NULL REFERENCES agency_accounts(id) ON DELETE CASCADE,
  created_by            text NOT NULL,
  website_url           text NOT NULL,
  status                text NOT NULL DEFAULT 'analyzing',
  business_dna          jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected_playbook_id  text REFERENCES playbook_templates(id) ON DELETE SET NULL,
  integration_blockers  jsonb NOT NULL DEFAULT '[]'::jsonb,
  workspace_id          uuid REFERENCES growth_workspaces(id) ON DELETE SET NULL,
  error                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_integrations (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id                  uuid NOT NULL REFERENCES agency_accounts(id) ON DELETE CASCADE,
  workspace_id               uuid NOT NULL REFERENCES growth_workspaces(id) ON DELETE CASCADE,
  provider                   text NOT NULL,
  status                     text NOT NULL DEFAULT 'not_connected',
  integration_connection_id  uuid REFERENCES integration_connections(id) ON DELETE SET NULL,
  account_label              text,
  required_scopes            text[] NOT NULL DEFAULT '{}',
  last_checked_at            timestamptz,
  error                      text,
  metadata                   jsonb NOT NULL DEFAULT '{}'::jsonb,
  credentials_metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider)
);

CREATE TABLE IF NOT EXISTS outcome_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     uuid NOT NULL REFERENCES agency_accounts(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL REFERENCES growth_workspaces(id) ON DELETE CASCADE,
  event_type    text NOT NULL,
  source        text NOT NULL,
  quantity      numeric(14,4) NOT NULL DEFAULT 1,
  value_usd     numeric(14,2),
  external_id   text,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid NOT NULL REFERENCES agency_accounts(id) ON DELETE CASCADE,
  workspace_id    uuid REFERENCES growth_workspaces(id) ON DELETE SET NULL,
  service         text NOT NULL,
  operation       text NOT NULL,
  quantity        numeric(14,4) NOT NULL DEFAULT 1,
  unit_cost_usd   numeric(14,6) NOT NULL DEFAULT 0,
  cost_usd        numeric(14,6) GENERATED ALWAYS AS (quantity * unit_cost_usd) STORED,
  billable_usd    numeric(14,6) NOT NULL DEFAULT 0,
  idempotency_key text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     uuid REFERENCES agency_accounts(id) ON DELETE SET NULL,
  workspace_id  uuid REFERENCES growth_workspaces(id) ON DELETE SET NULL,
  actor_email   text,
  actor_role    text,
  action        text NOT NULL,
  entity_type   text NOT NULL,
  entity_id     text,
  ip_address    text,
  user_agent    text,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_rate_limits (
  scope_key     text NOT NULL,
  action        text NOT NULL,
  window_start  timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_key, action, window_start)
);

CREATE TABLE IF NOT EXISTS catalog_submissions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id             uuid NOT NULL REFERENCES agency_accounts(id) ON DELETE CASCADE,
  submitted_by          text NOT NULL,
  artifact_type         text NOT NULL,
  artifact_id           text,
  name                  text NOT NULL,
  description           text NOT NULL,
  manifest              jsonb NOT NULL DEFAULT '{}'::jsonb,
  status                text NOT NULL DEFAULT 'submitted',
  security_review       jsonb NOT NULL DEFAULT '{}'::jsonb,
  commercial_terms      jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by           text,
  reviewed_at           timestamptz,
  review_notes          text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_invites_role_check') THEN
    ALTER TABLE platform_invites ADD CONSTRAINT platform_invites_role_check
      CHECK (role IN ('owner', 'operator', 'specialist', 'approver', 'client')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_sessions_status_check') THEN
    ALTER TABLE onboarding_sessions ADD CONSTRAINT onboarding_sessions_status_check
      CHECK (status IN ('analyzing', 'review', 'provisioning', 'completed', 'failed', 'cancelled')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalog_submissions_type_check') THEN
    ALTER TABLE catalog_submissions ADD CONSTRAINT catalog_submissions_type_check
      CHECK (artifact_type IN ('agent', 'playbook', 'integration')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalog_submissions_status_check') THEN
    ALTER TABLE catalog_submissions ADD CONSTRAINT catalog_submissions_status_check
      CHECK (status IN ('draft', 'submitted', 'changes_requested', 'approved', 'rejected', 'suspended')) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS platform_invites_email_idx ON platform_invites (lower(email), expires_at);
CREATE INDEX IF NOT EXISTS automation_schedules_due_idx ON automation_schedules (next_run_at) WHERE enabled;
CREATE INDEX IF NOT EXISTS onboarding_sessions_agency_idx ON onboarding_sessions (agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS workspace_integrations_agency_idx ON workspace_integrations (agency_id, workspace_id, status);
CREATE INDEX IF NOT EXISTS outcome_events_workspace_idx ON outcome_events (workspace_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS outcome_events_type_idx ON outcome_events (agency_id, event_type, occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS outcome_events_external_idx ON outcome_events (workspace_id,event_type,source,external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS usage_events_workspace_idx ON usage_events (workspace_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_agency_idx ON usage_events (agency_id, occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS usage_events_idempotency_idx ON usage_events (agency_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS security_audit_agency_idx ON security_audit_log (agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS security_audit_entity_idx ON security_audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS catalog_submissions_agency_idx ON catalog_submissions (agency_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS automation_runs_claim_idx ON automation_runs (status, next_attempt_at, created_at) WHERE status = 'queued';

CREATE OR REPLACE FUNCTION capture_platform_call_outcome() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO outcome_events (agency_id,workspace_id,event_type,source,external_id,metadata,occurred_at)
  SELECT gw.agency_id,gw.id,'call','call_logs',NEW.id::text,jsonb_build_object('durationSeconds',NEW.duration_seconds,'escalated',NEW.escalated),COALESCE(NEW.created_at,now())
  FROM growth_workspaces gw WHERE gw.lead_id=NEW.lead_id AND gw.agency_id IS NOT NULL
  ON CONFLICT (workspace_id,event_type,source,external_id) WHERE external_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS platform_call_outcome ON call_logs;
CREATE TRIGGER platform_call_outcome AFTER INSERT ON call_logs FOR EACH ROW EXECUTE FUNCTION capture_platform_call_outcome();

CREATE OR REPLACE FUNCTION capture_platform_booking_outcome() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO outcome_events (agency_id,workspace_id,event_type,source,external_id,metadata,occurred_at)
  SELECT gw.agency_id,gw.id,'appointment','cal_bookings',NEW.booking_uid,jsonb_build_object('status',NEW.status),COALESCE(NEW.created_at,now())
  FROM growth_workspaces gw WHERE gw.lead_id=NEW.lead_id AND gw.agency_id IS NOT NULL
  ON CONFLICT (workspace_id,event_type,source,external_id) WHERE external_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS platform_booking_outcome ON cal_bookings;
CREATE TRIGGER platform_booking_outcome AFTER INSERT ON cal_bookings FOR EACH ROW EXECUTE FUNCTION capture_platform_booking_outcome();

CREATE OR REPLACE FUNCTION capture_platform_review_outcome() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO outcome_events (agency_id,workspace_id,event_type,source,external_id,metadata,occurred_at)
  SELECT gw.agency_id,gw.id,'review','client_reviews',NEW.review_id,jsonb_build_object('rating',NEW.rating),COALESCE(NEW.created_at,now())
  FROM growth_workspaces gw WHERE gw.lead_id=NEW.lead_id AND gw.agency_id IS NOT NULL
  ON CONFLICT (workspace_id,event_type,source,external_id) WHERE external_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS platform_review_outcome ON client_reviews;
CREATE TRIGGER platform_review_outcome AFTER INSERT ON client_reviews FOR EACH ROW EXECUTE FUNCTION capture_platform_review_outcome();

SELECT 'Migration v22 platform control plane complete.' AS result;
