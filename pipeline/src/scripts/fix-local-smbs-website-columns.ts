/**
 * fix-local-smbs-website-columns.ts
 *
 * One-off repair for a real bug found 2026-09-28: in the "Local SMBs" sheet tab,
 * a scraper wrote the "Has Website" cell (col I) as an empty string for a large
 * fraction of rows, and that empty string got dropped from the row array entirely
 * instead of written as "" — shifting col J ("Website URL") and everything after it
 * left by one. So the raw sheet shows col J holding the YES/NO flag, and the real
 * website URL sitting in col K (Address) instead.
 *
 * This script fixes ONLY columns I and J — not K onward — for rows where the shift
 * is unambiguous: col I is not already a literal YES/NO, but col J is. Columns K
 * onward are left as-is; this codebase's own tooling (enrich-existing-rows.ts,
 * admin/src/lib/local/parse.ts) already shape-matches rather than trusts fixed
 * positions past column J, so nothing currently depends on those being perfectly
 * aligned.
 *
 * A second, unrelated problem exists in the same tab: a Yelp-import lineage mixed
 * into "remodeling"/"handyman" (6,529 rows, marked by a `yelp:<id>` value in col S)
 * with a completely different layout — its own Has-Website flag sits at col P
 * (index 15), not col I, and — checked directly, not assumed — 6,514 of those 6,529
 * rows never captured a website URL anywhere in the row at all (only 15 do). So for
 * this layout the script ONLY relocates the existing flag into col I; it does not
 * write anything into col J, since there is nothing real to write for the vast
 * majority of these rows and inventing one would be worse than leaving it blank.
 * (Some of this Yelp-imported data also looks mis-categorized by niche — that's a
 * separate, harder problem this script does not attempt to fix.)
 *
 * Safety: writes a JSON backup of every touched row's original I/J values (and row
 * number) before making any change. Dry-run by default — pass --apply to write.
 *
 * Usage:
 *   cd pipeline && npx tsx src/scripts/fix-local-smbs-website-columns.ts          # dry run
 *   cd pipeline && npx tsx src/scripts/fix-local-smbs-website-columns.ts --apply  # writes for real
 */

import 'dotenv/config'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { readSheetRows } from '../tools/google-sheets.js'
import { readFileSync } from 'fs'
import { createSign } from 'crypto'

const SHEET_ID = process.env.LEADS_SHEET_ID!
const TAB      = 'Local SMBs'
const APPLY    = process.argv.includes('--apply')

const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAPS_RE   = /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i
const RATING_RE = /^[0-5](\.\d+)?$/
const URL_RE    = /^(https?:\/\/)?[\w-]+(\.[\w-]+)*\.[a-zA-Z]{2,24}(\/\S*)?$/

