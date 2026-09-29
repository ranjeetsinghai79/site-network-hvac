"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { RefreshCw, ShieldCheck, ExternalLink, Loader2, Square } from "lucide-react"

interface Row {
  id: number; tab: string; name: string; niche: string; city: string; state: string
  phone: string; tier: string; date_added: string; added_ts: number | null
  website_url: string; maps_url: string
  check_status: string | null; check_http: number | null; check_final_url: string | null
  check_error: string | null; checked_at: number | null
}
interface Stats {
  total: number
  byTab: { tab: string; n: number }[]
  byStatus: { s: string; n: number }[]
  age: { oldest: number | null; newest: number | null; unknown: number | null }
}
interface Job { id: string; total: number; done: number; counts: Record<string, number>; status: string }
interface Filters { q: string; tab: string; tier: string; status: string; age: string; sheetSite: string }

const EMPTY: Filters = { q: "", tab: "", tier: "", status: "", age: "", sheetSite: "" }
const DAY = 86_400_000

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  live:         { label: "Live",          color: "var(--success)", bg: "var(--success-dim)" },
  live_blocked: { label: "Live (bot-wall)", color: "var(--success)", bg: "var(--success-dim)" },
  ssl_error:    { label: "SSL error",     color: "var(--warning)", bg: "var(--warning-dim)" },
  parked:       { label: "Parked",        color: "var(--warning)", bg: "var(--warning-dim)" },
  social:       { label: "Social only",   color: "var(--info)",    bg: "var(--info-dim)"    },
  timeout:      { label: "Timeout",       color: "var(--warning)", bg: "var(--warning-dim)" },
  down:         { label: "Down (5xx)",    color: "var(--error)",   bg: "var(--error-dim)"   },
  dead:         { label: "Dead",          color: "var(--error)",   bg: "var(--error-dim)"   },
  no_website:   { label: "No website",    color: "var(--text-2)",  bg: "var(--surface-2)"   },
  unchecked:    { label: "Unchecked",     color: "var(--muted)",   bg: "var(--surface-2)"   },
}

function ageOf(ts: number | null): { text: string; color: string } {
  if (ts == null) return { text: "unknown", color: "var(--muted)" }
  const d = Math.floor((Date.now() - ts) / DAY)
  const text = d < 1 ? "today" : d < 60 ? `${d}d` : d < 730 ? `${Math.round(d / 30)}mo` : `${(d / 365).toFixed(1)}y`
  return { text, color: d <= 7 ? "var(--success)" : d <= 30 ? "var(--info)" : d <= 90 ? "var(--warning)" : "var(--text-2)" }
}

