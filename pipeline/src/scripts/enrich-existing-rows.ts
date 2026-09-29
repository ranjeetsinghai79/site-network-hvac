/**
 * enrich-existing-rows.ts
 *
 * Backfills Business Email, Owner Email, Phone Type, Can SMS columns
 * for rows that don't have them yet.
 *
 * Usage:
 *   SHEET_TAB="MEDSPAS" npx tsx src/scripts/enrich-existing-rows.ts
 *   (no SHEET_TAB) → processes all tabs
 *
 * Env:
 *   SHEET_TAB       target tab (or all)
 *   ENRICH_NICHE    optional — only rows whose "Niche / Category" column matches
 *                   exactly (case-insensitive). Lets a single big tab (e.g. the
 *                   25k-row "Local SMBs") be worked niche-by-niche instead of
 *                   all-at-once.
 *   ENRICH_LIMIT    max rows to enrich per tab (default 500)
 *   ENRICH_CONCUR   concurrent website fetches (default 5)
 */

import 'dotenv/config'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createSign } from 'crypto'
import { lookupPhoneType } from '../tools/phone-lookup.js'
import { extractEmailsFromWebsite } from '../tools/email-extractor.js'

const SHEET_ID   = process.env.LEADS_SHEET_ID!
const TAB_ARG    = process.env.SHEET_TAB ?? ''
const NICHE_ARG  = process.env.ENRICH_NICHE?.trim().toLowerCase() ?? ''
const LIMIT      = parseInt(process.env.ENRICH_LIMIT  ?? '500')
const CONCUR     = parseInt(process.env.ENRICH_CONCUR ?? '5')

const ALL_TABS = [
  'Local SMBs','MEDSPAS','INDIA_MEDSPAS','USA_DentalOffices','INDIA_DentalOffices',
  'USA_Salons','USA_BarberShops','USA_FinancialAdvisorsandInsuranceAgents',
  'USA_RealEstateAgents','USA_Restaurants','India_Restaurants','USA_LawFirms',
  'USA_SkinClinics','USA_IVTherapy','USA_NailStudios','USA_CosmeticSurgeons',
  'USA_AutoDetailing','USA_HVAC','USA_Roofing','USA_Remodeling','USA_Plumbing',
]

// ─── Auth (auto-refresh every 45 min) ────────────────────────────────────────

let _tokenCache: { token: string; expiresAt: number } | null = null

async function getToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (_tokenCache && _tokenCache.expiresAt > now + 60) return _tokenCache.token

  let sa: any
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  else if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) sa = JSON.parse(readFileSync(resolve(process.env.GOOGLE_SERVICE_ACCOUNT_FILE), 'utf8'))
  else throw new Error('No service account configured')
  const h = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const p = Buffer.from(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now })).toString('base64url')
  const s = createSign('RSA-SHA256'); s.update(h + '.' + p)
  const jwt = h + '.' + p + '.' + s.sign(sa.private_key, 'base64url')
  const tk = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`, signal: AbortSignal.timeout(30000) })).json() as any
  if (!tk.access_token) throw new Error('Token error: ' + JSON.stringify(tk))
  _tokenCache = { token: tk.access_token, expiresAt: now + 3600 }
  return tk.access_token
}

// ─── Sheet read ───────────────────────────────────────────────────────────────

interface SheetRow {
  rowNum:      number   // 1-based sheet row (row 1 = header)
  niche:       string   // col C
  phone:       string
  state:       string
  websiteUrl:  string
  bizEmail:    string   // col S — may be empty
  ownerEmail:  string   // col T
  phoneType:   string   // col U
  canSms:      string   // col V
}

async function readRows(tab: string): Promise<SheetRow[]> {
  const token = await getToken()
  const range = encodeURIComponent(`${tab}!A2:V`)
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) return []
  const d = await res.json() as any
  const rows: SheetRow[] = []
  for (let i = 0; i < (d.values?.length ?? 0); i++) {
    const r = d.values[i] as string[]
    rows.push({
      rowNum:     i + 2,        // +2 because we skip header (row 1) and array is 0-based
      niche:      r[2]  ?? '',  // col C
      state:      r[4]  ?? '',  // col E
      phone:      r[6]  ?? '',  // col G
      websiteUrl: r[9]  ?? '',  // col J
      bizEmail:   r[18] ?? '',  // col S
      ownerEmail: r[19] ?? '',  // col T
      phoneType:  r[20] ?? '',  // col U
      canSms:     r[21] ?? '',  // col V
    })
  }
  return rows
}

// ─── Sheet write (batch) ──────────────────────────────────────────────────────

interface CellUpdate {
  rowNum: number
  bizEmail:   string
  ownerEmail: string
  phoneType:  string
  canSms:     string
}

async function writeUpdates(tab: string, updates: CellUpdate[]): Promise<void> {
  if (!updates.length) return

  const data = updates.map(u => ({
    range: `${tab}!S${u.rowNum}:V${u.rowNum}`,
    values: [[u.bizEmail, u.ownerEmail, u.phoneType, u.canSms]],
  }))

  // Retry with exponential backoff on 429/5xx/network errors
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const token = await getToken()
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchUpdate`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ valueInputOption: 'RAW', data }),
          signal: AbortSignal.timeout(30000),
        }
      )
      if (res.ok) return
      const err = await res.json() as any
      const code = err?.error?.code
      if (code === 429 || (code >= 500 && code < 600)) {
        const wait = attempt * 15000
        console.log(`  ⏳ HTTP ${code}, waiting ${wait / 1000}s (attempt ${attempt}/6)...`)
        await new Promise(r => setTimeout(r, wait))
      } else {
        throw new Error(`Sheet write failed: ${JSON.stringify(err)}`)
      }
    } catch (e: any) {
      if (e.message?.startsWith('Sheet write failed')) throw e  // non-retryable
      const wait = attempt * 10000
      console.log(`  ⏳ Network error: ${e.message} — waiting ${wait / 1000}s (attempt ${attempt}/6)...`)
      await new Promise(r => setTimeout(r, wait))
    }
  }
  throw new Error('Sheet write failed after 6 retries')
}

