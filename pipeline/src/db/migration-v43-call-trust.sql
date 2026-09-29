-- Call trust labels + Twilio STIR/SHAKEN attestation, so real callers can be told apart from spoofed robocalls.
-- trust: owner | self | widget | human | suspected_bot | no_speech | unknown  (computed in reception/call-screen.ts)
-- stir_verstat: raw Twilio `StirVerstat` (TN-Validation-Passed-A/B/C, TN-Validation-Failed-*, No-TN-Validation)
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS stir_verstat TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS trust        TEXT;
CREATE INDEX IF NOT EXISTS call_logs_trust_idx ON call_logs (trust);
CREATE INDEX IF NOT EXISTS call_logs_config_caller_idx ON call_logs (reception_config_id, caller_number, created_at DESC);
