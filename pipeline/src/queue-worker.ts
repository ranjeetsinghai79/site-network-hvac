/**
 * Queue Worker — parallel site generation at scale
 *
 * Uses pg-boss (Postgres-backed queue on Neon) to process leads in parallel.
 * N concurrent workers, each processing one lead at a time.
 * Rate-limit aware: fal.ai (parallel OK), Gemini (500/day → ~1 req/3min at 250/day target).
 *
 * Usage:
 *   npx tsx src/queue-worker.ts             # start N workers
 *   npx tsx src/queue-worker.ts --enqueue   # scan Google Maps + enqueue leads
 *   npx tsx src/queue-worker.ts --status    # print queue stats
 */

import PgBoss from 'pg-boss'
import { runNicheBrain } from './agents/niche-brain.js'
import { runBrandAnalystAgent } from './agents/brand-analyst.js'
import { runConfigGeneratorAgent } from './agents/config-generator.js'
import { runImageGeneratorAgent, fetchBusinessLogo } from './agents/image-generator.js'
import { runBuilderAgent } from './agents/builder.js'
import { runDeployerAgent } from './agents/deployer.js'
import { runSeoAgent } from './agents/seo-agent.js'
import { runOutreachAgent } from './agents/outreach.js'
import { runSmsAgent } from './agents/sms-agent.js'
import { runStripeAgent } from './agents/stripe-agent.js'
import { saveLead, updateLead, getLeadsByStatus } from './db/supabase.js'
import type { Lead, PipelineConfig } from './types.js'

const QUEUE_NAME = 'site-generation'
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '3', 10) // 3 parallel workers default

// ─── Worker job payload ────────────────────────────────────────────────────

interface SiteGenJob {
  lead: Lead
  config: PipelineConfig
}

// ─── Initialize pg-boss ────────────────────────────────────────────────────

export async function createBoss(): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL!,
    schema: 'pgboss',
    retryLimit: 2,
    retryDelay: 60,      // 60s between retries
    expireInHours: 24,
    deleteAfterDays: 7,
  })
  await boss.start()
  return boss
}

// ─── Enqueue leads from Google Maps ────────────────────────────────────────

export async function enqueuePipelineRun(config: PipelineConfig): Promise<void> {
  const { runLeadHunterAgent } = await import('./agents/lead-hunter.js')
  const { runSiteScorerAgent }  = await import('./agents/site-scorer.js')

  console.log(`\n=== Enqueuing pipeline run: ${config.niche} | ${config.location} | target ${config.count} ===`)

  const leadResult = await runLeadHunterAgent(config)
  if (!leadResult.success || !leadResult.data?.length) {
    console.error('Lead hunting failed:', leadResult.error)
    return
  }

  const boss = await createBoss()
  let enqueued = 0

  for (const rawLead of leadResult.data) {
    const saved = await saveLead(rawLead)
    const lead: Lead = saved?.id ? { ...rawLead, id: saved.id } : rawLead

    // Score first — skip good sites before enqueuing
    const scoreResult = await runSiteScorerAgent(lead)
    if (!scoreResult.success || scoreResult.data?.status === 'skipped') {
      console.log(`  [skip] ${rawLead.name} — site OK`)
      continue
    }

    // Scale clients get highest priority (6h SLA), then score-based ordering
    const clientPlan = (lead as any).client_plan ?? 'launch'
    const planPriority = clientPlan === 'scale' ? 20 : clientPlan === 'grow' ? 10 : 5
    const scorePriority = lead.site_score && lead.site_score < 20 ? 3 : 0

    await boss.send(QUEUE_NAME, { lead: scoreResult.data!, config }, {
      priority: planPriority + scorePriority,
      singletonKey: lead.place_id, // prevent duplicate jobs per business
    })

    enqueued++
    console.log(`  [queued] ${rawLead.name} (score: ${scoreResult.data?.site_score})`)
  }

  console.log(`\nEnqueued ${enqueued} leads for processing`)
  await boss.stop()
}

// ─── Process a single lead (one worker iteration) ─────────────────────────

