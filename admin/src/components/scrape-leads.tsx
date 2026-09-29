"use client"

import { useState } from "react"
import { Search, Loader2, CheckCircle, XCircle } from "lucide-react"

const ALL_NICHES = [
  { id: "hvac",                   label: "HVAC",                emoji: "🌡️" },
  { id: "plumbing",               label: "Plumbing",            emoji: "🔧" },
  { id: "roofing",                label: "Roofing",             emoji: "🏠" },
  { id: "cleaning",               label: "Cleaning",            emoji: "🧹" },
  { id: "landscaping",            label: "Landscaping",         emoji: "🌿" },
  { id: "junk-removal",           label: "Junk Removal",        emoji: "🚛" },
  { id: "auto-detailing",         label: "Auto Detailing",      emoji: "🚗" },
  { id: "pressure-washing",       label: "Pressure Washing",    emoji: "💧" },
  { id: "remodeling",             label: "Remodeling",          emoji: "🔨" },
  { id: "dentist",                label: "Dentist",             emoji: "🦷" },
  { id: "medspa",                 label: "Med Spa",             emoji: "💆" },
  { id: "daycare",                label: "Daycare",             emoji: "👶" },
  { id: "epoxy-flooring",         label: "Epoxy Flooring",      emoji: "🏭" },
  { id: "foundation-repair",      label: "Foundation Repair",   emoji: "🏗️" },
  { id: "tree-services",          label: "Tree Services",       emoji: "🌳" },
]

const DEFAULT_NICHES = ["hvac", "plumbing", "cleaning", "landscaping", "junk-removal", "auto-detailing"]

type Status = "idle" | "running" | "done" | "error"

export function ScrapeLeads() {
  const [selected,   setSelected]   = useState<Set<string>>(new Set(DEFAULT_NICHES))
  const [cities,     setCities]     = useState("Tracy, CA\nFresno, CA\nModesto, CA\nStockton, CA")
  const [target,     setTarget]     = useState(100)
  const [status,     setStatus]     = useState<Status>("idle")
  const [message,    setMessage]    = useState("")

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectTier1() {
    setSelected(new Set(["hvac", "plumbing", "roofing", "cleaning", "landscaping", "junk-removal", "auto-detailing", "pressure-washing"]))
  }

  async function run() {
    if (selected.size === 0) { setMessage("Select at least one niche"); return }
    setStatus("running")
    setMessage("")
    try {
      const cityList = cities.split("\n").map(c => c.trim()).filter(Boolean)
      const res  = await fetch("/api/scrape", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          niches: Array.from(selected),
          cities: cityList.length ? cityList : undefined,
          target,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus("done")
        setMessage(data.message)
      } else {
        setStatus("error")
        setMessage(data.error ?? "Scrape failed")
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
    <div
      style={{
        background:   "var(--surface)",
        border:       "1px solid var(--border)",
        borderRadius: 14,
        padding:      "24px 28px",
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
          Scrape Leads
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          Finds businesses with no/bad website. Saves to DB. No build, no deploy — just leads for calling.
        </div>
      </div>

      {/* Niche picker */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Niches ({selected.size} selected)
          </span>
          <button
            onClick={selectTier1}
            style={{ fontSize: 11, color: "var(--accent-light)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            Best 8 for closing →
          </button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {ALL_NICHES.map(n => {
            const on = selected.has(n.id)
            return (
              <button
                key={n.id}
                onClick={() => toggle(n.id)}
                style={{
                  padding:      "6px 11px",
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
                  gap:          5,
                }}
              >
                <span style={{ fontSize: 13 }}>{n.emoji}</span>
                {n.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Cities + count */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 16, marginBottom: 20 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 7 }}>
            Target Cities (one per line)
          </label>
          <textarea
            value={cities}
            onChange={e => setCities(e.target.value)}
            rows={4}
            placeholder={"Tracy, CA\nFresno, CA\nModesto, CA"}
            style={{ ...inp, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 7 }}>
            Target Count
          </label>
          <input
            type="number"
            min={10}
            max={500}
            value={target}
            onChange={e => setTarget(Number(e.target.value))}
            style={inp}
          />
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
            leads to find
          </div>
        </div>
      </div>

      {/* Run + status */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          onClick={run}
          disabled={status === "running"}
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          8,
            background:   status === "running" ? "var(--border-2)" : "#10b981",
            color:        "#fff",
            border:       "none",
            borderRadius: 9,
            padding:      "11px 24px",
            fontWeight:   700,
            fontSize:     14,
            cursor:       status === "running" ? "not-allowed" : "pointer",
            transition:   "background 0.12s",
          }}
        >
          {status === "running" ? (
            <><Loader2 size={15} className="anim-spin" /> Scraping…</>
          ) : (
            <><Search size={14} /> Scrape {target} Leads</>
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

        {status === "done" && (
          <a
            href="/calls"
            style={{ fontSize: 13, color: "var(--accent-light)", textDecoration: "none", fontWeight: 600, marginLeft: "auto" }}
          >
            View Call List →
          </a>
        )}
      </div>

      {status === "running" && (
        <div style={{ marginTop: 16, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
          Running in background. Takes 5-30 min depending on niche/city count.
          Check <a href="/leads" style={{ color: "var(--accent-light)" }}>Leads page</a> for progress.
        </div>
      )}
    </div>
  )
}
