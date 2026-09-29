import pg from 'pg'
import type { AuditReport } from '../types.js'
import type { GrowthAgentTask, GrowthPlan, GrowthWorkspace } from './types.js'

const { Pool } = pg

export interface SavedGrowthPlan {
  workspaceId: string
  planId: string
  taskIds: string[]
}

export async function loadAuditReport(auditId: string): Promise<AuditReport | null> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const { rows } = await pool.query('SELECT * FROM audits WHERE id = $1 LIMIT 1', [auditId])
    return rows[0] ? mapAudit(rows[0]) : null
  } finally {
    await pool.end()
  }
}

export async function saveGrowthPlanBundle(
  workspace: GrowthWorkspace,
  plan: GrowthPlan,
  auditId?: string,
  leadId?: string
): Promise<SavedGrowthPlan> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const workspaceResult = await client.query(
      `INSERT INTO growth_workspaces (
         id, lead_id, business_name, website_url, industry, city, state,
         goals, autonomy_level, connected_accounts
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10
       )
       ON CONFLICT (id) DO UPDATE SET
         business_name=EXCLUDED.business_name,
         website_url=EXCLUDED.website_url,
         industry=EXCLUDED.industry,
         city=EXCLUDED.city,
         state=EXCLUDED.state,
         goals=EXCLUDED.goals,
         autonomy_level=EXCLUDED.autonomy_level,
         connected_accounts=EXCLUDED.connected_accounts,
         updated_at=now()
       RETURNING id`,
      [
        workspace.id ?? null,
        leadId ?? null,
        workspace.businessName,
        workspace.websiteUrl,
        workspace.industry ?? null,
        workspace.city ?? null,
        workspace.state ?? null,
        JSON.stringify(workspace.goals),
        workspace.autonomyLevel,
        JSON.stringify(workspace.connectedAccounts),
      ]
    )
    const workspaceId = workspaceResult.rows[0].id as string

    const planResult = await client.query(
      `INSERT INTO growth_plans (
         workspace_id, audit_id, business_name, website_url, summary,
         priority, tracks, approval_policy
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        workspaceId,
        auditId ?? null,
        plan.businessName,
        plan.websiteUrl,
        plan.summary,
        plan.priority,
        JSON.stringify(plan.tracks),
        JSON.stringify(plan.approvalPolicy),
      ]
    )
    const planId = planResult.rows[0].id as string

    const taskIds: string[] = []
    for (const task of plan.initialTasks) {
      const savedTask = await saveTask(client, { ...task, workspaceId }, planId)
      taskIds.push(savedTask)
    }

    await client.query(
      'UPDATE growth_workspaces SET current_plan_id=$1, updated_at=now() WHERE id=$2',
      [planId, workspaceId]
    )

    await client.query('COMMIT')
    return { workspaceId, planId, taskIds }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

async function saveTask(client: pg.PoolClient, task: GrowthAgentTask, planId: string): Promise<string> {
  const { rows } = await client.query(
    `INSERT INTO growth_agent_tasks (
       id, workspace_id, plan_id, agent_type, title, input,
       status, priority, requires_approval, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (id) DO UPDATE SET
       input=EXCLUDED.input,
       status=EXCLUDED.status,
       priority=EXCLUDED.priority,
       requires_approval=EXCLUDED.requires_approval,
       updated_at=now()
     RETURNING id`,
    [
      task.id,
      task.workspaceId ?? null,
      planId,
      task.agentType,
      task.title,
      JSON.stringify(task.input),
      task.status,
      task.priority,
      task.requiresApproval,
      task.createdAt,
    ]
  )
  return rows[0].id as string
}

function mapAudit(row: any): AuditReport {
  return {
    id: row.id,
    lead_id: row.lead_id,
    website_url: row.website_url,
    business_name: row.business_name,
    niche: row.niche,
    city: row.city,
    created_at: row.created_at,
    website_score: row.website_score,
    seo_score: row.seo_score,
    reputation_score: row.reputation_score,
    phone_score: row.phone_score,
    booking_score: row.booking_score,
    overall_score: row.overall_score,
    mobile_score: row.mobile_score,
    desktop_score: row.desktop_score,
    site_issues: row.site_issues ?? [],
    site_broken: row.site_broken ?? false,
    meta_title: row.meta_title,
    meta_description: row.meta_description,
    has_schema: row.has_schema ?? false,
    h1_content: row.h1_content,
    seo_issues: row.seo_issues ?? [],
    phone_found: row.phone_found ?? false,
    has_booking_link: row.has_booking_link ?? false,
    booking_url: row.booking_url,
    has_reviews_on_site: row.has_reviews_on_site ?? false,
    competitors: row.competitors ?? [],
    recommendations: row.recommendations ?? [],
    report_viewed: row.report_viewed,
    report_viewed_at: row.report_viewed_at,
    outreach_sent: row.outreach_sent,
  }
}
