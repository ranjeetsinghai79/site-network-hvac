import { db, getMeta, setMeta } from "./db"
import { listTabs, readTab } from "./sheets"
import { parseRow } from "./parse"

export interface SyncResult {
  tabs: { tab: string; rows: number; added: number; removed: number }[]
  skipped: string[]
  total: number
  ms: number
}

const g = globalThis as unknown as { __syncRunning?: boolean }

// Pull every lead tab (header starts "Date Added","Business Name") into the local cache.
// Validation results live only in the cache, so upsert must never touch the check_* columns.
export async function syncFromSheet(): Promise<SyncResult> {
  if (g.__syncRunning) throw new Error("A sync is already running")
  g.__syncRunning = true
  const t0 = Date.now()
  try {
    const d = db()
    const now = Date.now()
    const out: SyncResult = { tabs: [], skipped: [], total: 0, ms: 0 }

    for (const tab of await listTabs()) {
      const rows = await readTab(tab)
      const header = rows[0] ?? []
      if (header[0]?.trim() !== "Date Added" || header[1]?.trim() !== "Business Name") {
        out.skipped.push(tab)
        continue
      }

      const before = Number((d.prepare("SELECT COUNT(*) n FROM sheet_leads WHERE tab = ?").get(tab) as { n: number }).n)
      const upsert = d.prepare(`
        INSERT INTO sheet_leads (key, tab, sheet_row, date_added, added_ts, name, niche, city, state, phone, email,
          business_email, owner_email, sheet_has_website, website_url, maps_url, tier, rating, reviews, can_sms,
          outreach_note, synced_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(key) DO UPDATE SET
          sheet_row=excluded.sheet_row, date_added=excluded.date_added, added_ts=excluded.added_ts,
          name=excluded.name, niche=excluded.niche, city=excluded.city, state=excluded.state,
          phone=excluded.phone, email=excluded.email, business_email=excluded.business_email,
          owner_email=excluded.owner_email, sheet_has_website=excluded.sheet_has_website,
          -- a changed URL invalidates the old check
          check_status = CASE WHEN website_url IS excluded.website_url THEN check_status ELSE NULL END,
          website_url=excluded.website_url, maps_url=excluded.maps_url, tier=excluded.tier,
          rating=excluded.rating, reviews=excluded.reviews, can_sms=excluded.can_sms,
          outreach_note=excluded.outreach_note, synced_at=excluded.synced_at`)

      d.exec("BEGIN")
      try {
        for (let i = 1; i < rows.length; i++) {
          const p = parseRow(tab, rows[i])
          if (!p) continue
          upsert.run(p.key, tab, i + 1, p.dateAdded, p.addedTs, p.name, p.niche, p.city, p.state, p.phone, p.email,
            p.businessEmail, p.ownerEmail, p.sheetHasWebsite, p.websiteUrl, p.mapsUrl, p.tier, p.rating, p.reviews,
            p.canSms, p.outreachNote, now)
        }
        // Rows no longer in the sheet (moved tabs, manual deletes) drop out of the cache.
        const removed = d.prepare("DELETE FROM sheet_leads WHERE tab = ? AND synced_at < ?").run(tab, now).changes
        d.exec("COMMIT")
        const after = Number((d.prepare("SELECT COUNT(*) n FROM sheet_leads WHERE tab = ?").get(tab) as { n: number }).n)
        out.tabs.push({ tab, rows: after, added: Math.max(0, after - before), removed: Number(removed) })
        out.total += after
      } catch (e) {
        d.exec("ROLLBACK")
        throw e
      }
    }

    // Tabs deleted from the sheet entirely.
    const known = out.tabs.map(t => t.tab)
    if (known.length) {
      d.prepare(`DELETE FROM sheet_leads WHERE tab NOT IN (${known.map(() => "?").join(",")})`).run(...known)
    }
    out.ms = Date.now() - t0
    setMeta("last_synced_at", String(Date.now()))
    setMeta("last_sync_summary", JSON.stringify({ total: out.total, tabs: out.tabs.length, skipped: out.skipped }))
    return out
  } finally {
    g.__syncRunning = false
  }
}

export function lastSync() {
  const at = getMeta("last_synced_at")
  return at ? Number(at) : null
}
