-- v34: billing lifecycle gaps found in a full audit — refund tracking,
-- deprovisioning reception is already covered by the pre-existing
-- reception_configs.active column (now actually wired, no schema change
-- needed there).
ALTER TABLE leads ADD COLUMN IF NOT EXISTS refunded BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
