/**
 * redistribute-leads.ts
 *
 * Reads ALL rows from "Local SMBs", routes each to the correct tab by niche,
 * normalises old 16-col DB rows → new 18-col format, rewrites Local SMBs
 * with only core home-service niches.
 *
 * Routing:
 *   medspa            → MEDSPAS
 *   dentist            → USA_DentalOffices
 *   lawfirm            → USA_LawFirms  (created if missing)
 *   luxury-realestate  → USA_RealEstateAgents
 *   salon              → USA_Salons
 *   barbershop         → USA_BarberShops
 *   restaurant         → USA_Restaurants
 *   everything else    → Local SMBs (stays)
 *
 * Run: npx tsx src/scripts/redistribute-leads.ts
 */
import 'dotenv/config'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createSign } from 'crypto'
import { clearSheet, writeSheetRows, appendSheetRow } from '../tools/google-sheets.js'

const SHEET_ID = process.env.LEADS_SHEET_ID!

// 18-col canonical header
const HEADER = [
  'Date Added', 'Business Name', 'Niche / Category', 'City', 'State / Country',
  'Timezone', 'Phone', 'Email', 'Has Website', 'Website URL', 'Address',
  'Rating', 'Reviews', 'GBP Claimed', 'Open Now', 'Price Level', 'Tier', 'Maps URL',
]

// Niche → destination tab
const NICHE_TAB: Record<string, string> = {
  medspa:               'MEDSPAS',
  'med spa':            'MEDSPAS',
  'medical spa':        'MEDSPAS',
  'medspa-usa':         'MEDSPAS',
  dentist:              'USA_DentalOffices',
  'dental-office':      'USA_DentalOffices',
  'dental office':      'USA_DentalOffices',
  orthodontist:         'USA_DentalOffices',
  lawfirm:              'USA_LawFirms',
  'law firm':           'USA_LawFirms',
  attorney:             'USA_LawFirms',
  lawyer:               'USA_LawFirms',
  'luxury-realestate':  'USA_RealEstateAgents',
  'real-estate-agent':  'USA_RealEstateAgents',
  realtor:              'USA_RealEstateAgents',
  salon:                'USA_Salons',
  'hair-salon':         'USA_Salons',
  'hair salon':         'USA_Salons',
  'nail-salon':         'USA_Salons',
  barbershop:           'USA_BarberShops',
  restaurant:           'USA_Restaurants',
  'india-restaurant':   'India_Restaurants',
  'financial-advisor':  'USA_FinancialAdvisorsandInsuranceAgents',
  'insurance-agent':    'USA_FinancialAdvisorsandInsuranceAgents',
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  let sa: any
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
    sa = JSON.parse(readFileSync(resolve(process.env.GOOGLE_SERVICE_ACCOUNT_FILE), 'utf8'))
  } else throw new Error('No service account')
  const now = Math.floor(Date.now() / 1000)
  const h = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const p = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now,
  })).toString('base64url')
  const s = createSign('RSA-SHA256'); s.update(h + '.' + p)
  const jwt = h + '.' + p + '.' + s.sign(sa.private_key, 'base64url')
  const tk = await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt,
  })).json() as any
  if (!tk.access_token) throw new Error('Token failed: ' + JSON.stringify(tk))
  return tk.access_token
}

async function getAllRows(token: string, tab: string): Promise<string[][]> {
  const range = encodeURIComponent(`${tab}!A:R`)
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error('Failed to read ' + tab + ': ' + await res.text())
  const d = await res.json() as any
  return d.values ?? []
}

// Create a new tab in the spreadsheet
async function createTab(token: string, title: string): Promise<void> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
    }
  )
  const d = await res.json() as any
  if (d.error) throw new Error('createTab failed: ' + d.error.message)
}

async function tabExists(token: string, title: string): Promise<boolean> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const d = await res.json() as any
  return d.sheets?.some((s: any) => s.properties.title === title) ?? false
}

