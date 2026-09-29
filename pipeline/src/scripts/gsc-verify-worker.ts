/**
 * gsc-verify-worker.ts
 *
 * Polls leads.gsc_verify_requested for flagged rows and runs gsc-agent.ts
 * on each. Exists because the admin dashboard runs on Cloudflare Workers'
 * edge runtime, which can't do the Node crypto/JWT + polling-for-deploy
 * work gsc-agent.ts does — the admin route just sets the flag, this worker
 * does the real work. Same shape as auto-build-from-sms.ts's poller.
 *
 * Usage:
 *   cd pipeline && npx tsx src/scripts/gsc-verify-worker.ts
 *   cd pipeline && DAEMON=true npx tsx src/scripts/gsc-verify-worker.ts
 */

import 'dotenv/config'
import pg from 'pg'
import { runGscAgent } from '../agents/gsc-agent.js'
import type { Lead } from '../types.js'

const DATABASE_URL = process.env.DATABASE_URL!
const DAEMON       = process.env.DAEMON === 'true'
const POLL_MS      = parseInt(process.env.POLL_MS ?? '30000', 10)

const pool = new pg.Pool({ connectionString: DATABASE_URL })

async function processPendingRequests() {
  const { rows } = await pool.query<Lead & { id: string }>(
    `SELECT * FROM leads WHERE gsc_verify_requested = TRUE LIMIT 10`
  )
  if (rows.length === 0) return

  console.log(`[GSC-Worker] ${rows.length} pending request(s)`)

  for (const lead of rows) {
    console.log(`[GSC-Worker] Running for ${lead.name} (${lead.id})`)
    const result = await runGscAgent(lead)

    if (result.success) {
      await pool.query(
        `UPDATE leads SET gsc_verified = TRUE, gsc_site_url = $1, gsc_verified_at = NOW(),
         gsc_verify_requested = FALSE, gsc_verify_error = NULL WHERE id = $2`,
        [result.data!.siteUrl, lead.id]
      )
      console.log(`[GSC-Worker] ✅ Verified ${lead.name}: ${result.data!.siteUrl}`)
    } else {
      await pool.query(
        `UPDATE leads SET gsc_verify_requested = FALSE, gsc_verify_error = $1 WHERE id = $2`,
        [result.error ?? 'Unknown error', lead.id]
      )
      console.error(`[GSC-Worker] ❌ Failed for ${lead.name}: ${result.error}`)
    }
  }
}

async function main() {
  if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1) }

  console.log(`[GSC-Worker] Starting${DAEMON ? ' (daemon mode)' : ' (single-pass)'}`)

  if (DAEMON) {
    while (true) {
      await processPendingRequests().catch(e => console.error('[GSC-Worker] Poll error:', e.message))
      await new Promise(r => setTimeout(r, POLL_MS))
    }
  } else {
    await processPendingRequests()
    await pool.end()
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
