import pg from 'pg'
import { writeSheetRows, appendSheetRow } from '../tools/google-sheets.js'

const { Pool } = pg

function normalizeUrl(url: string | null | undefined): string {
  if (!url) return ''
  return url.startsWith('http') ? url : `https://${url}`
}

const HEADERS = ['Date', 'Business Name', 'Niche', 'Location', 'Phone', 'Email',
  'Their Website', 'Demo Site', 'Rating', 'Reviews', 'Tier', 'Status']

export async function runDailyReport(): Promise<void> {
  const sheetId = process.env.LEADS_SHEET_ID
  if (!sheetId) {
    console.log('[Report] LEADS_SHEET_ID not set — skipping')
    return
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    // Fetch ALL reportable leads (not yet in sheet)
    const { rows } = await pool.query(`
      SELECT id, name, niche, city, state, address, phone, email,
             website, vercel_url, cloudflare_url, github_repo, rating,
             review_count, tier, site_score, status
      FROM leads
      WHERE status IN ('built','deployed','outreach_sent','sms_sent')
        AND (sheet_reported_at IS NULL)
      ORDER BY updated_at DESC
    `)

    console.log(`[Report] ${rows.length} unreported leads`)

    if (!rows.length) {
      await appendSheetRow({
        spreadsheetId: sheetId,
        sheetName: 'Sheet1',
        values: [new Date().toLocaleDateString('en-US'), '— no new sites today —', ...Array(10).fill('')],
      })
      return
    }

    const date = new Date().toLocaleDateString('en-US')
    const dataRows: string[][] = rows.map(row => {
      const demoUrl = normalizeUrl(row.cloudflare_url ?? row.vercel_url)
      return [
        date,
        row.name ?? '',
        row.niche ?? '',
        `${row.city}, ${row.state}`,
        row.phone ?? '',
        row.email ?? '',
        normalizeUrl(row.website),
        demoUrl,
        row.rating ?? '',
        row.review_count ?? '',
        row.tier ?? '',
        row.status ?? '',
      ]
    })

    // Single batch write — all rows at once, no rate limit issues
    // writeSheetRows does a PUT which overwrites from A1; prepend header
    const allRows = [HEADERS, ...dataRows]
    const ok = await writeSheetRows({ spreadsheetId: sheetId, sheetName: 'Sheet1', rows: allRows })

    if (!ok) {
      console.error('[Report] Sheet write failed')
      return
    }

    // Mark as reported
    const ids = rows.map(r => r.id).filter(Boolean)
    if (ids.length) {
      await pool.query(
        `UPDATE leads SET sheet_reported_at = NOW() WHERE id = ANY($1::uuid[])`,
        [ids]
      )
    }

    console.log(`[Report] Wrote ${rows.length} rows to Google Sheet`)
  } finally {
    await pool.end()
  }
}
