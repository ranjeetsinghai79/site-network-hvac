export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import { requireClient } from "@/lib/client-auth"
import { getClientLead, getClientReception, setClientCalendarSettings } from "@/lib/db"

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

// The reception server clamps these again on read; this keeps junk out of the database.
export async function POST(req: NextRequest) {
  const email = await requireClient()
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 })

  const body = await req.json().catch(() => ({})) as any
  const durationMin = Number(body.durationMin)
  if (![30, 45, 60, 90, 120].includes(durationMin)) return NextResponse.json({ error: "Pick an appointment length." }, { status: 400 })
  const hours: Record<string, [string, string] | null> = {}
  for (const d of DAYS) {
    const h = body.hours?.[d]
    if (h === null || h === undefined) { hours[d] = null; continue }
    if (!Array.isArray(h) || !HHMM.test(h[0]) || !HHMM.test(h[1]) || h[0] >= h[1]) return NextResponse.json({ error: "Opening time must be before closing time." }, { status: 400 })
    hours[d] = [h[0], h[1]]
  }
  if (!Object.values(hours).some(Boolean)) return NextResponse.json({ error: "Choose at least one day the AI can book." }, { status: 400 })

  const lead = await getClientLead(email)
  const reception = lead ? await getClientReception(lead.id) : null
  if (!reception) return NextResponse.json({ error: "No receptionist on this account" }, { status: 404 })
  await setClientCalendarSettings(reception.configId, { durationMin, hours, leadTimeHours: 2, bufferMin: 0 })
  return NextResponse.json({ ok: true })
}
