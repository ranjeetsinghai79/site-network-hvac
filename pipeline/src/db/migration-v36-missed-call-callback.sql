-- Missed-call AI voice callback: a customer can reply "CALL" to the missed-call
-- recovery SMS to request one immediate AI voice callback. See
-- api/src/index.ts's handleClientReceptionSmsReply() and
-- pipeline/src/reception/server.ts's /warm-trigger.

ALTER TABLE missed_calls ADD COLUMN IF NOT EXISTS callback_requested    BOOLEAN DEFAULT FALSE;
ALTER TABLE missed_calls ADD COLUMN IF NOT EXISTS callback_requested_at TIMESTAMPTZ;
ALTER TABLE missed_calls ADD COLUMN IF NOT EXISTS callback_sid          TEXT;          -- Twilio CallSid of the outbound callback
ALTER TABLE missed_calls ADD COLUMN IF NOT EXISTS callback_sent_at      TIMESTAMPTZ;
ALTER TABLE missed_calls ADD COLUMN IF NOT EXISTS callback_status       TEXT;          -- initiated | failed

-- Powers "most recent unresolved missed call for this caller+config" lookup,
-- run on every inbound SMS reply to a client reception number.
CREATE INDEX IF NOT EXISTS missed_calls_pending_callback_idx
  ON missed_calls (caller, config_id, created_at DESC)
  WHERE callback_requested = FALSE;

SELECT 'migration-v36-missed-call-callback applied.' AS result;
