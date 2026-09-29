/**
 * select-hvac-rebuild-candidates.ts
 *
 * Phase 1 of the HVAC tier-2 rebuild campaign (see the plan this came from,
 * 2026-09-28): reads the "Local SMBs" sheet tab, filters to HVAC leads that already
 * have a website, and writes a local candidate list for build-hvac-rebuilds.ts to
 * work through in daily batches.
 *
 * Read-only against the sheet — no sheet writes, no new column.
 *
 * Trusts columns I ("Has Website") and J ("Website URL") directly. That was NOT
 * safe before 2026-09-28: a scraper bug had dropped the "Has Website" cell for a
 * large fraction of rows, shifting every later column left by one. That's now fixed
 * at the source (fix-local-smbs-website-columns.ts, applied to the live sheet), so
 * simple column reads are correct again — no shape-matching needed here. If this
 * script ever again reports suspiciously few/zero candidates, re-run
 * fix-local-smbs-website-columns.ts's dry-run mode to check whether new corrupted
 * rows have been added by a later scrape.
 *
 * Usage:
 *   cd pipeline && npx tsx src/scripts/select-hvac-rebuild-candidates.ts
 *
 * Env:
 *   CANDIDATE_LIMIT   max candidates to select (default 1000)
 *   CANDIDATE_NICHE   niche/category filter, case-insensitive (default "hvac")
 *   CANDIDATE_TAB     sheet tab to read (default "Local SMBs")
 */

import 'dotenv/config'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { readSheetRows } from '../tools/google-sheets.js'

const SHEET_ID = process.env.LEADS_SHEET_ID!
const TAB      = process.env.CANDIDATE_TAB   ?? 'Local SMBs'
const NICHE    = (process.env.CANDIDATE_NICHE ?? 'hvac').trim().toLowerCase()
const LIMIT    = parseInt(process.env.CANDIDATE_LIMIT ?? '1000', 10)

export interface RebuildCandidate {
  name:       string   // col B
  niche:      string   // col C
  city:       string   // col D
  state:      string   // col E
  phone:      string   // col G
  email:      string   // col H
  websiteUrl: string   // col J
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1')) ? raw.trim() : ''
}

function parseRows(values: string[][]): RebuildCandidate[] {
  const out: RebuildCandidate[] = []
  for (const r of values) {
    const niche      = (r[2] ?? '').trim()
    const hasWebsite = (r[8] ?? '').trim().toUpperCase() === 'YES'
    const websiteUrl = (r[9] ?? '').trim()

    if (niche.toLowerCase() !== NICHE) continue
    if (!hasWebsite || !websiteUrl) continue

    out.push({
      name:  r[1] ?? '',
      niche,
      city:  r[3] ?? '',
      state: r[4] ?? '',
      phone: normalizePhone(r[6] ?? ''),
      email: r[7] ?? '',
      websiteUrl,
    })
  }
  return out
}

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`🔍  Select HVAC Rebuild Candidates`)
  console.log(`   Tab: ${TAB}  |  Niche: ${NICHE}  |  Limit: ${LIMIT}`)
  console.log(`${'═'.repeat(60)}\n`)

  const values = await readSheetRows({ spreadsheetId: SHEET_ID, sheetName: TAB, range: 'A2:V' })
  console.log(`Read ${values.length} rows from "${TAB}"`)

  const all = parseRows(values)
  console.log(`Matched niche="${NICHE}" AND has website: ${all.length}`)

  const candidates = all.slice(0, LIMIT)
  console.log(`Selected (first ${LIMIT}): ${candidates.length}`)

  const outDir = resolve(import.meta.dirname, '../../rebuild-candidates')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, `hvac-${new Date().toISOString().split('T')[0]}.json`)
  writeFileSync(outPath, JSON.stringify(candidates, null, 2))

  console.log(`\n✅  Wrote ${candidates.length} candidates → ${outPath}`)
  console.log(`   Next: cd pipeline && npx tsx src/scripts/build-hvac-rebuilds.ts ${outPath}\n`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
