export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import { requireClient } from "@/lib/client-auth"
import { getClientLead, getClientReception, setClientWidgetOrigin } from "@/lib/db"

// Sets the site the client's embeddable widget (public/widget.js) is allowed to
// run on. Defaults to deriving from reception_configs.website_url, but a
// self-serve/AI-reception-only client's real site is often a different domain
// than what's on file — this lets them correct it themselves instead of
// needing a manual DB edit.
export async function POST(req: NextRequest) {
  const email = await requireClient()
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 })

  const body = await req.json().catch(() => ({})) as any
  const raw = String(body.origin ?? "").trim()
  if (!raw) return NextResponse.json({ error: "Enter the web address where you'll add the assistant." }, { status: 400 })

  let origin: string
  try {
    const u = new URL(raw)
    if (u.protocol !== "https:") throw new Error("not https")
    origin = u.origin
  } catch {
    return NextResponse.json({ error: "Enter a full web address starting with https://, e.g. https://yourbusiness.com" }, { status: 400 })
  }

  const lead = await getClientLead(email)
  const reception = lead ? await getClientReception(lead.id) : null
  if (!reception) return NextResponse.json({ error: "No receptionist on this account" }, { status: 404 })

  await setClientWidgetOrigin(reception.configId, [origin])
  return NextResponse.json({ ok: true, origin })
}
