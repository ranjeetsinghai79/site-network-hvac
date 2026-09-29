-- Migration v6: AI Growth OS workspaces, plans, and agent tasks
-- Idempotent — safe to re-run

CREATE TABLE IF NOT EXISTS growth_workspaces (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id            uuid REFERENCES leads(id) ON DELETE SET NULL,
  business_name      text NOT NULL,
  website_url        text NOT NULL,
  industry           text,
  city               text,
  state              text,
  goals              jsonb NOT NULL DEFAULT '[]'::jsonb,
  autonomy_level     integer NOT NULL DEFAULT 2,
  connected_accounts jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_plan_id    uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS growth_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid REFERENCES growth_workspaces(id) ON DELETE CASCADE,
  audit_id        uuid REFERENCES audits(id) ON DELETE SET NULL,
  business_name   text NOT NULL,
  website_url     text NOT NULL,
  summary         text NOT NULL,
  priority        text NOT NULL,
  tracks          jsonb NOT NULL DEFAULT '[]'::jsonb,
  approval_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS growth_agent_tasks (
  id                text PRIMARY KEY,
  workspace_id      uuid REFERENCES growth_workspaces(id) ON DELETE CASCADE,
  plan_id           uuid REFERENCES growth_plans(id) ON DELETE CASCADE,
  agent_type        text NOT NULL,
  title             text NOT NULL,
  input             jsonb NOT NULL DEFAULT '{}'::jsonb,
  status            text NOT NULL,
  priority          text NOT NULL,
  requires_approval boolean NOT NULL DEFAULT true,
  result            jsonb,
  error             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'growth_workspaces_autonomy_level_check'
  ) THEN
    ALTER TABLE growth_workspaces
      ADD CONSTRAINT growth_workspaces_autonomy_level_check
      CHECK (autonomy_level BETWEEN 1 AND 4)
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS growth_workspaces_lead_idx     ON growth_workspaces (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS growth_workspaces_website_idx  ON growth_workspaces (website_url);
CREATE INDEX IF NOT EXISTS growth_plans_workspace_idx     ON growth_plans (workspace_id);
CREATE INDEX IF NOT EXISTS growth_plans_audit_idx         ON growth_plans (audit_id) WHERE audit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS growth_tasks_workspace_idx     ON growth_agent_tasks (workspace_id);
CREATE INDEX IF NOT EXISTS growth_tasks_status_idx        ON growth_agent_tasks (status, priority);

SELECT 'Migration v6 growth OS complete.' AS result;
