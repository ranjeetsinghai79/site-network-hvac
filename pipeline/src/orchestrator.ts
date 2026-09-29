import { runLeadHunterAgent } from './agents/lead-hunter.js'
import { runBrandAnalystAgent } from './agents/brand-analyst.js'
import { runNicheBrain } from './agents/niche-brain.js'
import { runConfigGeneratorAgent } from './agents/config-generator.js'
import { runImageGeneratorAgent, fetchBusinessLogo } from './agents/image-generator.js'
import { runBuilderAgent } from './agents/builder.js'
import { runDeployerAgent } from './agents/deployer.js'
import { runSeoAgent } from './agents/seo-agent.js'
import { runAeoAgent } from './agents/aeo-agent.js'
import { runGscAgent } from './agents/gsc-agent.js'
import { runOutreachAgent } from './agents/outreach.js'
import { buildWarmTeaseSMS, sendSMS } from './agents/sms-outreach.js'
import { canTextNow } from './tools/sms-consent.js'
import { runSiteScorerAgent } from './agents/site-scorer.js'
import { runStripeAgent } from './agents/stripe-agent.js'
import { runDailyReport } from './agents/report-agent.js'
import { saveLead, updateLead, getLeadById } from './db/supabase.js'
import { buildBrain, buildSystemPrompt } from './reception/brain-builder.js'
import { saveReceptionConfig } from './reception/db.js'
import { createAdCampaignDrafts, saveAdCampaignDrafts } from './ads/index.js'
import { createSocialAssetDrafts, saveSocialAssetDrafts } from './social/index.js'
import type { PipelineConfig, Lead } from './types.js'

// ── Auto-provision AI Reception for a deployed Tier 1 lead ───────────────────
async function autoProvisionReception(lead: Lead): Promise<string | null> {
  const siteUrl = lead.cloudflare_url ?? lead.vercel_url
  if (!siteUrl) return null
  if (!process.env.DATABASE_URL) return null

  try {
    console.log(`  [Reception] Provisioning AI brain for ${lead.name}…`)
    const brain = await buildBrain(siteUrl)
    const systemPrompt = buildSystemPrompt(brain)
    const config = await saveReceptionConfig(siteUrl, lead.name, brain, systemPrompt, lead.id)
    console.log(`  [Reception] Config saved: ${config.id}`)
    return config.id
  } catch (e: any) {
    console.error(`  [Reception] Provision failed: ${e.message}`)
    return null
  }
}

