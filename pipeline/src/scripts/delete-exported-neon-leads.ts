/**
 * delete-exported-neon-leads.ts
 *
 * Deletes leads from Neon that have already been exported to the
 * "Neon_DB_Export" sheet tab (run export-neon-leads-to-sheet.ts first).
 *
 * SAFE BY DESIGN — only deletes leads with zero real engagement. Several
 * tables CASCADE delete when a lead is removed (checked against every
 * migration's REFERENCES clause):
 *   call_logs, client_reviews, gsc_snapshots, client_google_tokens,
 *   business_knowledge
 * A blanket "DELETE FROM leads" would silently destroy real AI Reception
 * call transcripts and client-portal data for any lead that ever had
 * activity. This script excludes any lead with a row in those tables.
 * consent_events is unaffected either way — its lead_id FK is ON DELETE
 * SET NULL, and consent lookups match by phone number, not lead_id.
 *
 * Usage:
 *   cd pipeline && DRY_RUN=true npx tsx src/scripts/delete-exported-neon-leads.ts   # count only, no delete
 *   cd pipeline && npx tsx src/scripts/delete-exported-neon-leads.ts                # actually delete
 */

import 'dotenv/config'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const DRY_RUN = process.env.DRY_RUN === 'true'

const SAFE_TO_DELETE_WHERE = `
  NOT EXISTS (SELECT 1 FROM call_logs           c WHERE c.lead_id = leads.id)
  AND NOT EXISTS (SELECT 1 FROM client_reviews       c WHERE c.lead_id = leads.id)
  AND NOT EXISTS (SELECT 1 FROM gsc_snapshots        c WHERE c.lead_id = leads.id)
  AND NOT EXISTS (SELECT 1 FROM client_google_tokens c WHERE c.lead_id = leads.id)
  AND NOT EXISTS (SELECT 1 FROM business_knowledge   c WHERE c.lead_id = leads.id)
`

async function main() {
  console.log(`\n=== Delete exported Neon leads${DRY_RUN ? ' (DRY RUN — count only)' : ''} ===`)

  const { rows: totalRows } = await pool.query(`SELECT count(*)::int AS n FROM leads`)
  const { rows: safeRows } = await pool.query(`SELECT count(*)::int AS n FROM leads WHERE ${SAFE_TO_DELETE_WHERE}`)
  const { rows: keptRows } = await pool.query(`SELECT count(*)::int AS n FROM leads WHERE NOT (${SAFE_TO_DELETE_WHERE})`)

  console.log(`Total leads:        ${totalRows[0].n}`)
  console.log(`Safe to delete:     ${safeRows[0].n}  (no call_logs/client_reviews/gsc_snapshots/client_google_tokens/business_knowledge)`)
  console.log(`Kept (has activity): ${keptRows[0].n}  (real engagement — never deleted by this script)`)

  if (DRY_RUN) {
    console.log('\nDry run — nothing deleted. Re-run without DRY_RUN=true to actually delete.')
    await pool.end()
    return
  }

  console.log('\nDeleting...')
  const { rowCount } = await pool.query(`DELETE FROM leads WHERE ${SAFE_TO_DELETE_WHERE}`)
  console.log(`\n✅ Deleted ${rowCount} leads. ${keptRows[0].n} leads with real activity were kept.`)
  await pool.end()
}

main().catch(e => {
  console.error('[Delete] Fatal:', e.message)
  process.exit(1)
})
