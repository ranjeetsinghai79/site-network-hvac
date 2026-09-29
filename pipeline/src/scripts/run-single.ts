/**
 * Run the full pipeline for a single lead by ID.
 * Used by the admin builder UI to trigger on-demand builds.
 *
 * Usage: npx tsx src/scripts/run-single.ts <leadId>
 */
import pg from 'pg'
import { runBrandAnalystAgent } from '../agents/brand-analyst.js'
import { runNicheBrain } from '../agents/niche-brain.js'
import { runConfigGeneratorAgent } from '../agents/config-generator.js'
import { runBuilderLocalAgent } from '../agents/builder-local.js'
import { runSeoAgent } from '../agents/seo-agent.js'
import { updateLead } from '../db/supabase.js'
import type { Lead, PipelineConfig } from '../types.js'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

type HeroImages = Record<'hero-1' | 'hero-2' | 'hero-3' | 'hero-4', Buffer | null>

async function downloadPlacesHeroImages(lead: Lead): Promise<HeroImages | null> {
  const photoNames = lead.photo_names
  const apiKey     = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey || !photoNames || photoNames.length === 0) return null

  const keys: Array<'hero-1' | 'hero-2' | 'hero-3' | 'hero-4'> = ['hero-1', 'hero-2', 'hero-3', 'hero-4']
  const result: HeroImages = { 'hero-1': null, 'hero-2': null, 'hero-3': null, 'hero-4': null }

  await Promise.all(
    keys.map(async (key, i) => {
      const photoName = photoNames[i]
      if (!photoName) return
      try {
        const url = `https://places.googleapis.com/v1/${photoName}/media?key=${apiKey}&maxWidthPx=1600&maxHeightPx=900&skipHttpRedirect=false`
        const res = await fetch(url, { redirect: 'follow' })
        if (!res.ok) return
        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.length > 10_000) result[key] = buf  // skip suspiciously small responses
      } catch { /* skip this photo */ }
    })
  )

  const count = Object.values(result).filter(Boolean).length
  return count > 0 ? result : null
}

async function main() {
  const leadId = process.argv[2] ?? process.env.PIPELINE_LEAD_ID
  if (!leadId) {
    console.error('Usage: npx tsx src/scripts/run-single.ts <leadId>')
    process.exit(1)
  }

  const { rows } = await pool.query('SELECT * FROM leads WHERE id=$1', [leadId])
  if (!rows.length) {
    console.error(`Lead not found: ${leadId}`)
    process.exit(1)
  }

  let lead: Lead = rows[0]
  const niche    = (process.env.NICHE ?? lead.niche ?? 'hvac') as Lead['niche'] & string

  const config: PipelineConfig = {
    niche:         niche as any,
    location:      `${lead.city ?? ''}, ${lead.state ?? 'CA'}`,
    city:          lead.city ?? '',
    state:         lead.state ?? 'CA',
    count:         1,
    templateOwner: process.env.TEMPLATE_OWNER ?? 'ranjeetsinghai79',
    templateRepo:  process.env.TEMPLATE_REPO  ?? 'websitedeveloper',
    deployOwner:   process.env.DEPLOY_OWNER   ?? 'ranjeetsinghai79',
    dryRun:        process.env.DRY_RUN === 'true',
  }

  console.log(`\n[run-single] Starting pipeline for: ${lead.name} (${leadId})`)
  console.log(`[run-single] Niche: ${niche} | Tier: ${lead.tier ?? 'tier1'}`)

  // ── Step 1: Brand analysis ────────────────────────────────────────────────
  console.log('[brand] Analyzing brand...')
  const brandResult = await runBrandAnalystAgent(lead)
  if (!brandResult.success || !brandResult.data) {
    console.error('[brand] Failed:', brandResult.error)
    process.exit(1)
  }
  lead = brandResult.data
  await updateLead(lead)
  console.log('[brand] Done')

  // ── Step 2: Niche brain ───────────────────────────────────────────────────
  console.log('[niche-brain] Generating visual identity...')
  const nicheProfile = await runNicheBrain(lead)
  lead = { ...lead, niche_profile: nicheProfile }
  await updateLead(lead)
  console.log('[niche-brain] Done')

  // ── Step 3: Config generation ─────────────────────────────────────────────
  console.log('[config] Generating site config...')
  const configResult = await runConfigGeneratorAgent(lead)
  if (!configResult.success || !configResult.data) {
    console.error('[config] Failed:', configResult.error)
    process.exit(1)
  }
  lead = configResult.data
  await updateLead(lead)
  console.log(`[config] Done (${lead.config_ts?.length ?? 0} chars)`)

  if (config.dryRun) {
    console.log('[run-single] DRY RUN — skipping build/deploy')
    process.exit(0)
  }

  // ── Step 4: Google Places photos → hero images ───────────────────────────
  const heroImages = await downloadPlacesHeroImages(lead)
  if (heroImages) {
    const count = Object.values(heroImages).filter(Boolean).length
    console.log(`[hero-images] Downloaded ${count}/4 Google Places photos`)
  }

  // ── Step 5: Build locally + deploy directly to CF Pages (no GitHub) ──────
  console.log('[build:start] Building site locally...')
  const buildResult = await runBuilderLocalAgent(lead, config, heroImages)
  if (!buildResult.success || !buildResult.data) {
    console.log(`[build:error] ${buildResult.error}`)
    process.exit(1)
  }
  lead = buildResult.data
  await updateLead(lead)
  console.log(`[build:done] ${lead.cloudflare_url}`)
  console.log(`[deploy:start] Deploying...`)
  console.log(`[deploy:done] ${lead.cloudflare_url}`)

  // ── Step 8: SEO ───────────────────────────────────────────────────────────
  console.log('[seo] Generating SEO files...')
  await runSeoAgent(lead)
  console.log('[seo] Done')

  console.log(`\n[run-single] ✓ Complete: ${lead.cloudflare_url}`)
  await pool.end()
}

main().catch(e => {
  console.error('[run-single] Fatal:', e?.message ?? e)
  if (e?.stack) console.error(e.stack)
  process.exit(1)
})