export async function runPipeline(config: PipelineConfig) {
  console.log(`\n=== AI Pipeline Starting ===`)
  console.log(`Niche: ${config.niche} | Location: ${config.location}`)
  console.log(`Target: ${config.count} leads | Dry run: ${config.dryRun ?? false}\n`)

  // Step 1: Find leads
  const leadResult = await runLeadHunterAgent(config)
  if (!leadResult.success || !leadResult.data?.length) {
    console.error('Lead hunting failed:', leadResult.error)
    return
  }

  const leads = leadResult.data
  console.log(`Found ${leads.length} leads\n`)

  const summary = { processed: 0, skipped: 0, deployed: 0, outreached: 0, errors: 0 }

  for (const rawLead of leads) {
    console.log(`\n→ ${rawLead.name} | ${rawLead.website}`)
    let lead: Lead = rawLead
    summary.processed++

    try {
      // Persist to DB (ON CONFLICT preserves status if already built+)
      const saved = await saveLead(lead)
      if (saved?.id) lead = { ...lead, id: saved.id, status: saved.status }

      // Skip leads already through the expensive build/deploy steps
      const DONE = new Set(['built','deployed','outreach_sent','sms_sent',
        'conversation_active','meeting_scheduled','payment_link_sent','paid','handed_off'])
      if (DONE.has(lead.status)) {
        console.log(`  [skip] Already ${lead.status} — ${lead.vercel_url ?? lead.cloudflare_url ?? ''}`)
        summary.skipped++
        continue
      }

      // Step 2: Score existing website (tier2 leads only)
      // Track A: tier1 (no website) → build from scratch
      // Track B: tier1 + site_broken → build fresh, "site was down" SMS
      // Track C: tier2 (poor quality) → warm tease SMS, build only on YES
      if (lead.tier === 'tier2' && lead.website) {
        const scoreResult = await runSiteScorerAgent(lead)
        if (scoreResult.success && scoreResult.data) {
          lead = scoreResult.data
          await updateLead(lead)
          // Broken site → promote to tier1 so it goes through full build pipeline
          if (lead.site_broken) {
            console.log(`  Site broken → promoting to tier1 build pipeline`)
            lead = { ...lead, tier: 'tier1' }
          }
        }
      }

      // Step 3: Analyze brand
      const analyzeResult = await runBrandAnalystAgent(lead)
      if (!analyzeResult.success) {
        console.log(`  [!] Brand analysis failed: ${analyzeResult.error}`)
        summary.errors++
        continue
      }
      lead = analyzeResult.data!
      // Enrich email from scraped brand data if Places API didn't return one
      if (!lead.email && lead.brand_data?.email) {
        lead = { ...lead, email: lead.brand_data.email }
      }
      // Enrich phone from brand data if Places API missed it
      if (!lead.phone && lead.brand_data?.phone) {
        lead = { ...lead, phone: lead.brand_data.phone }
      }
      await updateLead(lead)
      const contactInfo = [lead.email && `email:${lead.email}`, lead.phone && `phone:${lead.phone}`].filter(Boolean).join(' | ')
      console.log(`  Brand analyzed: ${lead.brand_data?.name} | ${contactInfo || 'NO CONTACT — manual outreach'}`)

      // Generate ad campaign drafts (Google + Meta + Instagram) — all need_approval
      try {
        const adDrafts = createAdCampaignDrafts({ lead })
        const adIds = await saveAdCampaignDrafts(adDrafts)
        console.log(`  Ad drafts created: ${adIds.length} (${adDrafts.map(d => d.platform).join(', ')})`)
      } catch (e: any) {
        console.log(`  [!] Ad drafts skipped: ${e.message}`)
      }

      // Generate social content drafts (IG/FB/LinkedIn/GBP/etc.) — all needs_approval
      try {
        const socialDrafts = createSocialAssetDrafts({ lead })
        const socialIds = await saveSocialAssetDrafts(socialDrafts)
        console.log(`  Social drafts created: ${socialIds.length} (${[...new Set(socialDrafts.map(d => d.platform))].join(', ')})`)
      } catch (e: any) {
        console.log(`  [!] Social drafts skipped: ${e.message}`)
      }

      // Step 4: Outreach (pitch — no build yet)
      // Build is triggered manually from admin when lead confirms interest.
      const hasContact = !!(lead.email || lead.phone)
      if (!hasContact) {
        console.log(`  [!] No contact info — skip outreach, review manually`)
        await updateLead({ ...lead, status: 'outreach_sent' })
      } else {
        const outreachResult = await runOutreachAgent(lead)
        if (outreachResult.success) {
          lead = outreachResult.data!
          await updateLead(lead)
          const via = [lead.email && 'email', lead.phone && 'sms'].filter(Boolean).join('+')
          console.log(`  Pitch sent via ${via} → ${lead.email ?? lead.phone}`)
          summary.outreached++
        } else {
          console.log(`  [!] Outreach failed: ${outreachResult.error}`)
        }
      }

      // Step 10: Pre-generate Stripe payment link (ready when lead responds)
      if (process.env.STRIPE_SECRET_KEY) {
        const stripeResult = await runStripeAgent(lead, 'create_link')
        if (stripeResult.success && stripeResult.data) {
          lead = { ...lead, stripe_payment_url: stripeResult.data.paymentUrl }
          await updateLead(lead)
          console.log(`  Stripe payment link ready`)
        }
      }

    } catch (e: any) {
      console.error(`  [ERROR] ${lead.name}:`, e.message)
      console.error(`  [STACK]`, e.stack?.split('\n').slice(0, 4).join('\n  '))
      await updateLead({ ...lead, status: 'error' })
      summary.errors++
    }
  }

  console.log('\n=== Pipeline Complete ===')
  console.log(`Processed: ${summary.processed}`)
  console.log(`Skipped (good sites): ${summary.skipped}`)
  console.log(`Deployed: ${summary.deployed}`)
  console.log(`Emails sent: ${summary.outreached}`)
  console.log(`Errors: ${summary.errors}`)

  // Daily report — append today's results to Google Sheet
  await runDailyReport()
}