function normalizeUrl(raw: string): string {
  const s = raw.trim()
  if (!s || RATING_RE.test(s) || MAPS_RE.test(s) || EMAIL_RE.test(s)) return ''
  if (/^https?:\/\//i.test(s)) return URL_RE.test(s.replace(/^https?:\/\//i, '')) ? s : ''
  return URL_RE.test(s) ? `https://${s}` : ''
}

interface Fix { rowNum: number; oldI: string; oldJ: string; newI: 'YES' | 'NO'; newJ: string }

async function getToken(): Promise<string> {
  let sa: any
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  else if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) sa = JSON.parse(readFileSync(resolve(process.env.GOOGLE_SERVICE_ACCOUNT_FILE), 'utf8'))
  else throw new Error('No service account configured')
  const now = Math.floor(Date.now() / 1000)
  const h = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const p = Buffer.from(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now })).toString('base64url')
  const s = createSign('RSA-SHA256'); s.update(h + '.' + p)
  const jwt = h + '.' + p + '.' + s.sign(sa.private_key, 'base64url')
  const tk = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}` })).json() as any
  if (!tk.access_token) throw new Error('Token error: ' + JSON.stringify(tk))
  return tk.access_token
}

async function writeBatch(token: string, fixes: Fix[]): Promise<void> {
  const data = fixes.map(f => ({
    range: `${TAB}!I${f.rowNum}:J${f.rowNum}`,
    values: [[f.newI, f.newJ]],
  }))
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ valueInputOption: 'RAW', data }),
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
  }
  throw new Error('Sheet write failed after 6 retries')
}

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`🔧  Fix Local SMBs website columns (I/J)`)
  console.log(`   Mode: ${APPLY ? 'APPLY (writing for real)' : 'DRY RUN'}`)
  console.log(`${'═'.repeat(60)}\n`)

  const values = await readSheetRows({ spreadsheetId: SHEET_ID, sheetName: TAB, range: 'A2:V' })
  console.log(`Read ${values.length} rows`)

  const fixes: Fix[] = []
  let yelpFlagOnly = 0
  for (let i = 0; i < values.length; i++) {
    const r = values[i]
    const rowNum = i + 2   // sheet row (header is row 1)
    const flagAt8 = (r[8] ?? '').trim().toUpperCase()
    const flagAt9 = (r[9] ?? '').trim().toUpperCase()

    if (flagAt8 === 'YES' || flagAt8 === 'NO') continue   // already correct — skip

    if (flagAt9 === 'YES' || flagAt9 === 'NO') {
      // Shift-by-1 layout (the majority of the tab)
      const oldI = r[8] ?? ''
      const oldJ = r[9] ?? ''
      if (flagAt9 === 'NO') {
        fixes.push({ rowNum, oldI, oldJ, newI: 'NO', newJ: '' })
      } else {
        const url = normalizeUrl(r[10] ?? '')
        if (!url) continue   // flag says YES but no valid URL found at the shifted position — skip rather than guess
        fixes.push({ rowNum, oldI, oldJ, newI: 'YES', newJ: url })
      }
      continue
    }

    // Yelp-import layout: flag lives further right (checked at col P, index 15),
    // scoped by the yelp: marker so this never fires on an unrelated row shape.
    const hasYelpId = (r[18] ?? '').trim().toLowerCase().startsWith('yelp:')
    if (hasYelpId) {
      for (let idx = 10; idx <= 17; idx++) {
        const v = (r[idx] ?? '').trim().toUpperCase()
        if (v === 'YES' || v === 'NO') {
          fixes.push({ rowNum, oldI: r[8] ?? '', oldJ: r[9] ?? '', newI: v as 'YES' | 'NO', newJ: '' })
          yelpFlagOnly++
          break
        }
      }
    }
  }

  const realWebsite = fixes.filter(f => f.newI === 'YES' && f.newJ).length
  const noWebsite   = fixes.filter(f => f.newI === 'NO').length
  console.log(`Rows to fix: ${fixes.length}  (${realWebsite} with a real website URL, ${noWebsite} confirmed no-website, ${yelpFlagOnly} Yelp-import rows with a Has-Website flag but no URL ever captured)`)

  if (!fixes.length) { console.log('Nothing to do.'); return }

  const backupDir = resolve(import.meta.dirname, '../../rebuild-candidates')
  const backupPath = resolve(backupDir, `local-smbs-IJ-backup-${new Date().toISOString().replace(/:/g, '-')}.json`)
  writeFileSync(backupPath, JSON.stringify(fixes.map(f => ({ rowNum: f.rowNum, oldI: f.oldI, oldJ: f.oldJ })), null, 2))
  console.log(`Backup of original I/J values written → ${backupPath}`)

  if (!APPLY) {
    console.log('\nDry run — no changes written. Re-run with --apply to write for real.')
    console.log('Sample of planned fixes:')
    for (const f of fixes.slice(0, 5)) console.log(`  row ${f.rowNum}: I="${f.oldI}"→"${f.newI}"  J="${f.oldJ}"→"${f.newJ}"`)
    return
  }

  const token = await getToken()
  const BATCH = 200
  let written = 0
  for (let i = 0; i < fixes.length; i += BATCH) {
    const batch = fixes.slice(i, i + BATCH)
    await writeBatch(token, batch)
    written += batch.length
    console.log(`  💾 Wrote ${written}/${fixes.length}`)
  }

  console.log(`\n✅  Fixed ${fixes.length} rows in "${TAB}" (columns I and J only)`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
