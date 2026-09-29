export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import { requireClient } from "@/lib/client-auth"
import { getClientLead, getClientReception, setClientOpportunityStage } from "@/lib/db"

const ALLOWED = ["contacted", "won", "lost"] as const

export async function POST(req: NextRequest) {
  const email = await requireClient()
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 })

  const { id, stage } = await req.json().catch(() => ({}))
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id) || !ALLOWED.includes(stage)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const lead = await getClientLead(email)
  const reception = lead ? await getClientReception(lead.id) : null
  if (!reception) return NextResponse.json({ error: "No receptionist on this account" }, { status: 404 })

  const changed = await setClientOpportunityStage(reception.configId, id, stage)
  return NextResponse.json({ ok: true, changed })
}
