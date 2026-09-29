/**
 * insert-website-url-column.ts
 * One-time migration: inserts blank "Website URL" column at index 9
 * in an existing sheet tab (between "Website Status" and "Rating").
 *
 * Usage: SHEET_TAB=Sheet1 npx tsx src/scripts/insert-website-url-column.ts
 */
import 'dotenv/config'
import { batchUpdateSheet, getSheetId } from '../tools/google-sheets.js'
import { writeSheetRows } from '../tools/google-sheets.js'

const SHEET_ID  = process.env.LEADS_SHEET_ID!
const SHEET_TAB = process.env.SHEET_TAB ?? 'Local SMBs'

const HEADER = [
  'Date Added', 'Business Name', 'Niche', 'City', 'State', 'Timezone',
  'Phone', 'Email', 'Website Status', 'Website URL', 'Rating', 'Reviews',
  'GBP Claimed', 'Tier', 'Pipeline Status', 'Live URL',
]

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }

  const sheetId = await getSheetId({ spreadsheetId: SHEET_ID, sheetName: SHEET_TAB })
  if (sheetId === null) { console.error(`${SHEET_TAB} not found`); process.exit(1) }

  console.log(`Inserting Website URL column at J (index 9) in ${SHEET_TAB}...`)

  // Insert blank column at index 9 — shifts Rating and everything right
  const ok = await batchUpdateSheet({
    spreadsheetId: SHEET_ID,
    requests: [{
      insertDimension: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: 9,
          endIndex: 10,
        },
        inheritFromBefore: false,
      },
    }],
  })

  if (!ok) { console.error('Column insert failed'); process.exit(1) }
  console.log('Column inserted')

  // Rewrite header row with correct 16-col names
  const headerOk = await writeSheetRows({
    spreadsheetId: SHEET_ID,
    sheetName:     SHEET_TAB,
    rows:          [HEADER],
  })

  console.log(headerOk ? `✅ ${SHEET_TAB} — Website URL column added, header updated` : '❌ Header update failed')
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
