import 'dotenv/config'
import { getSheetId } from '../tools/google-sheets.js'

const SHEET_ID = process.env.LEADS_SHEET_ID ?? ''

async function main() {
  for (const name of ['Sheet1', 'Leads', 'All Leads', 'LEADS', 'leads', 'Main', 'DATA', 'Sheet 1', 'sheet1']) {
    const id = await getSheetId({ spreadsheetId: SHEET_ID, sheetName: name })
    if (id !== null) console.log(`FOUND tab: "${name}" = sheetId ${id}`)
  }
  // Also try MEDSPAS to confirm API works
  const m = await getSheetId({ spreadsheetId: SHEET_ID, sheetName: 'MEDSPAS' })
  console.log(`MEDSPAS sheetId: ${m}`)
}

main().catch(e => console.error(e.message))
