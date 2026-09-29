import 'dotenv/config'
import pg from 'pg'
const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
void (async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pipeline_costs (
      id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
      date         date        NOT NULL DEFAULT CURRENT_DATE,
      lead_id      uuid        REFERENCES leads(id) ON DELETE SET NULL,
      lead_name    text,
      service      text        NOT NULL,
      units        integer     NOT NULL DEFAULT 1,
      unit_cost_usd numeric(8,5) NOT NULL,
      total_usd    numeric(8,5) GENERATED ALWAYS AS (units * unit_cost_usd) STORED,
      note         text,
      created_at   timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS costs_date_idx    ON pipeline_costs (date);
    CREATE INDEX IF NOT EXISTS costs_service_idx ON pipeline_costs (service);
    CREATE INDEX IF NOT EXISTS costs_lead_idx    ON pipeline_costs (lead_id);
  `)
  console.log('pipeline_costs table created OK')
  await pool.end()
})()
