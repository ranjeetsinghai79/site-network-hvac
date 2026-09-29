export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { auditPlatform, defaultAgencyId, platformPool } from '@/lib/platform-control'

export async function GET(request: NextRequest) {
  try {
    const agencyId = await defaultAgencyId()
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')
    const { rows } = await platformPool().query(`
      SELECT ar.*,gw.business_name,ad.name AS agent_name,ad.risk_level
      FROM automation_runs ar JOIN growth_workspaces gw ON gw.id=ar.workspace_id LEFT JOIN agent_definitions ad ON ad.id=ar.agent_id
      WHERE gw.agency_id=$1 AND ($2::uuid IS NULL OR gw.id=$2) ORDER BY ar.created_at DESC LIMIT 200
    `, [agencyId, workspaceId])
    return NextResponse.json({ runs: rows })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const agencyId = await defaultAgencyId()
    const body = await request.json()
    if (!body.workspaceId || !body.agentId) return NextResponse.json({ error: 'workspaceId and agentId required' }, { status: 400 })
    if (body.intervalMinutes) {
      const interval = Math.max(15, Math.min(525600, Number(body.intervalMinutes)))
      const { rows } = await platformPool().query(`
        INSERT INTO automation_schedules (workspace_id,agent_id,trigger_type,interval_minutes,requires_approval,input,next_run_at,created_by)
        SELECT gw.id,ad.id,$3,$4,ad.default_requires_approval,$5,COALESCE($6,now()+($4||' minutes')::interval),$7
        FROM growth_workspaces gw JOIN agent_definitions ad ON ad.id=$2 JOIN workspace_agent_installations wai ON wai.workspace_id=gw.id AND wai.agent_id=ad.id AND wai.enabled
        WHERE gw.id=$1 AND gw.agency_id=$8
        ON CONFLICT (workspace_id,agent_id,trigger_type) DO UPDATE SET interval_minutes=EXCLUDED.interval_minutes,enabled=true,input=EXCLUDED.input,next_run_at=EXCLUDED.next_run_at,updated_at=now()
        RETURNING *
      `,[body.workspaceId,body.agentId,String(body.triggerType??'scheduled'),interval,JSON.stringify(body.input??{}),body.scheduledFor??null,String(body.actorEmail??'admin@webcrew.app'),agencyId])
      if(!rows[0])return NextResponse.json({error:'Agent is not installed for this workspace'},{status:400})
      return NextResponse.json({schedule:rows[0]},{status:201})
    }
    const { rows } = await platformPool().query(`
      INSERT INTO automation_runs (workspace_id,agent_id,trigger_type,status,requires_approval,idempotency_key,input,scheduled_for)
      SELECT gw.id,ad.id,$3,'queued',ad.default_requires_approval,$4,$5,$6
      FROM growth_workspaces gw JOIN agent_definitions ad ON ad.id=$2
      JOIN workspace_agent_installations wai ON wai.workspace_id=gw.id AND wai.agent_id=ad.id AND wai.enabled
      WHERE gw.id=$1 AND gw.agency_id=$7
      ON CONFLICT (workspace_id,idempotency_key) WHERE idempotency_key IS NOT NULL DO UPDATE SET updated_at=now()
      RETURNING *
    `, [body.workspaceId, body.agentId, String(body.triggerType ?? 'manual'), body.idempotencyKey ?? `manual:${body.workspaceId}:${body.agentId}:${Date.now()}`, JSON.stringify(body.input ?? {}), body.scheduledFor ?? null, agencyId])
    if (!rows[0]) return NextResponse.json({ error: 'Agent is not installed for this workspace' }, { status: 400 })
    await auditPlatform({ agencyId, workspaceId: body.workspaceId, actorEmail: String(body.actorEmail ?? 'admin@webcrew.app'), action: 'automation.queued', entityType: 'automation_run', entityId: rows[0].id, metadata: { agentId: body.agentId } })
    return NextResponse.json({ run: rows[0] }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const agencyId = await defaultAgencyId()
    const body = await request.json()
    const action = String(body.action ?? '')
    if (!body.runId || !['retry','cancel'].includes(action)) return NextResponse.json({ error: 'Invalid run action' }, { status: 400 })
    const status = action === 'retry' ? 'queued' : 'cancelled'
    const { rows } = await platformPool().query(`
      UPDATE automation_runs ar SET status=$3,error=NULL,next_attempt_at=now(),locked_at=NULL,locked_by=NULL,updated_at=now()
      FROM growth_workspaces gw WHERE ar.id=$1 AND gw.id=ar.workspace_id AND gw.agency_id=$2 RETURNING ar.*
    `, [body.runId, agencyId, status])
    if (!rows[0]) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    return NextResponse.json({ run: rows[0] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 })
  }
}
