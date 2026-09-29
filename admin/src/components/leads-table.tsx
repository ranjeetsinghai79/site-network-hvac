"use client"

import { useState, useMemo, useEffect, Fragment } from "react"
import { PaymentModal } from "@/components/payment-modal"
import { BuilderApp }   from "@/components/builder-app"
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  Trash2,
  Phone,
  PhoneCall,
  Mail,
  Globe,
  Github,
  Star,
  CheckCircle,
  ArrowUpDown,
  Save,
  Hammer,
  MessageSquare,
  Send,
  Wifi,
  WifiOff,
  Eye,
  MousePointerClick,
  PhoneIncoming,
  CalendarCheck,
  AlertTriangle,
  Activity,
  CreditCard,
} from "lucide-react"
import type { Lead } from "@/lib/db"

const ALL_STATUSES = [
  "found", "scored", "analyzed", "config_generated", "built",
  "deployed", "outreach_sent", "sms_sent", "conversation_active",
  "meeting_scheduled", "payment_link_sent", "paid", "handed_off",
  "skipped", "error",
]

const STATUS_COLOR: Record<string, string> = {
  found: "#64748b", scored: "#64748b", analyzed: "#64748b", config_generated: "#64748b",
  built: "#f59e0b",
  deployed: "#10b981", outreach_sent: "#10b981", sms_sent: "#10b981",
  conversation_active: "#6366f1", meeting_scheduled: "#6366f1",
  payment_link_sent: "#818cf8",
  paid: "#22c55e", handed_off: "#22c55e",
  skipped: "#334155",
  error: "#ef4444",
}

type SortKey = "name" | "niche" | "status" | "site_score" | "created_at"

