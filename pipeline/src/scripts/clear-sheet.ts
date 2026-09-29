import 'dotenv/config'
import { clearSheet, writeSheetRows } from '../tools/google-sheets.js'

const SHEET_ID  = process.env.LEADS_SHEET_ID!
const SHEET_TAB = process.env.SHEET_TAB ?? 'Local SMBs'

const HEADER = [
  'Date Added', 'Business Name', 'Niche', 'City', 'State', 'Timezone',
  'Phone', 'Email', 'Website Status', 'Website URL', 'Rating', 'Reviews',
  'GBP Claimed', 'Tier', 'Pipeline Status', 'Live URL',
]

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }
  console.log(`Clearing ${SHEET_TAB}...`)
  await clearSheet({ spreadsheetId: SHEET_ID, sheetName: SHEET_TAB })
  await writeSheetRows({ spreadsheetId: SHEET_ID, sheetName: SHEET_TAB, rows: [HEADER] })
  console.log(`Done — ${SHEET_TAB} clean, header written`)
}
main().catch(console.error)
