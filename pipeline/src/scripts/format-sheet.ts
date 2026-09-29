/**
 * format-sheet.ts
 * Applies professional formatting to Local SMBs:
 *  - Bold dark header row (frozen)
 *  - Auto-filter on all columns
 *  - Column widths sized to content
 *  - Alternating row colors for readability
 *  - Status column color-coded (deployed=green, outreach_sent=blue, etc.)
 *
 * Run: npx tsx src/scripts/format-sheet.ts
 */

import 'dotenv/config'
import { batchUpdateSheet, getSheetId, getConditionalRuleCount } from '../tools/google-sheets.js'

const SHEET_ID   = process.env.LEADS_SHEET_ID!
const SHEET_NAME = process.env.SHEET_TAB ?? 'Local SMBs'

// Column widths in pixels — matches header order
// Date | Name | Niche | City | State | Timezone | Phone | Email | Website Status | Website URL | Rating | Reviews | GBP | Tier | Pipeline Status | Live URL
const COL_WIDTHS = [100, 240, 110, 120, 55, 90, 130, 210, 110, 240, 65, 75, 90, 60, 130, 300]

// Status → background color (RGB 0-1, full field names for Sheets API)
const STATUS_COLORS: Record<string, { red: number; green: number; blue: number }> = {
  deployed:          { red: 0.20, green: 0.78, blue: 0.35 },
  outreach_sent:     { red: 0.26, green: 0.52, blue: 0.96 },
  sms_sent:          { red: 0.26, green: 0.52, blue: 0.96 },
  built:             { red: 1.00, green: 0.76, blue: 0.03 },
  config_generated:  { red: 1.00, green: 0.90, blue: 0.40 },
  analyzed:          { red: 0.95, green: 0.95, blue: 0.95 },
  found:             { red: 0.95, green: 0.95, blue: 0.95 },
  meeting_scheduled: { red: 1.00, green: 0.55, blue: 0.00 },
  paid:              { red: 0.00, green: 0.60, blue: 0.00 },
  handed_off:        { red: 0.50, green: 0.00, blue: 0.50 },
}

