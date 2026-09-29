export const runtime = "edge"

import { NextRequest, NextResponse } from "next/server"
import { setCallStatus } from "@/lib/db"

// Twilio posts call status updates here (queued → ringing → in-progress → completed/no-answer/busy/failed)
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const leadId = searchParams.get("leadId") ?? ""

  if (!leadId) return NextResponse.json({ ok: true })

  const form = await req.formData()
  const twilioStatus = form.get("CallStatus")?.toString() ?? ""

  // Map Twilio statuses to our simpler set
  const statusMap: Record<string, string> = {
    "completed":  "answered",
    "no-answer":  "no_answer",
    "busy":       "busy",
    "failed":     "failed",
    "canceled":   "failed",
  }

  const status = statusMap[twilioStatus]
  if (status) await setCallStatus(leadId, status)

  return NextResponse.json({ ok: true })
}
