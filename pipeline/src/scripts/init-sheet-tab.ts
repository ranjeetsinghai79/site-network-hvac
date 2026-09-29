/**
 * init-sheet-tab.ts
 * Writes header row to a sheet tab (clears first). Safe to run on empty tabs.
 * Usage: SHEET_TAB=MEDSPAS npx tsx src/scripts/init-sheet-tab.ts
 */
import 'dotenv/config'
import { writeSheetRows } from '../tools/google-sheets.js'

const SHEET_ID  = process.env.LEADS_SHEET_ID!
const SHEET_TAB = process.env.SHEET_TAB ?? 'Local SMBs'

const HEADER = [
  'Date Added', 'Business Name', 'Niche', 'City', 'State', 'Timezone',
  'Phone', 'Email', 'Website Status', 'Website URL', 'Rating', 'Reviews', 'GBP Claimed',
  'Tier', 'Pipeline Status', 'Live URL',
]

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }
  console.log(`Writing header to ${SHEET_TAB}...`)
  const ok = await writeSheetRows({ spreadsheetId: SHEET_ID, sheetName: SHEET_TAB, rows: [HEADER] })
  console.log(ok ? `✅ Header written to ${SHEET_TAB}` : '❌ Failed')
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
