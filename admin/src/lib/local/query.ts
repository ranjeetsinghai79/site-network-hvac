import { db } from "./db"

export interface LeadFilter {
  tab?: string
  tier?: string
  status?: string      // a check_status, "unchecked", or "" for all
  age?: string         // "7" | "30" | "90" | "older90" | "unknown"
  sheetSite?: string   // "yes" | "no"
  q?: string
}

const DAY = 86_400_000

export function buildWhere(f: LeadFilter): { sql: string; params: unknown[] } {
  const w: string[] = []
  const p: unknown[] = []
  if (f.tab)  { w.push("tab = ?");  p.push(f.tab) }
  if (f.tier) { w.push("tier = ?"); p.push(f.tier) }
  if (f.status === "unchecked") w.push("check_status IS NULL")
  else if (f.status) { w.push("check_status = ?"); p.push(f.status) }
  if (f.sheetSite === "yes") w.push("website_url != ''")
  if (f.sheetSite === "no")  w.push("website_url = ''")
  const now = Date.now()
  if (f.age === "unknown") w.push("added_ts IS NULL")
  else if (f.age === "older90") { w.push("added_ts < ?"); p.push(now - 90 * DAY) }
  else if (f.age && /^\d+$/.test(f.age)) { w.push("added_ts >= ?"); p.push(now - Number(f.age) * DAY) }
  if (f.q?.trim()) {
    const like = `%${f.q.trim().toLowerCase()}%`
    w.push("(lower(name) LIKE ? OR lower(city) LIKE ? OR phone LIKE ? OR lower(website_url) LIKE ?)")
    p.push(like, like, like, like)
  }
  return { sql: w.length ? `WHERE ${w.join(" AND ")}` : "", params: p }
}

const SORTS = new Set(["added_ts", "name", "city", "tab", "checked_at", "tier"])

export function listLeads(f: LeadFilter, sort: string, dir: string, page: number, pageSize: number) {
  const { sql, params } = buildWhere(f)
  const col = SORTS.has(sort) ? sort : "added_ts"
  const order = dir === "asc" ? "ASC" : "DESC"
  // NULLs (unknown age / never checked) always sink to the bottom.
  const rows = db().prepare(
    `SELECT * FROM sheet_leads ${sql} ORDER BY ${col} IS NULL, ${col} ${order}, id LIMIT ? OFFSET ?`,
  ).all(...params, pageSize, page * pageSize)
  const total = Number((db().prepare(`SELECT COUNT(*) n FROM sheet_leads ${sql}`).get(...params) as { n: number }).n)
  return { rows, total }
}

export function idsForFilter(f: LeadFilter, limit: number): number[] {
  const { sql, params } = buildWhere(f)
  return db().prepare(`SELECT id FROM sheet_leads ${sql} LIMIT ?`).all(...params, limit).map(r => Number(r.id))
}

export function stats() {
  const d = db()
  const total = Number((d.prepare("SELECT COUNT(*) n FROM sheet_leads").get() as { n: number }).n)
  const byTab = d.prepare("SELECT tab, COUNT(*) n FROM sheet_leads GROUP BY tab ORDER BY n DESC").all()
  const byStatus = d.prepare("SELECT COALESCE(check_status,'unchecked') s, COUNT(*) n FROM sheet_leads GROUP BY 1").all()
  const age = d.prepare("SELECT MIN(added_ts) oldest, MAX(added_ts) newest, SUM(added_ts IS NULL) unknown FROM sheet_leads").get()
  return { total, byTab, byStatus, age }
}
