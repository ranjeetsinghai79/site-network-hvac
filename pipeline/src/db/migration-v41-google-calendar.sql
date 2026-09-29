-- One-click Google Calendar connection for client receptionists (no API keys).
-- The refresh token is stored AES-GCM encrypted (CALENDAR_TOKEN_KEY); calendar_settings
-- holds what the owner controls from the dashboard: appointment length + bookable hours.
ALTER TABLE reception_configs ADD COLUMN IF NOT EXISTS calendar_provider         TEXT;   -- 'google' | 'cal' | NULL
ALTER TABLE reception_configs ADD COLUMN IF NOT EXISTS google_refresh_token_enc  TEXT;
ALTER TABLE reception_configs ADD COLUMN IF NOT EXISTS google_account_email      TEXT;
ALTER TABLE reception_configs ADD COLUMN IF NOT EXISTS calendar_settings         JSONB;

SELECT 'Migration v41 (google calendar) complete.' AS result;
