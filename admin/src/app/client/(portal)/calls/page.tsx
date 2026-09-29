export const runtime = 'edge'
import { redirect } from "next/navigation"
import { Play } from "lucide-react"
import { loadPortal, prettyPhone, tidyTranscript } from "@/lib/client-portal"
import { getClientCallLogs } from "@/lib/db"
import { PageHeader, Card, Chip, Empty, ButtonLink } from "@/components/portal-ui"

export const dynamic = "force-dynamic"

const OUTCOME: Record<string, string> = { appointment_booked: "Booked", appointment_rescheduled: "Rescheduled", appointment_cancelled: "Cancelled", message_taken: "Message taken", escalated_to_human: "Transferred to you" }
const INTENT: Record<string, string> = { new_lead: "New customer", existing_customer: "Existing customer", appointment_booking: "Booking", appointment_change: "Appointment change", general_inquiry: "Question", emergency: "Emergency", vendor_sales: "Sales call", spam_or_wrong_number: "Wrong number / spam" }
const FILTERS = [
  { key: "all", label: "All" }, { key: "booked", label: "Booked" }, { key: "messages", label: "Messages" }, { key: "urgent", label: "Urgent" }, { key: "filtered", label: "Filtered" },
] as const

export default async function CallsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f = "all" } = await searchParams
  const p = await loadPortal()
  if (!p.reception) redirect("/client/dashboard")
  const all = await getClientCallLogs(p.lead.id, 100, p.reception.configId)
  const calls = all.filter(c =>
    f === "booked" ? c.booked : f === "messages" ? !!c.message_taken : f === "urgent" ? (c.urgency === "urgent" || c.urgency === "emergency") : f === "filtered" ? c.is_spam : true)

  return (
    <>
      <PageHeader title="Calls" subtitle="Every call your AI receptionist answered, with a plain-English summary." />
      <div role="navigation" aria-label="Filter calls" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {FILTERS.map(x => (
          <a key={x.key} href={`/client/calls?f=${x.key}`} aria-current={f === x.key ? "page" : undefined}
            style={{ fontSize: 12, fontWeight: 700, textDecoration: "none", borderRadius: 20, padding: "6px 13px", border: "1px solid var(--border-2)", color: f === x.key ? "#fff" : "var(--text-2)", background: f === x.key ? "var(--accent)" : "var(--bg)" }}>{x.label}</a>
        ))}
      </div>
      {calls.length === 0 ? (
        <Card pad={false}><Empty title={all.length ? "No calls match this filter" : "No calls yet"} body={all.length ? "Try another filter." : "Forward your business number to your AI number and calls will appear here within a minute."} action={!all.length ? <ButtonLink href="/client/receptionist" primary>Set up forwarding</ButtonLink> : undefined} /></Card>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {calls.map(c => {
            const m = Math.floor(c.duration_seconds / 60), sec = c.duration_seconds % 60
            const when = new Date(c.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: p.reception!.timezone ?? undefined })
            const urgent = c.urgency === "urgent" || c.urgency === "emergency"
            const outcome = OUTCOME[c.route ?? ""]
            return (
              <article key={c.id} style={{ background: "var(--surface)", border: `1px solid ${urgent ? "rgba(245,158,11,0.5)" : "var(--border)"}`, borderRadius: 12, padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{prettyPhone(c.caller_number)}</span>
                  {c.booked && <Chip tone="good">Booked</Chip>}
                  {outcome && !c.booked && <Chip tone={c.escalated ? "warn" : "neutral"}>{outcome}</Chip>}
                  {urgent && <Chip tone="bad">{c.urgency}</Chip>}
                  {c.intent && INTENT[c.intent] && <span style={{ fontSize: 12, color: "var(--muted)" }}>{INTENT[c.intent]}</span>}
                  {c.is_spam && !c.intent && <Chip>Short call</Chip>}
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>{when} · {m > 0 ? `${m}m ` : ""}{sec}s</span>
                </div>
                {c.summary && <p style={{ fontSize: 13, color: "var(--text-2)", margin: "8px 0 0", lineHeight: 1.55 }}>{c.summary}</p>}
                {c.message_taken && <p style={{ fontSize: 13, color: "var(--text)", margin: "8px 0 0", lineHeight: 1.5, background: "var(--surface-2)", borderRadius: 8, padding: "8px 12px" }}><strong>Message:</strong> {c.message_taken}</p>}
                <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                  {c.recording_url && <a href={c.recording_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "var(--accent-light)", textDecoration: "none" }}><Play size={12} /> Listen</a>}
                  {c.transcript && (
                    <details style={{ flex: 1, minWidth: 220 }}>
                      <summary style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", cursor: "pointer" }}>Full transcript</summary>
                      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12, color: "var(--text-2)", lineHeight: 1.6, margin: "8px 0 0", maxHeight: 280, overflow: "auto" }}>{tidyTranscript(c.transcript)}</pre>
                    </details>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