// Normalise a raw row (old 16-col OR new 18-col) to the canonical 18-col format
function normalise(row: string[], isOldFormat: boolean): string[] {
  if (isOldFormat) {
    // Old 16-col: [Date, Name, Niche, City, State, TZ, Phone, Email, WebsiteStatus, WebsiteURL,
    //              Rating, Reviews, GBP, Tier, PipelineStatus, LiveURL]
    const hasWebsite = (row[8] ?? '').toLowerCase().includes('has') ? 'YES' : 'NO'
    return [
      row[0]  ?? '',  // Date Added
      row[1]  ?? '',  // Business Name
      row[2]  ?? '',  // Niche / Category
      row[3]  ?? '',  // City
      row[4]  ?? '',  // State / Country
      row[5]  ?? '',  // Timezone
      row[6]  ?? '',  // Phone
      row[7]  ?? '',  // Email
      hasWebsite,     // Has Website
      row[9]  ?? '',  // Website URL
      '',             // Address (not in old format)
      row[10] ?? '',  // Rating
      row[11] ?? '',  // Reviews
      row[12] ?? '',  // GBP Claimed
      '',             // Open Now
      '',             // Price Level
      row[13] ?? '',  // Tier
      '',             // Maps URL
    ]
  } else {
    // New 18-col — pad to 18 if shorter
    const r = [...row]
    while (r.length < 18) r.push('')
    return r.slice(0, 18)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }

  console.log(`\n${'═'.repeat(64)}`)
  console.log(`🔀  Redistribute Leads — ${new Date().toISOString().split('T')[0]}`)
  console.log(`${'═'.repeat(64)}\n`)

  const token = await getToken()

  // Ensure USA_LawFirms tab exists
  if (!await tabExists(token, 'USA_LawFirms')) {
    await createTab(token, 'USA_LawFirms')
    console.log('  ✅ Created tab: USA_LawFirms')
    // Write header
    await writeSheetRows({ spreadsheetId: SHEET_ID, sheetName: 'USA_LawFirms', rows: [HEADER] })
    console.log('  📝 Header written to USA_LawFirms')
  } else {
    console.log('  ✅ Tab already exists: USA_LawFirms')
  }

  // Read all Local SMBs rows
  const allRows = await getAllRows(token, 'Local SMBs')
  console.log(`\n  Read ${allRows.length} rows from Local SMBs (includes header)`)

  if (allRows.length < 2) {
    console.log('  Nothing to redistribute.')
    return
  }

  // Detect old vs new format: old header has 'Niche' at col 2, new has 'Niche / Category'
  const headerRow = allRows[0]
  const dataRows  = allRows.slice(1)

  // Buckets
  const stays:   string[][] = []  // goes back into Local SMBs
  const moved:   Record<string, string[][]> = {}  // tab → rows

  let skippedHeaders = 0

  for (const row of dataRows) {
    // Skip embedded header rows (sometimes appended by mistake)
    if ((row[0] ?? '').toLowerCase() === 'date added') { skippedHeaders++; continue }

    const niche = (row[2] ?? '').toLowerCase().trim()
    const dest  = NICHE_TAB[niche]

    // Detect format: old = "has website"/"no website" in col 8, new = "YES"/"NO"
    const col8 = (row[8] ?? '').toLowerCase()
    const isOld = col8 === 'has website' || col8 === 'no website'
    const normalised = normalise(row, isOld)

    if (dest) {
      if (!moved[dest]) moved[dest] = []
      moved[dest].push(normalised)
    } else {
      stays.push(normalised)
    }
  }

  // Summary before writing
  console.log(`\n  Routing plan:`)
  console.log(`    Local SMBs (stays):  ${stays.length} rows`)
  Object.entries(moved).forEach(([tab, rows]) =>
    console.log(`    ${tab.padEnd(46)} ${rows.length} rows`)
  )
  if (skippedHeaders) console.log(`    Skipped embedded headers: ${skippedHeaders}`)

  // Append moved rows to destination tabs
  console.log(`\n  Appending to destination tabs...`)
  for (const [tab, rows] of Object.entries(moved)) {
    let count = 0
    for (const row of rows) {
      const ok = await appendSheetRow({ spreadsheetId: SHEET_ID, sheetName: tab, values: row })
      if (ok) count++
      await new Promise(r => setTimeout(r, 150))  // rate limit
    }
    console.log(`    ✅ ${tab}: +${count} rows`)
  }

  // Rewrite Local SMBs with only stays rows + proper 18-col header
  console.log(`\n  Rewriting Local SMBs (${stays.length} rows + header)...`)
  const cleared = await clearSheet({ spreadsheetId: SHEET_ID, sheetName: 'Local SMBs' })
  if (!cleared) { console.error('  ❌ Clear failed'); process.exit(1) }

  const written = await writeSheetRows({
    spreadsheetId: SHEET_ID,
    sheetName: 'Local SMBs',
    rows: [HEADER, ...stays],
  })

  if (written) {
    console.log(`  ✅ Local SMBs rewritten: ${stays.length} rows, 18-col format`)
  } else {
    console.error('  ❌ Write failed')
    process.exit(1)
  }

  console.log(`\n${'═'.repeat(64)}`)
  console.log(`✅  Redistribution complete`)
  console.log(`    Local SMBs:  ${stays.length} rows (home services only)`)
  Object.entries(moved).forEach(([tab, rows]) =>
    console.log(`    ${tab.padEnd(46)} +${rows.length} rows`)
  )
  console.log(`${'═'.repeat(64)}\n`)
}

main().catch(e => { console.error('\n💥', e.message); process.exit(1) })
