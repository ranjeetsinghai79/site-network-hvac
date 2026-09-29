import 'dotenv/config'
import { readSheetRows } from '../tools/google-sheets.js'
import { searchPlaces } from '../tools/google-places.js'

function digits(p?: string): string { return (p ?? '').replace(/\D/g, '').slice(-10) }

async function main() {
  const rows = await readSheetRows({ spreadsheetId: process.env.LEADS_SHEET_ID!, sheetName: 'Local SMBs' })
  let checked = 0
  for (let i = 1; i < rows.length && checked < 8; i++) {
    const r = rows[i]
    const name = r[1]?.trim(), niche = r[2]?.trim(), city = r[3]?.trim(), state = r[4]?.trim()
    const phone = r[6]?.trim(), hasWeb = r[8]?.trim()?.toUpperCase()
    const rating = parseFloat(r[11] ?? '0'), reviews = parseInt(r[12] ?? '0')
    if (!name || hasWeb !== 'NO' || !phone || rating < 4.5 || reviews < 10) continue
    checked++
    try {
      const places = await searchPlaces(name, `${city}, ${state}`, 3)
      const m = places.find(p => digits(p.phone) === digits(phone))
        ?? places.find(p => p.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(p.name.toLowerCase()))
      if (m && !m.website && (m.reviews?.filter(rv => (rv.text?.length ?? 0) > 10).length ?? 0) >= 1) {
        console.log(`MATCH row ${i+1}: ${name} | ${niche} | ${city}, ${state} | ${phone}`)
        console.log(`  Places: ${m.name} | rating ${m.rating} (${m.review_count}) | photos ${m.photoCount} | website: ${m.website ?? 'NONE'}`)
      } else {
        console.log(`no-match row ${i+1}: ${name} (${city}) — places=${places.length}${m ? ' [has website or no review text]' : ''}`)
      }
    } catch (e: any) { console.log(`err row ${i+1}: ${name} — ${e.message}`) }
  }
}
main()
