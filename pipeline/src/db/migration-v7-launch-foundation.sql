-- Migration v7: launch foundation for memory, social assets, and CRM sync
-- Idempotent — safe to re-run

CREATE TABLE IF NOT EXISTS memory_documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid REFERENCES growth_workspaces(id) ON DELETE CASCADE,
  lead_id        uuid REFERENCES leads(id) ON DELETE SET NULL,
  source_type    text NOT NULL,
  source_url     text,
  title          text NOT NULL,
  content        text NOT NULL,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memory_chunks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    uuid REFERENCES memory_documents(id) ON DELETE CASCADE,
  workspace_id   uuid REFERENCES growth_workspaces(id) ON DELETE CASCADE,
  chunk_index    integer NOT NULL,
  content        text NOT NULL,
  keywords       text[] NOT NULL DEFAULT '{}',
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_assets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid REFERENCES growth_workspaces(id) ON DELETE CASCADE,
  lead_id         uuid REFERENCES leads(id) ON DELETE SET NULL,
  asset_type      text NOT NULL,
  platform        text NOT NULL,
  status          text NOT NULL DEFAULT 'draft',
  title           text NOT NULL,
  caption         text NOT NULL,
  slides          jsonb NOT NULL DEFAULT '[]'::jsonb,
  image_prompts   jsonb NOT NULL DEFAULT '[]'::jsonb,
  hashtags        text[] NOT NULL DEFAULT '{}',
  approval_notes  text,
  scheduled_for   timestamptz,
  published_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid REFERENCES growth_workspaces(id) ON DELETE CASCADE,
  provider        text NOT NULL,
  base_url        text,
  status          text NOT NULL DEFAULT 'not_connected',
  settings        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider)
);

CREATE TABLE IF NOT EXISTS crm_sync_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid REFERENCES growth_workspaces(id) ON DELETE SET NULL,
  lead_id         uuid REFERENCES leads(id) ON DELETE SET NULL,
  provider        text NOT NULL,
  event_type      text NOT NULL,
  external_id     text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'queued',
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'social_assets_type_check'
  ) THEN
    ALTER TABLE social_assets
      ADD CONSTRAINT social_assets_type_check
      CHECK (asset_type IN ('image_post', 'carousel'))
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS memory_documents_workspace_idx ON memory_documents (workspace_id);
CREATE INDEX IF NOT EXISTS memory_chunks_workspace_idx    ON memory_chunks (workspace_id);
CREATE INDEX IF NOT EXISTS memory_chunks_keywords_idx     ON memory_chunks USING gin (keywords);
CREATE INDEX IF NOT EXISTS social_assets_workspace_idx    ON social_assets (workspace_id, status);
CREATE INDEX IF NOT EXISTS crm_accounts_workspace_idx     ON crm_accounts (workspace_id);
CREATE INDEX IF NOT EXISTS crm_sync_events_status_idx     ON crm_sync_events (status, provider);

SELECT 'Migration v7 launch foundation complete.' AS result;