function ago(ts: number | null): string {
  if (!ts) return ""
  const m = Math.floor((Date.now() - ts) / 60_000)
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`
}

const btn = (primary = false, disabled = false): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: 12, fontWeight: 600,
  borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
  border: `1px solid ${primary ? "var(--accent)" : "var(--border-2)"}`,
  background: primary ? "var(--accent)" : "var(--surface)", color: primary ? "#fff" : "var(--text)",
})
const input: React.CSSProperties = {
  padding: "7px 10px", fontSize: 12, borderRadius: 8, background: "var(--surface)",
  border: "1px solid var(--border-2)", color: "var(--text)",
}

export function SheetLeadsTable() {
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [lastSynced, setLastSynced] = useState<number | null>(null)
  const [f, setF] = useState<Filters>(EMPTY)
  const [sort, setSort] = useState({ col: "added_ts", dir: "desc" })
  const [page, setPage] = useState(0)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [job, setJob] = useState<Job | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState<string>("")
  const pageSize = 100
  const reqId = useRef(0)

  const qs = useCallback((extra: Record<string, string> = {}) => {
    const p = new URLSearchParams()
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v))
    Object.entries(extra).forEach(([k, v]) => p.set(k, v))
    return p
  }, [f])

  const load = useCallback(async () => {
    const my = ++reqId.current
    const res = await fetch(`/api/local/sheet-leads?${qs({ sort: sort.col, dir: sort.dir, page: String(page), pageSize: String(pageSize) })}`)
    if (!res.ok) { setMsg(`Load failed (${res.status})`); return }
    const d = await res.json()
    if (my !== reqId.current) return
    setRows(d.rows); setTotal(d.total); setStats(d.stats); setLastSynced(d.lastSyncedAt)
  }, [qs, sort, page])

  useEffect(() => { void load() }, [load])
  useEffect(() => { setPage(0); setSel(new Set()) }, [f, sort])

  // Poll the background validation job; refresh rows while it runs so results appear live.
  useEffect(() => {
    void fetch("/api/local/sheet-leads/validate").then(r => r.json()).then(d => setJob(d.job))
  }, [])
  useEffect(() => {
    if (job?.status !== "running") return
    const t = setInterval(async () => {
      const d = await (await fetch("/api/local/sheet-leads/validate")).json()
      setJob(d.job)
      void load()
    }, 1500)
    return () => clearInterval(t)
  }, [job?.status, load])

  const sync = async () => {
    setSyncing(true); setMsg("Syncing from Google Sheet… (can take ~1 min for 80k rows)")
    const res = await fetch("/api/local/sheet-leads/sync", { method: "POST" })
    const d = await res.json()
    setSyncing(false)
    setMsg(res.ok ? `Synced ${d.total.toLocaleString()} leads from ${d.tabs.length} tabs in ${(d.ms / 1000).toFixed(0)}s` : `Sync failed: ${d.error}`)
    void load()
  }

  const validate = async (body: { ids?: number[]; filter?: Filters }, label: string, count: number) => {
    if (count > 500 && !confirm(`Check ${count.toLocaleString()} websites? Runs 12 at a time in the background (~${Math.ceil(count / 12 * 3 / 60)} min).`)) return
    const res = await fetch("/api/local/sheet-leads/validate", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    const d = await res.json()
    if (!res.ok) { setMsg(d.error); return }
    setJob(d); setMsg(`Validating ${label}…`)
  }

  const setFilter = (k: keyof Filters, v: string) => setF(prev => ({ ...prev, [k]: v }))
  const sortBy = (col: string) => setSort(s => ({ col, dir: s.col === col && s.dir === "desc" ? "asc" : "desc" }))
  const running = job?.status === "running"
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const allSel = rows.length > 0 && rows.every(r => sel.has(r.id))
  const th = (label: string, col?: string): React.ReactNode => (
    <th onClick={col ? () => sortBy(col) : undefined}
      style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.05em", color: "var(--text-2)", cursor: col ? "pointer" : "default", whiteSpace: "nowrap" }}>
      {label}{col && sort.col === col ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  )

  return (
    <div>
      {/* Stats */}
      {stats && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <Chip label="Total" value={stats.total.toLocaleString()} />
          <Chip label="Newest" value={stats.age.newest ? ageOf(stats.age.newest).text : "—"} />
          <Chip label="Oldest" value={stats.age.oldest ? ageOf(stats.age.oldest).text : "—"} />
          {!!stats.age.unknown && <Chip label="No date" value={String(stats.age.unknown)} />}
          {stats.byStatus.map(s => (
            <Chip key={s.s} label={STATUS[s.s]?.label ?? s.s} value={s.n.toLocaleString()} color={STATUS[s.s]?.color}
              active={f.status === s.s} onClick={() => setFilter("status", f.status === s.s ? "" : s.s)} />
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <button style={btn(true, syncing)} disabled={syncing} onClick={sync}>
          {syncing ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />} Sync from sheet
        </button>
        <span style={{ fontSize: 11, color: "var(--text-2)" }}>
          {lastSynced ? `last synced ${ago(lastSynced)}` : "never synced — click Sync"}
        </span>
        <div style={{ flex: 1 }} />
        <input style={{ ...input, width: 200 }} placeholder="Search name, city, phone, site…" value={f.q}
          onChange={e => setFilter("q", e.target.value)} />
        <select style={input} value={f.tab} onChange={e => setFilter("tab", e.target.value)}>
          <option value="">All tabs</option>
          {stats?.byTab.map(t => <option key={t.tab} value={t.tab}>{t.tab} ({t.n.toLocaleString()})</option>)}
        </select>
        <select style={input} value={f.tier} onChange={e => setFilter("tier", e.target.value)}>
          <option value="">All tiers</option><option value="tier1">Tier 1 (no site)</option><option value="tier2">Tier 2 (has site)</option>
        </select>
        <select style={input} value={f.age} onChange={e => setFilter("age", e.target.value)}>
          <option value="">Any age</option><option value="7">Added ≤ 7 days</option><option value="30">Added ≤ 30 days</option>
          <option value="90">Added ≤ 90 days</option><option value="older90">Older than 90 days</option><option value="unknown">No date</option>
        </select>
        <select style={input} value={f.sheetSite} onChange={e => setFilter("sheetSite", e.target.value)}>
          <option value="">Sheet: any</option><option value="yes">Sheet lists a website</option><option value="no">Sheet lists none</option>
        </select>
        {Object.values(f).some(Boolean) && <button style={btn()} onClick={() => setF(EMPTY)}>Clear</button>}
      </div>

      {/* Bulk actions */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <button style={btn(false, running || !total)} disabled={running || !total}
          onClick={() => validate({ filter: f }, `${total.toLocaleString()} filtered leads`, total)}>
          <ShieldCheck size={13} /> Validate {Object.values(f).some(Boolean) ? "filtered" : "all"} ({total.toLocaleString()})
        </button>
        <button style={btn(false, running || !sel.size)} disabled={running || !sel.size}
          onClick={() => validate({ ids: [...sel] }, `${sel.size} selected`, sel.size)}>
          <ShieldCheck size={13} /> Validate selected ({sel.size})
        </button>
        {running && (
          <>
            <div style={{ flex: 1, maxWidth: 320, height: 6, background: "var(--surface-2)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${(job!.done / Math.max(1, job!.total)) * 100}%`, height: "100%", background: "var(--accent)" }} />
            </div>
            <span style={{ fontSize: 12, color: "var(--text-2)" }}>{job!.done.toLocaleString()} / {job!.total.toLocaleString()}</span>
            <button style={btn()} onClick={async () => setJob((await (await fetch("/api/local/sheet-leads/validate", { method: "DELETE" })).json()).job)}>
              <Square size={11} /> Stop
            </button>
          </>
        )}
        {!running && job && <span style={{ fontSize: 12, color: "var(--text-2)" }}>
          Last job {job.status}: {job.done.toLocaleString()} checked
          {Object.entries(job.counts).map(([k, v]) => ` · ${STATUS[k]?.label ?? k} ${v}`).join("")}
        </span>}
      </div>
      {msg && <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 10 }}>{msg}</p>}

      {/* Table */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflowX: "auto", background: "var(--surface)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead style={{ background: "var(--surface-2)" }}>
            <tr>
              <th style={{ padding: "10px 12px", width: 30 }}>
                <input type="checkbox" checked={allSel}
                  onChange={() => setSel(allSel ? new Set() : new Set(rows.map(r => r.id)))} />
              </th>
              {th("Business", "name")}{th("Tab", "tab")}{th("City", "city")}{th("Added", "added_ts")}
              {th("Website")}{th("Live check", "checked_at")}{th("Tier", "tier")}{th("")}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const a = ageOf(r.added_ts)
              const st = STATUS[r.check_status ?? "unchecked"]
              return (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 12px" }}>
                    <input type="checkbox" checked={sel.has(r.id)} onChange={() => setSel(s => {
                      const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n
                    })} />
                  </td>
                  <td style={{ padding: "8px 12px", color: "var(--text)", fontWeight: 600, maxWidth: 240 }}>
                    {r.name}
                    <div style={{ fontWeight: 400, color: "var(--text-2)", fontSize: 11 }}>{r.phone}</div>
                  </td>
                  <td style={{ padding: "8px 12px", color: "var(--text-2)" }}>{r.tab}</td>
                  <td style={{ padding: "8px 12px", color: "var(--text-2)" }}>{[r.city, r.state].filter(Boolean).join(", ")}</td>
                  <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                    <span style={{ color: a.color, fontWeight: 700 }}>{a.text}</span>
                    <div style={{ color: "var(--muted)", fontSize: 11 }}>{r.date_added || "no date"}</div>
                  </td>
                  <td style={{ padding: "8px 12px", maxWidth: 220 }}>
                    {r.website_url
                      ? <a href={r.website_url} target="_blank" rel="noreferrer" style={{ color: "var(--accent-light)", textDecoration: "none", display: "inline-flex", gap: 4, alignItems: "center" }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 190 }}>{r.website_url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                          <ExternalLink size={11} />
                        </a>
                      : <span style={{ color: "var(--muted)" }}>none in sheet</span>}
                  </td>
                  <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }} title={r.check_error ?? r.check_final_url ?? ""}>
                    <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, color: st.color, background: st.bg }}>
                      {st.label}{r.check_http ? ` ${r.check_http}` : ""}
                    </span>
                    {r.checked_at && <div style={{ color: "var(--muted)", fontSize: 11 }}>{ago(r.checked_at)}</div>}
                  </td>
                  <td style={{ padding: "8px 12px", color: "var(--text-2)" }}>{r.tier || "—"}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <button style={btn(false, running)} disabled={running}
                      onClick={() => validate({ ids: [r.id] }, r.name, 1)}>Check</button>
                  </td>
                </tr>
              )
            })}
            {!rows.length && (
              <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: "var(--text-2)" }}>
                {stats?.total === 0 ? "Nothing cached yet — click “Sync from sheet”." : "No leads match these filters."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", marginTop: 12, fontSize: 12, color: "var(--text-2)" }}>
        <span>{total ? `${page * pageSize + 1}–${Math.min(total, (page + 1) * pageSize)} of ${total.toLocaleString()}` : "0 results"}</span>
        <button style={btn(false, page === 0)} disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
        <span>{page + 1} / {pages}</span>
        <button style={btn(false, page + 1 >= pages)} disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>Next</button>
      </div>
      <style>{`.spin{animation:sl-spin 1s linear infinite}@keyframes sl-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function Chip({ label, value, color, active, onClick }: { label: string; value: string; color?: string; active?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      padding: "6px 12px", borderRadius: 8, background: "var(--surface)", cursor: onClick ? "pointer" : "default",
      border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: color ?? "var(--text-2)", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)" }}>{value}</div>
    </div>
  )
}
