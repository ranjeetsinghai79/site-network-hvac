/**
 * scheduler.ts — automated retention delivery engine
 *
 * Runs pg-boss cron jobs for the flat $297/mo plan (2026-09-02 pricing —
 * no more tiers, everything included for every paid client): monthly
 * analytics report, monthly review replies, monthly GBP posts.
 * Competitor report + quarterly design refresh are legacy grow/scale-only
 * add-ons, not part of the current flat offer — still plan-gated below,
 * effectively dormant until/unless client_plan is deliberately set.
 *
 * Start: npx tsx src/scheduler.ts
 * Runs as a persistent daemon — see com.webcrew.scheduler launchd job.
 */

import 'dotenv/config'
import PgBoss from 'pg-boss'
import pg from 'pg'
import { runReviewsAgent }   from './agents/reviews-agent.js'
import { runAnalyticsAgent } from './agents/analytics-agent.js'
import { runGbpAgent }       from './agents/gbp-agent.js'
import { runCompetitorAgent } from './agents/competitor-agent.js'
import type { Lead } from './types.js'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL! })

// ─── Idempotency guard ────────────────────────────────────────────────────────

async function alreadyRan(leadId: string, jobType: string, periodKey: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM scheduler_log WHERE lead_id=$1 AND job_type=$2 AND period_key=$3 LIMIT 1`,
    [leadId, jobType, periodKey]
  )
  return rows.length > 0
}

async function markRan(leadId: string, jobType: string, periodKey: string, success: boolean, error?: string) {
  await pool.query(
    `INSERT INTO scheduler_log (lead_id, job_type, period_key, success, error)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (lead_id, job_type, period_key) DO NOTHING`,
    [leadId, jobType, periodKey, success, error ?? null]
  )
}

function monthKey():   string { return new Date().toISOString().slice(0, 7) }         // '2025-06'
function quarterKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`                  // '2025-Q2'
}

// ─── Fetch all deployed clients ───────────────────────────────────────────────

async function getDeployedClients(): Promise<Lead[]> {
  const { rows } = await pool.query(`
    SELECT * FROM leads
    WHERE status IN ('deployed','outreach_sent','sms_sent','conversation_active',
                     'meeting_scheduled','payment_link_sent','paid','handed_off')
      AND (cloudflare_url IS NOT NULL OR vercel_url IS NOT NULL)
    ORDER BY created_at ASC
  `)
  return rows.map(rowToLead)
}

function rowToLead(r: any): Lead {
  return {
    ...r,
    brand_data: typeof r.brand_data === 'string' ? JSON.parse(r.brand_data) : r.brand_data,
    niche_profile: typeof r.niche_profile === 'string' ? JSON.parse(r.niche_profile) : r.niche_profile,
  }
}

// ─── Job handlers ─────────────────────────────────────────────────────────────

async function runMonthlyReviews(clients: Lead[]) {
  const period = monthKey()
  console.log(`[Scheduler] Monthly review replies — ${clients.length} clients — ${period}`)

  for (const client of clients) {
    if (!client.id) continue
    if (await alreadyRan(client.id, 'reviews', period)) {
      console.log(`  [skip] ${client.name} — already ran`)
      continue
    }
    const result = await runReviewsAgent(client)
    await markRan(client.id, 'reviews', period, result.success, result.error)
    console.log(`  ${result.success ? '✓' : '✗'} ${client.name} — ${result.success ? `${result.data?.replied} replied` : result.error}`)
  }
}

async function runMonthlyAnalytics(clients: Lead[]) {
  const period = monthKey()
  console.log(`[Scheduler] Monthly analytics reports — ${clients.length} clients — ${period}`)

  for (const client of clients) {
    if (!client.id || !client.email) continue
    if (await alreadyRan(client.id, 'analytics', period)) {
      console.log(`  [skip] ${client.name} — already ran`)
      continue
    }
    const result = await runAnalyticsAgent(client)
    await markRan(client.id, 'analytics', period, result.success, result.error)
    console.log(`  ${result.success ? '✓' : '✗'} ${client.name}`)
  }
}

async function runMonthlyGbp(clients: Lead[]) {
  // Flat $297/mo plan includes GBP posts for every paid client — no tier gate.
  const period = monthKey()
  console.log(`[Scheduler] Monthly GBP posts — ${clients.length} clients — ${period}`)

  if (!process.env.GBP_ACCOUNT_ID || !process.env.GBP_LOCATION_ID) {
    console.log('  [skip] GBP credentials not set')
    return
  }

  for (const client of clients) {
    if (!client.id) continue
    if (await alreadyRan(client.id, 'gbp', period)) {
      console.log(`  [skip] ${client.name} — already ran`)
      continue
    }
    const result = await runGbpAgent(client)
    await markRan(client.id, 'gbp', period, result.success, result.error)
    console.log(`  ${result.success ? '✓' : '✗'} ${client.name}`)
  }
}

async function runMonthlyCompetitor(clients: Lead[]) {
  const growClients = clients.filter(c => c.client_plan === 'grow' || c.client_plan === 'scale')
  const period = monthKey()
  console.log(`[Scheduler] Monthly competitor reports — ${growClients.length} Grow/Scale clients — ${period}`)

  for (const client of growClients) {
    if (!client.id || !client.email) continue
    if (await alreadyRan(client.id, 'competitor', period)) {
      console.log(`  [skip] ${client.name} — already ran`)
      continue
    }
    const result = await runCompetitorAgent(client)
    await markRan(client.id, 'competitor', period, result.success, result.error)
    console.log(`  ${result.success ? '✓' : '✗'} ${client.name}`)
  }
}

