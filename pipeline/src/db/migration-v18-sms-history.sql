-- v18: full conversation history per SMS thread
ALTER TABLE sms_conversations ADD COLUMN IF NOT EXISTS messages JSONB DEFAULT '[]';
