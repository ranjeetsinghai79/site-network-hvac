// Local-only SQLite cache of the Google Sheet leads + website-check results.
// node:sqlite is fetched via process.getBuiltinModule so the bundler never tries to resolve it.
import path from "path"
import fs from "fs"

type Db = {
  exec(sql: string): void
  prepare(sql: string): {
    run(...p: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint }
    all(...p: unknown[]): Record<string, unknown>[]
    get(...p: unknown[]): Record<string, unknown> | undefined
  }
}

const g = globalThis as unknown as { __sheetLeadsDb?: Db }

export function db(): Db {
  if (g.__sheetLeadsDb) return g.__sheetLeadsDb
  const sqlite = process.getBuiltinModule("node:sqlite") as {
    DatabaseSync: new (file: string) => Db
  }
  const dir = path.join(process.cwd(), ".local-data")
  fs.mkdirSync(dir, { recursive: true })
  const d = new sqlite.DatabaseSync(path.join(dir, "sheet-leads.db"))
  d.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sheet_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      tab TEXT NOT NULL,
      sheet_row INTEGER,
      date_added TEXT,
      added_ts INTEGER,
      name TEXT, niche TEXT, city TEXT, state TEXT, phone TEXT, email TEXT,
      business_email TEXT, owner_email TEXT,
      sheet_has_website TEXT, website_url TEXT, maps_url TEXT, tier TEXT,
      rating REAL, reviews INTEGER, can_sms TEXT, outreach_note TEXT,
      synced_at INTEGER,
      check_status TEXT, check_http INTEGER, check_final_url TEXT,
      check_error TEXT, check_ms INTEGER, checked_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS ix_sl_tab ON sheet_leads(tab);
    CREATE INDEX IF NOT EXISTS ix_sl_added ON sheet_leads(added_ts);
    CREATE INDEX IF NOT EXISTS ix_sl_status ON sheet_leads(check_status);
    CREATE TABLE IF NOT EXISTS sync_meta (k TEXT PRIMARY KEY, v TEXT);
  `)
  g.__sheetLeadsDb = d
  return d
}

export function getMeta(k: string): string | null {
  const r = db().prepare("SELECT v FROM sync_meta WHERE k = ?").get(k)
  return r ? String(r.v) : null
}
export function setMeta(k: string, v: string) {
  db().prepare("INSERT INTO sync_meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").run(k, v)
}
