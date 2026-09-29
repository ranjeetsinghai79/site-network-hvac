import { cache } from "react"
import { redirect } from "next/navigation"
import { requireClient, hasPassword } from "@/lib/client-auth"
import { getClientLead, getClientReception, getClientCallStats, getClientNavCounts, type Lead, type ClientReception } from "@/lib/db"

export interface Portal {
  email: string
  lead: Lead
  reception: ClientReception | null
  siteUrl: string | null
  hasSite: boolean
  hasCalls: boolean
  nav: { needsCallback: number; upcoming: number }
  setup: { forwarding: boolean; calendar: boolean; transfer: boolean; done: boolean }
}

/** One auth + data load per request, shared by the shell and the page (React cache dedupes). */
export const loadPortal = cache(async (): Promise<Portal> => {
  const email = await requireClient()
  if (!email) redirect("/client/login")
  if (!(await hasPassword(email))) redirect("/client/welcome")   // one-time link sign-ins must create a password first
  const lead = await getClientLead(email)
  if (!lead) redirect("/client/login?error=not-found")

  const reception = await getClientReception(lead.id)
  const [stats, nav] = reception
    ? await Promise.all([getClientCallStats(lead.id, reception.configId), getClientNavCounts(reception.configId)])
    : [null, { needsCallback: 0, upcoming: 0 }]
  const siteUrl = lead.cloudflare_url ?? lead.vercel_url ?? null
  const hasCalls = (stats?.total_all_time ?? 0) > 0
  const setup = {
    forwarding: hasCalls,                                  // first real call proves forwarding works
    calendar: !!reception?.hasCalendar,
    transfer: !!(reception?.transferPhone || lead.phone),
    done: false,
  }
  setup.done = setup.forwarding && setup.calendar && setup.transfer
  return { email, lead, reception, siteUrl, hasSite: !!siteUrl, hasCalls, nav, setup }
})

// Rough average value of one booked job, by niche — used only for the "est. revenue" tile.
export const ROI_PER_BOOKING: Record<string, number> = {
  hvac: 350, roofing: 1500, plumbing: 300, remodeling: 600, dentist: 250,
  medspa: 300, "skin-clinic": 250, "iv-therapy": 180, cleaning: 150,
  landscaping: 200, "auto-detailing": 130, "junk-removal": 200,
  lawfirm: 800, daycare: 100, salon: 80, barbershop: 60,
  restaurant: 60, "nail-studio": 70, "luxury-realestate": 5000,
}

export const prettyPhone = (n: string | null | undefined) => (n ? n.replace(/^\+?1?(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : "Unknown number")

export function timeAgo(iso: string): string {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.round(m / 60)}h ago`
  return `${Math.round(m / 1440)}d ago`
}

/**
 * Stored transcripts were written one speech fragment per line ("AI: Thanks for", "AI:  calling"…).
 * Stitch consecutive fragments from the same speaker back into sentences for display.
 */
export function tidyTranscript(raw: string | null): string {
  if (!raw) return ""
  const out: Array<{ who: string | null; text: string }> = []
  for (const line of raw.split("\n")) {
    const m = line.match(/^(AI|Caller|Visitor): ?([\s\S]*)$/)
    if (!m) { if (line.trim()) out.push({ who: null, text: line.trim() }); continue }
    const label = m[1] === "AI" ? "AI" : "Caller"
    const last = out[out.length - 1]
    if (last && last.who === label) last.text += m[2]
    else out.push({ who: label, text: m[2] })
  }
  return out.map(o => (o.who ? `${o.who}: ${o.text.replace(/\s+/g, " ").trim()}` : o.text)).join("\n")
}
