export const runtime = "edge"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { Pool } from "@/lib/pool"
import { syncAdPerformance } from "@/lib/ad-reporting"

let _pool: InstanceType<typeof Pool> | null = null
function pool(): InstanceType<typeof Pool> {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return _pool
}

// POST /api/ads/performance/sync — pulls last 30 days of spend/impressions/clicks/conversions
// from Google Ads + Meta for every published campaign and upserts into ad_performance_daily.
// Body: { draftId?: string } to sync a single campaign instead of all published ones.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { draftId?: string }
  const results = await syncAdPerformance(pool(), { draftId: body.draftId })
  const ok = results.every((r) => r.ok)
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 207 })
}
