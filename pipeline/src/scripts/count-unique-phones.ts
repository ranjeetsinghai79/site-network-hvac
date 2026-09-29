/**
 * count-unique-phones.ts — read all tabs, dedupe phone numbers (col G), report totals
 * Run: node --env-file=.env --import=tsx/esm src/scripts/count-unique-phones.ts
 */
import { readSheetRows } from '../tools/google-sheets.js'

const SHEET = process.env.LEADS_SHEET_ID!
const TABS = [
  'Local SMBs','INDIA_DentalOffices','USA_BarberShops','MEDSPAS',
  'USA_FinancialAdvisorsandInsuranceAgents','USA_Restaurants','USA_Salons','INDIA_MEDSPAS',
  'USA_RealEstateAgents','USA_DentalOffices','USA_LawFirms','India_Restaurants',
  'USA_SkinClinics','USA_CosmeticSurgeons','USA_IVTherapy','USA_NailStudios',
  'USA_AutoDetailing','USA_HVAC','USA_Roofing','USA_Remodeling','USA_Plumbing',
  'Yelp_Dataset','USA_AutoRepair','USA_MedicalOffices','USA_Fitness','USA_PetServices',
]

function normalizePhone(raw: string): string {
  // keep digits only, strip leading country code "1" for 11-digit US numbers
  let d = raw.replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1)
  return d
}

async function main() {
  const globalSeen = new Set<string>()
  const perTab: Record<string, { total: number; nonEmpty: number; uniqueInTab: number; newGlobal: number }> = {}

  for (const tab of TABS) {
    try {
      const rows = await readSheetRows({ spreadsheetId: SHEET, sheetName: tab, range: 'A:V' })
      const data = rows.slice(1)
      const tabSeen = new Set<string>()
      let nonEmpty = 0
      let newGlobal = 0
      for (const r of data) {
        const raw = (r[6] ?? '').trim() // col G
        if (!raw) continue
        nonEmpty++
        const norm = normalizePhone(raw)
        if (!norm) continue
        tabSeen.add(norm)
        if (!globalSeen.has(norm)) {
          globalSeen.add(norm)
          newGlobal++
        }
      }
      perTab[tab] = { total: data.length, nonEmpty, uniqueInTab: tabSeen.size, newGlobal }
      console.log(`${tab.padEnd(42)} rows=${data.length.toString().padStart(6)} withPhone=${nonEmpty.toString().padStart(6)} uniqueInTab=${tabSeen.size.toString().padStart(6)} newToGlobal=${newGlobal.toString().padStart(6)}`)
    } catch (e) {
      console.log(`${tab.padEnd(42)} ERROR reading tab: ${(e as Error).message}`)
      perTab[tab] = { total: 0, nonEmpty: 0, uniqueInTab: 0, newGlobal: 0 }
    }
  }

  const totalRows = Object.values(perTab).reduce((a, t) => a + t.total, 0)
  const totalNonEmpty = Object.values(perTab).reduce((a, t) => a + t.nonEmpty, 0)

  console.log('\n=== SUMMARY ===')
  console.log(`Total sheet rows (all 26 tabs): ${totalRows.toLocaleString()}`)
  console.log(`Total rows with a phone value:  ${totalNonEmpty.toLocaleString()}`)
  console.log(`TOTAL UNIQUE PHONE NUMBERS (deduped across all tabs incl. Yelp_Dataset): ${globalSeen.size.toLocaleString()}`)
  console.log(`Yelp_Dataset tab alone — unique phones: ${(perTab['Yelp_Dataset']?.uniqueInTab ?? 0).toLocaleString()}, new (not seen in other tabs): ${(perTab['Yelp_Dataset']?.newGlobal ?? 0).toLocaleString()}`)
}

main().catch(e => { console.error(e); process.exit(1) })
