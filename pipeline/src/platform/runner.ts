import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg
const workerId = `platform-${process.pid}-${Math.random().toString(36).slice(2, 8)}`
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

interface ClaimedRun {
  id: string
  workspace_id: string
  agent_id: string | null
  trigger_type: string
  input: Record<string, unknown>
  attempt_count: number
  max_attempts: number
  requires_approval: boolean
  approval_event_id: string | null
  agent_name: string | null
  risk_level: 'low' | 'medium' | 'high' | null
}

async function materializeSchedules(): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(`
      SELECT id,workspace_id,agent_id,trigger_type,interval_minutes,requires_approval,input,next_run_at
      FROM automation_schedules WHERE enabled AND next_run_at<=now()
      ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT 25
    `)
    for (const schedule of rows) {
      await client.query(`
        INSERT INTO automation_runs (workspace_id,agent_id,trigger_type,status,requires_approval,idempotency_key,input,scheduled_for)
        VALUES ($1,$2,$3,'queued',$4,$5,$6,$7)
        ON CONFLICT (workspace_id,idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
      `, [schedule.workspace_id,schedule.agent_id,schedule.trigger_type,schedule.requires_approval,`schedule:${schedule.id}:${new Date(schedule.next_run_at).toISOString()}`,JSON.stringify(schedule.input),schedule.next_run_at])
      await client.query(`UPDATE automation_schedules SET last_run_at=next_run_at,next_run_at=next_run_at+(interval_minutes || ' minutes')::interval,updated_at=now() WHERE id=$1`,[schedule.id])
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}

async function claimRun(onlyRunId?: string): Promise<ClaimedRun | null> {
  const { rows } = await pool.query<ClaimedRun>(`
    WITH candidate AS (
      SELECT ar.id,ad.name AS agent_name,ad.risk_level
      FROM automation_runs ar
      LEFT JOIN agent_definitions ad ON ad.id=ar.agent_id
      WHERE ar.status = 'queued'
        AND ($2::uuid IS NULL OR ar.id=$2::uuid)
        AND ar.next_attempt_at <= now()
        AND ($2::uuid IS NOT NULL OR COALESCE(ar.scheduled_for, now()) <= now())
      ORDER BY ar.created_at
      FOR UPDATE OF ar SKIP LOCKED
      LIMIT 1
    )
    UPDATE automation_runs ar
    SET status = 'running', locked_at = now(), locked_by = $1,
        started_at = COALESCE(started_at, now()), attempt_count = attempt_count + 1,
        updated_at = now()
    FROM candidate c
    WHERE ar.id = c.id
    RETURNING ar.id, ar.workspace_id, ar.agent_id, ar.trigger_type, ar.input,
              ar.attempt_count, ar.max_attempts, ar.requires_approval,
              ar.approval_event_id, c.agent_name, c.risk_level
  `, [workerId, onlyRunId ?? null])
  return rows[0] ?? null
}