async function processLead(lead: Lead, config: PipelineConfig): Promise<void> {
  console.log(`\n→ [Worker] ${lead.name} | ${lead.city}, ${lead.state}`)

  try {
    // 1. Brand analysis
    const analyzeResult = await runBrandAnalystAgent(lead)
    if (!analyzeResult.success) throw new Error(`Brand analysis: ${analyzeResult.error}`)
    lead = analyzeResult.data!
    await updateLead(lead)

    // 2. Niche Brain — unique visual identity per business
    const nicheProfile = await runNicheBrain(lead)
    lead = { ...lead, niche_profile: nicheProfile }
    await updateLead(lead)

    // 3. Config generation
    const configResult = await runConfigGeneratorAgent(lead)
    if (!configResult.success) throw new Error(`Config gen: ${configResult.error}`)
    lead = configResult.data!
    await updateLead(lead)

    if (config.dryRun) {
      console.log(`  [DRY RUN] ${lead.name} — skipping build/deploy`)
      return
    }

    // 4. Image generation (brain-powered unique prompts, all 4 in parallel)
    const imgResult = await runImageGeneratorAgent(lead, nicheProfile)
    const heroImages = imgResult.success ? imgResult.data?.images ?? null : null
    const logoBuffer = await fetchBusinessLogo(lead)

    // 5. Video generation — removed (2026-09-28, whole-pipeline decision, see
    //    orchestrator.ts's runPipelineForLead for the full note). Sites now build
    //    with posterSrc-only heroes.
    const heroVideoBuffer: Buffer | null = null

    // 6. Build (GitHub fork + deploy assets)
    const buildResult = await runBuilderAgent(lead, config, heroImages, heroVideoBuffer, null, logoBuffer)
    if (!buildResult.success) throw new Error(`Build: ${buildResult.error}`)
    lead = buildResult.data!
    await updateLead(lead)

    // 7. Deploy (Cloudflare Pages)
    const deployResult = await runDeployerAgent(lead)
    if (!deployResult.success) throw new Error(`Deploy: ${deployResult.error}`)
    lead = deployResult.data!
    await updateLead(lead)
    console.log(`  LIVE: ${lead.vercel_url}`)

    // 8. SEO (non-blocking)
    await runSeoAgent(lead).catch(() => {})

    // 9. Email outreach
    if (lead.email) {
      const emailResult = await runOutreachAgent(lead)
      if (emailResult.success) lead = emailResult.data!
      await updateLead(lead)
    }

    // 10. SMS outreach (Twilio) — if phone available and email missing or as follow-up
    if (lead.phone && process.env.TWILIO_ACCOUNT_SID) {
      const smsResult = await runSmsAgent(lead, 'initial')
      if (smsResult.success) lead = smsResult.data!
      await updateLead(lead)
    }

    // 11. Generate Stripe payment link (attach to lead for when they respond)
    if (process.env.STRIPE_SECRET_KEY) {
      const stripeResult = await runStripeAgent(lead, 'create_link')
      if (stripeResult.success) {
        lead = { ...lead, stripe_payment_url: stripeResult.data?.paymentUrl }
        await updateLead(lead)
      }
    }

    console.log(`  ✓ ${lead.name} complete`)
  } catch (e: any) {
    console.error(`  [ERROR] ${lead.name}: ${e.message}`)
    await updateLead({ ...lead, status: 'error' })
    throw e // let pg-boss handle retry
  }
}

// ─── Start workers ─────────────────────────────────────────────────────────

export async function startWorkers(config: PipelineConfig): Promise<void> {
  const boss = await createBoss()

  console.log(`\n=== Starting ${CONCURRENCY} workers for queue: ${QUEUE_NAME} ===`)

  // Launch CONCURRENCY parallel workers (each polls independently)
  const workerIds: string[] = []
  for (let i = 0; i < CONCURRENCY; i++) {
    const id = await boss.work<SiteGenJob>(
      QUEUE_NAME,
      { batchSize: 1 },
      async (jobs) => {
        for (const job of jobs) {
          await processLead(job.data.lead, job.data.config || config)
        }
      }
    )
    workerIds.push(id)
  }
  console.log(`Started ${workerIds.length} workers`)

  // Print stats every 30s
  setInterval(async () => {
    const counts = await boss.getQueueSize(QUEUE_NAME)
    console.log(`[Queue] Pending: ${counts}`)
  }, 30_000)

  console.log(`Workers running. Ctrl+C to stop.\n`)

  // Keep process alive
  process.on('SIGINT', async () => {
    console.log('\nGraceful shutdown...')
    await boss.stop({ graceful: true, timeout: 30_000 })
    process.exit(0)
  })
}

// ─── Re-process stale leads ────────────────────────────────────────────────

export async function requeueStaleLeads(config: PipelineConfig): Promise<void> {
  const staleStatuses = ['found', 'scored', 'analyzed', 'config_generated', 'built']
  const boss = await createBoss()
  let count = 0

  for (const status of staleStatuses) {
    const leads = await getLeadsByStatus(status as any)
    for (const lead of leads) {
      await boss.send(QUEUE_NAME, { lead, config }, { singletonKey: lead.place_id })
      count++
    }
  }

  console.log(`Re-queued ${count} stale leads`)
  await boss.stop()
}

// ─── CLI entrypoint ────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith('queue-worker.ts') || process.argv[1]?.endsWith('queue-worker.js')) {
  const config: PipelineConfig = {
    niche:         (process.env.NICHE as any) || 'hvac',
    location:      process.env.LOCATION || 'Tracy, CA',
    city:          process.env.CITY || 'Tracy',
    state:         process.env.STATE || 'CA',
    count:         parseInt(process.env.COUNT || '10', 10),
    templateOwner: process.env.TEMPLATE_OWNER || '',
    templateRepo:  process.env.TEMPLATE_REPO || 'websitedeveloper',
    deployOwner:   process.env.DEPLOY_OWNER || '',
    dryRun:        process.env.DRY_RUN === 'true',
  }

  const arg = process.argv[2]

  if (arg === '--enqueue') {
    enqueuePipelineRun(config).catch(console.error)
  } else if (arg === '--requeue-stale') {
    requeueStaleLeads(config).catch(console.error)
  } else if (arg === '--status') {
    createBoss().then(async (boss) => {
      const size = await boss.getQueueSize(QUEUE_NAME)
      console.log(`Queue "${QUEUE_NAME}": ${size} pending`)
      await boss.stop()
    })
  } else {
    startWorkers(config).catch(console.error)
  }
}
