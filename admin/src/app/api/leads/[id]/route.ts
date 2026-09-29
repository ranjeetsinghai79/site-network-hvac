export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import {
  setLeadTier,
  setLeadStatus,
  markLeadPaid,
  resetLeadForRebuild,
  deleteLead,
  setLeadEmail,
  getLeadById,
  requestGscVerify,
} from "@/lib/db"

async function triggerOutreach(leadId: string, type: "sms" | "email" | "both") {
  const triggerUrl = process.env.PIPELINE_TRIGGER_URL
  if (!triggerUrl) return
  await fetch(`${triggerUrl}/outreach`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${process.env.PIPELINE_TRIGGER_SECRET ?? ""}`,
    },
    body: JSON.stringify({ leadId, type }),
  }).catch(() => {})
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const lead = await getLeadById(id)
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(lead)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  try {
    if (body.action === "set_tier" && body.tier) {
      await setLeadTier(id, body.tier)
      return NextResponse.json({ ok: true })
    }
    if (body.action === "set_status" && body.status) {
      await setLeadStatus(id, body.status)
      return NextResponse.json({ ok: true })
    }
    if (body.action === "mark_paid") {
      await markLeadPaid(id)
      return NextResponse.json({ ok: true })
    }
    if (body.action === "set_email") {
      await setLeadEmail(id, body.email ?? "")
      return NextResponse.json({ ok: true })
    }
    if (body.action === "rebuild") {
      await resetLeadForRebuild(id)
      return NextResponse.json({ ok: true, message: "Reset to analyzed" })
    }
    if (body.action === "send_sms") {
      await triggerOutreach(id, "sms")
      return NextResponse.json({ ok: true, message: "SMS queued" })
    }
    if (body.action === "send_email") {
      await triggerOutreach(id, "email")
      return NextResponse.json({ ok: true, message: "Email queued" })
    }
    if (body.action === "trigger_gsc") {
      await requestGscVerify(id)
      return NextResponse.json({ ok: true, message: "GSC verification queued (picks up within ~2min)" })
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await deleteLead(id)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
