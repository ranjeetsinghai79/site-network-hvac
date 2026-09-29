/**
 * dedup-yelp.ts — find + remove Yelp_Dataset rows whose phone already exists in another tab
 * Run: npx tsx --env-file=.env src/scripts/dedup-yelp.ts
 * Dry-run by default. Set DEDUP_APPLY=true to actually delete rows.
 */
import { readSheetRows, batchUpdateSheet } from '../tools/google-sheets.js'

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

function normalizePhone(p: string): string {
  return p.replace(/\D/g, '').slice(-10)
}

async function main() {
  // 1. Collect all phones from non-Yelp tabs
  const phoneSet = new Set<string>()
  console.log('Reading non-Yelp tabs for phone index...')
  for (const tab of NON_YELP_TABS) {
    try {
      const rows = await readSheetRows({ spreadsheetId: SHEET, sheetName: tab, range: 'G2:G' })
      let added = 0
      for (const r of rows) {
        const p = normalizePhone(r[0] ?? '')
        if (p.length >= 10) { phoneSet.add(p); added++ }
      }
      process.stdout.write(`.`)
    } catch { process.stdout.write('x') }
  }
  console.log(`\nNon-Yelp phone index: ${phoneSet.size.toLocaleString()} unique phones`)

  // 2. Read Yelp_Dataset (columns A:G → need row index for deletion)
  console.log('Reading Yelp_Dataset...')
  const yelpRows = await readSheetRows({ spreadsheetId: SHEET, sheetName: 'Yelp_Dataset', range: 'A:G' })
  const dataRows = yelpRows.slice(1) // skip header

  let totalWithPhone = 0
  const dupeRowIndices: number[] = [] // 1-based sheet row indices (row 1 = header)

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i]
    const p = normalizePhone(r[6] ?? '')
    if (p.length < 10) continue
    totalWithPhone++
    if (phoneSet.has(p)) {
      dupeRowIndices.push(i + 2) // +1 for header, +1 for 1-based
    }
  }

  console.log(`Yelp rows total: ${dataRows.length.toLocaleString()}`)
  console.log(`Yelp with phone: ${totalWithPhone.toLocaleString()}`)
  console.log(`Duplicates found (same phone in another tab): ${dupeRowIndices.length}`)

  // Also find within-Yelp duplicates (same phone appearing twice in Yelp_Dataset)
  const yelpPhoneSeen = new Map<string, number>() // phone → first row index
  const intraYelpDupes: number[] = []
  for (let i = 0; i < dataRows.length; i++) {
    const p = normalizePhone(dataRows[i][6] ?? '')
    if (p.length < 10) continue
    if (yelpPhoneSeen.has(p)) {
      intraYelpDupes.push(i + 2)
    } else {
      yelpPhoneSeen.set(p, i + 2)
    }
  }
  console.log(`Intra-Yelp duplicate phones: ${intraYelpDupes.length}`)

  const allDupeRows = Array.from(new Set([...dupeRowIndices, ...intraYelpDupes])).sort((a, b) => b - a) // desc for deletion
  console.log(`Total rows to remove: ${allDupeRows.length}`)

  if (allDupeRows.length === 0) { console.log('Nothing to delete.'); return }
  if (!APPLY) {
    console.log('\nDRY RUN — set DEDUP_APPLY=true to delete')
    console.log('Sample dupe row indices (first 10):', allDupeRows.slice(-10).reverse())
    return
  }

  // 3. Delete rows in batches (descending order so indices stay valid)
  // Get Yelp_Dataset sheetId first
  const { readFileSync } = await import('fs')
  const { resolve } = await import('path')
  const { createSign } = await import('crypto')
  let sa: any
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  else sa = JSON.parse(readFileSync(resolve(process.env.GOOGLE_SERVICE_ACCOUNT_FILE!), 'utf8'))
  const now = Math.floor(Date.now() / 1000)
  const h = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const cl = Buffer.from(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', exp: now+3600, iat: now })).toString('base64url')
  const sig = createSign('RSA-SHA256').update(h+'.'+cl).sign(sa.private_key,'base64url')
  const jwt = h+'.'+cl+'.'+sig
  const tr = await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`})
  const token = ((await tr.json()) as any).access_token as string

  // get sheetId for Yelp_Dataset
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}?includeGridData=false`,{headers:{Authorization:`Bearer ${token}`}})
  const meta = await metaRes.json() as any
  const yelpSheet = meta.sheets?.find((s: any) => s.properties.title === 'Yelp_Dataset')
  const yelpSheetId = yelpSheet?.properties?.sheetId
  console.log(`Yelp_Dataset sheetId: ${yelpSheetId}`)

  // Delete in batches of 100 (API limit), rows already in descending order
  const BATCH = 100
  let deleted = 0
  for (let i = 0; i < allDupeRows.length; i += BATCH) {
    const chunk = allDupeRows.slice(i, i + BATCH) // already desc sorted
    const requests = chunk.map(rowIdx => ({
      deleteDimension: {
        range: { sheetId: yelpSheetId, dimension: 'ROWS', startIndex: rowIdx - 1, endIndex: rowIdx }
      }
    }))
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}:batchUpdate`,{
      method:'POST',
      headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body: JSON.stringify({ requests })
    })
    const d = await res.json() as any
    if (d.error) console.error('Delete error:', d.error.message)
    else { deleted += chunk.length; process.stdout.write(`\rDeleted ${deleted}/${allDupeRows.length}...`) }
    await new Promise(r => setTimeout(r, 500))
  }
  console.log(`\nDone. Removed ${deleted} duplicate rows from Yelp_Dataset.`)
}

main().catch(e => { console.error(e); process.exit(1) })
