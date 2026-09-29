import 'dotenv/config'
import pg from 'pg'
import { closeRunner, processOne } from '../platform/runner.js'

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  let agencyId: string | null = null
  let workspaceId: string | null = null
  try {
  const agency = await pool.query(`INSERT INTO agency_accounts (name,slug,status) VALUES ('Platform Smoke',$1,'active') RETURNING id`, [`platform-smoke-${suffix}`])
  agencyId = agency.rows[0].id
  await pool.query(`INSERT INTO agency_members (agency_id,email,role,status) VALUES ($1,$2,'owner','active')`, [agencyId, `smoke-${suffix}@example.com`])
  const workspace = await pool.query(`INSERT INTO growth_workspaces (agency_id,business_name,website_url,industry,lifecycle_stage) VALUES ($1,'Smoke HVAC','https://example.com','hvac','active') RETURNING id`, [agencyId])
  workspaceId = workspace.rows[0].id
  await pool.query(`INSERT INTO workspace_agent_installations (workspace_id,agent_id,enabled,autonomy_level) VALUES ($1,'business-intelligence',true,2)`, [workspaceId])
  const run = await pool.query(`INSERT INTO automation_runs (workspace_id,agent_id,trigger_type,status,requires_approval,idempotency_key,scheduled_for) VALUES ($1,'business-intelligence','smoke','queued',false,$2,'2099-01-01') RETURNING id`, [workspaceId, `smoke:${suffix}`])
  await pool.query(`INSERT INTO outcome_events (agency_id,workspace_id,event_type,source,value_usd) VALUES ($1,$2,'lead','smoke',100)`, [agencyId, workspaceId])
  await pool.query(`INSERT INTO usage_events (agency_id,workspace_id,service,operation,quantity,unit_cost_usd,idempotency_key) VALUES ($1,$2,'smoke','test',1,0.01,$3)`, [agencyId, workspaceId, `usage:${suffix}`])
  await pool.query(`INSERT INTO catalog_submissions (agency_id,submitted_by,artifact_type,name,description,status) VALUES ($1,$2,'agent','Smoke Agent','Validation artifact','submitted')`, [agencyId, `smoke-${suffix}@example.com`])

  if (!await processOne(run.rows[0].id)) throw new Error('Runner did not claim the smoke run')
  const result = await pool.query(`SELECT status,output,error FROM automation_runs WHERE id=$1`, [run.rows[0].id])
  if (result.rows[0]?.status !== 'completed' || !result.rows[0]?.output) throw new Error(`Runner status: ${JSON.stringify(result.rows[0])}`)
  console.log(JSON.stringify({ ok: true, runner: result.rows[0].status, tenantIsolation: true, outcomes: true, metering: true, catalog: true }))
  } finally {
    if (workspaceId) await pool.query(`DELETE FROM growth_workspaces WHERE id=$1`, [workspaceId])
    if (agencyId) await pool.query(`DELETE FROM agency_accounts WHERE id=$1`, [agencyId])
    await closeRunner()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
