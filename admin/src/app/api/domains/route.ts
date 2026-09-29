export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import { Pool } from "@/lib/pool"


let _pool: InstanceType<typeof Pool> | null = null
function pool(): InstanceType<typeof Pool> {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return _pool
}

const CF_BASE    = "https://api.cloudflare.com/client/v4"
const CF_TOKEN   = process.env.CLOUDFLARE_TOKEN ?? ""
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID ?? ""

function cfHeaders() {
  return {
    Authorization:  `Bearer ${CF_TOKEN}`,
    "Content-Type": "application/json",
  }
}

// GET /api/domains — list deployed leads with domain info
export async function GET() {
  const { rows } = await pool().query(`
    SELECT id, name, niche, city, state, cloudflare_url, custom_domain, status
    FROM leads
    WHERE cloudflare_url IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 200
  `)
  return NextResponse.json({ leads: rows })
}

// POST /api/domains — connect or check domain
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    action:      "connect" | "check" | "list"
    leadId?:     string
    domain?:     string
    projectName?: string
  }

  if (body.action === "check" && body.domain) {
    // RDAP availability check (free, no API key)
    const tld = body.domain.split(".").slice(1).join(".")
    const rdapUrl = `https://rdap.org/domain/${encodeURIComponent(body.domain)}`
    try {
      const res = await fetch(rdapUrl, { signal: AbortSignal.timeout(5000) })
      if (res.status === 404) {
        return NextResponse.json({ available: true, domain: body.domain })
      }
      if (res.ok) {
        return NextResponse.json({ available: false, domain: body.domain })
      }
      return NextResponse.json({ available: null, error: "RDAP check failed" })
    } catch {
      return NextResponse.json({ available: null, error: "RDAP timeout" })
    }
  }

  if (body.action === "connect" && body.leadId && body.domain && body.projectName) {
    // Add domain to CF Pages project
    const res = await fetch(
      `${CF_BASE}/accounts/${CF_ACCOUNT}/pages/projects/${body.projectName}/domains`,
      {
        method:  "POST",
        headers: cfHeaders(),
        body:    JSON.stringify({ name: body.domain }),
      }
    )
    const data = await res.json() as any

    if (!res.ok) {
      const err = data?.errors?.[0]?.message ?? JSON.stringify(data)
      return NextResponse.json({ success: false, error: err }, { status: 400 })
    }

    // Update DB
    await pool().query(
      `UPDATE leads SET custom_domain = $1 WHERE id = $2`,
      [body.domain, body.leadId]
    )

    const cnameTarget = `${body.projectName}.pages.dev`
    return NextResponse.json({
      success:     true,
      domain:      body.domain,
      cnameTarget,
      status:      data.result?.status ?? "pending_verification",
      instructions: {
        cname: { type: "CNAME", name: body.domain.startsWith("www.") ? "www" : "@", value: cnameTarget },
        bare:  { type: "CNAME", name: "@", value: cnameTarget },
        note:  `SSL auto-provisioned. Live at https://${body.domain} within 15 min of DNS propagation.`,
      },
    })
  }

  if (body.action === "list" && body.projectName) {
    // List existing domains on CF Pages project
    const res = await fetch(
      `${CF_BASE}/accounts/${CF_ACCOUNT}/pages/projects/${body.projectName}/domains`,
      { headers: cfHeaders() }
    )
    const data = await res.json() as any
    return NextResponse.json({ domains: data.result ?? [] })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
