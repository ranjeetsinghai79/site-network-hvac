export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import { Pool } from "@/lib/pool"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, businessName, niche, city, sendOutreach } = body

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url required" }, { status: 400 })
    }

    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith("http")) normalizedUrl = `https://${normalizedUrl}`

    const triggerUrl = process.env.PIPELINE_TRIGGER_URL
    if (!triggerUrl) {
      return NextResponse.json({
        ok:      true,
        message: `Audit queued for ${normalizedUrl} — runs on next GCP cycle`,
      })
    }

    const res = await fetch(`${triggerUrl}/audit`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${process.env.PIPELINE_TRIGGER_SECRET ?? ""}`,
      },
      body: JSON.stringify({ url: normalizedUrl, businessName, niche, city, sendOutreach }),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Trigger failed: ${res.status}` }, { status: 502 })
    }

    return NextResponse.json({
      ok:      true,
      message: `Audit started for ${normalizedUrl}. Check Audits page in ~60s.`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

let _pool: InstanceType<typeof Pool> | null = null
function pool(): InstanceType<typeof Pool> {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return _pool
}

export async function GET() {
  try {
    const { rows } = await pool().query(
      `SELECT id, website_url, business_name, niche, overall_score, created_at, report_viewed, outreach_sent
       FROM audits ORDER BY created_at DESC LIMIT 50`
    )
    return NextResponse.json({ audits: rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
