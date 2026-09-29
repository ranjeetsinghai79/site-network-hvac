/**
 * export-neon-leads-to-sheet.ts
 *
 * One-time export: dumps every row in Neon's `leads` table to a new sheet
 * tab ("Neon_DB_Export") so the DB copy can be safely deleted afterward to
 * free up storage/compute. Read-only against the sheet (creates a new tab,
 * never touches existing tabs) and read-only against the DB — does NOT
 * delete anything. Deletion is a separate, explicit step
 * (delete-exported-neon-leads.ts) run only after this export is verified.
 *
 * Usage:
 *   cd pipeline && npx tsx src/scripts/export-neon-leads-to-sheet.ts
 */

import 'dotenv/config'
import pg from 'pg'
import { batchUpdateSheet, writeSheetRows, getSheetId } from '../tools/google-sheets.js'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const SPREADSHEET_ID = process.env.LEADS_SHEET_ID!
const TAB = 'Neon_DB_Export'

const HEADER = [
  'id', 'place_id', 'name', 'phone', 'international_phone', 'email', 'website',
  'address', 'city', 'state', 'zip', 'niche', 'tier', 'status',
  'rating', 'review_count', 'gbp_claimed', 'is_open', 'price_level',
  'outreach_sent', 'outreach_sent_at', 'sms_sent', 'sms_sent_at',
  'follow_up_1_sent_at', 'follow_up_2_sent_at', 'sms_opt_out',
  'paid', 'paid_at', 'handed_off', 'handed_off_at',
  'cloudflare_url', 'vercel_url', 'custom_domain',
  'reception_config_id', 'reception_phone', 'last_call_at', 'call_count',
  'missed_call_sms_sent_at', 'last_missed_call_at',
  'stripe_customer_id', 'stripe_subscription_id', 'subscription_active', 'subscription_plan',
  'google_maps_uri', 'source', 'created_at', 'updated_at',
]

async function main() {
  if (!SPREADSHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }

  console.log('Counting leads...')
  const { rows: countRows } = await pool.query(`SELECT count(*)::int AS n FROM leads`)
  const total = countRows[0].n
  console.log(`${total} leads to export`)
  if (total === 0) { console.log('Nothing to export.'); await pool.end(); return }

  const { rows } = await pool.query(`SELECT ${HEADER.join(',')} FROM leads ORDER BY created_at ASC`)

  // Create the destination tab (fresh — errors harmlessly if it already exists from a prior partial run)
  await batchUpdateSheet({
    spreadsheetId: SPREADSHEET_ID,
    requests: [{ addSheet: { properties: { title: TAB } } }],
  }).catch(() => console.log(`(tab "${TAB}" may already exist — continuing)`))

  const sheetRows = [
    HEADER,
    ...rows.map(r => HEADER.map(col => {
      const v = (r as any)[col]
      if (v === null || v === undefined) return ''
      if (v instanceof Date) return v.toISOString()
      return String(v)
    })),
  ]

  console.log(`Writing ${rows.length} rows to tab "${TAB}"...`)
  const ok = await writeSheetRows({ spreadsheetId: SPREADSHEET_ID, sheetName: TAB, rows: sheetRows })
  if (!ok) { console.error('Write failed — DB NOT touched, nothing deleted, safe to retry.'); process.exit(1) }

  console.log(`\n✅ Exported ${rows.length} leads to sheet tab "${TAB}".`)
  console.log('Verify the tab in the sheet before running delete-exported-neon-leads.ts.')
  await pool.end()
}

main().catch(e => {
  console.error('[Export] Fatal:', e.message)
  process.exit(1)
})
