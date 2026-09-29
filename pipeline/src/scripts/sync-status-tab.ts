/**
 * sync-status-tab.ts — rebuild the Status dashboard from the Sheet only (no DB dependency).
 * Sheet is the source of truth. Simple table + 3 scorecards + bar chart + pie chart.
 * Run: npx tsx --env-file=.env src/scripts/sync-status-tab.ts
 */
import { clearRange, writeRangeValues, readSheetRows } from '../tools/google-sheets.js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createSign } from 'crypto'

const SHEET = process.env.LEADS_SHEET_ID!
const TABS = [
  'Local SMBs','INDIA_DentalOffices','USA_BarberShops','MEDSPAS',
  'USA_FinancialAdvisorsandInsuranceAgents','USA_Restaurants','USA_Salons','INDIA_MEDSPAS',
  'USA_RealEstateAgents','USA_DentalOffices','USA_LawFirms','India_Restaurants',
  'USA_SkinClinics','USA_CosmeticSurgeons','USA_IVTherapy','USA_NailStudios',
  'USA_AutoDetailing','USA_HVAC','USA_Roofing','USA_Remodeling','USA_Plumbing',
  'Yelp_Dataset','USA_AutoRepair','USA_MedicalOffices','USA_Fitness','USA_PetServices',
]

