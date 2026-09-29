/**
 * rebuild-sheet.ts
 * Rewrites "Local SMBs" tab from DB — deduped, organized, with timezone column.
 * DESTRUCTIVE: clears and rewrites the tab. Requires --confirm flag.
 * Run: npx tsx src/scripts/rebuild-sheet.ts --confirm
 */
import 'dotenv/config'

if (!process.argv.includes('--confirm')) {
  console.error('⛔  rebuild-sheet is DESTRUCTIVE — it clears and rewrites the entire "Local SMBs" tab.')
  console.error('    Pass --confirm to proceed: npx tsx src/scripts/rebuild-sheet.ts --confirm')
  process.exit(1)
}
import pg from 'pg'
import { clearSheet, writeSheetRows } from '../tools/google-sheets.js'

const { Pool } = pg
const SHEET_ID   = process.env.LEADS_SHEET_ID ?? ''
const SHEET_NAME = 'Local SMBs'

// Derive timezone from US state abbreviation
function stateTimezone(state: string): string {
  const PT = ['CA','OR','WA','NV']
  const MT = ['MT','ID','WY','CO','UT','NM','AZ']  // AZ no DST but same offset most of year
  const CT = ['TX','OK','KS','NE','SD','ND','MN','IA','MO','AR','LA','WI','IL','MS','AL']
  if (PT.includes(state)) return 'Pacific'
  if (MT.includes(state)) return 'Mountain'
  if (CT.includes(state)) return 'Central'
  return 'Eastern'
}

const HEADER = [
  'Date Added', 'Business Name', 'Niche', 'City', 'State', 'Timezone',
  'Phone', 'Email', 'Website Status', 'Website URL', 'Rating', 'Reviews',
  'GBP Claimed', 'Tier', 'Pipeline Status', 'Live URL',
]

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  const { rows } = await pool.query(`
    SELECT name, niche, city, state, address, phone, email, website,
           github_repo, cloudflare_url, status, tier,
           gbp_claimed, rating, review_count,
           created_at::date AS date_added
    FROM leads
    ORDER BY created_at ASC
  `)
  await pool.end()

  console.log(`[Rebuild] ${rows.length} leads from DB`)

  const dataRows: string[][] = rows.map(r => {
    const liveUrl = r.cloudflare_url
      ? r.cloudflare_url
      : r.github_repo
        ? `https://${r.github_repo.split('/').pop()}.pages.dev`
        : ''
    const tz = stateTimezone((r.state ?? '').toUpperCase())
    const dateStr = r.date_added
      ? new Date(r.date_added).toLocaleDateString('en-US', { timeZone: 'UTC' })
      : ''

    return [
      dateStr,
      r.name ?? '',
      r.niche ?? '',
      r.city ?? '',
      (r.state ?? '').toUpperCase(),
      tz,
      r.phone ?? '',
      r.email ?? '',
      r.website ? 'has website' : 'no website',
      r.website ?? '',
      r.rating?.toString() ?? '',
      r.review_count?.toString() ?? '',
      r.gbp_claimed === true ? 'claimed' : r.gbp_claimed === false ? 'unclaimed' : '',
      r.tier ?? '',
      r.status ?? '',
      liveUrl,
    ]
  })

  console.log('[Rebuild] Clearing sheet...')
  const cleared = await clearSheet({ spreadsheetId: SHEET_ID, sheetName: SHEET_NAME })
  if (!cleared) { console.error('Clear failed'); process.exit(1) }

  console.log('[Rebuild] Writing...')
  const written = await writeSheetRows({
    spreadsheetId: SHEET_ID,
    sheetName: SHEET_NAME,
    rows: [HEADER, ...dataRows],
  })

  if (written) {
    console.log(`✅ Sheet rebuilt: ${dataRows.length} leads`)
    console.log(`   https://docs.google.com/spreadsheets/d/${SHEET_ID}`)
  } else {
    console.error('❌ Write failed')
    process.exit(1)
  }
}

main().catch(console.error)
