export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// PATCH /api/ads/drafts/[id] — update status (approve / reject / pause)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = await getDb()
  const body = await req.json() as { status: string; notes?: string }

  const allowed = ['approved', 'rejected', 'paused', 'needs_approval']
  if (!allowed.includes(body.status)) {
    return NextResponse.json({ error: `status must be one of: ${allowed.join(', ')}` }, { status: 400 })
  }

  const { rows } = await db.query(
    `UPDATE ad_campaign_drafts
     SET status = $1,
         approval_notes = COALESCE($2, approval_notes),
         updated_at = now()
     WHERE id = $3
     RETURNING id, status, platform, campaign_name`,
    [body.status, body.notes ?? null, id]
  )

  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true, draft: rows[0] })
}

// GET /api/ads/drafts/[id] — get single draft with full detail
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = await getDb()

  const { rows } = await db.query(
    `SELECT
       acd.*,
       l.name AS lead_name, l.niche, l.city, l.cloudflare_url
     FROM ad_campaign_drafts acd
     LEFT JOIN leads l ON l.id = acd.lead_id
     WHERE acd.id = $1`,
    [id]
  )

  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ draft: rows[0] })
}
