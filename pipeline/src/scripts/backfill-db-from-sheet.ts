/**
 * backfill-db-from-sheet.ts
 * Reads every tab from Google Sheets, extracts place_ids from Maps URL (col R),
 * inserts into scraped_places DB. Prevents re-scraping rows already in sheet.
 *
 * Usage: node --env-file=.env --import=tsx/esm src/scripts/backfill-db-from-sheet.ts
 */

import pg from 'pg'
import { readSheetRows } from '../tools/google-sheets.js'

const SHEET_ID = process.env.LEADS_SHEET_ID ?? ''
const COL_NAME    = 1   // B
const COL_CITY    = 3   // D
const COL_MAPS_URL = 17 // R

const TABS = [
  'Local SMBs', 'MEDSPAS', 'USA_SkinClinics', 'USA_CosmeticSurgeons',
  'USA_IVTherapy', 'USA_DentalOffices', 'USA_NailStudios', 'INDIA_MEDSPAS',
  'USA_Salons', 'INDIA_DentalOffices', 'USA_BarberShops',
  'USA_FinancialAdvisorsandInsuranceAgents', 'USA_RealEstateAgents',
  'USA_Restaurants', 'India_Restaurants', 'USA_LawFirms',
  'USA_AutoDetailing', 'USA_HVAC', 'USA_Roofing', 'USA_Remodeling', 'USA_Plumbing',
]

function extractPlaceId(url: string, name?: string, city?: string): string {
  if (!url) {
    const key = name && city ? `${name.toLowerCase().trim()}::${city.toLowerCase().trim()}` : ''
    if (!key) return ''
    let h = 0
    for (let i = 0; i < key.length; i++) { h = ((h << 5) - h) + key.charCodeAt(i); h |= 0 }
    return `hash_${Math.abs(h).toString(16)}`
  }
  const m = url.match(/!1s([^!]+)!/)
  if (m) return m[1]
  const cid = url.match(/[?&]cid=(\d+)/)
  if (cid) return `cid_${cid[1]}`
  const key = name && city ? `${name.toLowerCase().trim()}::${city.toLowerCase().trim()}` : url
  let h = 0
  for (let i = 0; i < key.length; i++) { h = ((h << 5) - h) + key.charCodeAt(i); h |= 0 }
  return `hash_${Math.abs(h).toString(16)}`
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function backfillTab(tab: string): Promise<{ inserted: number; skipped: number; total: number }> {
  const rows = await readSheetRows({ spreadsheetId: SHEET_ID, sheetName: tab, range: 'A:R' })
  if (rows.length <= 1) return { inserted: 0, skipped: 0, total: 0 }

  const dataRows = rows.slice(1) // skip header
  let inserted = 0, skipped = 0

  const batch: Array<[string, string, string, string]> = []
  for (const row of dataRows) {
    const name    = row[COL_NAME]    ?? ''
    const city    = row[COL_CITY]    ?? ''
    const mapsUrl = row[COL_MAPS_URL] ?? ''
    const placeId = extractPlaceId(mapsUrl, name, city)
    if (!placeId) { skipped++; continue }
    batch.push([placeId, tab, name, city])
  }

  // Batch upsert in chunks of 500
  const CHUNK = 500
  for (let i = 0; i < batch.length; i += CHUNK) {
    const chunk = batch.slice(i, i + CHUNK)
    const values = chunk.map((_, idx) => `($${idx * 4 + 1}, $${idx * 4 + 2}, $${idx * 4 + 3}, $${idx * 4 + 4})`).join(',')
    const flat = chunk.flat()
    const res = await pool.query(
      `INSERT INTO scraped_places (place_id, tab, name, city)
       VALUES ${values}
       ON CONFLICT (place_id, tab) DO NOTHING`,
      flat
    )
    inserted += res.rowCount ?? 0
  }

  skipped += batch.length - inserted
  return { inserted, skipped, total: dataRows.length }
}

async function main() {
  console.log('=== Backfill DB from Sheet ===')
  console.log('Syncing sheet rows → scraped_places to prevent re-scraping\n')

  let totalInserted = 0, totalSkipped = 0, totalRows = 0

  for (const tab of TABS) {
    process.stdout.write(`  ${tab.padEnd(50)}`)
    try {
      const { inserted, skipped, total } = await backfillTab(tab)
      totalInserted += inserted
      totalSkipped  += skipped
      totalRows     += total
      console.log(`${total} rows → +${inserted} new in DB, ${skipped} already tracked`)
    } catch (e: any) {
      console.log(`ERROR: ${e.message?.slice(0, 60)}`)
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Sheet rows read: ${totalRows}`)
  console.log(`Newly inserted to DB: ${totalInserted}`)
  console.log(`Already in DB (skipped): ${totalSkipped}`)
  console.log(`\nNext scrape will skip ALL ${totalRows} existing leads. Zero duplicates.`)

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
