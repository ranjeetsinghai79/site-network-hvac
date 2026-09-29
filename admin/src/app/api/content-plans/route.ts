export const runtime = "edge"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { Pool } from "@/lib/pool"

let _pool: InstanceType<typeof Pool> | null = null
function pool(): InstanceType<typeof Pool> {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return _pool
}

const TIER_DEFAULTS: Record<string, { reels: number; carousels: number; images: number; period: string }> = {
  weekly_lite:   { reels: 1, carousels: 1, images: 2, period: "week" },
  daily_premium: { reels: 3, carousels: 1, images: 1, period: "day" },
}

export async function GET() {
  const { rows } = await pool().query(
    `SELECT cp.*, gw.business_name
     FROM content_cadence_plans cp
     JOIN growth_workspaces gw ON gw.id = cp.workspace_id
     ORDER BY cp.updated_at DESC`
  )
  return NextResponse.json({ plans: rows })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    workspaceId?: string
    tier?: "weekly_lite" | "daily_premium"
    channels?: string[]
    active?: boolean
  }
  if (!body.workspaceId || !body.tier || !TIER_DEFAULTS[body.tier]) {
    return NextResponse.json({ error: "workspaceId and a valid tier are required" }, { status: 400 })
  }
  const defaults = TIER_DEFAULTS[body.tier]
  const channels = body.channels?.length ? body.channels : ["instagram", "facebook"]

  const { rows } = await pool().query(
    `INSERT INTO content_cadence_plans (workspace_id, tier, channels, reels_per_period, carousels_per_period, images_per_period, period, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (workspace_id) DO UPDATE SET
       tier = EXCLUDED.tier,
       channels = EXCLUDED.channels,
       reels_per_period = EXCLUDED.reels_per_period,
       carousels_per_period = EXCLUDED.carousels_per_period,
       images_per_period = EXCLUDED.images_per_period,
       period = EXCLUDED.period,
       active = EXCLUDED.active,
       updated_at = now()
     RETURNING *`,
    [body.workspaceId, body.tier, channels, defaults.reels, defaults.carousels, defaults.images, defaults.period, body.active !== false]
  )
  return NextResponse.json({ plan: rows[0] })
}
