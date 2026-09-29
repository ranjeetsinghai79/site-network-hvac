-- Migration v20: video asset drafts and render jobs
-- Idempotent — safe to re-run

CREATE TABLE IF NOT EXISTS video_assets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid REFERENCES growth_workspaces(id) ON DELETE CASCADE,
  lead_id            uuid REFERENCES leads(id) ON DELETE SET NULL,
  asset_type         text NOT NULL,
  platform           text NOT NULL,
  provider           text NOT NULL DEFAULT 'manual',
  status             text NOT NULL DEFAULT 'needs_approval',
  title              text NOT NULL,
  script             text NOT NULL,
  scenes             jsonb NOT NULL DEFAULT '[]'::jsonb,
  prompt             text NOT NULL,
  duration_sec       integer NOT NULL DEFAULT 15,
  aspect_ratio       text NOT NULL DEFAULT '9:16',
  compliance_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  render_payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  render_error       text,
  external_job_id    text,
  asset_url          text,
  thumbnail_url      text,
  approved_by        text,
  approved_at        timestamptz,
  rendered_at        timestamptz,
  published_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS video_assets_workspace_idx ON video_assets (workspace_id, status);
CREATE INDEX IF NOT EXISTS video_assets_platform_idx ON video_assets (platform, status);
CREATE INDEX IF NOT EXISTS video_assets_provider_idx ON video_assets (provider, status);

SELECT 'Migration v20 video assets complete.' AS result;
