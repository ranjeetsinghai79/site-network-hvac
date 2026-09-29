/**
 * init-all-headers.ts
 * Writes header row to each of the 11 sheet tabs — only if tab is empty or has wrong header.
 * Safe to re-run: skips tabs that already have correct header in row 1.
 *
 * Run: npx tsx src/scripts/init-all-headers.ts
 */
import 'dotenv/config'
import { writeSheetRows, clearSheet } from '../tools/google-sheets.js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createSign } from 'crypto'

const SHEET_ID = process.env.LEADS_SHEET_ID!

const TABS = [
  'Local SMBs',
  'MEDSPAS',
  'INDIA_MEDSPAS',
  'USA_DentalOffices',
  'INDIA_DentalOffices',
  'USA_Salons',
  'USA_BarberShops',
  'USA_FinancialAdvisorsandInsuranceAgents',
  'USA_RealEstateAgents',
  'USA_Restaurants',
  'India_Restaurants',
  'USA_LawFirms',
  'USA_SkinClinics',
  'USA_IVTherapy',
  'USA_NailStudios',
  // Week 3 — high-value niches (S → A → B)
  'USA_CosmeticSurgeons',
  'USA_AutoDetailing',
  'USA_HVAC',
  'USA_Roofing',
  'USA_Remodeling',
  'USA_Plumbing',
]

// 22-column header — matches scrape-universal.ts leadToRow()
const HEADER = [
  'Date Added',
  'Business Name',
  'Niche / Category',
  'City',
  'State / Country',
  'Timezone',
  'Phone',
  'Email',
  'Has Website',
  'Website URL',
  'Address',
  'Rating',
  'Reviews',
  'GBP Claimed',
  'Open Now',
  'Price Level',
  'Tier',
  'Maps URL',
  'Business Email',
  'Owner Email',
  'Phone Type',
  'Can SMS',
]

async function getToken(): Promise<string> {
  let sa: any
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
    sa = JSON.parse(readFileSync(resolve(process.env.GOOGLE_SERVICE_ACCOUNT_FILE), 'utf8'))
  } else throw new Error('No service account')
  const now = Math.floor(Date.now() / 1000)
  const h = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const p = Buffer.from(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now })).toString('base64url')
  const s = createSign('RSA-SHA256'); s.update(h + '.' + p)
  const jwt = h + '.' + p + '.' + s.sign(sa.private_key, 'base64url')
  const tk = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt })).json() as any
  if (!tk.access_token) throw new Error('Token failed: ' + JSON.stringify(tk))
  return tk.access_token
}

async function getRow1(token: string, tab: string): Promise<string[]> {
  const range = encodeURIComponent(`${tab}!A1:V1`)
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) return []
  const d = await res.json() as any
  return d.values?.[0] ?? []
}

async function getRowCount(token: string, tab: string): Promise<number> {
  const range = encodeURIComponent(`${tab}!A:A`)
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) return 0
  const d = await res.json() as any
  return d.values?.length ?? 0
}

// Insert a row at position 1 (shifts all existing rows down)
async function insertHeaderRow(token: string, sheetId: number): Promise<void> {
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          insertDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
            inheritFromBefore: false,
          }
        }]
      })
    }
  )
}

async function getSheetNumericId(token: string, tab: string): Promise<number | null> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) return null
  const d = await res.json() as any
  const sheet = d.sheets?.find((s: any) => s.properties.title === tab)
  return sheet?.properties?.sheetId ?? null
}

async function tabExists(token: string, tab: string): Promise<boolean> {
  return (await getSheetNumericId(token, tab)) !== null
}

async function createTab(token: string, tab: string): Promise<boolean> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }),
    }
  )
  return res.ok
}

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }
  const token = await getToken()

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`📋  Init Headers — ${new Date().toISOString().split('T')[0]}`)
  console.log(`${'═'.repeat(60)}\n`)

  for (const tab of TABS) {
    // Create tab if it doesn't exist
    if (!(await tabExists(token, tab))) {
      const created = await createTab(token, tab)
      if (!created) { console.log(`  ✗  ${tab}  — failed to create tab`); continue }
      console.log(`  ➕  ${tab}  — created new tab`)
    }

    const row1   = await getRow1(token, tab)
    const count  = await getRowCount(token, tab)
    const hasCorrectHeader = row1[0] === 'Date Added' && row1[row1.length - 1] === 'Can SMS' && row1.length >= 22

    if (hasCorrectHeader) {
      console.log(`  ✅  ${tab}  (${count} rows — header OK)`)
      continue
    }

    if (count === 0) {
      // Empty tab — write header at A1
      const ok = await writeSheetRows({ spreadsheetId: SHEET_ID, sheetName: tab, rows: [HEADER] })
      console.log(`  📝  ${tab}  — empty, wrote header  ${ok ? '✓' : '✗'}`)
    } else {
      // Has data but no correct header — insert header row at top
      const numId = await getSheetNumericId(token, tab)
      if (numId !== null) await insertHeaderRow(token, numId)
      // Now write header to the newly inserted row 1
      const ok = await writeSheetRows({ spreadsheetId: SHEET_ID, sheetName: tab, rows: [HEADER] })
      console.log(`  🔧  ${tab}  — had ${count} data rows, inserted header  ${ok ? '✓' : '✗'}`)
    }
  }

  console.log(`\n✅  All tabs have correct 22-column header\n`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
