/**
 * dedup-yelp-by-name.ts — remove Yelp_Dataset rows where same business (name+city)
 * already exists in another tab (with or without phone).
 * Prefer keeping the non-Yelp row (has more data, often has phone).
 *
 * Run (dry): npx tsx --env-file=.env src/scripts/dedup-yelp-by-name.ts
 * Run (apply): DEDUP_APPLY=true npx tsx --env-file=.env src/scripts/dedup-yelp-by-name.ts
 */
import { readSheetRows } from '../tools/google-sheets.js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createSign } from 'crypto'

const SHEET = process.env.LEADS_SHEET_ID!
const APPLY = process.env.DEDUP_APPLY === 'true'

const NON_YELP_TABS = [
  'Local SMBs','MEDSPAS','USA_Restaurants','USA_DentalOffices','USA_Salons',
  'USA_BarberShops','USA_SkinClinics','USA_NailStudios','USA_IVTherapy',
  'USA_FinancialAdvisorsandInsuranceAgents','USA_LawFirms','USA_RealEstateAgents',
  'USA_AutoDetailing','USA_HVAC','USA_Roofing','USA_Remodeling','USA_Plumbing',
  'USA_CosmeticSurgeons','INDIA_DentalOffices','INDIA_MEDSPAS','India_Restaurants',
  'USA_AutoRepair','USA_MedicalOffices','USA_Fitness','USA_PetServices',
]

// Normalize: lowercase, remove punctuation/extra spaces, trim
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

// Key: name+city (both normalized)
function makeKey(name: string, city: string): string {
  return `${norm(name)}|${norm(city)}`
}

// Also a name-only key for cases where city is blank
function nameKey(name: string): string {
  return norm(name)
}

async function getSheetsToken(): Promise<string> {
  let sa: any
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  else sa = JSON.parse(readFileSync(resolve(process.env.GOOGLE_SERVICE_ACCOUNT_FILE!), 'utf8'))
  const now = Math.floor(Date.now() / 1000)
  const h = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const cl = Buffer.from(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now })).toString('base64url')
  const sig = createSign('RSA-SHA256').update(h + '.' + cl).sign(sa.private_key, 'base64url')
  const jwt = h + '.' + cl + '.' + sig
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}` })
  return ((await r.json()) as any).access_token as string
}

async function main() {
  // 1. Build name+city index from all non-Yelp tabs (col B=name, col D=city)
  const ncIndex = new Set<string>()   // name+city
  const nameIndex = new Set<string>() // name only (for Yelp rows with blank city)

  console.log('Building name+city index from non-Yelp tabs...')
  for (const tab of NON_YELP_TABS) {
    try {
      const rows = await readSheetRows({ spreadsheetId: SHEET, sheetName: tab, range: 'B2:D' })
      for (const r of rows) {
        const name = r[0]?.trim() ?? ''
        const city = r[2]?.trim() ?? ''
        if (!name) continue
        ncIndex.add(makeKey(name, city))
        nameIndex.add(nameKey(name))
      }
      process.stdout.write('.')
    } catch { process.stdout.write('x') }
  }
  console.log(`\nIndex built: ${ncIndex.size.toLocaleString()} name+city pairs, ${nameIndex.size.toLocaleString()} unique names`)

  // 2. Read Yelp_Dataset (col B=name, col D=city)
  console.log('Reading Yelp_Dataset...')
  const yelpRows = await readSheetRows({ spreadsheetId: SHEET, sheetName: 'Yelp_Dataset', range: 'A:G' })
  const dataRows = yelpRows.slice(1)

  const dupeRowIndices: number[] = [] // 1-based sheet indices, descending for safe deletion
  const matchTypes: Record<string, number> = { nameCity: 0, nameOnly: 0 }

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i]
    const name = r[1]?.trim() ?? ''  // col B
    const city = r[3]?.trim() ?? ''  // col D
    if (!name) continue

    const nc = makeKey(name, city)
    const n  = nameKey(name)

    if (ncIndex.has(nc)) {
      dupeRowIndices.push(i + 2)
      matchTypes.nameCity++
    } else if (!city && nameIndex.has(n)) {
      // Yelp row has no city — match by name only
      dupeRowIndices.push(i + 2)
      matchTypes.nameOnly++
    }
  }

  // Sort descending for safe row deletion
  dupeRowIndices.sort((a, b) => b - a)

  console.log(`\nYelp total rows: ${dataRows.length.toLocaleString()}`)
  console.log(`Duplicates found:`)
  console.log(`  Name+City match: ${matchTypes.nameCity.toLocaleString()}`)
  console.log(`  Name-only match: ${matchTypes.nameOnly.toLocaleString()}`)
  console.log(`  TOTAL to remove: ${dupeRowIndices.length.toLocaleString()}`)
  console.log(`  Yelp unique rows after: ${(dataRows.length - dupeRowIndices.length).toLocaleString()}`)

  if (dupeRowIndices.length === 0) { console.log('No duplicates — nothing to delete.'); return }
  if (!APPLY) {
    console.log('\nDRY RUN — run with DEDUP_APPLY=true to delete')
    console.log('Sample matches (first 5 by row):',
      dupeRowIndices.slice(-5).reverse().map(i => {
        const r = dataRows[i - 2]
        return `row ${i}: "${r[1]}" | "${r[3]}"`
      })
    )
    return
  }

  // 3. Delete in batches (descending order keeps indices valid)
  const token = await getSheetsToken()

  // Get Yelp_Dataset sheetId
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}?includeGridData=false`, { headers: { Authorization: `Bearer ${token}` } })
  const meta = await metaRes.json() as any
  const yelpSheetId = meta.sheets?.find((s: any) => s.properties.title === 'Yelp_Dataset')?.properties?.sheetId
  console.log(`Yelp_Dataset sheetId: ${yelpSheetId}`)

  const BATCH = 500
  let deleted = 0
  for (let i = 0; i < dupeRowIndices.length; i += BATCH) {
    const chunk = dupeRowIndices.slice(i, i + BATCH) // already desc
    const requests = chunk.map(rowIdx => ({
      deleteDimension: {
        range: { sheetId: yelpSheetId, dimension: 'ROWS', startIndex: rowIdx - 1, endIndex: rowIdx }
      }
    }))
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    })
    const d = await res.json() as any
    if (d.error) { console.error('Delete error:', d.error.message); break }
    deleted += chunk.length
    process.stdout.write(`\rDeleted ${deleted.toLocaleString()}/${dupeRowIndices.length.toLocaleString()}...`)
    await new Promise(r => setTimeout(r, 800))
  }
  console.log(`\nDone. Removed ${deleted.toLocaleString()} duplicate rows from Yelp_Dataset.`)
}

main().catch(e => { console.error(e); process.exit(1) })