// ─── Run pipeline for a single lead already in DB (triggered from admin) ─────
// Skips lead-hunter. Fetches lead by ID, runs full agent chain.
export async function runPipelineForLead(
  leadId: string,
  config: Partial<PipelineConfig> = {},
  opts: { skipOutreach?: boolean; reuseArtifacts?: boolean; talkingWebsite?: boolean } = {},
) {
  const lead0 = await getLeadById(leadId)
  if (!lead0) throw new Error(`Lead ${leadId} not found`)

  const cfg: PipelineConfig = {
    niche:    (lead0.niche as any) ?? 'hvac',
    location: lead0.city ? `${lead0.city}, ${lead0.state ?? 'US'}` : 'US',
    city:     lead0.city ?? '',
    state:    lead0.state ?? '',
    count:    1,
    dryRun:   false,
    templateOwner: process.env.TEMPLATE_OWNER ?? 'ranjeetsinghai79',
    templateRepo:  process.env.TEMPLATE_REPO  ?? 'websitedeveloper',
    deployOwner:   process.env.DEPLOY_OWNER   ?? 'ranjeetsinghai79',
    ...config,
  }

  console.log(`\n=== Pipeline Trigger: ${lead0.name} (${leadId}) ===`)
  let lead: Lead = lead0

  // Brand analysis — reuse stored brand_data on rebuilds (saves Gemini quota)
  if (opts.reuseArtifacts && lead.brand_data) {
    console.log('[Trigger] Reusing stored brand_data')
  } else {
    const analyzeResult = await runBrandAnalystAgent(lead)
    if (!analyzeResult.success) throw new Error(`Brand analysis failed: ${analyzeResult.error}`)
    lead = analyzeResult.data!
    if (!lead.email && lead.brand_data?.email) lead = { ...lead, email: lead.brand_data.email }
    if (!lead.phone && lead.brand_data?.phone) lead = { ...lead, phone: lead.brand_data.phone }
    await updateLead(lead)
  }

  // Niche brain (has deterministic fallback when Gemini unavailable)
  const nicheProfile = await runNicheBrain(lead)
  lead = { ...lead, niche_profile: nicheProfile }
  await updateLead(lead)

  // Config generation — reuse stored config_ts on rebuilds
  if (opts.reuseArtifacts && lead.config_ts) {
    console.log('[Trigger] Reusing stored config_ts')
  } else {
    const configResult = await runConfigGeneratorAgent(lead)
    if (!configResult.success) throw new Error(`Config generation failed: ${configResult.error}`)
    lead = configResult.data!
    await updateLead(lead)
  }

  // Exact Google Maps pin — spliced in post-generation rather than asked of
  // Gemini (same reasoning as the heroFrames splice above: a structured
  // numeric field is more reliable injected than trusted to free-form
  // generation). Sourced from Places API lat/lng for scraped leads, or from
  // the self-serve form's parsed Google Maps link — either way it lands on
  // `lead.latitude`/`lead.longitude` before this point.
  if (lead.config_ts && lead.latitude != null && lead.longitude != null && !lead.config_ts.includes('location:')) {
    lead = {
      ...lead,
      config_ts: lead.config_ts.replace(
        'business: {',
        `business: {\n    location: { lat: ${lead.latitude}, lng: ${lead.longitude} },`
      ),
    }
    await updateLead(lead)
  }

  // Talking-site campaigns need the config id during the GitHub build so the
  // widget is present in the first Cloudflare deployment. The Pages hostname is
  // deterministic from the builder's repo naming rule.
  if (opts.talkingWebsite && !lead.reception_config_id && lead.website) {
    const project = `site-${lead.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
      .replace(/-+/g, '-').slice(0, 63).replace(/-$/g, '')
    const previewUrl = `https://${project}.pages.dev`
    const brain = await buildBrain(lead.website)
    const reception = await saveReceptionConfig(previewUrl, lead.name, brain, buildSystemPrompt(brain), lead.id, {
      isPreview: true,
      previewExpiresAt: new Date(Date.now() + 7 * 86_400_000),
    })
    lead = { ...lead, reception_config_id: reception.id }
    await updateLead(lead)
    console.log(`[Trigger] Talking website provisioned: ${reception.id}`)
  }

  // Images
  const imgResult  = await runImageGeneratorAgent(lead, lead.niche_profile)
  const heroImages = imgResult.success ? (imgResult.data?.images ?? null) : null
  const logoBuffer = await fetchBusinessLogo(lead)

  // Hero video (Kling) removed from the build pipeline (2026-09-28, whole-pipeline
  // decision, not just the HVAC rebuild campaign) — cost/complexity cut, sites now
  // use posterSrc-only heroes. This also silently retired the per-lead automatic
  // scroll-sequence-hero frame extraction (SCROLL_HERO_ENABLED, medspa-only), since
  // it depended on the video this step used to produce — the ScrollSequenceHero
  // component and its static demo routes (/scroll-demo) are unaffected, they don't
  // go through this pipeline. Unrelated: reel generation (pipeline/src/video/
  // fal_kling provider) and the RE walkthrough feature both still use Kling for
  // their own separate purposes — not touched by this change.
  const heroVideoBuffer: Buffer | null = null
  const heroFrames: { filename: string; buffer: Buffer }[] | null = null

  // Build
  const buildResult = await runBuilderAgent(lead, cfg, heroImages, heroVideoBuffer, heroFrames, logoBuffer)
  if (!buildResult.success) throw new Error(`Build failed: ${buildResult.error}`)
  lead = buildResult.data!
  await updateLead(lead)

  // Deploy
  const deployResult = await runDeployerAgent(lead)
  if (!deployResult.success) throw new Error(`Deploy failed: ${deployResult.error}`)
  lead = deployResult.data!
  await updateLead(lead)
  console.log(`[Trigger] LIVE: ${lead.cloudflare_url ?? lead.vercel_url}`)

  // Auto-provision AI Reception (Tier 1 only — Tier 2 auto-provisions via CF Worker on YES)
  if (!lead.reception_config_id) {
    const configId = await autoProvisionReception(lead)
    if (configId) {
      lead = { ...lead, reception_config_id: configId }
      await updateLead(lead)
    }
  }

  // SEO + AEO
  await runSeoAgent(lead)
  await runAeoAgent(lead)

  // Search Console auto-verification — best-effort, never blocks outreach.
  // Waits on a redeploy internally (~1min), so this is the slowest of the
  // non-blocking steps; that's fine, it still runs well before any human
  // would be reading the lead's record.
  const gscResult = await runGscAgent(lead)
  if (gscResult.success) {
    lead = { ...lead, gsc_verified: true, gsc_site_url: gscResult.data!.siteUrl, gsc_verified_at: new Date().toISOString() }
    await updateLead(lead)
  } else {
    console.warn(`[Trigger] GSC verification failed (non-blocking): ${gscResult.error}`)
  }

  // Outreach — skipped when caller (e.g. SMS agent) owns the conversation.
  // runOutreachAgent handles email AND SMS internally (tier-aware, TCPA-gated) —
  // do not also call runSMSOutreachAgent here, it duplicates the SMS send.
  if (!opts.skipOutreach) {
    if (lead.email || lead.phone) {
      const r = await runOutreachAgent(lead)
      if (r.success) { lead = r.data!; await updateLead(lead) }
    }

    // Stripe payment link
    if (process.env.STRIPE_SECRET_KEY) {
      const r = await runStripeAgent(lead, 'create_link')
      if (r.success && r.data) {
        lead = { ...lead, stripe_payment_url: r.data.paymentUrl }
        await updateLead(lead)
      }
    }
  }

  console.log(`[Trigger] Done: ${lead.name} | ${lead.cloudflare_url ?? lead.vercel_url}`)
  return lead
}

