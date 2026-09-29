export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import { createMagicToken, getLeadByStripeSessionId } from "@/lib/db"

// Lets the webcrew.app /thank-you page carry a just-paid customer straight
// into their dashboard without retyping their email. session_id is Stripe's
// own opaque, unguessable checkout session id — handed only to the browser
// that completed that specific checkout (same trust boundary Stripe's own
// success-page redirect relies on). We still only ever return a fresh,
// single-use, short-TTL magic token (same as the manual login-form path) —
// never a standing credential — and only once the webhook has actually
// finished provisioning (handed_off = true), so this can't race ahead of
// account setup.
const ALLOWED_ORIGINS = new Set([
  "https://webcrew.app",
  "http://localhost:3002",
  "http://localhost:3001", // Next.js falls back here when 3002 is already taken locally
])

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://webcrew.app"
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) })
}

export async function GET(req: NextRequest) {
  const headers = corsHeaders(req.headers.get("origin"))
  const sessionId = req.nextUrl.searchParams.get("session_id")
  if (!sessionId) {
    return NextResponse.json({ error: "session_id required" }, { status: 400, headers })
  }

  try {
    const lead = await getLeadByStripeSessionId(sessionId)
    if (!lead || !lead.handedOff || !lead.email) {
      return NextResponse.json({ status: "pending" }, { headers })
    }

    const token = await createMagicToken(lead.email)
    const base = process.env.ADMIN_URL || process.env.NEXT_PUBLIC_URL || "http://localhost:3010"
    return NextResponse.json({ status: "ready", authUrl: `${base}/client/auth/${token}` }, { headers })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers })
  }
}
