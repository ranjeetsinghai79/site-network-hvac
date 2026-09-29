export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformContext } from '@/lib/platform-auth'
import { auditPlatform, platformPool } from '@/lib/platform-control'

export async function GET() {
  try {
    const context = await requirePlatformContext()
    const { rows } = await platformPool().query(`
      SELECT ar.id,ar.agent_id,ad.name AS agent_name,ar.input,ar.created_at,gw.id AS workspace_id,gw.business_name
      FROM automation_runs ar JOIN growth_workspaces gw ON gw.id=ar.workspace_id LEFT JOIN agent_definitions ad ON ad.id=ar.agent_id
      WHERE gw.agency_id=$1 AND ar.status='needs_approval' ORDER BY ar.created_at
    `, [context.agencyId])
    return NextResponse.json({ approvals: rows })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requirePlatformContext(['owner','approver'])
    const body = await request.json()
    if (!body.runId || !['approve','reject'].includes(body.action)) return NextResponse.json({ error: 'Invalid approval' }, { status: 400 })
    const client = await platformPool().connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query(`SELECT ar.workspace_id FROM automation_runs ar JOIN growth_workspaces gw ON gw.id=ar.workspace_id WHERE ar.id=$1 AND gw.agency_id=$2 AND ar.status='needs_approval' FOR UPDATE`, [body.runId, context.agencyId])
      if (!rows[0]) throw new Error('Approval not found')
      const event = await client.query(`INSERT INTO approval_events (workspace_id,entity_type,entity_id,action,actor_email,notes) VALUES ($1,'run',$2,$3,$4,$5) RETURNING id`, [rows[0].workspace_id, body.runId, body.action, context.email, body.notes ?? null])
      await client.query(`UPDATE automation_runs SET status=$2,approval_event_id=$3,next_attempt_at=now(),updated_at=now() WHERE id=$1`, [body.runId, body.action==='approve'?'queued':'rejected', event.rows[0].id])
      await client.query('COMMIT')
      await auditPlatform({ agencyId: context.agencyId, workspaceId: rows[0].workspace_id, actorEmail: context.email, actorRole: context.role, action: `automation.${body.action}`, entityType: 'automation_run', entityId: body.runId })
      return NextResponse.json({ ok: true })
    } catch (error) {
      await client.query('ROLLBACK'); throw error
    } finally { client.release() }
  } catch (error) {
    const message=error instanceof Error?error.message:String(error)
    return NextResponse.json({ error: message }, { status: message==='FORBIDDEN'?403:message==='UNAUTHORIZED'?401:400 })
  }
}
