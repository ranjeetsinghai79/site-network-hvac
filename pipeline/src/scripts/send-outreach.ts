/**
 * send-outreach.ts
 *
 * Batch SMS outreach runner.
 * Pulls leads from DB with status='deployed' and sms_sent=false, sends outreach.
 *
 * Run:
 *   npx tsx src/scripts/send-outreach.ts           # live sends
 *   SMS_DRY_RUN=true npx tsx src/scripts/send-outreach.ts  # dry run
 *
 * Env:
 *   OUTREACH_BATCH=20        (max SMS per run, default 20)
 *   OUTREACH_NICHE=hvac      (optional: filter by niche)
 *   OUTREACH_TIER=tier1      (optional: filter by tier)
 *   SMS_DRY_RUN=true         (default false)
 */

import 'dotenv/config'
import pg from 'pg'
import { runSMSOutreachAgent } from '../agents/sms-outreach.js'
import { updateLead } from '../db/supabase.js'
import type { Lead } from '../types.js'

const BATCH_SIZE = parseInt(process.env.OUTREACH_BATCH ?? '20')
const NICHE_FILTER = process.env.OUTREACH_NICHE
const TIER_FILTER  = process.env.OUTREACH_TIER
const DRY_RUN      = process.env.SMS_DRY_RUN === 'true'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function getOutreachQueue(): Promise<Lead[]> {
  let query = `
    SELECT * FROM leads
    WHERE status = 'deployed'
      AND (sms_sent IS NULL OR sms_sent = false)
      AND (sms_opt_out IS NULL OR sms_opt_out = false)
      AND phone IS NOT NULL
      AND (vercel_url IS NOT NULL OR cloudflare_url IS NOT NULL)
  `
  const params: any[] = []

  if (NICHE_FILTER) {
    params.push(NICHE_FILTER)
    query += ` AND niche = $${params.length}`
  }
  if (TIER_FILTER) {
    params.push(TIER_FILTER)
    query += ` AND tier = $${params.length}`
  }

  query += ` ORDER BY created_at ASC LIMIT $${params.length + 1}`
  params.push(BATCH_SIZE)

  const { rows } = await pool.query(query, params)

  return rows.map((r: any) => ({
    id: r.id, place_id: r.place_id, name: r.name, phone: r.phone,
    email: r.email, website: r.website, address: r.address,
    city: r.city, state: r.state, niche: r.niche, tier: r.tier,
    rating: r.rating, review_count: r.review_count,
    site_score: r.site_score, site_issues: r.site_issues,
    vercel_url: r.vercel_url, cloudflare_url: r.cloudflare_url,
    sms_sent: r.sms_sent, sms_opt_out: r.sms_opt_out,
    status: r.status, created_at: r.created_at,
  }))
}

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`📱 SMS Outreach Runner${DRY_RUN ? ' (DRY RUN)' : ''}`)
  console.log(`   Batch: ${BATCH_SIZE} | Niche: ${NICHE_FILTER ?? 'all'} | Tier: ${TIER_FILTER ?? 'all'}`)
  console.log(`${'═'.repeat(60)}\n`)

  const leads = await getOutreachQueue()
  console.log(`  Queue: ${leads.length} leads ready for outreach\n`)

  if (leads.length === 0) {
    console.log('  Nothing to send. Run pipeline first to build + deploy sites.')
    await pool.end()
    return
  }

  let sent = 0
  let failed = 0

  for (const lead of leads) {
    console.log(`[${sent + failed + 1}/${leads.length}] ${lead.name} — ${lead.tier ?? 'unknown tier'}`)

    const result = await runSMSOutreachAgent(lead)

    if (result.success && result.data) {
      if (!DRY_RUN) {
        await updateLead(result.data).catch(e =>
          console.error(`  DB update failed: ${e.message}`)
        )
      }
      sent++
    } else {
      console.error(`  ✗ Failed: ${result.error}`)
      failed++
    }

    // 1s between sends — don't hammer Twilio / appear spammy
    if (sent + failed < leads.length) {
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`✅  Outreach Complete`)
  console.log(`   Sent    : ${sent}`)
  console.log(`   Failed  : ${failed}`)
  console.log(`   DRY RUN : ${DRY_RUN}`)
  console.log(`${'═'.repeat(60)}\n`)

  if (DRY_RUN) console.log('  Set SMS_DRY_RUN=false to send for real.')

  await pool.end()
}

main().catch(e => {
  console.error('\n💥 Outreach fatal error:', e.message)
  console.error(e.stack)
  process.exit(1)
})
