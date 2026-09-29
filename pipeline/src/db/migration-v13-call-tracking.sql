-- Migration v13: call tracking columns
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_call_at    TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS call_status     TEXT;   -- initiated | no_answer | busy | failed | answered | opted_out | interested
ALTER TABLE leads ADD COLUMN IF NOT EXISTS call_sid        TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS call_count      INTEGER NOT NULL DEFAULT 0;
