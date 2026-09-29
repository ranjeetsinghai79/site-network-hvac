export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// GET /api/ads/drafts?status=needs_approval&lead_id=xxx&limit=50
export async function GET(req: NextRequest) {
  const db = await getDb()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const leadId = searchParams.get('lead_id')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  const conditions: string[] = []
  const params: unknown[] = []

  if (status) {
    params.push(status)
    conditions.push(`acd.status = $${params.length}`)
  }
  if (leadId) {
    params.push(leadId)
    conditions.push(`acd.lead_id = $${params.length}`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  params.push(limit)

  const { rows } = await db.query(
    `SELECT
       acd.id, acd.lead_id, acd.workspace_id, acd.platform, acd.status,
       acd.campaign_name, acd.objective, acd.daily_budget,
       acd.geo_target, acd.audience, acd.keywords, acd.negative_keywords,
       acd.ad_groups, acd.creatives, acd.landing_page_url,
       acd.approval_notes, acd.compliance_warnings,
       acd.external_id, acd.published_at, acd.created_at,
       l.name AS lead_name, l.niche, l.city
     FROM ad_campaign_drafts acd
     LEFT JOIN leads l ON l.id = acd.lead_id
     ${where}
     ORDER BY acd.created_at DESC
     LIMIT $${params.length}`,
    params
  )

  return NextResponse.json({ drafts: rows })
}