function rgb(r: number, g: number, b: number) {
  return { red: r, green: g, blue: b }
}

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }

  const sheetId = await getSheetId({ spreadsheetId: SHEET_ID, sheetName: SHEET_NAME })
  if (sheetId === null) { console.error(`${SHEET_NAME} not found`); process.exit(1) }

  console.log(`${SHEET_NAME} id: ${sheetId}`)

  // Step 1: delete existing conditional rules (prevents duplicates on re-run)
  const existingRules = await getConditionalRuleCount({ spreadsheetId: SHEET_ID, sheetId })
  if (existingRules > 0) {
    const deleteRequests = Array.from({ length: existingRules }, () => ({
      deleteConditionalFormatRule: { sheetId, index: 0 },
    }))
    await batchUpdateSheet({ spreadsheetId: SHEET_ID, requests: deleteRequests })
    console.log(`Cleared ${existingRules} existing conditional rules`)
  }

  const requests: any[] = []

  // 1. Freeze header row
  requests.push({
    updateSheetProperties: {
      properties: {
        sheetId,
        gridProperties: { frozenRowCount: 1 },
      },
      fields: 'gridProperties.frozenRowCount',
    },
  })

  // 2. Header row — dark bg, white bold text, center-aligned
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
      cell: {
        userEnteredFormat: {
          backgroundColor: rgb(0.13, 0.13, 0.17),  // near-black
          textFormat: {
            bold: true,
            fontSize: 10,
            foregroundColor: rgb(1, 1, 1),
            fontFamily: 'Arial',
          },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          padding: { top: 8, bottom: 8, left: 6, right: 6 },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)',
    },
  })

  // 3. Data rows — clean white bg, readable font
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 10000 },
      cell: {
        userEnteredFormat: {
          backgroundColor: rgb(1, 1, 1),
          textFormat: {
            bold: false,
            fontSize: 10,
            foregroundColor: rgb(0.15, 0.15, 0.15),
            fontFamily: 'Arial',
          },
          verticalAlignment: 'MIDDLE',
          padding: { top: 4, bottom: 4, left: 6, right: 6 },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,padding)',
    },
  })

  // 4. Column widths
  for (let i = 0; i < COL_WIDTHS.length; i++) {
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: i,
          endIndex: i + 1,
        },
        properties: { pixelSize: COL_WIDTHS[i] },
        fields: 'pixelSize',
      },
    })
  }

  // 5. Row height — header taller
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 40 },
      fields: 'pixelSize',
    },
  })

  // 6. Data row height
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 10000 },
      properties: { pixelSize: 28 },
      fields: 'pixelSize',
    },
  })

  // 7. Auto-filter (filter dropdowns on header)
  requests.push({
    setBasicFilter: {
      filter: {
        range: {
          sheetId,
          startRowIndex: 0,
          startColumnIndex: 0,
          endColumnIndex: COL_WIDTHS.length,
        },
      },
    },
  })

  // 8. Niche column (col C = index 2) — color-coded backgrounds per niche
  const NICHE_COLORS: Record<string, { r: number; g: number; b: number }> = {
    hvac:           { r: 0.93, g: 0.96, b: 1.00 },
    roofing:        { r: 1.00, g: 0.95, b: 0.88 },
    plumbing:       { r: 0.88, g: 0.96, b: 1.00 },
    cleaning:       { r: 0.90, g: 1.00, b: 0.93 },
    landscaping:    { r: 0.88, g: 0.98, b: 0.88 },
    'auto-detailing': { r: 1.00, g: 0.93, b: 0.93 },
    dentist:        { r: 0.97, g: 0.90, b: 1.00 },
    remodeling:     { r: 1.00, g: 0.98, b: 0.88 },
  }

  // Alternating rows via conditional format (ISEVEN row number = light grey)
  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId, startRowIndex: 1, endRowIndex: 10000, startColumnIndex: 0, endColumnIndex: COL_WIDTHS.length }],
        booleanRule: {
          condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=ISEVEN(ROW())' }] },
          format: { backgroundColor: { red: 0.97, green: 0.97, blue: 0.99 } },
        },
      },
      index: 0,
    },
  })

  // 9. Conditional formatting — Pipeline Status column (col O = index 14)
  for (const [status, color] of Object.entries(STATUS_COLORS)) {
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{
            sheetId,
            startRowIndex: 1,
            endRowIndex: 10000,
            startColumnIndex: 14,
            endColumnIndex: 15,
          }],
          booleanRule: {
            condition: {
              type: 'TEXT_EQ',
              values: [{ userEnteredValue: status }],
            },
            format: {
              backgroundColor: color,
              textFormat: {
                bold: status === 'paid' || status === 'deployed',
                foregroundColor: (status === 'paid' || status === 'handed_off')
                  ? { red: 1, green: 1, blue: 1 }
                  : { red: 0.1, green: 0.1, blue: 0.1 },
              },
            },
          },
        },
        index: 0,
      },
    })
  }

  // 10. Tier column (N = index 13) conditional color
  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId, startRowIndex: 1, endRowIndex: 10000, startColumnIndex: 13, endColumnIndex: 14 }],
        booleanRule: {
          condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'tier1' }] },
          format: { backgroundColor: { red: 0.87, green: 0.96, blue: 1.00 },
                    textFormat: { foregroundColor: { red: 0.1, green: 0.1, blue: 0.1 } } },
        },
      },
      index: 0,
    },
  })
  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId, startRowIndex: 1, endRowIndex: 10000, startColumnIndex: 13, endColumnIndex: 14 }],
        booleanRule: {
          condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'tier2' }] },
          format: { backgroundColor: { red: 1.00, green: 0.93, blue: 0.80 },
                    textFormat: { foregroundColor: { red: 0.1, green: 0.1, blue: 0.1 } } },
        },
      },
      index: 0,
    },
  })

  // 11. Rating >= 4.5 → green highlight (col K = index 10)
  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId, startRowIndex: 1, endRowIndex: 10000, startColumnIndex: 10, endColumnIndex: 11 }],
        booleanRule: {
          condition: { type: 'NUMBER_GREATER_THAN_EQ', values: [{ userEnteredValue: '4.5' }] },
          format: { backgroundColor: { red: 0.80, green: 0.97, blue: 0.82 } },
        },
      },
      index: 0,
    },
  })

  // 12. Missing phone → red highlight
  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId, startRowIndex: 1, endRowIndex: 10000, startColumnIndex: 6, endColumnIndex: 7 }],
        booleanRule: {
          condition: { type: 'BLANK' },
          format: { backgroundColor: { red: 1.00, green: 0.88, blue: 0.88 } },
        },
      },
      index: 0,
    },
  })

  console.log(`Applying ${requests.length} formatting requests...`)
  const ok = await batchUpdateSheet({ spreadsheetId: SHEET_ID, requests })

  if (ok) {
    console.log('✅ Sheet formatted')
    console.log(`   https://docs.google.com/spreadsheets/d/${SHEET_ID}`)
  } else {
    console.error('❌ Formatting failed')
    process.exit(1)
  }
}

main().catch(e => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
