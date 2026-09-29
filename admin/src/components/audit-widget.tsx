"use client"

import { useState, useEffect } from "react"
import { Search, Loader2, CheckCircle, XCircle, BarChart2 } from "lucide-react"

const BEAUTY_NICHES = [
  { id: "medspa",              label: "Med Spa",           emoji: "💆" },
  { id: "dentist",             label: "Dental",            emoji: "🦷" },
  { id: "skin-clinic",         label: "Skin Clinic",       emoji: "✨" },
  { id: "iv-therapy",          label: "IV Therapy",        emoji: "💉" },
  { id: "salon",               label: "Hair Salon",        emoji: "💇" },
  { id: "barbershop",          label: "Barbershop",        emoji: "✂️"  },
  { id: "nail-studio",         label: "Nail Studio",       emoji: "💅" },
  { id: "orthodontist",        label: "Orthodontist",      emoji: "😁" },
  { id: "weight-loss-clinic",  label: "Weight Loss",       emoji: "⚖️"  },
]

type Status = "idle" | "running" | "done" | "error"

interface AuditSummary {
  id: string
  website_url: string
  business_name: string
  niche: string
  overall_score: number
  created_at: string
  report_viewed: boolean
  outreach_sent: boolean
}

function scoreColor(s: number) {
  if (s >= 80) return "var(--success, #10b981)"
  if (s >= 50) return "#f59e0b"
  return "var(--error, #ef4444)"
}

