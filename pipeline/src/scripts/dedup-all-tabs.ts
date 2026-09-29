/**
 * dedup-all-tabs.ts — remove duplicate leads across ALL lead tabs, keep first occurrence.
 *
 * A row is a duplicate if ANY of these keys was already seen (in any tab processed earlier,
 * or earlier in the same tab):
 *   1. place_id extracted from Maps URL (col R)  — strongest signal
 *   2. normalized phone, last 10 digits (col G)  — same phone = same lead for outreach
 *   3. normalized business name + city (cols B+D) — fallback for rows missing both above
 *
 * Dry-run by default. Set DEDUP_APPLY=true to actually delete rows.
 * Deleted rows are backed up to pipeline/dedup-backups/<tab>-<date>.json before deletion.
 *
 * Run: node --env-file=.env --import=tsx/esm src/scripts/dedup-all-tabs.ts
 * Apply: DEDUP_APPLY=true node --env-file=.env --import=tsx/esm src/scripts/dedup-all-tabs.ts
 */
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { readSheetRows, batchUpdateSheet, listSheetTabs } from '../tools/google-sheets.js'

const SHEET = process.env.LEADS_SHEET_ID!
const APPLY = process.env.DEDUP_APPLY === 'true'

// Tabs that are not lead lists — never touch
const SKIP_TABS = new Set(['Status', 'Dashboard', 'Config', 'Notes'])

const COL_NAME = 1     // B
const COL_CITY = 3     // D
const COL_PHONE = 6    // G
const COL_MAPS_URL = 17 // R

function normalizePhone(p: string): string {
  const d = (p ?? '').replace(/\D/g, '')
  return d.length >= 10 ? d.slice(-10) : ''
}

