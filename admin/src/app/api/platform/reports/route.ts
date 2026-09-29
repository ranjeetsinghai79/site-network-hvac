export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { auditPlatform, defaultAgencyId, platformPool } from '@/lib/platform-control'

export async function GET(request: NextRequest) {
  try {
    const agencyId = await defaultAgencyId()
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')
    const { rows } = await platformPool().query(`
      SELECT gw.id AS workspace_id,gw.business_name,gw.service_tier,
        COUNT(DISTINCT oe.id) FILTER (WHERE oe.event_type='lead') AS leads,
        COUNT(DISTINCT oe.id) FILTER (WHERE oe.event_type='appointment') AS appointments,
        COUNT(DISTINCT oe.id) FILTER (WHERE oe.event_type='call') AS calls,
        COUNT(DISTINCT oe.id) FILTER (WHERE oe.event_type='review') AS reviews,
        COALESCE(SUM(oe.value_usd),0) AS attributed_revenue,
        COALESCE((SELECT SUM(ue.cost_usd) FROM usage_events ue WHERE ue.workspace_id=gw.id AND ue.occurred_at>now()-interval '30 days'),0) AS cost_30d,
        COALESCE((SELECT SUM(ue.billable_usd) FROM usage_events ue WHERE ue.workspace_id=gw.id AND ue.occurred_at>now()-interval '30 days'),0) AS billable_usage_30d,
        (SELECT COUNT(*) FROM automation_runs ar WHERE ar.workspace_id=gw.id AND ar.status='completed' AND ar.created_at>now()-interval '30 days') AS completed_runs_30d
      FROM growth_workspaces gw LEFT JOIN outcome_events oe ON oe.workspace_id=gw.id AND oe.occurred_at>now()-interval '30 days'
      WHERE gw.agency_id=$1 AND ($2::uuid IS NULL OR gw.id=$2)
      GROUP BY gw.id ORDER BY gw.business_name
    `, [agencyId, workspaceId])
    return NextResponse.json({ period: '30d', reports: rows })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const agencyId = await defaultAgencyId()
    const body = await request.json()
    const allowed = ['lead','appointment','call','review','pipeline','revenue','conversion']
    if (!body.workspaceId || !allowed.includes(body.eventType)) return NextResponse.json({ error: 'Valid workspaceId and eventType required' }, { status: 400 })
    const { rows } = await platformPool().query(`
      INSERT INTO outcome_events (agency_id,workspace_id,event_type,source,quantity,value_usd,external_id,metadata,occurred_at)
      SELECT $1,gw.id,$3,$4,$5,$6,$7,$8,COALESCE($9,now()) FROM growth_workspaces gw
      WHERE gw.id=$2 AND gw.agency_id=$1 RETURNING *
    `, [agencyId, body.workspaceId, body.eventType, String(body.source ?? 'manual'), Number(body.quantity ?? 1), body.valueUsd == null ? null : Number(body.valueUsd), body.externalId ?? null, JSON.stringify(body.metadata ?? {}), body.occurredAt ?? null])
    if (!rows[0]) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    await auditPlatform({ agencyId, workspaceId: body.workspaceId, actorEmail: String(body.actorEmail ?? 'admin@webcrew.app'), action: 'outcome.recorded', entityType: 'outcome_event', entityId: rows[0].id, metadata: { eventType: body.eventType } })
    return NextResponse.json({ outcome: rows[0] }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 })
  }
}
