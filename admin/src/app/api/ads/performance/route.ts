export const runtime = "edge"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"

// GET /api/ads/performance?draft_id=xxx&days=30
// Returns per-draft totals (spend, impressions, clicks, conversions, CTR, CPL) plus a daily series.
export async function GET(req: NextRequest) {
  const db = await getDb()
  const { searchParams } = new URL(req.url)
  const draftId = searchParams.get("draft_id")
  const days = Math.min(parseInt(searchParams.get("days") ?? "30"), 90)

  const conditions: string[] = [`apd.date >= CURRENT_DATE - $1::int`]
  const params: unknown[] = [days]
  if (draftId) {
    params.push(draftId)
    conditions.push(`apd.draft_id = $${params.length}`)
  }

  const { rows: totals } = await db.query(
    `SELECT
       apd.draft_id,
       acd.platform,
       acd.campaign_name,
       acd.lead_id,
       l.name AS lead_name,
       SUM(apd.impressions)::int AS impressions,
       SUM(apd.clicks)::int AS clicks,
       SUM(apd.spend)::numeric(10,2) AS spend,
       SUM(apd.conversions)::numeric(10,2) AS conversions,
       MAX(apd.fetched_at) AS last_synced_at
     FROM ad_performance_daily apd
     JOIN ad_campaign_drafts acd ON acd.id = apd.draft_id
     LEFT JOIN leads l ON l.id = acd.lead_id
     WHERE ${conditions.join(" AND ")}
     GROUP BY apd.draft_id, acd.platform, acd.campaign_name, acd.lead_id, l.name
     ORDER BY spend DESC`,
    params
  )

  const summary = totals.map((row: any) => {
    const impressions = Number(row.impressions)
    const clicks = Number(row.clicks)
    const spend = Number(row.spend)
    const conversions = Number(row.conversions)
    return {
      ...row,
      impressions,
      clicks,
      spend,
      conversions,
      ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
      cpl: conversions > 0 ? Number((spend / conversions).toFixed(2)) : null,
    }
  })

  if (draftId) {
    const { rows: daily } = await db.query(
      `SELECT date, impressions, clicks, spend, conversions
       FROM ad_performance_daily
       WHERE draft_id = $1 AND date >= CURRENT_DATE - $2::int
       ORDER BY date`,
      [draftId, days]
    )
    return NextResponse.json({ summary: summary[0] ?? null, daily })
  }

  return NextResponse.json({ summary })
}
