/**
 * Print the number of unique, valid US phone numbers in one lead-sheet tab.
 * Intended for target-aware background runners.
 */
import { readSheetRows } from '../tools/google-sheets.js'

const sheetId = process.env.LEADS_SHEET_ID ?? ''
const tab = process.env.SHEET_TAB ?? ''

function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  return digits.length === 10 ? digits : ''
}

async function main(): Promise<void> {
  if (!sheetId || !tab) throw new Error('LEADS_SHEET_ID and SHEET_TAB are required')
  const rows = await readSheetRows({ spreadsheetId: sheetId, sheetName: tab, range: 'G:G' })
  const phones = new Set<string>()
  for (const row of rows.slice(1)) {
    const phone = normalizePhone(row[0] ?? '')
    if (phone) phones.add(phone)
  }
  console.log(phones.size)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
