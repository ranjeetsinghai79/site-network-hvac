export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { requirePlatformContext } from '@/lib/platform-auth'
import { platformPool } from '@/lib/platform-control'

export async function GET() {
  try {
    const context = await requirePlatformContext()
    const [workspaces, reports, usage, approvals, integrations] = await Promise.all([
      platformPool().query(`
        SELECT gw.id,gw.business_name,gw.website_url,gw.industry,gw.lifecycle_stage,gw.service_tier,gw.autonomy_level,
               COUNT(DISTINCT wai.id) FILTER (WHERE wai.enabled) AS installed_agents,
               COUNT(DISTINCT ar.id) FILTER (WHERE ar.status IN ('queued','running','needs_approval')) AS open_runs
        FROM growth_workspaces gw LEFT JOIN workspace_agent_installations wai ON wai.workspace_id=gw.id LEFT JOIN automation_runs ar ON ar.workspace_id=gw.id
        WHERE gw.agency_id=$1 GROUP BY gw.id ORDER BY gw.updated_at DESC
      `, [context.agencyId]),
      platformPool().query(`
        SELECT gw.id AS workspace_id,gw.business_name,COUNT(oe.id) FILTER (WHERE oe.event_type='lead') AS leads,
               COUNT(oe.id) FILTER (WHERE oe.event_type='appointment') AS appointments,COALESCE(SUM(oe.value_usd),0) AS revenue
        FROM growth_workspaces gw LEFT JOIN outcome_events oe ON oe.workspace_id=gw.id AND oe.occurred_at>now()-interval '30 days'
        WHERE gw.agency_id=$1 GROUP BY gw.id ORDER BY gw.business_name
      `, [context.agencyId]),
      platformPool().query(`SELECT COALESCE(SUM(cost_usd),0) AS cost_mtd,COALESCE(SUM(billable_usd),0) AS billable_mtd FROM usage_events WHERE agency_id=$1 AND occurred_at>=date_trunc('month',now())`, [context.agencyId]),
      platformPool().query(`SELECT COUNT(*) AS count FROM automation_runs ar JOIN growth_workspaces gw ON gw.id=ar.workspace_id WHERE gw.agency_id=$1 AND ar.status='needs_approval'`, [context.agencyId]),
      platformPool().query(`SELECT wi.workspace_id,wi.provider,wi.status,wi.account_label FROM workspace_integrations wi WHERE wi.agency_id=$1 ORDER BY wi.workspace_id,wi.provider`,[context.agencyId]),
    ])
    return NextResponse.json({ context: { agencyName: context.agencyName, email: context.email, role: context.role }, workspaces: workspaces.rows, reports: reports.rows, usage: usage.rows[0], pendingApprovals: Number(approvals.rows[0]?.count ?? 0), integrations: integrations.rows })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 401 })
  }
}
