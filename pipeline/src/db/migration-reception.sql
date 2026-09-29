-- AI Reception configs table
-- Run once: node --env-file=pipeline/.env --import=tsx/esm -e "import pg from 'pg'; const p = new pg.Pool({connectionString: process.env.DATABASE_URL}); await p.query(await (await import('fs/promises')).readFile('pipeline/src/db/migration-reception.sql','utf8')); console.log('Done'); process.exit()"

CREATE TABLE IF NOT EXISTS reception_configs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        uuid        REFERENCES leads(id) ON DELETE SET NULL,
  website_url    text        NOT NULL UNIQUE,
  business_name  text        NOT NULL,
  brain_json     jsonb       NOT NULL,
  system_prompt  text        NOT NULL,
  twilio_phone   text,                                    -- Twilio number routed here
  active         boolean     DEFAULT true,
  created_at     timestamptz DEFAULT NOW(),
  updated_at     timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reception_lead_idx   ON reception_configs (lead_id);
CREATE INDEX IF NOT EXISTS reception_phone_idx  ON reception_configs (twilio_phone);
CREATE INDEX IF NOT EXISTS reception_active_idx ON reception_configs (active) WHERE active = true;

SELECT 'reception_configs table ready.' AS result;
