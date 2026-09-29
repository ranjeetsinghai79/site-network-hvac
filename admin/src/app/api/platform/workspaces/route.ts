export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { auditPlatform, defaultAgencyId, platformPool } from '@/lib/platform-control'

export async function GET() {
  try {
    const agencyId = await defaultAgencyId()
    const { rows } = await platformPool().query(`
      SELECT gw.id,gw.business_name,gw.website_url,gw.industry,gw.city,gw.state,gw.lifecycle_stage,gw.service_tier,gw.autonomy_level,gw.onboarding_status,gw.updated_at,
             COUNT(DISTINCT wai.id) FILTER (WHERE wai.enabled) AS installed_agents,
             COUNT(DISTINCT ar.id) FILTER (WHERE ar.status IN ('queued','running','needs_approval')) AS open_runs,
             COUNT(DISTINCT wi.id) FILTER (WHERE wi.status='connected') AS connected_integrations
      FROM growth_workspaces gw
      LEFT JOIN workspace_agent_installations wai ON wai.workspace_id=gw.id
      LEFT JOIN automation_runs ar ON ar.workspace_id=gw.id
      LEFT JOIN workspace_integrations wi ON wi.workspace_id=gw.id
      WHERE gw.agency_id=$1 GROUP BY gw.id ORDER BY gw.updated_at DESC
    `, [agencyId])
    return NextResponse.json({ workspaces: rows })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const agencyId = await defaultAgencyId()
    const body = await request.json()
    if (!body.workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })
    const allowedStages = ['onboarding', 'active', 'paused', 'offboarding', 'archived']
    const stage = body.lifecycleStage && allowedStages.includes(body.lifecycleStage) ? body.lifecycleStage : null
    const autonomy = body.autonomyLevel == null ? null : Math.max(1, Math.min(4, Number(body.autonomyLevel)))
    const { rows } = await platformPool().query(`
      UPDATE growth_workspaces SET lifecycle_stage=COALESCE($3,lifecycle_stage),service_tier=COALESCE($4,service_tier),autonomy_level=COALESCE($5,autonomy_level),updated_at=now()
      WHERE id=$1 AND agency_id=$2 RETURNING *
    `, [body.workspaceId, agencyId, stage, body.serviceTier ?? null, autonomy])
    if (!rows[0]) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    await auditPlatform({ agencyId, workspaceId: body.workspaceId, actorEmail: String(body.actorEmail ?? 'admin@webcrew.app'), action: 'workspace.updated', entityType: 'workspace', entityId: body.workspaceId, metadata: { stage, autonomy, serviceTier: body.serviceTier } })
    return NextResponse.json({ workspace: rows[0] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 })
  }
}