// ─── Track C: warm tease for tier2 (poor but loading website) ────────────────

async function sendWarmTeaseOutreach(lead: Lead, config: PipelineConfig) {
  if (!lead.phone) {
    console.log(`  [TrackC] No phone for ${lead.name} — skip`)
    await updateLead({ ...lead, status: 'outreach_sent' })
    return
  }

  if (config.dryRun) {
    console.log(`  [TrackC DRY RUN] Would send warm tease to ${lead.name} (${lead.phone})`)
    return
  }

  if (!(await canTextNow(lead.phone))) {
    console.log(`  [TrackC] ${lead.phone} not textable (opted out / no consent) — skip`)
    await updateLead({ ...lead, status: 'outreach_sent' })
    return
  }

  const msg = buildWarmTeaseSMS(lead)

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_FROM_NUMBER) {
    try {
      await sendSMS(lead.phone, msg)
      console.log(`  [TrackC] Warm tease SMS → ${lead.phone}`)
    } catch (e: any) {
      console.log(`  [TrackC] SMS error: ${e.message}`)
    }
  } else {
    console.log(`  [TrackC] Would send warm tease to ${lead.phone} — add TWILIO_* to enable`)
    console.log(`  Message: ${msg.slice(0, 100)}...`)
  }

  await updateLead({ ...lead, status: 'outreach_sent', sms_sent: true, sms_sent_at: new Date().toISOString() })
}
