"use client"

import { useState, useMemo } from "react"
import { Phone, Star, Globe, WifiOff, Hammer, CheckCircle, XCircle, Clock } from "lucide-react"
import type { Lead } from "@/lib/db"

const NICHE_EMOJI: Record<string, string> = {
  hvac:               "🌡️",
  plumbing:           "🔧",
  roofing:            "🏠",
  cleaning:           "🧹",
  landscaping:        "🌿",
  "junk-removal":     "🚛",
  "auto-detailing":   "🚗",
  "pressure-washing": "💧",
  remodeling:         "🔨",
  dentist:            "🦷",
  medspa:             "💆",
  daycare:            "👶",
}

type CallStatus = "interested" | "called" | "skipped"

export function CallList({ leads }: { leads: Lead[] }) {
  const [rows,        setRows]        = useState<Lead[]>(leads)
  const [search,      setSearch]      = useState("")
  const [nicheFilter, setNicheFilter] = useState("all")
  const [showFilter,  setShowFilter]  = useState<"all" | "no-website" | "interested">("all")
  const [loading,     setLoading]     = useState<Record<string, boolean>>({})
  const [feedback,    setFeedback]    = useState<Record<string, string>>({})

  const niches = useMemo(() => Array.from(new Set(leads.map(l => l.niche))).sort(), [leads])

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return rows.filter(l => {
      if (s && !l.name.toLowerCase().includes(s) && !l.city?.toLowerCase().includes(s)) return false
      if (nicheFilter !== "all" && l.niche !== nicheFilter) return false
      if (showFilter === "no-website" && l.website) return false
      if (showFilter === "interested" && l.status !== "interested") return false
      return true
    })
  }, [rows, search, nicheFilter, showFilter])

  function flash(id: string, msg: string) {
    setFeedback(f => ({ ...f, [id]: msg }))
    setTimeout(() => setFeedback(f => { const n = { ...f }; delete n[id]; return n }), 2000)
  }

  async function setStatus(id: string, status: CallStatus) {
    setLoading(l => ({ ...l, [id]: true }))
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "set_status", status }),
      })
      if (res.ok) {
        setRows(rs => rs.map(r => r.id === id ? { ...r, status } : r))
        flash(id, status === "interested" ? "✓ Marked interested!" : status === "called" ? "✓ Called" : "✗ Skipped")
      }
    } finally {
      setLoading(l => { const n = { ...l }; delete n[id]; return n })
    }
  }

  function openBuilder(lead: Lead) {
    const params = new URLSearchParams({ mode: "new", lead: lead.id, niche: lead.niche ?? "", name: lead.name })
    window.open(`/builder?${params}`, "_blank")
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

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder="Search name or city…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inp, width: 200 }}
        />
        <select value={nicheFilter} onChange={e => setNicheFilter(e.target.value)} style={inp}>
          <option value="all">All niches</option>
          {niches.map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        {(["all", "no-website", "interested"] as const).map(f => (
          <button
            key={f}
            onClick={() => setShowFilter(f)}
            style={{
              padding:      "7px 12px",
              borderRadius: 7,
              fontSize:     12,
              fontWeight:   600,
              cursor:       "pointer",
              border:       `1px solid ${showFilter === f ? "var(--accent)" : "var(--border-2)"}`,
              background:   showFilter === f ? "var(--accent-dim-2)" : "transparent",
              color:        showFilter === f ? "var(--accent-light)" : "var(--text-2)",
            }}
          >
            {f === "all" ? "All" : f === "no-website" ? "No Website" : "Interested"}
          </button>
        ))}

        <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
          {filtered.length} leads
        </span>
      </div>

      {/* Lead cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(lead => {
          const busy  = loading[lead.id]
          const fb    = feedback[lead.id]
          const emoji = NICHE_EMOJI[lead.niche] ?? "🏢"
          const isInterested = lead.status === "interested"
          const isCalled     = lead.status === "called"
          const isSkipped    = lead.status === "skipped"

          return (
            <div
              key={lead.id}
              style={{
                background:   isInterested
                  ? "rgba(34,197,94,0.05)"
                  : isCalled
                    ? "rgba(255,255,255,0.02)"
                    : "var(--surface)",
                border:       `1px solid ${isInterested ? "rgba(34,197,94,0.25)" : "var(--border)"}`,
                borderRadius: 12,
                padding:      "16px 20px",
                display:      "flex",
                alignItems:   "center",
                gap:          16,
                opacity:      isSkipped ? 0.45 : 1,
              }}
            >
              {/* Niche emoji */}
              <div style={{ fontSize: 24, flexShrink: 0, width: 36, textAlign: "center" }}>
                {emoji}
              </div>

              {/* Main info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>
                    {lead.name}
                  </span>
                  {isInterested && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                      color: "#22c55e", background: "rgba(34,197,94,0.12)",
                      border: "1px solid rgba(34,197,94,0.25)", borderRadius: 999, padding: "2px 7px",
                    }}>
                      Interested
                    </span>
                  )}
                  {!lead.website && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                      color: "var(--warning)", background: "var(--warning-dim)",
                      border: "1px solid rgba(245,158,11,0.25)", borderRadius: 999, padding: "2px 7px",
                      display: "flex", alignItems: "center", gap: 3,
                    }}>
                      <WifiOff size={8} /> No Website
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span>{lead.niche} · {lead.city}, {lead.state}</span>
                  {lead.rating && (
                    <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <Star size={10} color="var(--warning)" fill="var(--warning)" />
                      {lead.rating} ({lead.review_count ?? 0})
                    </span>
                  )}
                  {lead.website && (
                    <a
                      href={lead.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--accent-light)", display: "flex", alignItems: "center", gap: 3, textDecoration: "none" }}
                    >
                      <Globe size={10} /> existing site
                    </a>
                  )}
                </div>
              </div>

              {/* Phone (big + clickable) */}
              <a
                href={`tel:${lead.phone}`}
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  gap:            8,
                  background:     "rgba(99,102,241,0.1)",
                  border:         "1px solid rgba(99,102,241,0.25)",
                  borderRadius:   9,
                  padding:        "10px 16px",
                  textDecoration: "none",
                  flexShrink:     0,
                }}
              >
                <Phone size={14} color="var(--accent-light)" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--accent-light)", fontFamily: "monospace" }}>
                  {lead.phone}
                </span>
              </a>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                <button
                  title="Interested — wants the site"
                  onClick={() => setStatus(lead.id, "interested")}
                  disabled={busy}
                  style={{
                    padding:      "8px 12px",
                    borderRadius: 8,
                    border:       "1px solid rgba(34,197,94,0.3)",
                    background:   isInterested ? "rgba(34,197,94,0.15)" : "transparent",
                    color:        "#22c55e",
                    cursor:       busy ? "not-allowed" : "pointer",
                    display:      "flex",
                    alignItems:   "center",
                    gap:          5,
                    fontSize:     12,
                    fontWeight:   600,
                  }}
                >
                  <CheckCircle size={13} /> Interested
                </button>

                <button
                  title="Build website for this lead"
                  onClick={() => openBuilder(lead)}
                  style={{
                    padding:      "8px 12px",
                    borderRadius: 8,
                    border:       "1px solid rgba(99,102,241,0.3)",
                    background:   "transparent",
                    color:        "var(--accent-light)",
                    cursor:       "pointer",
                    display:      "flex",
                    alignItems:   "center",
                    gap:          5,
                    fontSize:     12,
                    fontWeight:   600,
                  }}
                >
                  <Hammer size={13} /> Build Site
                </button>

                <button
                  title="Called — no answer / not interested"
                  onClick={() => setStatus(lead.id, "called")}
                  disabled={busy}
                  style={{
                    padding:      "8px 10px",
                    borderRadius: 8,
                    border:       "1px solid var(--border-2)",
                    background:   isCalled ? "var(--surface-2)" : "transparent",
                    color:        "var(--muted)",
                    cursor:       busy ? "not-allowed" : "pointer",
                    display:      "flex",
                    alignItems:   "center",
                    gap:          4,
                    fontSize:     12,
                  }}
                >
                  <Clock size={12} /> Called
                </button>

                <button
                  title="Skip this lead"
                  onClick={() => setStatus(lead.id, "skipped")}
                  disabled={busy}
                  style={{
                    padding:      "8px 10px",
                    borderRadius: 8,
                    border:       "1px solid var(--border-2)",
                    background:   "transparent",
                    color:        "var(--muted)",
                    cursor:       busy ? "not-allowed" : "pointer",
                    display:      "flex",
                    alignItems:   "center",
                  }}
                >
                  <XCircle size={13} />
                </button>
              </div>

              {/* Feedback flash */}
              {fb && (
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: fb.startsWith("✓") ? "var(--success)" : fb.startsWith("✗") ? "var(--error)" : "var(--muted)",
                  minWidth: 80,
                }}>
                  {fb}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: 48, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
          No leads match the filter.
        </div>
      )}
    </div>
  )
}
