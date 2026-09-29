"use client"

import { useState, useMemo, Fragment } from "react"
import {
  ChevronDown,
  ChevronRight,
  Phone,
  AlertTriangle,
  Download,
  User,
} from "lucide-react"
import type { ReceptionCallRow, ReceptionConfigOption } from "@/lib/db"

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—"
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function csvEscape(value: string | null | undefined): string {
  const v = value ?? ""
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

// Default view hides scam robocalls and our own test traffic so the list shows real prospects.
const TRUST_HIDDEN_BY_DEFAULT = new Set(["suspected_bot", "self", "owner"])
const TRUST_LABELS: Record<string, string> = { human: "Human", widget: "Web chat", suspected_bot: "Robocall", no_speech: "No speech", self: "Own line", owner: "Owner", unknown: "Unclear" }
function trustColor(t: string | null): string {
  if (t === "human") return "var(--success)"
  if (t === "suspected_bot") return "var(--error)"
  if (t === "widget") return "var(--accent-light)"
  return "var(--muted)"
}

function sentimentColors(sentiment: string | null): { color: string; background: string; border: string } {
  if (sentiment === "positive") return { color: "var(--success)", background: "var(--success-dim)", border: "rgba(16,185,129,0.25)" }
  if (sentiment === "negative") return { color: "var(--error)", background: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)" }
  return { color: "var(--muted)", background: "var(--surface-2)", border: "var(--border-2)" }
}

export function ReceptionCallsTable({
  calls,
  configs,
}: {
  calls: ReceptionCallRow[]
  configs: ReceptionConfigOption[]
}) {
  const [search,         setSearch]         = useState("")
  const [configFilter,   setConfigFilter]   = useState("all")
  const [escalatedOnly,  setEscalatedOnly]  = useState(false)
  const [trustFilter,    setTrustFilter]    = useState("clean")
  const [expanded,       setExpanded]       = useState<Set<string>>(new Set())

  const configName = useMemo(() => {
    const m = new Map(configs.map(c => [c.id, c]))
    return (id: string | null) => id ? (m.get(id)?.business_name ?? id.slice(0, 8)) : "—"
  }, [configs])

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return calls.filter(c => {
      if (s && !c.caller_number?.toLowerCase().includes(s) && !c.lead_name?.toLowerCase().includes(s)) return false
      if (configFilter !== "all" && c.reception_config_id !== configFilter) return false
      if (escalatedOnly && !c.escalated) return false
      if (trustFilter === "clean" && c.trust && TRUST_HIDDEN_BY_DEFAULT.has(c.trust)) return false
      if (trustFilter !== "clean" && trustFilter !== "all" && (c.trust ?? "unlabeled") !== trustFilter) return false
      return true
    })
  }, [calls, search, configFilter, escalatedOnly, trustFilter])

  function toggleExpand(id: string) {
    setExpanded(e => {
      const n = new Set(e)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  function exportCsv() {
    const header = ["Date", "Caller", "Business", "Demo Line", "Duration", "Escalated", "Lead Name", "Lead Email", "Lead Niche", "Message Taken", "Summary", "Sentiment", "Transcript"]
    const lines = filtered.map(c => [
      new Date(c.created_at).toISOString(),
      c.caller_number ?? "",
      configName(c.reception_config_id),
      configs.find(cfg => cfg.id === c.reception_config_id)?.website_url ?? "",
      formatDuration(c.duration_seconds),
      c.escalated ? "yes" : "no",
      c.lead_name ?? "",
      c.lead_email ?? "",
      c.lead_niche ?? "",
      c.message_taken ?? "",
      c.summary ?? "",
      c.sentiment ?? "",
      c.transcript ?? "",
    ].map(csvEscape).join(","))
    const csv = [header.join(","), ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href     = url
    a.download = `reception-calls-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
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
          placeholder="Search caller number or name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inp, width: 220 }}
        />
        <select value={configFilter} onChange={e => setConfigFilter(e.target.value)} style={inp}>
          <option value="all">All demo lines</option>
          {configs.map(c => (
            <option key={c.id} value={c.id}>{c.business_name} — {c.website_url}</option>
          ))}
        </select>
        <select value={trustFilter} onChange={e => setTrustFilter(e.target.value)} style={inp}>
          <option value="clean">Hide robocalls &amp; own/owner calls</option>
          <option value="all">All calls</option>
          {Object.entries(TRUST_LABELS).map(([k, v]) => <option key={k} value={k}>{v} only</option>)}
        </select>
        <button
          onClick={() => setEscalatedOnly(v => !v)}
          style={{
            padding:      "7px 12px",
            borderRadius: 7,
            fontSize:     12,
            fontWeight:   600,
            cursor:       "pointer",
            border:       `1px solid ${escalatedOnly ? "var(--error)" : "var(--border-2)"}`,
            background:   escalatedOnly ? "rgba(239,68,68,0.1)" : "transparent",
            color:        escalatedOnly ? "var(--error)" : "var(--text-2)",
            display:      "flex",
            alignItems:   "center",
            gap:          5,
          }}
        >
          <AlertTriangle size={12} /> Escalated only
        </button>
        <button
          onClick={exportCsv}
          style={{
            padding:      "7px 12px",
            borderRadius: 7,
            fontSize:     12,
            fontWeight:   600,
            cursor:       "pointer",
            border:       "1px solid var(--border-2)",
            background:   "transparent",
            color:        "var(--accent-light)",
            display:      "flex",
            alignItems:   "center",
            gap:          5,
          }}
        >
          <Download size={12} /> Export CSV
        </button>
        <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
          {filtered.length} / {calls.length}
        </span>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
              <th style={{ width: 36 }} />
              <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Caller</th>
              <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Demo Line</th>
              <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>When</th>
              <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Duration</th>
              <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Prospect</th>
              <th style={{ width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const isOpen = expanded.has(c.id)
              const isEven = i % 2 === 0
              return (
                <Fragment key={c.id}>
                  <tr
                    onClick={() => toggleExpand(c.id)}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background:   isOpen ? "rgba(99,102,241,0.05)" : isEven ? "transparent" : "rgba(255,255,255,0.007)",
                      cursor:       "pointer",
                    }}
                  >
                    <td style={{ padding: "10px 0 10px 12px", color: "var(--muted)", width: 36 }}>
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: "var(--text)", fontFamily: "monospace", fontSize: 12.5 }}>
                        <Phone size={12} color="var(--muted)" />
                        {c.caller_number ?? "unknown"}
                        {c.trust && (
                          <span title={c.stir_verstat ? `Caller-ID check: ${c.stir_verstat}` : undefined}
                                style={{ fontFamily: "inherit", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: trustColor(c.trust), border: `1px solid ${trustColor(c.trust)}`, borderRadius: 999, padding: "1px 7px", opacity: 0.9 }}>
                            {TRUST_LABELS[c.trust] ?? c.trust}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-2)", fontSize: 12 }}>
                      {configName(c.reception_config_id)}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-2)", fontSize: 12 }}>
                      {new Date(c.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-2)", fontSize: 12 }}>
                      {formatDuration(c.duration_seconds)}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {c.lead_id ? (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                          color: "var(--success)", background: "var(--success-dim)",
                          border: "1px solid rgba(16,185,129,0.25)", borderRadius: 999,
                          padding: "3px 8px",
                        }}>
                          <User size={9} /> {c.lead_name ?? "captured"}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>no message</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {c.escalated && (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                            color: "var(--error)", background: "rgba(239,68,68,0.1)",
                            border: "1px solid rgba(239,68,68,0.25)", borderRadius: 999,
                            padding: "3px 8px",
                          }}>
                            <AlertTriangle size={9} /> Escalated
                          </span>
                        )}
                        {c.sentiment && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                            borderRadius: 999, padding: "3px 8px",
                            ...sentimentColors(c.sentiment),
                            border: `1px solid ${sentimentColors(c.sentiment).border}`,
                          }}>
                            {c.sentiment}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <td colSpan={7} style={{ padding: 0 }}>
                        <div
                          style={{
                            background: "rgba(99,102,241,0.04)",
                            borderTop:  "1px solid var(--border)",
                            padding:    "16px 24px 16px 60px",
                            display:    "flex",
                            flexDirection: "column",
                            gap:        10,
                          }}
                        >
                          {c.lead_email && (
                            <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                              <strong style={{ color: "var(--text)" }}>Email:</strong> {c.lead_email}
                              {c.lead_niche && <> · <strong style={{ color: "var(--text)" }}>Niche:</strong> {c.lead_niche}</>}
                              {c.lead_status && <> · <strong style={{ color: "var(--text)" }}>Status:</strong> {c.lead_status}</>}
                            </div>
                          )}
                          {c.message_taken && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                                Message Taken
                              </div>
                              <div style={{ fontSize: 12.5, color: "var(--text-2)", whiteSpace: "pre-wrap" }}>
                                {c.message_taken}
                              </div>
                            </div>
                          )}
                          {c.escalation_reason && (
                            <div style={{ fontSize: 12, color: "var(--error)" }}>
                              <strong>Escalation reason:</strong> {c.escalation_reason}
                            </div>
                          )}
                          {c.summary && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                                Summary
                              </div>
                              <div style={{ fontSize: 12.5, color: "var(--text-2)", whiteSpace: "pre-wrap" }}>
                                {c.summary}
                              </div>
                            </div>
                          )}
                          {c.recording_url && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                                Recording
                              </div>
                              <audio controls src={c.recording_url} style={{ width: "100%", height: 32 }} />
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                              Transcript
                            </div>
                            <div style={{
                              fontSize: 12.5, color: "var(--text-2)", whiteSpace: "pre-wrap",
                              maxHeight: 320, overflowY: "auto",
                              background: "var(--surface)", border: "1px solid var(--border)",
                              borderRadius: 8, padding: "10px 12px",
                            }}>
                              {c.transcript || "No transcript recorded."}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: 48, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
          No calls match the filter.
        </div>
      )}
    </div>
  )
}
