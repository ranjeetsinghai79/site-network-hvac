"use client"

import { useState } from "react"
import { Play, Loader2, CheckCircle, XCircle } from "lucide-react"

const NICHES = [
  "hvac", "roofing", "dentist", "medspa", "lawfirm",
  "remodeling", "cleaning", "junk-removal", "daycare",
  "auto-detailing", "restaurant", "luxury-realestate",
]

const TIER_INFO = {
  regular: { emoji: "🟢", label: "Regular",  price: "$299–499", desc: "Hero images + email outreach" },
  premium: { emoji: "⭐", label: "Premium",  price: "$599–999", desc: "Kling v3 scroll video + priority" },
  custom:  { emoji: "💎", label: "Custom",   price: "$1,500+",  desc: "Bespoke components + white-glove" },
} as const

type Tier   = keyof typeof TIER_INFO
type Status = "idle" | "running" | "done" | "error"

export function RunPipeline() {
  const [niche,    setNiche]    = useState("hvac")
  const [location, setLocation] = useState("")
  const [count,    setCount]    = useState(5)
  const [tier,     setTier]     = useState<Tier>("regular")
  const [dryRun,   setDryRun]   = useState(false)
  const [status,   setStatus]   = useState<Status>("idle")
  const [message,  setMessage]  = useState("")

  async function run() {
    if (!location.trim()) { setMessage("Enter a location first"); return }
    setStatus("running")
    setMessage("")
    try {
      const res  = await fetch("/api/pipeline", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ niche, location, count, tier, dryRun }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus("done")
        setMessage(data.message)
      } else {
        setStatus("error")
        setMessage(data.error ?? "Pipeline failed")
      }
    } catch (e: any) {
      setStatus("error")
      setMessage(e.message)
    }
  }

  const label = {
    fontSize:      11,
    fontWeight:    700,
    color:         "var(--muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.07em",
    display:       "block",
    marginBottom:  7,
  }

  const field = {
    width:        "100%",
    background:   "var(--surface-2)",
    border:       "1px solid var(--border-2)",
    borderRadius: 8,
    color:        "var(--text)",
    padding:      "9px 12px",
    fontSize:     13,
    outline:      "none",
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
      {/* Tier selector */}
      <div style={{ marginBottom: 24 }}>
        <span style={label}>Tier</span>
        <div style={{ display: "flex", gap: 10 }}>
          {(Object.keys(TIER_INFO) as Tier[]).map(t => {
            const info    = TIER_INFO[t]
            const active  = tier === t
            return (
              <button
                key={t}
                onClick={() => setTier(t)}
                style={{
                  flex:         1,
                  padding:      "12px 14px",
                  borderRadius: 10,
                  cursor:       "pointer",
                  border:       `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  background:   active ? "var(--accent-dim-2)" : "transparent",
                  textAlign:    "left",
                  transition:   "all 0.12s",
                }}
              >
                <div style={{ fontSize: 16, marginBottom: 4 }}>{info.emoji}</div>
                <div
                  style={{
                    fontSize:   13,
                    fontWeight: 700,
                    color:      active ? "var(--accent-light)" : "var(--text)",
                    marginBottom: 2,
                  }}
                >
                  {info.label}
                </div>
                <div
                  style={{
                    fontSize:   12,
                    fontWeight: 700,
                    color:      active ? "var(--accent-light)" : "var(--text-2)",
                    marginBottom: 3,
                  }}
                >
                  {info.price}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  {info.desc}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Fields */}
      <div
        style={{
          display:             "grid",
          gridTemplateColumns: "1fr 1.5fr 80px",
          gap:                 16,
          marginBottom:        20,
        }}
      >
        <div>
          <label style={label}>Niche</label>
          <select value={niche} onChange={e => setNiche(e.target.value)} style={field}>
            {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div>
          <label style={label}>Location</label>
          <input
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="e.g. Tracy, CA"
            style={field}
          />
        </div>

        <div>
          <label style={label}>Count</label>
          <input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={e => setCount(Number(e.target.value))}
            style={field}
          />
        </div>
      </div>

      {/* Dry run toggle */}
      <div
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          10,
          marginBottom: 20,
        }}
      >
        <button
          onClick={() => setDryRun(d => !d)}
          style={{
            width:        36,
            height:       20,
            borderRadius: 10,
            background:   dryRun ? "var(--accent)" : "var(--border-2)",
            border:       "none",
            cursor:       "pointer",
            position:     "relative",
            flexShrink:   0,
            transition:   "background 0.15s",
          }}
        >
          <div
            style={{
              position:     "absolute",
              top:          2,
              left:         dryRun ? 18 : 2,
              width:        16,
              height:       16,
              borderRadius: "50%",
              background:   "#fff",
              transition:   "left 0.15s",
            }}
          />
        </button>
        <span style={{ fontSize: 13, color: dryRun ? "var(--accent-light)" : "var(--text-2)" }}>
          Dry run{" "}
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            {dryRun ? "— no GitHub / Cloudflare / email" : "— live mode"}
          </span>
        </span>
      </div>

      {/* Run button + status */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          onClick={run}
          disabled={status === "running"}
          style={{
            display:        "flex",
            alignItems:     "center",
            gap:            8,
            background:
              status === "running" ? "var(--border-2)" : "var(--accent)",
            color:          "#fff",
            border:         "none",
            borderRadius:   9,
            padding:        "11px 28px",
            fontWeight:     700,
            fontSize:       14,
            cursor:         status === "running" ? "not-allowed" : "pointer",
            transition:     "background 0.12s",
          }}
        >
          {status === "running" ? (
            <><Loader2 size={15} className="anim-spin" /> Running…</>
          ) : (
            <><Play size={14} fill="#fff" /> Run Pipeline</>
          )}
        </button>

        {message && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {status === "done"  && <CheckCircle size={14} color="var(--success)" />}
            {status === "error" && <XCircle     size={14} color="var(--error)"   />}
            <span
              style={{
                fontSize: 13,
                color:
                  status === "error"
                    ? "var(--error)"
                    : status === "done"
                    ? "var(--success)"
                    : "var(--muted)",
              }}
            >
              {message}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
