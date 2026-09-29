export const runtime = "edge"

import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"

async function sendSms(to: string, body: string, env: { sid: string; token: string; from: string }) {
  const digits = to.replace(/\D/g, "")
  if (digits.length < 10) throw new Error("Invalid phone number")
  const e164 = digits.startsWith("1") ? `+${digits}` : `+1${digits}`

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${env.sid}:${env.token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: e164, From: env.from, Body: body }).toString(),
    }
  )
  const data = await res.json() as any
  if (!res.ok) throw new Error(data.message ?? `Twilio error ${res.status}`)
  return { sid: data.sid, to: e164 }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from  = process.env.TWILIO_FROM_NUMBER
  if (!sid || !token || !from) {
    return NextResponse.json({ error: "Twilio credentials not configured" }, { status: 500 })
  }

  const { id } = await params
  const body   = await req.json() as { message: string }
  if (!body.message?.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 })
  }

  const db = await getDb()
  const { rows } = await db.query(`SELECT id, name, phone, sms_opt_out FROM leads WHERE id = $1`, [id])
  const lead = rows[0]
  if (!lead)          return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  if (!lead.phone)    return NextResponse.json({ error: "Lead has no phone number" }, { status: 400 })
  if (lead.sms_opt_out) return NextResponse.json({ error: "Lead has opted out of SMS" }, { status: 400 })

  try {
    const result = await sendSms(lead.phone, body.message, { sid, token, from })

    // Log event
    await db.query(
      `INSERT INTO lead_events (lead_id, event_type, detail)
       VALUES ($1, 'sms_sent', $2)
       ON CONFLICT DO NOTHING`,
      [id, JSON.stringify({ body: body.message, twilio_sid: result.sid, to: result.to, source: "admin_manual" })]
    ).catch(() => {})

    return NextResponse.json({ ok: true, sid: result.sid, to: result.to })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