export function AuditWidget() {
  const [url,      setUrl]      = useState("")
  const [name,     setName]     = useState("")
  const [niche,    setNiche]    = useState("medspa")
  const [city,     setCity]     = useState("")
  const [outreach, setOutreach] = useState(false)
  const [status,   setStatus]   = useState<Status>("idle")
  const [message,  setMessage]  = useState("")
  const [audits,   setAudits]   = useState<AuditSummary[]>([])

  useEffect(() => { loadAudits() }, [])

  async function loadAudits() {
    try {
      const res = await fetch("/api/audit")
      if (res.ok) {
        const data = await res.json()
        setAudits(data.audits ?? [])
      }
    } catch {}
  }

  async function run() {
    if (!url.trim()) { setMessage("Enter a website URL"); return }
    setStatus("running")
    setMessage("")
    try {
      const res = await fetch("/api/audit", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          url:          url.trim(),
          businessName: name.trim() || undefined,
          niche:        niche || undefined,
          city:         city.trim() || undefined,
          sendOutreach: outreach,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus("done")
        setMessage(data.message)
        // Reload audits list after 5s (give backend time to process)
        setTimeout(loadAudits, 5000)
        setTimeout(loadAudits, 15000)
        setTimeout(loadAudits, 30000)
      } else {
        setStatus("error")
        setMessage(data.error ?? "Audit failed")
      }
    } catch (e: any) {
      setStatus("error")
      setMessage(e.message)
    }
  }

  const inp = {
    width:        "100%",
    background:   "var(--surface-2)",
    border:       "1px solid var(--border-2)",
    borderRadius: 8,
    color:        "var(--text)",
    padding:      "9px 12px",
    fontSize:     13,
    outline:      "none",
    boxSizing:    "border-box" as const,
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px 28px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <BarChart2 size={16} color="var(--accent-light)" />
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>AI Growth Audit</span>
          <span style={{ fontSize: 11, background: "var(--accent-dim-2)", color: "var(--accent-light)", borderRadius: 6, padding: "2px 7px", fontWeight: 600 }}>
            Free lead magnet
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          Paste a business URL → instant audit report with scores, issues, and AI recommendations.
        </div>
      </div>

      {/* URL input */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 7 }}>
          Website URL *
        </label>
        <input
          type="url"
          placeholder="https://example-medspa.com"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === "Enter" && run()}
          style={inp}
        />
      </div>

      {/* Business name + city */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 7 }}>
            Business Name (optional)
          </label>
          <input
            type="text"
            placeholder="Glow Aesthetics"
            value={name}
            onChange={e => setName(e.target.value)}
            style={inp}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 7 }}>
            City (for competitors)
          </label>
          <input
            type="text"
            placeholder="Los Angeles, CA"
            value={city}
            onChange={e => setCity(e.target.value)}
            style={inp}
          />
        </div>
      </div>

      {/* Niche picker */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 8 }}>
          Niche
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {BEAUTY_NICHES.map(n => {
            const on = niche === n.id
            return (
              <button
                key={n.id}
                onClick={() => setNiche(n.id)}
                style={{
                  padding:      "5px 10px",
                  borderRadius: 999,
                  fontSize:     12,
                  fontWeight:   600,
                  cursor:       "pointer",
                  border:       `1px solid ${on ? "var(--accent)" : "var(--border-2)"}`,
                  background:   on ? "var(--accent-dim-2)" : "transparent",
                  color:        on ? "var(--accent-light)" : "var(--text-2)",
                  transition:   "all 0.1s",
                  display:      "flex",
                  alignItems:   "center",
                  gap:          4,
                }}
              >
                <span style={{ fontSize: 12 }}>{n.emoji}</span>
                {n.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Outreach toggle */}
      <div style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
        <input
          id="outreach-toggle"
          type="checkbox"
          checked={outreach}
          onChange={e => setOutreach(e.target.checked)}
          style={{ width: 14, height: 14, cursor: "pointer" }}
        />
        <label htmlFor="outreach-toggle" style={{ fontSize: 13, color: "var(--text-2)", cursor: "pointer" }}>
          Send audit email to business owner after report (if email found in DB)
        </label>
      </div>

      {/* Run button */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          onClick={run}
          disabled={status === "running"}
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          8,
            background:   status === "running" ? "var(--border-2)" : "linear-gradient(135deg,#7c3aed,#5b21b6)",
            color:        "#fff",
            border:       "none",
            borderRadius: 9,
            padding:      "11px 24px",
            fontWeight:   700,
            fontSize:     14,
            cursor:       status === "running" ? "not-allowed" : "pointer",
            transition:   "opacity 0.12s",
          }}
        >
          {status === "running" ? (
            <><Loader2 size={15} className="anim-spin" /> Analyzing…</>
          ) : (
            <><Search size={14} /> Run Free Audit</>
          )}
        </button>

        {message && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {status === "done"  && <CheckCircle size={14} color="var(--success)" />}
            {status === "error" && <XCircle     size={14} color="var(--error)"   />}
            <span style={{ fontSize: 13, color: status === "error" ? "var(--error)" : "var(--success)" }}>
              {message}
            </span>
          </div>
        )}
      </div>

      {status === "running" && (
        <div style={{ marginTop: 14, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
          Running PageSpeed + website analysis + AI recommendations. Takes ~60 seconds.
        </div>
      )}

      {/* Recent audits table */}
      {audits.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
            Recent Audits ({audits.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {audits.slice(0, 8).map(a => (
              <div
                key={a.id}
                style={{
                  display:      "flex",
                  alignItems:   "center",
                  gap:          10,
                  padding:      "10px 14px",
                  background:   "var(--surface-2)",
                  border:       "1px solid var(--border-2)",
                  borderRadius: 8,
                  fontSize:     12,
                }}
              >
                {/* Score badge */}
                <div style={{
                  minWidth:   36,
                  height:     36,
                  borderRadius: "50%",
                  background: `${scoreColor(a.overall_score)}22`,
                  border:     `2px solid ${scoreColor(a.overall_score)}`,
                  display:    "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize:   13,
                  color:      scoreColor(a.overall_score),
                  flexShrink: 0,
                }}>
                  {a.overall_score}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.business_name}
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.website_url}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                  {a.report_viewed && (
                    <span style={{ fontSize: 10, color: "#10b981", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 4, padding: "2px 6px" }}>
                      Viewed
                    </span>
                  )}
                  {a.outreach_sent && (
                    <span style={{ fontSize: 10, color: "#3b82f6", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 4, padding: "2px 6px" }}>
                      Email sent
                    </span>
                  )}
                  <a
                    href={`/audit/${a.id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 11, color: "var(--accent-light)", textDecoration: "none", fontWeight: 600 }}
                  >
                    View →
                  </a>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={loadAudits}
            style={{ marginTop: 10, fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
          >
            Refresh list
          </button>
        </div>
      )}
    </div>
  )
}
