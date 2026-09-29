-- Rolling summary for long SMS conversations. sms_conversations.messages is
-- capped at 40 raw entries fed into Sofia's context each turn — once a
-- conversation exceeds that, older turns fold into this compact summary
-- instead of being silently lost. See summarizeConversation() in api/src/index.ts.
ALTER TABLE sms_conversations ADD COLUMN IF NOT EXISTS summary TEXT;
