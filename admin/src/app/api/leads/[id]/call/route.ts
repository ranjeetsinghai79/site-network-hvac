export const runtime = "edge"

import { NextRequest, NextResponse } from "next/server"
import { updateCallTracking } from "@/lib/db"

const TWILIO_SID    = process.env.TWILIO_ACCOUNT_SID ?? ""
const TWILIO_TOKEN  = process.env.TWILIO_AUTH_TOKEN  ?? ""
const TWILIO_FROM   = process.env.TWILIO_FROM_NUMBER ?? ""
const ADMIN_URL     = process.env.ADMIN_URL ?? "https://webcrew-admin.pages.dev"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.json() as { phone: string; name: string; siteUrl?: string }

  if (!body.phone) return NextResponse.json({ error: "No phone" }, { status: 400 })
  if (!TWILIO_SID || !TWILIO_TOKEN) {
    return NextResponse.json({ error: "Twilio not configured" }, { status: 500 })
  }

  const twimlUrl = new URL(`${ADMIN_URL}/api/webhooks/voice`)
  twimlUrl.searchParams.set("leadId", id)
  twimlUrl.searchParams.set("name",   encodeURIComponent(body.name))
  twimlUrl.searchParams.set("site",   encodeURIComponent(body.siteUrl ?? ""))

  const statusUrl = new URL(`${ADMIN_URL}/api/webhooks/voice-status`)
  statusUrl.searchParams.set("leadId", id)

  const form = new URLSearchParams({
    To:                   body.phone,
    From:                 TWILIO_FROM,
    Url:                  twimlUrl.toString(),
    StatusCallback:       statusUrl.toString(),
    StatusCallbackMethod: "POST",
    Timeout:              "30",
  })

  const creds = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls.json`,
    {
      method:  "POST",
      headers: {
        Authorization:  `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    },
  )

  const data = await res.json() as { sid?: string; message?: string }
  if (!res.ok) {
    return NextResponse.json({ error: data.message ?? "Twilio error" }, { status: 502 })
  }

  await updateCallTracking(id, data.sid!, "initiated")
  return NextResponse.json({ ok: true, callSid: data.sid })
}
