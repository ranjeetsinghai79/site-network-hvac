/**
 * build-cold-email-queue.ts
 *
 * Curates a deduped, paced list of med-spa-vertical leads with a usable email
 * into a dedicated "Cold Email Queue" tab, sized for a 3000/mo (~100/day)
 * cold-email outreach target.
 *
 * This script does NOT enrich anything itself — it assumes S (Business Email)
 * / T (Owner Email) are already backfilled by enrich-existing-rows.ts, and
 * just filters/dedups/paces what's already there. It never mutates source
 * tabs and never sends anything — sheet-only output, no Neon writes.
 *
 * Usage:
 *   cd pipeline && DRY_RUN=true npx tsx src/scripts/build-cold-email-queue.ts
 *   cd pipeline && npx tsx src/scripts/build-cold-email-queue.ts
 *
 * Env:
 *   LEADS_SHEET_ID        spreadsheet id (required)
 *   DRY_RUN                'true' → read + report only, no writes
 *   COLD_EMAIL_BATCH_SIZE  rows per "Send Batch #" (default 100 = daily pace)
 */

import 'dotenv/config'
import {
  listSheetTabs,
  batchUpdateSheet,
  writeSheetRows,
  appendSheetRows,
  readSheetRows,
} from '../tools/google-sheets.js'

const SPREADSHEET_ID = process.env.LEADS_SHEET_ID!
const DRY_RUN = process.env.DRY_RUN === 'true'
const DAILY_PACE = parseInt(process.env.COLD_EMAIL_BATCH_SIZE ?? '100', 10)
const QUEUE_TAB = 'Cold Email Queue'

// Med-spa vertical only — matches sheets-outreach.ts's existing tab scope.
const SOURCE_TABS = ['MEDSPAS', 'USA_SkinClinics', 'USA_IVTherapy']

const HEADER = [
  'Date Queued', 'Business Name', 'Niche', 'City', 'State', 'Phone',
  'Website URL', 'Business Email', 'Owner Email', 'Email To Use',
  'Tier', 'Source Tab', 'Maps URL', 'Send Batch #',
]

// 0-based column indices into the 22-col (A-V) source-tab schema.
const COL = {
  NAME: 1, NICHE: 2, CITY: 3, STATE: 4, PHONE: 6, WEBSITE: 9,
  TIER: 16, MAPS_URL: 17, BIZ_EMAIL: 18, OWNER_EMAIL: 19,
}

interface QueueRow {
  name: string
  niche: string
  city: string
  state: string
  phone: string
  website: string
  bizEmail: string
  ownerEmail: string
  emailToUse: string
  tier: string
  sourceTab: string
  mapsUrl: string
}

function pickEmail(bizEmail: string, ownerEmail: string, seen: Set<string>): string | null {
  const b = bizEmail.trim()
  const o = ownerEmail.trim()
  if (b && !seen.has(b.toLowerCase())) return b
  if (o && !seen.has(o.toLowerCase())) return o
  return null
}

// Marks BOTH of a row's raw addresses as used, not just the one picked — a
// row whose business email was chosen must not resurface via its owner email
// on a later run (or vice versa), or every row would get queued twice.
function markRowSeen(bizEmail: string, ownerEmail: string, seen: Set<string>): void {
  const b = bizEmail.trim().toLowerCase()
  const o = ownerEmail.trim().toLowerCase()
  if (b) seen.add(b)
  if (o) seen.add(o)
}

async function ensureQueueTab(): Promise<{ isNew: boolean; existingRows: string[][] }> {
  const tabs = await listSheetTabs({ spreadsheetId: SPREADSHEET_ID })
  const exists = tabs.some(t => t.title === QUEUE_TAB)

  if (!exists) {
    if (!DRY_RUN) {
      const ok = await batchUpdateSheet({
        spreadsheetId: SPREADSHEET_ID,
        requests: [{ addSheet: { properties: { title: QUEUE_TAB } } }],
      })
      if (!ok) throw new Error(`Failed to create "${QUEUE_TAB}" tab`)
      await writeSheetRows({ spreadsheetId: SPREADSHEET_ID, sheetName: QUEUE_TAB, rows: [HEADER] })
    }
    return { isNew: true, existingRows: [] }
  }

  const rows = await readSheetRows({ spreadsheetId: SPREADSHEET_ID, sheetName: QUEUE_TAB, range: 'A2:N' })
  return { isNew: false, existingRows: rows }
}