async function runQuarterlyDesignRefresh(clients: Lead[]) {
  const growClients = clients.filter(c => c.client_plan === 'grow' || c.client_plan === 'scale')
  const period = quarterKey()
  console.log(`[Scheduler] Quarterly design refresh reminders — ${growClients.length} clients — ${period}`)

  const resendKey   = process.env.RESEND_API_KEY
  const fromEmail   = process.env.OUTREACH_FROM_EMAIL ?? 'hello@webcrew.app'
  const adminEmail  = process.env.BUSINESS_OWNER_EMAIL ?? fromEmail

  for (const client of growClients) {
    if (!client.id) continue
    if (await alreadyRan(client.id, 'design_refresh', period)) {
      console.log(`  [skip] ${client.name} — already ran`)
      continue
    }

    let success = true
    try {
      if (resendKey) {
        // Notify admin to action the refresh
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: fromEmail,
            to: adminEmail,
            subject: `Quarterly Design Refresh Due — ${client.name}`,
            html: `
              <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
                <h2 style="margin:0 0 12px;">Quarterly Design Refresh</h2>
                <p>Time to refresh the design for <strong>${client.name}</strong> (${client.niche}, ${client.city} ${client.state}).</p>
                <p><strong>Period:</strong> ${period}<br>
                   <strong>Plan:</strong> ${client.client_plan ?? 'grow'}<br>
                   <strong>Site:</strong> <a href="${client.cloudflare_url ?? client.vercel_url}">${client.cloudflare_url ?? client.vercel_url}</a><br>
                   <strong>Email:</strong> ${client.email ?? 'N/A'}</p>
                <p>Review their site, propose any layout or copy updates, and deploy within 7 days.</p>
              </div>`,
          }),
        })

        // Notify the client too
        if (client.email) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: fromEmail,
              to: client.email,
              subject: `Your quarterly site refresh is coming up — ${client.name}`,
              html: `
                <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
                  <h2 style="margin:0 0 12px;">Quarterly Design Refresh</h2>
                  <p>Hi! As part of your Grow plan, we do a quarterly design review and refresh of your site.</p>
                  <p>Our team will be reviewing <strong>${client.cloudflare_url ?? client.vercel_url}</strong> this week and may reach out if we'd like your input on any changes.</p>
                  <p>No action needed from you — we'll handle it. If you have any specific requests, reply to this email.</p>
                  <p style="color:#666;font-size:13px;">— WebCrew Team</p>
                </div>`,
            }),
          })
        }
      }
    } catch (e: any) {
      success = false
      console.error(`  [!] ${client.name}: ${e.message}`)
    }

    await markRan(client.id, 'design_refresh', period, success)
    console.log(`  ${success ? '✓' : '✗'} ${client.name}`)
  }
}

// ─── pg-boss cron registration ────────────────────────────────────────────────

async function main() {
  console.log('\n=== WebCrew Retention Scheduler ===')
  console.log(new Date().toISOString())

  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL!,
    schema: 'pgboss',
  })

  await boss.start()
  console.log('pg-boss started')

  // pg-boss v10 requires queues to exist before schedule()/work() reference them.
  for (const q of ['monthly-reviews', 'monthly-analytics', 'monthly-gbp', 'monthly-competitor', 'quarterly-design-refresh']) {
    await boss.createQueue(q)
  }

  // Monthly jobs — 1st of month at 08:00 UTC
  await boss.schedule('monthly-reviews',         '0 8 1 * *', {})
  await boss.schedule('monthly-analytics',       '0 8 1 * *', {})
  await boss.schedule('monthly-gbp',             '0 9 1 * *', {})   // 1hr offset to avoid rate limits
  await boss.schedule('monthly-competitor',      '0 10 1 * *', {})

  // Quarterly design refresh — 1st of Jan/Apr/Jul/Oct at 08:00 UTC
  await boss.schedule('quarterly-design-refresh', '0 8 1 1,4,7,10 *', {})

  // ── Handlers ──────────────────────────────────────────────────────────────

  boss.work('monthly-reviews', async (_job: any) => {
    const clients = await getDeployedClients()
    await runMonthlyReviews(clients)
  })

  boss.work('monthly-analytics', async (_job: any) => {
    const clients = await getDeployedClients()
    await runMonthlyAnalytics(clients)
  })

  boss.work('monthly-gbp', async (_job: any) => {
    const clients = await getDeployedClients()
    await runMonthlyGbp(clients)
  })

  boss.work('monthly-competitor', async (_job: any) => {
    const clients = await getDeployedClients()
    await runMonthlyCompetitor(clients)
  })

  boss.work('quarterly-design-refresh', async (_job: any) => {
    const clients = await getDeployedClients()
    await runQuarterlyDesignRefresh(clients)
  })

  console.log('Cron jobs registered:')
  console.log('  monthly-reviews         — 1st of month 08:00 UTC')
  console.log('  monthly-analytics       — 1st of month 08:00 UTC')
  console.log('  monthly-gbp             — 1st of month 09:00 UTC (all clients)')
  console.log('  monthly-competitor      — 1st of month 10:00 UTC (Grow+)')
  console.log('  quarterly-design-refresh — Jan/Apr/Jul/Oct 1st 08:00 UTC (Grow+)')
  console.log('\nScheduler running. Ctrl+C to stop.')

  // Keep process alive
  process.on('SIGTERM', async () => { await boss.stop(); process.exit(0) })
  process.on('SIGINT',  async () => { await boss.stop(); process.exit(0) })
}

main().catch(e => { console.error(e); process.exit(1) })
