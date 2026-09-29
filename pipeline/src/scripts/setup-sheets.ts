/**
 * setup-sheets.ts
 * One-time script to add header row to Google Sheets.
 * Run once: npx tsx src/scripts/setup-sheets.ts
 */
import 'dotenv/config'
import { appendSheetRow } from '../tools/google-sheets.js'

const SHEET_ID   = process.env.LEADS_SHEET_ID ?? ''
const SHEET_NAME = 'Sheet1'

async function main() {
  if (!SHEET_ID) {
    console.error('LEADS_SHEET_ID not set in .env')
    process.exit(1)
  }

  console.log('Setting up Google Sheets header row...')

  const ok = await appendSheetRow({
    spreadsheetId: SHEET_ID,
    sheetName: SHEET_NAME,
    values: [
      'Date Scraped',
      'Business Name',
      'Phone',
      'Address',
      'City',
      'State',
      'Niche',
      'Website Status',
      'Rating',
      'Reviews',
      'GBP Status',
      'Open Now',
      'Place ID',
    ],
  })

  if (ok) {
    console.log(`✅ Header row added to sheet: ${SHEET_NAME}`)
    console.log(`   Open: https://docs.google.com/spreadsheets/d/${SHEET_ID}`)
  } else {
    console.error('❌ Failed — check service account has editor access to the sheet')
    console.log('\nFix:')
    console.log(`1. Open sheet: https://docs.google.com/spreadsheets/d/${SHEET_ID}`)
    console.log('2. Share → add service account email → Editor')
    console.log(`3. Service account email is in service-account.json → client_email`)
  }
}

main()