async function executeRun(run: ClaimedRun): Promise<Record<string, unknown>> {
  const { rows: workspaceRows } = await pool.query(`
    SELECT gw.business_name, gw.website_url, gw.industry, gw.city, gw.state,
           gw.lifecycle_stage, gw.service_tier, gw.agency_id
    FROM growth_workspaces gw WHERE gw.id = $1
  `, [run.workspace_id])
  const workspace = workspaceRows[0]
  if (!workspace) throw new Error('Workspace not found')

  const { rows: usageRows } = await pool.query(`
    SELECT aa.monthly_usage_cap_usd,COALESCE(SUM(ue.cost_usd),0) AS cost_mtd
    FROM agency_accounts aa LEFT JOIN usage_events ue ON ue.agency_id=aa.id AND ue.occurred_at>=date_trunc('month',now())
    WHERE aa.id=$1 GROUP BY aa.id
  `, [workspace.agency_id])
  if (Number(usageRows[0]?.monthly_usage_cap_usd ?? 0) > 0 && Number(usageRows[0]?.cost_mtd ?? 0) >= Number(usageRows[0].monthly_usage_cap_usd)) {
    throw new Error('Usage cap reached; increase the agency cap before retrying')
  }

  if (run.agent_id === 'business-manager' || run.agent_id === 'business-intelligence') {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM growth_agent_tasks WHERE workspace_id=$1 AND status IN ('queued','running')) AS open_tasks,
        (SELECT COUNT(*) FROM approval_events WHERE workspace_id=$1 AND created_at > now() - interval '30 days') AS approvals_30d,
        (SELECT COUNT(*) FROM outcome_events WHERE workspace_id=$1 AND occurred_at > now() - interval '30 days') AS outcomes_30d,
        (SELECT COALESCE(SUM(value_usd),0) FROM outcome_events WHERE workspace_id=$1 AND occurred_at > now() - interval '30 days') AS outcome_value_30d,
        (SELECT COALESCE(SUM(cost_usd),0) FROM usage_events WHERE workspace_id=$1 AND occurred_at > now() - interval '30 days') AS cost_30d
    `, [run.workspace_id])
    return { workspace, metrics: rows[0], generatedAt: new Date().toISOString() }
  }

  return {
    workspace,
    agent: run.agent_name ?? run.agent_id,
    acceptedInput: run.input,
    handoff: 'Agent execution recorded. Any external side effect remains in its dedicated approval-gated queue.',
    generatedAt: new Date().toISOString(),
  }
}

export async function processOne(onlyRunId?: string): Promise<boolean> {
  if (!onlyRunId) await materializeSchedules()
  const run = await claimRun(onlyRunId)
  if (!run) return false

  try {
    if (run.requires_approval && !run.approval_event_id) {
      await pool.query(`
        UPDATE automation_runs SET status='needs_approval', locked_at=NULL, locked_by=NULL, updated_at=now()
        WHERE id=$1
      `, [run.id])
      return true
    }

    const output = await executeRun(run)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`
        UPDATE automation_runs
        SET status='completed', output=$2, error=NULL, finished_at=now(),
            locked_at=NULL, locked_by=NULL, updated_at=now()
        WHERE id=$1
      `, [run.id, JSON.stringify(output)])
      await client.query(`
        INSERT INTO usage_events (agency_id, workspace_id, service, operation, quantity, unit_cost_usd, idempotency_key, metadata)
        SELECT agency_id, id, 'platform', 'automation_run', 1, 0, $2::text, jsonb_build_object('runId',$1::text,'agentId',$3::text)
        FROM growth_workspaces WHERE id=$4::uuid
        ON CONFLICT (agency_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
      `, [run.id, `automation:${run.id}`, run.agent_id, run.workspace_id])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const exhausted = message.startsWith('Usage cap reached') || run.attempt_count >= run.max_attempts
    const delayMinutes = Math.min(60, 2 ** Math.max(0, run.attempt_count - 1))
    await pool.query(`
      UPDATE automation_runs
      SET status=$2, error=$3, next_attempt_at=now()+($4 || ' minutes')::interval,
          locked_at=NULL, locked_by=NULL, finished_at=CASE WHEN $2='failed' THEN now() ELSE NULL END,
          updated_at=now()
      WHERE id=$1
    `, [run.id, exhausted ? 'failed' : 'queued', message, delayMinutes])
  }
  return true
}

// Polling every 5s 24/7 kept the Neon endpoint from ever autosuspending,
// burning compute-hours for a feature (automation_schedules) with no
// confirmed active tenant yet. Idle sleep is now 5 minutes; the "found
// work" path below is untouched, so real runs still process immediately.
const IDLE_POLL_MS = parseInt(process.env.PLATFORM_WORKER_IDLE_POLL_MS ?? '300000')

async function main() {
  const once = process.argv.includes('--once')
  do {
    let worked = false
    try {
      worked = await processOne()
    } catch (e: any) {
      // A DB error here (e.g. Neon unreachable/over quota) used to crash the
      // whole process — launchd's KeepAlive would respawn it immediately,
      // producing a crash-loop that reconnects just as often as the old 5s
      // poll did, defeating the point of the throttle above. Treat it as
      // "no work this cycle" instead: log, sleep, retry.
      console.error('[platform-runner] cycle failed, will retry after idle sleep:', e.message)
    }
    if (once) break
    if (!worked) await new Promise((resolve) => setTimeout(resolve, IDLE_POLL_MS))
  } while (true)
}

export async function closeRunner(): Promise<void> {
  await pool.end()
}

if (process.argv[1]?.endsWith('/platform/runner.ts') || process.argv[1]?.endsWith('/platform/runner.js')) {
  main()
    .catch((error) => {
      console.error('[platform-runner]', error)
      process.exitCode = 1
    })
    .finally(async () => {
      if (process.argv.includes('--once')) await closeRunner()
    })
}