export function LeadsTable({ leads }: { leads: Lead[] }) {
  const [search,        setSearch]        = useState("")
  const [nicheFilter,   setNicheFilter]   = useState("all")
  const [statusFilter,  setStatusFilter]  = useState("all")
  const [tierFilter,    setTierFilter]    = useState("all")
  const [websiteFilter, setWebsiteFilter] = useState("all")
  const [sortKey,       setSortKey]       = useState<SortKey>("created_at")
  const [sortAsc,       setSortAsc]       = useState(false)
  const [expanded,      setExpanded]      = useState<Set<string>>(new Set())
  const [loading,       setLoading]       = useState<Record<string, boolean>>({})
  const [paymentLead,   setPaymentLead]   = useState<Lead | null>(null)
  const [builderLead,   setBuilderLead]   = useState<Lead | null>(null)
  const [feedback,      setFeedback]      = useState<Record<string, string>>({})
  const [rows,          setRows]          = useState<Lead[]>(leads)

  const niches = useMemo(
    () => Array.from(new Set(leads.map(l => l.niche))).sort(),
    [leads]
  )

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return rows
      .filter(l => {
        if (s && !l.name.toLowerCase().includes(s) && !l.city?.toLowerCase().includes(s)) return false
        if (nicheFilter   !== "all" && l.niche  !== nicheFilter)   return false
        if (statusFilter  !== "all" && l.status !== statusFilter)   return false
        if (tierFilter    !== "all" && l.tier   !== tierFilter)    return false
        if (websiteFilter === "no"  && l.website) return false
        if (websiteFilter === "yes" && !l.website) return false
        return true
      })
      .sort((a, b) => {
        const sign = sortAsc ? 1 : -1
        switch (sortKey) {
          case "name":       return sign * a.name.localeCompare(b.name)
          case "niche":      return sign * (a.niche ?? "").localeCompare(b.niche ?? "")
          case "status":     return sign * (a.status ?? "").localeCompare(b.status ?? "")
          case "site_score": return sign * ((a.site_score ?? -1) - (b.site_score ?? -1))
          case "created_at": return sign * (new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
          default: return 0
        }
      })
  }, [rows, search, nicheFilter, statusFilter, tierFilter, websiteFilter, sortKey, sortAsc])

  // counts for header badges
  const noWebsiteCount  = rows.filter(l => !l.website).length
  const hasWebsiteCount = rows.filter(l => !!l.website).length

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  function flash(id: string, msg: string) {
    setFeedback(f => ({ ...f, [id]: msg }))
    setTimeout(() => setFeedback(f => { const n = { ...f }; delete n[id]; return n }), 2200)
  }

  async function patch(id: string, body: object) {
    setLoading(l => ({ ...l, [id]: true }))
    try {
      const res  = await fetch(`/api/leads/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        const act = (body as any).action
        setRows(rs => rs.map(r => {
          if (r.id !== id) return r
          if (act === "set_tier")   return { ...r, tier:   (body as any).tier }
          if (act === "set_status") return { ...r, status: (body as any).status }
          if (act === "rebuild")    return { ...r, status: "analyzed" }
          if (act === "mark_paid")  return { ...r, paid: true, status: "handed_off" }
          return r
        }))
        flash(id, act === "mark_paid" ? "✓ Marked paid" : "✓ Saved")
      } else {
        flash(id, `✗ ${data.error}`)
      }
    } finally {
      setLoading(l => { const n = { ...l }; delete n[id]; return n })
    }
  }

  async function deleteLead(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setLoading(l => ({ ...l, [id]: true }))
    const res = await fetch(`/api/leads/${id}`, { method: "DELETE" })
    if (res.ok) {
      setRows(rs => rs.filter(r => r.id !== id))
    } else {
      const d = await res.json()
      flash(id, `✗ ${d.error}`)
      setLoading(l => { const n = { ...l }; delete n[id]; return n })
    }
  }

  function openBuilder(lead: Lead) {
    setBuilderLead(lead)
  }

  async function sendSms(lead: Lead) {
    if (!lead.phone) { alert("No phone number for this lead"); return }
    if (!confirm(`Send SMS to ${lead.name} (${lead.phone})?`)) return
    setLoading(l => ({ ...l, [lead.id]: true }))
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_sms" }),
      })
      const d = await res.json()
      flash(lead.id, res.ok ? "✓ SMS queued" : `✗ ${d.error}`)
    } finally {
      setLoading(l => { const n = { ...l }; delete n[lead.id]; return n })
    }
  }

  async function sendEmail(lead: Lead) {
    if (!lead.email) { alert("Set email first (expand the row)"); return }
    if (!confirm(`Send outreach email to ${lead.name} (${lead.email})?`)) return
    setLoading(l => ({ ...l, [lead.id]: true }))
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_email" }),
      })
      const d = await res.json()
      flash(lead.id, res.ok ? "✓ Email queued" : `✗ ${d.error}`)
    } finally {
      setLoading(l => { const n = { ...l }; delete n[lead.id]; return n })
    }
  }

  async function runGscCheck(lead: Lead) {
    setLoading(l => ({ ...l, [lead.id]: true }))
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger_gsc" }),
      })
      const d = await res.json()
      flash(lead.id, res.ok ? "✓ GSC check queued" : `✗ ${d.error}`)
      if (res.ok) setRows(rs => rs.map(r => r.id === lead.id ? { ...r, gsc_verify_requested: true } : r))
    } finally {
      setLoading(l => { const n = { ...l }; delete n[lead.id]; return n })
    }
  }

  async function callLead(lead: Lead) {
    if (!lead.phone) { alert("No phone number for this lead"); return }
    if (lead.sms_opt_out) { alert("This lead opted out of calls"); return }
    const siteUrl = lead.cloudflare_url ?? lead.vercel_url ?? ""
    if (!confirm(`Call ${lead.name} at ${lead.phone}?\n\nAI voice will pitch the demo site${siteUrl ? ` (${siteUrl})` : ""}.`)) return
    setLoading(l => ({ ...l, [lead.id]: true }))
    try {
      const res = await fetch(`/api/leads/${lead.id}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: lead.phone, name: lead.name, siteUrl }),
      })
      const d = await res.json()
      if (res.ok) {
        flash(lead.id, "✓ Call initiated")
        setRows(rs => rs.map(r => r.id === lead.id
          ? { ...r, call_status: "initiated", call_count: (r.call_count ?? 0) + 1 }
          : r
        ))
      } else {
        flash(lead.id, `✗ ${d.error}`)
      }
    } finally {
      setLoading(l => { const n = { ...l }; delete n[lead.id]; return n })
    }
  }

  function sendPaymentLink(lead: Lead) {
    if (!lead.email) { alert("Lead has no email address"); return }
    setPaymentLead(lead)
  }

  const inp = {
    background:   "var(--surface-2)",
    border:       "1px solid var(--border-2)",
    borderRadius: 7,
    color:        "var(--text)",
    padding:      "7px 11px",
    fontSize:     12.5,
    outline:      "none",
  }

  const TH = ({
    k, children, w, noSort,
  }: { k?: SortKey; children: React.ReactNode; w?: number | string; noSort?: boolean }) => (
    <th
      onClick={() => k && !noSort && toggleSort(k)}
      style={{
        padding:       "10px 14px",
        textAlign:     "left",
        color:         "var(--muted)",
        fontWeight:    600,
        fontSize:      11,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        whiteSpace:    "nowrap",
        cursor:        k && !noSort ? "pointer" : "default",
        userSelect:    "none",
        width:         w,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {children}
        {k && !noSort && (
          <ArrowUpDown size={10} style={{ opacity: sortKey === k ? 0.9 : 0.35, color: sortKey === k ? "var(--accent-light)" : "currentColor" }} />
        )}
      </span>
    </th>
  )

  return (
    <div>
      {/* Builder overlay — full-screen, slides over leads */}
      {builderLead && (
        <div style={{
          position:   "fixed",
          inset:      0,
          zIndex:     9999,
          background: "var(--bg)",
          display:    "flex",
          flexDirection: "column",
        }}>
          <BuilderApp
            initialMode={builderLead.website ? "url" : "new"}
            initialUrl={builderLead.website ?? undefined}
            initialNiche={builderLead.niche ?? undefined}
            initialName={builderLead.name}
            initialLeadId={builderLead.id}
            onClose={() => setBuilderLead(null)}
          />
        </div>
      )}

      {/* Payment modal */}
      {paymentLead && (
        <PaymentModal
          lead={paymentLead}
          onClose={() => setPaymentLead(null)}
          onSuccess={(url, status) => {
            setRows(rs => rs.map(r => r.id === paymentLead.id
              ? { ...r, status, stripe_payment_link: url }
              : r
            ))
            flash(paymentLead.id, "✓ Payment link ready")
          }}
        />
      )}
      {/* Website summary badges */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <WebBadge
          active={websiteFilter === "no"}
          color="var(--warning)"
          icon={WifiOff}
          label="No Website"
          count={noWebsiteCount}
          onClick={() => setWebsiteFilter(websiteFilter === "no" ? "all" : "no")}
        />
        <WebBadge
          active={websiteFilter === "yes"}
          color="var(--success)"
          icon={Wifi}
          label="Has Website"
          count={hasWebsiteCount}
          onClick={() => setWebsiteFilter(websiteFilter === "yes" ? "all" : "yes")}
        />
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder="Search name or city…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inp, width: 210 }}
        />
        <select value={nicheFilter}  onChange={e => setNicheFilter(e.target.value)}  style={inp}>
          <option value="all">All niches</option>
          {niches.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inp}>
          <option value="all">All statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <select value={tierFilter}   onChange={e => setTierFilter(e.target.value)}   style={inp}>
          <option value="all">All tiers</option>
          <option value="regular">🟢 Regular</option>
          <option value="premium">⭐ Premium</option>
          <option value="custom">💎 Custom</option>
        </select>
        <button
          onClick={() => { setSearch(""); setNicheFilter("all"); setStatusFilter("all"); setTierFilter("all"); setWebsiteFilter("all") }}
          style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 7, color: "var(--muted)", padding: "7px 11px", fontSize: 12, cursor: "pointer" }}
        >
          Clear
        </button>
        <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
          {filtered.length} / {rows.length}
        </span>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
              <th style={{ width: 36 }} />
              <TH k="name">Business</TH>
              <TH k="niche" w={90}>Niche</TH>
              <TH noSort w={120}>Website</TH>
              <TH k="status" w={160}>Status</TH>
              <TH noSort w={110}>Tier</TH>
              <TH k="site_score" w={90}>Score</TH>
              <TH noSort w={60}>Phone</TH>
              <TH noSort w={60}>Live</TH>
              <TH noSort w={170}>Actions</TH>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead, i) => {
              const siteUrl = lead.cloudflare_url ?? lead.vercel_url
              const isOpen  = expanded.has(lead.id)
              const busy    = loading[lead.id]
              const sc      = STATUS_COLOR[lead.status] ?? "#64748b"
              const isEven  = i % 2 === 0
              const hasWeb  = !!lead.website

              return (
                <Fragment key={lead.id}>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background:   isOpen ? "rgba(99,102,241,0.05)" : isEven ? "transparent" : "rgba(255,255,255,0.007)",
                      cursor: "pointer",
                    }}
                  >
                    {/* Expand */}
                    <td onClick={() => toggleExpand(lead.id)} style={{ padding: "10px 0 10px 12px", color: "var(--muted)", width: 36 }}>
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>

                    {/* Business */}
                    <td onClick={() => toggleExpand(lead.id)} style={{ padding: "10px 14px" }}>
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>{lead.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{lead.city}, {lead.state}</div>
                    </td>

                    {/* Niche */}
                    <td onClick={() => toggleExpand(lead.id)} style={{ padding: "10px 14px", color: "var(--text-2)", fontSize: 12 }}>
                      {lead.niche}
                    </td>

                    {/* Website badge */}
                    <td onClick={() => toggleExpand(lead.id)} style={{ padding: "10px 14px" }}>
                      {hasWeb ? (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                          color: "var(--success)", background: "var(--success-dim)",
                          border: "1px solid rgba(16,185,129,0.25)", borderRadius: 999,
                          padding: "3px 8px",
                        }}>
                          <Wifi size={9} /> Has Website
                        </span>
                      ) : (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                          color: "var(--warning)", background: "var(--warning-dim)",
                          border: "1px solid rgba(245,158,11,0.25)", borderRadius: 999,
                          padding: "3px 8px",
                        }}>
                          <WifiOff size={9} /> No Website
                        </span>
                      )}
                    </td>

                    {/* Status dropdown */}
                    <td style={{ padding: "10px 14px" }} onClick={e => e.stopPropagation()}>
                      <select
                        value={lead.status}
                        disabled={busy}
                        onChange={e => patch(lead.id, { action: "set_status", status: e.target.value })}
                        style={{
                          background:   `${sc}18`,
                          color:         sc,
                          border:       `1px solid ${sc}44`,
                          borderRadius:  999,
                          padding:       "3px 10px",
                          fontSize:      11,
                          fontWeight:    600,
                          cursor:        busy ? "not-allowed" : "pointer",
                          outline:       "none",
                          maxWidth:      140,
                        }}
                      >
                        {ALL_STATUSES.map(s => (
                          <option key={s} value={s} style={{ background: "#111118", color: "#e2e8f0" }}>
                            {s.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                      {feedback[lead.id] && (
                        <div style={{ fontSize: 10, color: feedback[lead.id].startsWith("✓") ? "var(--success)" : "var(--error)", marginTop: 3 }}>
                          {feedback[lead.id]}
                        </div>
                      )}
                    </td>

                    {/* Tier */}
                    <td style={{ padding: "10px 14px" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 3 }}>
                        {(["regular", "premium", "custom"] as const).map(t => (
                          <button
                            key={t}
                            disabled={busy}
                            title={t}
                            onClick={() => patch(lead.id, { action: "set_tier", tier: t })}
                            style={{
                              fontSize: 14, padding: "3px 7px", borderRadius: 6,
                              cursor: busy ? "not-allowed" : "pointer",
                              border: `1px solid ${lead.tier === t ? "var(--accent)" : "var(--border)"}`,
                              background: lead.tier === t ? "var(--accent-dim-2)" : "transparent",
                              opacity: busy ? 0.5 : 1,
                            }}
                          >
                            {t === "regular" ? "🟢" : t === "premium" ? "⭐" : "💎"}
                          </button>
                        ))}
                      </div>
                    </td>

                    {/* Score */}
                    <td onClick={() => toggleExpand(lead.id)} style={{ padding: "10px 14px" }}>
                      {lead.site_score != null ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <div style={{ width: 38, height: 4, borderRadius: 2, background: "var(--border-2)", overflow: "hidden" }}>
                            <div style={{
                              height: "100%", width: `${lead.site_score}%`, borderRadius: 2,
                              background: lead.site_score >= 60 ? "var(--success)" : lead.site_score >= 40 ? "var(--warning)" : "var(--error)",
                            }} />
                          </div>
                          <span style={{ fontSize: 11, color: "var(--text-2)" }}>{lead.site_score}</span>
                        </div>
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: 11 }}>—</span>
                      )}
                    </td>

                    {/* Phone */}
                    <td style={{ padding: "10px 14px" }} onClick={e => e.stopPropagation()}>
                      {lead.phone ? (
                        <a href={`tel:${lead.phone}`} title={lead.phone} style={{ color: "var(--text-2)", display: "flex", alignItems: "center" }}>
                          <Phone size={13} />
                        </a>
                      ) : (
                        <span style={{ color: "var(--border-2)" }}>—</span>
                      )}
                    </td>

                    {/* Live site */}
                    <td style={{ padding: "10px 14px" }} onClick={e => e.stopPropagation()}>
                      {siteUrl ? (
                        <a href={siteUrl} target="_blank" rel="noopener noreferrer"
                          style={{ color: "var(--accent-light)", display: "flex", alignItems: "center", gap: 3, fontSize: 11 }}>
                          <ExternalLink size={12} /> View
                        </a>
                      ) : (
                        <span style={{ color: "var(--border-2)", fontSize: 11 }}>—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "10px 14px" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {/* Build Website */}
                        <ActionBtn
                          icon={Hammer}
                          label="Build Website"
                          color="#818cf8"
                          busy={busy}
                          onClick={() => openBuilder(lead)}
                        />
                        {/* Send SMS */}
                        <ActionBtn
                          icon={MessageSquare}
                          label="Send SMS"
                          color="var(--success)"
                          busy={busy}
                          onClick={() => sendSms(lead)}
                        />
                        {/* Call Lead */}
                        <ActionBtn
                          icon={PhoneCall}
                          label={lead.call_status
                            ? `Call (${lead.call_status}${lead.call_count ? ` ×${lead.call_count}` : ""})`
                            : "Call Lead"
                          }
                          color={lead.call_status === "interested" ? "var(--paid)"
                            : lead.call_status === "opted_out"   ? "var(--muted)"
                            : lead.sms_opt_out                   ? "var(--border-2)"
                            : "#f59e0b"}
                          busy={busy}
                          onClick={() => callLead(lead)}
                        />
                        {/* Send Email */}
                        <ActionBtn
                          icon={Send}
                          label="Send Email"
                          color="var(--info)"
                          busy={busy}
                          onClick={() => sendEmail(lead)}
                        />
                        {/* Google Search Console auto-verify */}
                        {(lead.cloudflare_url || lead.vercel_url) && !lead.gsc_verified && (
                          <ActionBtn
                            icon={Globe}
                            label={lead.gsc_verify_requested ? "GSC Pending…" : lead.gsc_verify_error ? "GSC Failed — Retry" : "Check GSC"}
                            color={lead.gsc_verify_error ? "var(--danger, #ef4444)" : lead.gsc_verify_requested ? "var(--muted)" : "#06b6d4"}
                            busy={busy || lead.gsc_verify_requested}
                            onClick={() => runGscCheck(lead)}
                          />
                        )}
                        {lead.gsc_verified && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--success)", padding: "0 8px" }}>
                            <CheckCircle size={13} /> GSC verified
                          </span>
                        )}
                        {/* Send Payment Link */}
                        {!lead.paid && (
                          <ActionBtn
                            icon={CreditCard}
                            label={lead.stripe_payment_link ? "Resend Payment Link" : "Send Payment Link"}
                            color="#10b981"
                            busy={busy}
                            onClick={() => sendPaymentLink(lead)}
                          />
                        )}
                        {/* Mark paid */}
                        {!lead.paid && (
                          <ActionBtn
                            icon={CheckCircle}
                            label="Mark as Paid"
                            color="var(--paid)"
                            busy={busy}
                            onClick={() => { if (confirm(`Mark ${lead.name} as paid?`)) patch(lead.id, { action: "mark_paid" }) }}
                          />
                        )}
                        {lead.paid && <span title="Paid" style={{ fontSize: 12, color: "var(--paid)", padding: "2px 4px" }}>✓</span>}
                        {/* Rebuild */}
                        <ActionBtn
                          icon={RotateCcw}
                          label="Rebuild"
                          color="var(--warning)"
                          busy={busy}
                          onClick={() => { if (confirm(`Rebuild ${lead.name}? Resets to analyzed.`)) patch(lead.id, { action: "rebuild" }) }}
                        />
                        {/* Delete */}
                        <ActionBtn
                          icon={Trash2}
                          label="Delete"
                          color="var(--error)"
                          busy={busy}
                          onClick={() => deleteLead(lead.id, lead.name)}
                        />
                      </div>
                    </td>
                  </tr>

                  {/* Expanded detail */}
                  {isOpen && (
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <td colSpan={10} style={{ padding: 0 }}>
                        <div
                          className="anim-slide-dn"
                          style={{
                            background: "rgba(99,102,241,0.04)",
                            borderTop:  "1px solid var(--border)",
                            padding:    "14px 24px 14px 60px",
                            display:    "flex",
                            gap:        28,
                            flexWrap:   "wrap",
                            alignItems: "flex-start",
                          }}
                        >
                          {lead.phone && (
                            <Info icon={Phone} label="Phone">
                              <a href={`tel:${lead.phone}`} style={{ color: "var(--accent-light)", textDecoration: "none", fontSize: 12 }}>
                                {lead.phone}
                              </a>
                            </Info>
                          )}
                          {lead.call_status && (
                            <Info icon={PhoneCall} label="Call Status">
                              <span style={{
                                fontSize: 11.5,
                                color: lead.call_status === "interested" ? "var(--paid)"
                                  : lead.call_status === "opted_out"    ? "var(--error)"
                                  : lead.call_status === "answered"     ? "var(--success)"
                                  : "var(--text-2)",
                              }}>
                                {lead.call_status}
                                {lead.call_count ? ` (${lead.call_count}×)` : ""}
                                {lead.last_call_at ? ` — ${new Date(lead.last_call_at).toLocaleDateString()}` : ""}
                              </span>
                            </Info>
                          )}
                          <EmailField
                            lead={lead}
                            onSave={(email) => {
                              patch(lead.id, { action: "set_email", email })
                              setRows(rs => rs.map(r => r.id === lead.id ? { ...r, email } : r))
                            }}
                          />
                          {lead.website && (
                            <Info icon={Globe} label="Original Site">
                              <a href={lead.website} target="_blank" rel="noopener noreferrer"
                                style={{ color: "var(--accent-light)", textDecoration: "none", fontSize: 12 }}>
                                {lead.website.replace(/https?:\/\//, "").slice(0, 36)}
                              </a>
                            </Info>
                          )}
                          {lead.github_repo && (
                            <Info icon={Github} label="GitHub">
                              <a href={lead.github_repo} target="_blank" rel="noopener noreferrer"
                                style={{ color: "var(--accent-light)", textDecoration: "none", fontSize: 12 }}>
                                View repo ↗
                              </a>
                            </Info>
                          )}
                          {lead.rating != null && (
                            <Info icon={Star} label="Google Rating">
                              <span style={{ fontSize: 12, color: "var(--warning)", fontWeight: 600 }}>
                                ★ {lead.rating}
                                <span style={{ color: "var(--muted)", fontWeight: 400 }}>{" "}({lead.review_count ?? 0} reviews)</span>
                              </span>
                            </Info>
                          )}
                          {lead.created_at && (
                            <Info label="Added">
                              <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                                {new Date(lead.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            </Info>
                          )}
                          {lead.paid && (
                            <Info label="Payment">
                              <span style={{ fontSize: 12, color: "var(--paid)", fontWeight: 600 }}>✓ Paid</span>
                            </Info>
                          )}
                        </div>
                        <ActivityTimeline leadId={lead.id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div style={{ padding: 48, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            No leads match the current filters
          </div>
        )}
      </div>
    </div>
  )
}

// ── Website filter badge ──────────────────────────────────────────────────────

function WebBadge({
  active, color, icon: Icon, label, count, onClick,
}: {
  active: boolean
  color: string
  icon: any
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display:      "flex",
        alignItems:   "center",
        gap:          7,
        padding:      "8px 14px",
        borderRadius: 9,
        border:       `1px solid ${active ? color : "var(--border-2)"}`,
        background:   active ? `${color}18` : "var(--surface-2)",
        color:        active ? color : "var(--text-2)",
        cursor:       "pointer",
        fontSize:     12.5,
        fontWeight:   600,
        transition:   "all 0.12s",
      }}
    >
      <Icon size={13} />
      {label}
      <span style={{
        background:   active ? color : "var(--border-2)",
        color:        active ? "#fff" : "var(--text-2)",
        borderRadius: 999,
        padding:      "1px 7px",
        fontSize:     11,
        fontWeight:   700,
        minWidth:     22,
        textAlign:    "center",
      }}>
        {count}
      </span>
    </button>
  )
}

// ── Action button ─────────────────────────────────────────────────────────────

function ActionBtn({
  icon: Icon, label, onClick, busy, color,
}: { icon: any; label: string; onClick: () => void; busy?: boolean; color: string }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={label}
      style={{
        padding: "5px 6px", borderRadius: 6,
        border: "1px solid var(--border)",
        background: "transparent",
        cursor: busy ? "not-allowed" : "pointer",
        color: "var(--text-2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: busy ? 0.4 : 1,
        transition: "border-color 0.12s, color 0.12s",
      }}
      onMouseEnter={e => { if (!busy) { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-2)" }}
    >
      <Icon size={13} />
    </button>
  )
}

// ── Inline email editor ───────────────────────────────────────────────────────

function EmailField({ lead, onSave }: { lead: Lead; onSave: (email: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [val,     setVal]     = useState(lead.email ?? "")

  function save() { setEditing(false); onSave(val.trim()) }

  return (
    <Info icon={Mail} label="Client Email">
      {editing ? (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <input
            autoFocus value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false) }}
            placeholder="owner@business.com"
            style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 5, color: "var(--text)", padding: "3px 7px", fontSize: 12, outline: "none", width: 190 }}
          />
          <button onClick={save} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 5, padding: "4px 7px", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <Save size={11} />
          </button>
        </div>
      ) : (
        <div onClick={() => setEditing(true)} title="Click to edit" style={{ fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
          {lead.email ? (
            <a href={`mailto:${lead.email}`} onClick={e => e.stopPropagation()} style={{ color: "var(--accent-light)", textDecoration: "none" }}>
              {lead.email}
            </a>
          ) : (
            <span style={{ color: "var(--border-2)", fontStyle: "italic" }}>set email for portal…</span>
          )}
          <span style={{ fontSize: 10, color: "var(--muted)" }}>✎</span>
        </div>
      )}
    </Info>
  )
}

// ── Info cell ─────────────────────────────────────────────────────────────────

interface LeadEvent { id: string; event_type: string; detail: any; created_at: string }

const EVENT_META: Record<string, { icon: any; label: string; color: string }> = {
  email_sent:      { icon: Send,                label: "Email sent",         color: "var(--info)" },
  email_opened:    { icon: Eye,                  label: "Email opened",       color: "var(--accent-light)" },
  email_clicked:   { icon: MousePointerClick,    label: "Email link clicked", color: "var(--success)" },
  email_bounced:   { icon: AlertTriangle,        label: "Email bounced",      color: "var(--error)" },
  sms_sent:        { icon: MessageSquare,        label: "SMS sent",           color: "var(--info)" },
  sms_replied:     { icon: MessageSquare,        label: "SMS reply received", color: "var(--success)" },
  sms_opted_out:   { icon: AlertTriangle,        label: "SMS opted out",      color: "var(--error)" },
  call_received:   { icon: PhoneIncoming,        label: "Call answered by AI",color: "var(--accent-light)" },
  call_booked:     { icon: CalendarCheck,        label: "Appointment booked", color: "var(--success)" },
  call_escalated:  { icon: AlertTriangle,        label: "Call escalated",     color: "var(--warning)" },
}

function ActivityTimeline({ leadId }: { leadId: string }) {
  const [events,  setEvents]  = useState<LeadEvent[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/leads/${leadId}/events`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setEvents(d.events ?? []); setLoading(false) } })
      .catch(() => { if (!cancelled) { setEvents([]); setLoading(false) } })
    return () => { cancelled = true }
  }, [leadId])

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
        <Activity size={10} /> Activity
      </div>
      {loading && <span style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</span>}
      {!loading && events?.length === 0 && (
        <span style={{ fontSize: 12, color: "var(--muted)" }}>No activity yet — outreach not sent or no engagement.</span>
      )}
      {!loading && events && events.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {events.map(ev => {
            const meta = EVENT_META[ev.event_type] ?? { icon: Activity, label: ev.event_type, color: "var(--text-2)" }
            const Icon = meta.icon
            return (
              <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <Icon size={13} color={meta.color} />
                <span style={{ color: "var(--text-2)" }}>{meta.label}</span>
                <span style={{ color: "var(--muted)", fontSize: 11 }}>
                  {new Date(ev.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Info({ icon: Icon, label, children }: { icon?: any; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {Icon && <Icon size={10} />}
        {label}
      </div>
      {children}
    </div>
  )
}