function normalizeText(s: string): string {
  return (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
}

// Real place_id only — no hash fallback (hash collisions on empty data would over-delete)
function extractPlaceId(url: string): string {
  if (!url) return ''
  const m = url.match(/!1s([^!]+)!/)
  if (m) return m[1]
  const cid = url.match(/[?&]cid=(\d+)/)
  if (cid) return `cid_${cid[1]}`
  const q = url.match(/place_id[:=]([A-Za-z0-9_-]+)/)
  if (q) return q[1]
  return ''
}

interface DupeInfo { rowIndex: number; row: string[]; reason: string }

async function main() {
  console.log(`=== Dedup ALL tabs ${APPLY ? '(LIVE — rows WILL be deleted)' : '(DRY RUN)'} ===\n`)

  const tabs = (await listSheetTabs({ spreadsheetId: SHEET }))
    .filter(t => !SKIP_TABS.has(t.title))
  if (!tabs.length) { console.error('No tabs found — check LEADS_SHEET_ID / service account'); process.exit(1) }
  console.log(`Lead tabs: ${tabs.map(t => t.title).join(', ')}\n`)

  const seenPlace = new Set<string>()
  const seenPhone = new Set<string>()
  const seenNameCity = new Set<string>()

  const perTabDupes = new Map<string, DupeInfo[]>()
  const reasonCounts: Record<string, number> = { place_id: 0, phone: 0, 'name+city': 0 }
  let totalRows = 0

  for (const tab of tabs) {
    let rows: string[][]
    try {
      rows = await readSheetRows({ spreadsheetId: SHEET, sheetName: tab.title, range: 'A:V' })
    } catch (e: any) {
      console.log(`  ${tab.title}: read failed (${e.message?.slice(0, 50)}) — skipped`)
      continue
    }
    if (rows.length <= 1) { console.log(`  ${tab.title.padEnd(45)} 0 rows`); continue }

    const dupes: DupeInfo[] = []
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      const placeId = extractPlaceId(r[COL_MAPS_URL] ?? '')
      const phone = normalizePhone(r[COL_PHONE] ?? '')
      const name = normalizeText(r[COL_NAME] ?? '')
      const city = normalizeText(r[COL_CITY] ?? '')
      const nameCity = name && city ? `${name}::${city}` : ''

      let reason = ''
      if (placeId && seenPlace.has(placeId)) reason = 'place_id'
      else if (phone && seenPhone.has(phone)) reason = 'phone'
      else if (nameCity && seenNameCity.has(nameCity)) reason = 'name+city'

      if (reason) {
        dupes.push({ rowIndex: i + 1, row: r, reason }) // 1-based sheet row
        reasonCounts[reason]++
      } else {
        if (placeId) seenPlace.add(placeId)
        if (phone) seenPhone.add(phone)
        if (nameCity) seenNameCity.add(nameCity)
      }
    }

    totalRows += rows.length - 1
    if (dupes.length) perTabDupes.set(tab.title, dupes)
    console.log(`  ${tab.title.padEnd(45)} ${(rows.length - 1).toLocaleString().padStart(7)} rows → ${dupes.length.toLocaleString()} dupes`)
  }

  const totalDupes = [...perTabDupes.values()].reduce((s, d) => s + d.length, 0)
  console.log(`\n=== Summary ===`)
  console.log(`Total rows scanned : ${totalRows.toLocaleString()}`)
  console.log(`Duplicates found   : ${totalDupes.toLocaleString()}`)
  console.log(`  by place_id      : ${reasonCounts['place_id'].toLocaleString()}`)
  console.log(`  by phone         : ${reasonCounts['phone'].toLocaleString()}`)
  console.log(`  by name+city     : ${reasonCounts['name+city'].toLocaleString()}`)
  console.log(`Unique leads kept  : ${(totalRows - totalDupes).toLocaleString()}`)

  if (!totalDupes) { console.log('\nSheet already clean.'); return }

  if (!APPLY) {
    console.log('\nDRY RUN — no rows deleted. Re-run with DEDUP_APPLY=true to delete.')
    for (const [tab, dupes] of perTabDupes) {
      const sample = dupes.slice(0, 3).map(d => `row ${d.rowIndex} "${d.row[COL_NAME]}" (${d.reason})`).join('; ')
      console.log(`  ${tab}: ${dupes.length} → e.g. ${sample}`)
    }
    return
  }

  // ── LIVE: backup then delete ──────────────────────────────────────────────
  const backupDir = join(process.cwd(), 'dedup-backups')
  mkdirSync(backupDir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)

  const sheetIdByTitle = new Map(tabs.map(t => [t.title, t.sheetId]))

  for (const [tabTitle, dupes] of perTabDupes) {
    const sheetId = sheetIdByTitle.get(tabTitle)
    if (sheetId === undefined) { console.error(`  ${tabTitle}: no sheetId — skipped`); continue }

    const backupPath = join(backupDir, `${tabTitle.replace(/[^\w-]/g, '_')}-${stamp}.json`)
    writeFileSync(backupPath, JSON.stringify(dupes, null, 1))

    // Sort desc, merge consecutive rows into contiguous ranges → fewer requests
    const rowsDesc = dupes.map(d => d.rowIndex).sort((a, b) => b - a)
    const ranges: Array<{ start: number; end: number }> = []
    for (const r of rowsDesc) {
      const last = ranges[ranges.length - 1]
      if (last && r === last.start - 1) last.start = r
      else ranges.push({ start: r, end: r })
    }

    const requests = ranges.map(({ start, end }) => ({
      deleteDimension: {
        range: { sheetId, dimension: 'ROWS', startIndex: start - 1, endIndex: end },
      },
    }))

    // Chunk batchUpdate calls; ranges already descending so indices stay valid
    const BATCH = 200
    let deleted = 0
    for (let i = 0; i < requests.length; i += BATCH) {
      const chunk = requests.slice(i, i + BATCH)
      // Retry transient 503s with backoff — a partial failure leaves stale row indices,
      // so we must not continue past a chunk that never succeeded
      let ok = false
      for (let attempt = 1; attempt <= 5 && !ok; attempt++) {
        ok = await batchUpdateSheet({ spreadsheetId: SHEET, requests: chunk })
        if (!ok) await new Promise(r => setTimeout(r, attempt * 3000))
      }
      if (!ok) { console.error(`  ${tabTitle}: delete batch failed after retries — stopping this tab (backup: ${backupPath})`); break }
      deleted += chunk.reduce((s, q) => s + (q.deleteDimension.range.endIndex - q.deleteDimension.range.startIndex), 0)
      process.stdout.write(`\r  ${tabTitle}: deleted ${deleted}/${dupes.length}`)
      await new Promise(r => setTimeout(r, 400))
    }
    console.log(`\r  ${tabTitle}: deleted ${deleted}/${dupes.length} (backup: ${backupPath})`)
  }

  console.log('\nDone. Sheet deduped. DB (scraped_places) untouched — still blocks re-scraping.')
}

main().catch(e => { console.error(e); process.exit(1) })