async function getSheetsToken(): Promise<string> {
  let sa: any
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  else sa = JSON.parse(readFileSync(resolve(process.env.GOOGLE_SERVICE_ACCOUNT_FILE!), 'utf8'))
  const now = Math.floor(Date.now() / 1000)
  const h = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const cl = Buffer.from(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now })).toString('base64url')
  const sig = createSign('RSA-SHA256').update(h + '.' + cl).sign(sa.private_key, 'base64url')
  const jwt = h + '.' + cl + '.' + sig
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}` })
  return ((await r.json()) as any).access_token as string
}

type TabStat = { total: number; hasPhone: number; hasWeb: number; noWeb: number; smsY: number }

async function main() {
  console.log('Reading sheet tabs (source of truth — no DB)...')
  const stats: Record<string, TabStat> = {}
  for (const tab of TABS) {
    try {
      const rows = await readSheetRows({ spreadsheetId: SHEET, sheetName: tab, range: 'A:V' })
      const data = rows.slice(1)
      let hasPhone = 0, hasWeb = 0, noWeb = 0, smsY = 0
      for (const r of data) {
        if ((r[6] ?? '').trim()) hasPhone++
        ;(r[8] ?? '').toUpperCase() === 'YES' ? hasWeb++ : noWeb++
        if ((r[21] ?? '').toUpperCase() === 'YES') smsY++
      }
      stats[tab] = { total: data.length, hasPhone, hasWeb, noWeb, smsY }
      process.stdout.write('.')
    } catch {
      stats[tab] = { total: 0, hasPhone: 0, hasWeb: 0, noWeb: 0, smsY: 0 }
    }
  }
  console.log('')

  // Sort tabs by total leads, descending — makes the bar chart readable
  const sorted = [...TABS].sort((a, b) => (stats[b]?.total ?? 0) - (stats[a]?.total ?? 0))

  const header = ['Tab', 'Total Leads', 'Phone %', 'Has Website', 'No Website', 'Can SMS ✓']
  const dataRows = sorted.map(tab => {
    const s = stats[tab]
    const phonePct = s.total ? Math.round((s.hasPhone / s.total) * 100) + '%' : '0%'
    return [tab, s.total, phonePct, s.hasWeb, s.noWeb, s.smsY]
  })

  const totTotal = TABS.reduce((a, t) => a + stats[t].total, 0)
  const totPhone = TABS.reduce((a, t) => a + stats[t].hasPhone, 0)
  const totHW    = TABS.reduce((a, t) => a + stats[t].hasWeb, 0)
  const totNW    = TABS.reduce((a, t) => a + stats[t].noWeb, 0)
  const totSY    = TABS.reduce((a, t) => a + stats[t].smsY, 0)
  const totPhonePct = totTotal ? Math.round((totPhone / totTotal) * 100) + '%' : '0%'
  const today = new Date().toISOString().split('T')[0]

  const N = sorted.length
  const rows: (string | number)[][] = [
    header,
    ...dataRows,
    ['', '', '', '', '', ''],                                             // blank — index N+1
    ['TOTAL', totTotal, totPhonePct, totHW, totNW, totSY],                // index N+2
    ['Last updated', today, '', '', '', ''],                              // index N+3
  ]

  const token = await getSheetsToken()
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}?includeGridData=false`, { headers: { Authorization: `Bearer ${token}` } })
  const meta = await metaRes.json() as any
  const statusSheet = meta.sheets?.find((s: any) => s.properties.title === 'Status')
  const statusSheetId: number = statusSheet?.properties?.sheetId

  // Stale manual cell merges (e.g. a leftover A1:D2 title banner) make writeRangeValues
  // silently drop values for every cell but the merge's top-left — unmerge before writing.
  const unmergeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ unmergeCells: { range: { sheetId: statusSheetId, startRowIndex: 0, endRowIndex: 60, startColumnIndex: 0, endColumnIndex: 26 } } }] }),
  })
  const unmergeData = await unmergeRes.json() as any
  if (unmergeData.error) console.error('Unmerge error:', unmergeData.error.message)

  await clearRange({ spreadsheetId: SHEET, range: 'Status!A1:Z60' })
  const ok = await writeRangeValues({ spreadsheetId: SHEET, range: `Status!A1:F${rows.length}`, values: rows })
  console.log(`Table written: ${ok}`)

  const existingCharts: any[] = statusSheet?.charts ?? []
  const deleteRequests = existingCharts.map((c: any) => ({ deleteEmbeddedObject: { objectId: c.chartId } }))

  const totalRowIndex = N + 2 // 0-indexed row of the TOTAL row

  // Scorecard 1 — Total Leads
  const scorecardTotal = {
    addChart: { chart: {
      spec: { title: 'Total Leads', scorecardChart: {
        keyValueData: { sourceRange: { sources: [{ sheetId: statusSheetId, startRowIndex: totalRowIndex, endRowIndex: totalRowIndex + 1, startColumnIndex: 1, endColumnIndex: 2 }] } },
        numberFormatSource: 'FROM_DATA',
        keyValueFormat: { textFormat: { fontSize: 32, bold: true } },
      } },
      position: { overlayPosition: { anchorCell: { sheetId: statusSheetId, rowIndex: 0, columnIndex: 7 }, widthPixels: 220, heightPixels: 130 } },
    } }
  }

  // Scorecard 2 — Phone %
  const scorecardPhone = {
    addChart: { chart: {
      spec: { title: 'Phone %', scorecardChart: {
        keyValueData: { sourceRange: { sources: [{ sheetId: statusSheetId, startRowIndex: totalRowIndex, endRowIndex: totalRowIndex + 1, startColumnIndex: 2, endColumnIndex: 3 }] } },
        numberFormatSource: 'FROM_DATA',
        keyValueFormat: { textFormat: { fontSize: 32, bold: true } },
      } },
      position: { overlayPosition: { anchorCell: { sheetId: statusSheetId, rowIndex: 0, columnIndex: 10 }, widthPixels: 220, heightPixels: 130 } },
    } }
  }

  // Scorecard 3 — Can SMS
  const scorecardSms = {
    addChart: { chart: {
      spec: { title: 'Can SMS ✓', scorecardChart: {
        keyValueData: { sourceRange: { sources: [{ sheetId: statusSheetId, startRowIndex: totalRowIndex, endRowIndex: totalRowIndex + 1, startColumnIndex: 5, endColumnIndex: 6 }] } },
        numberFormatSource: 'FROM_DATA',
        keyValueFormat: { textFormat: { fontSize: 32, bold: true } },
      } },
      position: { overlayPosition: { anchorCell: { sheetId: statusSheetId, rowIndex: 0, columnIndex: 13 }, widthPixels: 220, heightPixels: 130 } },
    } }
  }

  // Bar chart — Total Leads by tab (sorted, all tabs)
  const barChart = {
    addChart: { chart: {
      spec: {
        title: 'Total Leads by Tab',
        basicChart: {
          chartType: 'BAR',
          legendPosition: 'NO_LEGEND',
          axis: [{ position: 'BOTTOM_AXIS', title: 'Leads' }],
          domains: [{ domain: { sourceRange: { sources: [{ sheetId: statusSheetId, startRowIndex: 1, endRowIndex: 1 + N, startColumnIndex: 0, endColumnIndex: 1 }] } } }],
          series: [{ series: { sourceRange: { sources: [{ sheetId: statusSheetId, startRowIndex: 1, endRowIndex: 1 + N, startColumnIndex: 1, endColumnIndex: 2 }] } }, color: { red: 0.235, green: 0.702, blue: 0.443 } }],
          headerCount: 0,
        }
      },
      position: { overlayPosition: { anchorCell: { sheetId: statusSheetId, rowIndex: 7, columnIndex: 7 }, widthPixels: 640, heightPixels: 480 } },
    } }
  }

  // Pie chart — Has Website vs No Website
  const pieChart = {
    addChart: { chart: {
      spec: {
        title: 'Has Website vs No Website',
        pieChart: {
          legendPosition: 'RIGHT_LEGEND',
          domain: { sourceRange: { sources: [{ sheetId: statusSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 3, endColumnIndex: 5 }] } },
          series: { sourceRange: { sources: [{ sheetId: statusSheetId, startRowIndex: totalRowIndex, endRowIndex: totalRowIndex + 1, startColumnIndex: 3, endColumnIndex: 5 }] } },
        }
      },
      position: { overlayPosition: { anchorCell: { sheetId: statusSheetId, rowIndex: 7, columnIndex: 18 }, widthPixels: 380, heightPixels: 320 } },
    } }
  }

  const chartRequests = [...deleteRequests, scorecardTotal, scorecardPhone, scorecardSms, barChart, pieChart]
  const chartRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: chartRequests }),
  })
  const chartData = await chartRes.json() as any
  if (chartData.error) console.error('Chart error:', chartData.error.message)
  else console.log('Charts rebuilt: 3 scorecards + bar chart + pie chart')

  console.log(`\nTotal leads: ${totTotal.toLocaleString()} | With phone: ${totPhone.toLocaleString()} (${totPhonePct}) | Can SMS: ${totSY.toLocaleString()}`)
}

main().catch(e => { console.error(e); process.exit(1) })