// ─── Concurrency pool ─────────────────────────────────────────────────────────

async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
  onDone?: (idx: number, result: T) => void
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let next = 0

  async function worker() {
    while (next < tasks.length) {
      const idx = next++
      results[idx] = await tasks[idx]()
      onDone?.(idx, results[idx])
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}

// ─── Enrich one tab ───────────────────────────────────────────────────────────

async function enrichTab(tab: string): Promise<void> {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`📋  ${tab}`)

  const allRows = await readRows(tab)
  if (!allRows.length) { console.log('  → empty tab, skip'); return }

  // Rows missing Phone Type (col U), or missing Business Email (col S) when a
  // website exists to scrape it from — a row can get phone-enriched in one pass
  // and still be missing email if that pass predates email extraction, or the
  // earlier attempt found nothing; re-check those instead of skipping them forever.
  const needsWork = (r: SheetRow) =>
    (!NICHE_ARG || r.niche.trim().toLowerCase() === NICHE_ARG) &&
    (!r.phoneType || (!r.bizEmail && !!r.websiteUrl))
  const todo = allRows.filter(needsWork).slice(0, LIMIT)
  console.log(`  Total rows: ${allRows.length}  |  Need enrichment: ${allRows.filter(needsWork).length}  |  This run: ${todo.length}`)

  if (!todo.length) { console.log('  ✅ All rows already enriched'); return }

  let done = 0
  const updates: CellUpdate[] = []

  // Build tasks: phone lookup is instant, email fetch is async
  const tasks = todo.map(row => async () => {
    // Phone type — instant offline
    let phoneType = ''
    let canSms    = ''
    if (row.phone) {
      const r = lookupPhoneType(row.phone, row.state)
      phoneType = r.lineType
      canSms    = r.canSms ? 'YES' : 'NO'
    }

    // Email — only if website URL present and not already filled
    let bizEmail   = row.bizEmail
    let ownerEmail = row.ownerEmail
    if (row.websiteUrl && !bizEmail) {
      try {
        const r = await extractEmailsFromWebsite(row.websiteUrl)
        bizEmail   = r.businessEmail ?? ''
        ownerEmail = r.ownerEmail ?? ''
      } catch { /* skip */ }
    }

    return { rowNum: row.rowNum, bizEmail, ownerEmail, phoneType, canSms } as CellUpdate
  })

  const BATCH_WRITE = 300  // write to sheet every N rows

  await runConcurrent(tasks, CONCUR, async (idx, update) => {
    updates.push(update)
    done++

    const row = todo[idx]
    const emailFlag = update.bizEmail ? ` ✉ ${update.bizEmail}` : ''
    const smsFlag   = update.canSms === 'NO' ? ' [no-sms]' : ''
    console.log(`  [${done}/${todo.length}] row ${update.rowNum} | ${update.phoneType || '—'}${smsFlag}${emailFlag}`)

    // Flush batch to sheet
    if (updates.length >= BATCH_WRITE) {
      const batch = updates.splice(0, updates.length)
      await writeUpdates(tab, batch)
      console.log(`  💾 Wrote ${batch.length} updates to sheet`)
    }
  })

  // Write remaining
  if (updates.length) {
    await writeUpdates(tab, updates)
    console.log(`  💾 Wrote ${updates.length} updates to sheet`)
  }

  console.log(`  ✅ Enriched ${done} rows`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }

  const tabs = TAB_ARG ? [TAB_ARG] : ALL_TABS

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`🔍  Enrich Existing Rows — ${new Date().toISOString().split('T')[0]}`)
  console.log(`   Tabs: ${tabs.length}  |  Limit/tab: ${LIMIT}  |  Concurrency: ${CONCUR}`)
  console.log(`${'═'.repeat(60)}`)

  for (const tab of tabs) {
    try {
      await enrichTab(tab)
    } catch (e: any) {
      console.error(`  ✗ ${tab}: ${e.message}`)
    }
  }

  console.log(`\n✅  Done\n`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
