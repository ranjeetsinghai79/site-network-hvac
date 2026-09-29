export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { auditPlatform, defaultAgencyId, platformPool } from '@/lib/platform-control'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const agencyId = await defaultAgencyId()
    const { rows } = await platformPool().query(`
      SELECT ad.id,ad.name,ad.category,ad.description,ad.risk_level,ad.default_requires_approval,
             COALESCE(wai.enabled,false) AS installed,COALESCE(wai.autonomy_level,1) AS autonomy_level,wai.config
      FROM agent_definitions ad
      JOIN growth_workspaces gw ON gw.id=$1 AND gw.agency_id=$2
      LEFT JOIN workspace_agent_installations wai ON wai.agent_id=ad.id AND wai.workspace_id=gw.id
      WHERE ad.status='active' ORDER BY ad.category,ad.name
    `, [id, agencyId])
    return NextResponse.json({ agents: rows })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const agencyId = await defaultAgencyId()
    const body = await request.json()
    const autonomy = Math.max(1, Math.min(4, Number(body.autonomyLevel ?? 1)))
    const { rows } = await platformPool().query(`
      INSERT INTO workspace_agent_installations (workspace_id,agent_id,enabled,autonomy_level,config,installed_by)
      SELECT gw.id,ad.id,$4,$5,$6,$7 FROM growth_workspaces gw JOIN agent_definitions ad ON ad.id=$3
      WHERE gw.id=$1 AND gw.agency_id=$2 AND ad.status='active'
      ON CONFLICT (workspace_id,agent_id) DO UPDATE SET enabled=EXCLUDED.enabled,autonomy_level=EXCLUDED.autonomy_level,config=EXCLUDED.config,updated_at=now()
      RETURNING *
    `, [id, agencyId, body.agentId, Boolean(body.enabled), autonomy, JSON.stringify(body.config ?? {}), String(body.actorEmail ?? 'admin@webcrew.app')])
    if (!rows[0]) return NextResponse.json({ error: 'Workspace or agent not found' }, { status: 404 })
    await auditPlatform({ agencyId, workspaceId: id, actorEmail: String(body.actorEmail ?? 'admin@webcrew.app'), action: body.enabled ? 'agent.enabled' : 'agent.disabled', entityType: 'agent_installation', entityId: body.agentId, metadata: { autonomy } })
    return NextResponse.json({ installation: rows[0] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 })
  }
}
