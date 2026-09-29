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
  const provider = searchParams.get("provider")
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 250)
  const params: unknown[] = []
  const conditions: string[] = []
  if (status) {
    params.push(status)
    conditions.push(`va.status = $${params.length}`)
  }
  if (provider) {
    params.push(provider)
    conditions.push(`va.provider = $${params.length}`)
  }
  params.push(limit)
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  const { rows } = await pool().query(
    `SELECT va.*, gw.business_name
     FROM video_assets va
     LEFT JOIN growth_workspaces gw ON gw.id = va.workspace_id
     ${where}
     ORDER BY va.created_at DESC
     LIMIT $${params.length}`,
    params
  )
  return NextResponse.json({ assets: rows })
}
