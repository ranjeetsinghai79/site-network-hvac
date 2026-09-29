export const runtime = "edge"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { Pool } from "@/lib/pool"

let _pool: InstanceType<typeof Pool> | null = null
function pool(): InstanceType<typeof Pool> {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return _pool
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const platform = searchParams.get("platform")
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 250)

  const params: unknown[] = []
  const conditions: string[] = []
  if (status) {
    params.push(status)
    conditions.push(`sa.status = $${params.length}`)
  }
  if (platform) {
    params.push(platform)
    conditions.push(`sa.platform = $${params.length}`)
  }
  params.push(limit)

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
  const { rows } = await pool().query(
    `SELECT sa.id, sa.workspace_id, sa.lead_id, sa.asset_type, sa.platform, sa.status,
            sa.title, sa.caption, sa.slides, sa.image_prompts, sa.hashtags,
            sa.approval_notes, sa.scheduled_for, sa.published_at, sa.created_at,
            sa.compliance_warnings,
            sa.external_id, sa.asset_url, sa.publish_payload, sa.publish_error,
            gw.business_name
     FROM social_assets sa
     LEFT JOIN growth_workspaces gw ON gw.id = sa.workspace_id
     ${where}
     ORDER BY sa.created_at DESC
     LIMIT $${params.length}`,
    params
  )

  return NextResponse.json({ assets: rows })
}
