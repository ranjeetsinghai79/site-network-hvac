"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Users } from "lucide-react"

export interface PipelineRow {
  id: string
  name: string | null
  phone: string | null
  title: string | null
  intent: string | null
  urgency: string | null
  stage: string
  booking_start: string | null
  created_at: string
}

const STAGE: Record<string, { label: string; color: string; bg: string }> = {
  new:                { label: "Needs callback", color: "#B45309", bg: "rgba(245,158,11,0.14)" },
  callback_requested: { label: "Needs callback", color: "#B45309", bg: "rgba(245,158,11,0.14)" },
  escalated:          { label: "Transferred",    color: "#B45309", bg: "rgba(245,158,11,0.14)" },
  booked:             { label: "Booked",         color: "#047857", bg: "rgba(16,185,129,0.12)" },
  contacted:          { label: "Contacted",      color: "#0369A1", bg: "rgba(14,165,233,0.12)" },
  won:                { label: "Won",            color: "#047857", bg: "rgba(16,185,129,0.18)" },
  lost:               { label: "Lost",           color: "#6B7280", bg: "rgba(107,114,128,0.14)" },
  cancelled:          { label: "Cancelled",      color: "#6B7280", bg: "rgba(107,114,128,0.14)" },
}
const INTENT: Record<string, string> = {
  new_lead: "New customer", existing_customer: "Existing customer", appointment_booking: "Booking",
  appointment_change: "Appointment change", general_inquiry: "Question", emergency: "Emergency",
}
const OPEN = new Set(["new", "callback_requested", "escalated"])

const pretty = (n: string | null) => (n ? n.replace(/^\+?1?(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : "Unknown number")
function ago(iso: string) {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.round(m / 60)}h ago`
  return `${Math.round(m / 1440)}d ago`
}

const TABS = [
  { key: "all", label: "All", test: () => true },
  { key: "open", label: "Needs callback", test: (r: PipelineRow) => OPEN.has(r.stage) },
  { key: "booked", label: "Booked", test: (r: PipelineRow) => r.stage === "booked" },
  { key: "done", label: "Done", test: (r: PipelineRow) => ["contacted", "won", "lost", "cancelled"].includes(r.stage) },
] as const

export function ClientPipeline({ rows, title = "Leads from your calls", footer, tabs = false }: { rows: PipelineRow[]; title?: string; footer?: ReactNode; tabs?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const needs = rows.filter(r => OPEN.has(r.stage)).length
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all")
  const visible = rows.filter(TABS.find(t => t.key === tab)!.test)

  async function move(id: string, stage: "contacted" | "won" | "lost") {
    setBusy(id); setError(null)
    const res = await fetch("/api/client/opportunity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, stage }) })
    setBusy(null)
    if (res.ok) router.refresh(); else setError("Could not update that lead. Try again.")
  }

  const btn = (primary: boolean) => ({
    fontSize: 12, fontWeight: 700, borderRadius: 7, padding: "5px 11px", cursor: "pointer",
    border: primary ? "none" : "1px solid var(--border-2)", color: primary ? "#fff" : "var(--text-2)",
    background: primary ? "var(--accent)" : "var(--bg)",
  }) as const

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "22px 28px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <Users size={16} color="var(--accent-light)" />
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{title}</span>
        {needs > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#B45309", background: "rgba(245,158,11,0.14)", borderRadius: 20, padding: "2px 9px" }}>{needs} need a callback</span>}
      </div>
      {tabs && (
        <div role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {TABS.map(t => {
            const n = rows.filter(t.test).length
            return (
              <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                style={{ fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "6px 13px", cursor: "pointer", border: "1px solid var(--border-2)",
                  color: tab === t.key ? "#fff" : "var(--text-2)", background: tab === t.key ? "var(--accent)" : "var(--bg)" }}>
                {t.label} <span style={{ opacity: 0.75 }}>{n}</span>
              </button>
            )
          })}
        </div>
      )}
      {error && <div role="alert" style={{ fontSize: 12, color: "#B91C1C", marginBottom: 10 }}>{error}</div>}
      {visible.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)", padding: "18px 0", textAlign: "center" }}>Nothing here.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map(r => {
          const st = STAGE[r.stage] ?? STAGE.new
          const open = OPEN.has(r.stage)
          const urgent = r.urgency === "urgent" || r.urgency === "emergency"
          return (
            <div key={r.id} style={{ background: "var(--surface-2)", border: `1px solid ${open && urgent ? "rgba(245,158,11,0.5)" : "var(--border)"}`, borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{r.name || "Caller"}</span>
                {r.phone && <a href={`tel:${r.phone}`} style={{ fontSize: 12, color: "var(--accent-light)", fontWeight: 600, textDecoration: "none" }}>{pretty(r.phone)}</a>}
                <span style={{ fontSize: 10, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 4, padding: "2px 7px" }}>{st.label.toUpperCase()}</span>
                {urgent && <span style={{ fontSize: 10, fontWeight: 700, color: "#B91C1C", background: "rgba(220,38,38,0.1)", borderRadius: 4, padding: "2px 7px" }}>{r.urgency!.toUpperCase()}</span>}
                {r.intent && INTENT[r.intent] && <span style={{ fontSize: 11, color: "var(--muted)" }}>{INTENT[r.intent]}</span>}
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>{ago(r.created_at)}</span>
              </div>
              {r.title && <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: open || r.stage === "booked" ? 8 : 0 }}>{r.title}</div>}
              {r.stage === "booked" && r.booking_start && (
                <div style={{ fontSize: 12, color: "#047857", fontWeight: 600, marginBottom: 8 }}>
                  {new Date(r.booking_start).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </div>
              )}
              {(open || r.stage === "booked" || r.stage === "contacted") && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {open && <button disabled={busy === r.id} onClick={() => move(r.id, "contacted")} style={btn(true)}>Called back</button>}
                  <button disabled={busy === r.id} onClick={() => move(r.id, "won")} style={btn(false)}>Won</button>
                  <button disabled={busy === r.id} onClick={() => move(r.id, "lost")} style={btn(false)}>Lost</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {footer && <div style={{ marginTop: 14 }}>{footer}</div>}
    </div>
  )
}
