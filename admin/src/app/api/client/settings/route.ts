export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import { requireClient } from "@/lib/client-auth"
import { getClientLead, getClientReception, setClientTransferPhone } from "@/lib/db"

// US numbers only for now (the receptionist and Twilio numbers are US).
function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "")
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits
  return ten.length === 10 && /^[2-9]/.test(ten) ? `+1${ten}` : null
}

export async function POST(req: NextRequest) {
  const email = await requireClient()
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 })

  const { transferPhone } = await req.json().catch(() => ({}))
  const phone = typeof transferPhone === "string" ? toE164(transferPhone) : null
  if (!phone) return NextResponse.json({ error: "Enter a valid 10-digit US phone number." }, { status: 400 })

  const lead = await getClientLead(email)
  const reception = lead ? await getClientReception(lead.id) : null
  if (!reception) return NextResponse.json({ error: "No receptionist on this account" }, { status: 404 })

  const result = await setClientTransferPhone(reception.configId, phone)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true, transferPhone: phone })
}
