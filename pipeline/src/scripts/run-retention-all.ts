/**
 * run-retention-all.ts
 *
 * Per-client retention runner. Processes ALL paid/active clients for:
 *   - Google review auto-replies (daily)
 *   - GBP posts (weekly)
 *   - Analytics report email (monthly)
 *   - Follow-up drip check
 *   - Review request SMS (hourly, via send-review-requests.ts)
 *
 * GCP Cloud Scheduler calls this once per day. One job, all clients.
 * No per-client Cloud Scheduler jobs needed.
 *
 * Run:
 *   cd pipeline && npx tsx src/scripts/run-retention-all.ts
 *
 * Env flags:
 *   RUN_GBP=true|false (default true on Mon/Wed/Fri)
 *   RUN_REVIEWS=true|false (default true)
 *   RUN_ANALYTICS=true|false (default true on 1st of month)
 */

import 'dotenv/config'
import pg from 'pg'
import { runGbpAgent }      from '../agents/gbp-agent.js'
import { runReviewsAgent }  from '../agents/reviews-agent.js'
import { runAnalyticsAgent } from '../agents/analytics-agent.js'
import type { Lead } from '../types.js'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const now       = new Date()
const dayOfWeek = now.getDay()   // 0=Sun 1=Mon … 6=Sat
const dayOfMonth = now.getDate()

// Default schedule: GBP on Mon/Wed/Fri, analytics on 1st of month
const RUN_GBP       = process.env.RUN_GBP       === 'true' ? true
                    : process.env.RUN_GBP        === 'false' ? false
                    : [1, 3, 5].includes(dayOfWeek)   // Mon Wed Fri

const RUN_REVIEWS   = process.env.RUN_REVIEWS   !== 'false'   // always unless disabled
const RUN_ANALYTICS = process.env.RUN_ANALYTICS === 'true' ? true
                    : process.env.RUN_ANALYTICS  === 'false' ? false
                    : dayOfMonth === 1

function rowToLead(r: any): Lead {
  return {
    id:                r.id,
    name:              r.name,
    niche:             r.niche,
    city:              r.city,
    state:             r.state,
    email:             r.email,
    phone:             r.phone,
    website:           r.website,
    tier:              r.tier ?? 'tier1',
    cloudflare_url:    r.cloudflare_url,
    vercel_url:        r.vercel_url,
    github_repo:       r.github_repo,
    gbp_account_id:    r.gbp_account_id,
    gbp_location_id:   r.gbp_location_id,
    client_plan:       r.client_plan,
    status:            r.status,
    brand_data:        r.brand_data ?? null,
  } as Lead
}

async function getPaidClients(): Promise<Lead[]> {
  const { rows } = await pool.query(
    `SELECT id, name, niche, city, state, email, phone, website, tier,
            cloudflare_url, vercel_url, github_repo,
            gbp_account_id, gbp_location_id, client_plan, status, brand_data
     FROM leads
     WHERE status IN ('paid','handed_off','deployed','outreach_sent','sms_sent',
                      'conversation_active','meeting_scheduled','payment_link_sent')
       AND (cloudflare_url IS NOT NULL OR vercel_url IS NOT NULL)
     ORDER BY paid_at ASC NULLS LAST`
  )
  return rows.map(rowToLead)
}

function hasGbpCreds(c: Lead): boolean {
  return !!((c.gbp_account_id ?? process.env.GBP_ACCOUNT_ID) &&
            (c.gbp_location_id ?? process.env.GBP_LOCATION_ID))
}

async function main() {
  console.log('\n=== Per-Client Retention Runner ===')
  console.log(new Date().toISOString())
  console.log(`GBP: ${RUN_GBP} | Reviews: ${RUN_REVIEWS} | Analytics: ${RUN_ANALYTICS}`)

  const clients = await getPaidClients()
  console.log(`${clients.length} active clients\n`)

  if (!clients.length) {
    console.log('No active clients yet.')
    await pool.end()
    return
  }

  const summary = { gbp: 0, reviews: 0, analytics: 0, errors: 0 }

  for (const client of clients) {
    const plan = (client as any).client_plan ?? 'launch'
    console.log(`\n→ ${client.name} [${plan}] (${client.city})`)

    // ── Google review auto-replies (all plans) ────────────────────────────
    if (RUN_REVIEWS && hasGbpCreds(client)) {
      try {
        const r = await runReviewsAgent(client)
        if (r.success) {
          const replied = r.data?.replied ?? 0
          if (replied > 0) console.log(`  Reviews: ${replied} replied`)
          summary.reviews += replied
        } else {
          console.log(`  [!] Reviews: ${r.error}`)
        }
      } catch (e: any) {
        console.error(`  [!] Reviews error: ${e.message}`)
        summary.errors++
      }
    }

    // ── GBP post (all plans with GBP creds) ──────────────────────────────
    if (RUN_GBP && hasGbpCreds(client)) {
      try {
        const r = await runGbpAgent(client)
        if (r.success) {
          console.log(`  GBP: post published`)
          summary.gbp++
        } else {
          console.log(`  [!] GBP: ${r.error}`)
        }
      } catch (e: any) {
        console.error(`  [!] GBP error: ${e.message}`)
        summary.errors++
      }
    }

    // ── Monthly analytics report ──────────────────────────────────────────
    if (RUN_ANALYTICS && client.email) {
      try {
        const r = await runAnalyticsAgent(client)
        if (r.success) {
          console.log(`  Analytics: report sent to ${client.email}`)
          summary.analytics++
        } else {
          console.log(`  [!] Analytics: ${r.error}`)
        }
      } catch (e: any) {
        console.error(`  [!] Analytics error: ${e.message}`)
        summary.errors++
      }
    }
  }

  console.log('\n=== Retention Complete ===')
  console.log(`GBP posts: ${summary.gbp}`)
  console.log(`Review replies: ${summary.reviews}`)
  console.log(`Analytics reports: ${summary.analytics}`)
  console.log(`Errors: ${summary.errors}`)

  await pool.end()
}

main().catch(e => {
  console.error('[Retention] Fatal:', e.message)
  process.exit(1)
})