async function main() {
  if (!SPREADSHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`📧  Build Cold Email Queue — ${new Date().toISOString().split('T')[0]}${DRY_RUN ? '  [DRY RUN]' : ''}`)
  console.log(`   Source tabs: ${SOURCE_TABS.join(', ')}`)
  console.log(`   Daily pace: ${DAILY_PACE}/batch`)
  console.log(`${'═'.repeat(60)}`)

  const { existingRows } = await ensureQueueTab()

  // Seed dedup set from whatever's already queued — both raw addresses (col H/I),
  // not just the chosen one (col J), so a queued row can't resurface via its
  // other email on a later run.
  const seen = new Set<string>()
  for (const r of existingRows) {
    markRowSeen(r[7] ?? '', r[8] ?? '', seen)
  }
  console.log(`\n  Existing queue: ${existingRows.length} rows (${seen.size} unique emails already queued)`)

  const accepted: QueueRow[] = []
  let totalRead = 0
  let totalWithEmail = 0
  let totalFilteredOut = 0

  for (const tab of SOURCE_TABS) {
    const rows = await readSheetRows({ spreadsheetId: SPREADSHEET_ID, sheetName: tab, range: 'A2:V' })
    totalRead += rows.length

    let tabWithEmail = 0
    let tabAccepted = 0
    let tabFiltered = 0

    for (const r of rows) {
      const name = (r[COL.NAME] ?? '').trim()
      const bizEmail = r[COL.BIZ_EMAIL] ?? ''
      const ownerEmail = r[COL.OWNER_EMAIL] ?? ''
      if (bizEmail.trim() || ownerEmail.trim()) tabWithEmail++

      if (!name) { tabFiltered++; continue }

      const emailToUse = pickEmail(bizEmail, ownerEmail, seen)
      if (!emailToUse) { tabFiltered++; continue }

      markRowSeen(bizEmail, ownerEmail, seen)
      accepted.push({
        name,
        niche: r[COL.NICHE] ?? '',
        city: r[COL.CITY] ?? '',
        state: r[COL.STATE] ?? '',
        phone: r[COL.PHONE] ?? '',
        website: r[COL.WEBSITE] ?? '',
        bizEmail,
        ownerEmail,
        emailToUse,
        tier: r[COL.TIER] ?? '',
        sourceTab: tab,
        mapsUrl: r[COL.MAPS_URL] ?? '',
      })
      tabAccepted++
    }

    totalWithEmail += tabWithEmail
    totalFilteredOut += tabFiltered
    console.log(`  📋 ${tab}: ${rows.length} rows | ${tabWithEmail} with email | ${tabAccepted} queued | ${tabFiltered} filtered/dupe`)
  }

  console.log(`\n  Totals: ${totalRead} rows read | ${totalWithEmail} with ≥1 email | ${accepted.length} new candidates | ${totalFilteredOut} filtered/dupe`)

  if (!accepted.length) {
    console.log(`\n✅  Nothing new to queue — all candidates already present or filtered.\n`)
    return
  }

  const today = new Date().toISOString().split('T')[0]
  let runningIndex = existingRows.length
  const newRows: string[][] = accepted.map(c => {
    runningIndex++
    const sendBatch = Math.ceil(runningIndex / DAILY_PACE)
    return [
      today, c.name, c.niche, c.city, c.state, c.phone, c.website,
      c.bizEmail, c.ownerEmail, c.emailToUse, c.tier, c.sourceTab, c.mapsUrl,
      String(sendBatch),
    ]
  })

  const firstBatch = newRows[0][13]
  const lastBatch = newRows[newRows.length - 1][13]
  console.log(`  New rows: ${newRows.length} | Send Batch # range: ${firstBatch}–${lastBatch}`)

  if (DRY_RUN) {
    console.log(`\n✅  [DRY RUN] Would append ${newRows.length} rows. Final queue size would be ${existingRows.length + newRows.length}.\n`)
    return
  }

  const CHUNK = 500
  for (let i = 0; i < newRows.length; i += CHUNK) {
    const chunk = newRows.slice(i, i + CHUNK)
    const ok = await appendSheetRows({ spreadsheetId: SPREADSHEET_ID, sheetName: QUEUE_TAB, rows: chunk })
    if (!ok) throw new Error(`Append failed at chunk starting row ${i}`)
    console.log(`  💾 Wrote ${chunk.length} rows (${i + chunk.length}/${newRows.length})`)
    if (i + CHUNK < newRows.length) await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\n✅  Done. Queue now has ${existingRows.length + newRows.length} rows.\n`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
