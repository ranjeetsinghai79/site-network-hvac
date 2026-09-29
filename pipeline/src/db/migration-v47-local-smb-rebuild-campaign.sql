CREATE TABLE IF NOT EXISTS local_smb_rebuild_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), spreadsheet_id text NOT NULL,
  sheet_name text NOT NULL DEFAULT 'Local SMBs', sheet_row integer NOT NULL,
  business_name text NOT NULL, niche text, city text, state text, phone text, email text,
  source_url text NOT NULL,
  status text NOT NULL DEFAULT 'audit_ready' CHECK (status IN ('audit_ready','approved_to_build','building','preview_ready','approved_to_contact','contacted','rejected','claimed','expired','failed')),
  audit_json jsonb NOT NULL DEFAULT '{}'::jsonb, lead_id uuid, preview_url text,
  cloudflare_project text, reception_config_id uuid, approved_to_build_at timestamptz,
  approved_to_contact_at timestamptz, contacted_at timestamptz, form_submitted_at timestamptz,
  email_send_count integer NOT NULL DEFAULT 0, next_followup_at timestamptz,
  expires_at timestamptz, last_error text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (spreadsheet_id, sheet_name, sheet_row), UNIQUE (source_url)
);
CREATE INDEX IF NOT EXISTS local_smb_rebuild_jobs_status_idx ON local_smb_rebuild_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS local_smb_rebuild_jobs_followup_idx ON local_smb_rebuild_jobs (next_followup_at) WHERE status = 'contacted';
CREATE INDEX IF NOT EXISTS local_smb_rebuild_jobs_expiry_idx ON local_smb_rebuild_jobs (expires_at) WHERE status IN ('preview_ready','approved_to_contact','contacted');
CREATE TABLE IF NOT EXISTS local_smb_rebuild_email_events (
  id bigserial PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES local_smb_rebuild_jobs(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, sequence_number)
);
CREATE INDEX IF NOT EXISTS local_smb_rebuild_email_events_sent_idx ON local_smb_rebuild_email_events (sent_at);
SELECT 'Migration v47 (Local SMB rebuild campaign) complete.' AS result;
