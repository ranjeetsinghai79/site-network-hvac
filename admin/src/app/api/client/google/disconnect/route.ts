export const runtime = 'edge'
import { NextResponse } from "next/server"
import { requireClient } from "@/lib/client-auth"
import { clearGoogleCalendar, getClientLead, getClientReception } from "@/lib/db"
import { decryptToken } from "@/lib/token-crypto"

export async function POST() {
  const email = await requireClient()
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 })
  const lead = await getClientLead(email)
  const reception = lead ? await getClientReception(lead.id) : null
  if (!reception) return NextResponse.json({ error: "No receptionist on this account" }, { status: 404 })

  const enc = await clearGoogleCalendar(reception.configId)
  if (enc) {   // best effort: also tell Google to forget the grant
    try {
      await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: await decryptToken(enc) }).toString() })
    } catch { /* already cleared locally; the owner can also remove access in their Google account */ }
  }
  return NextResponse.json({ ok: true })
}
