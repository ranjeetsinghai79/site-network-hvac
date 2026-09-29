export const runtime = "edge"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { Pool } from "@/lib/pool"
import { publishApprovedSocialAsset } from "@/lib/social-publisher"

let _pool: InstanceType<typeof Pool> | null = null
function pool(): InstanceType<typeof Pool> {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return _pool
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({})) as { dryRun?: boolean }
  try {
    const result = await publishApprovedSocialAsset(pool(), id, { dryRun: body.dryRun })
    return NextResponse.json(result, { status: result.ok ? 200 : 409 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, mode: "live", blockers: [error instanceof Error ? error.message : "Social publishing failed."] },
      { status: 500 }
    )
  }
}
