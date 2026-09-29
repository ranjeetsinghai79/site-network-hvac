/**
 * content-cadence-cron.ts
 *
 * Generates the next batch of social content (reels + carousels/images) for
 * every active `content_cadence_plans` row that's due, per its tier:
 *   weekly_lite   — 1 reel + 1 carousel + 2 image posts per WEEK
 *   daily_premium — 3 reels + 1 carousel + 1 image post per DAY
 * (tier defaults live in admin's content-plan create form — this script just
 * honors whatever reels_per_period/period is actually stored per workspace.)
 *
 * Drafts land as needs_approval — nothing here spends money. Reel video
 * generation (the actual paid fal.ai call) only happens later, when a human
 * approves a reel draft in the admin Video Queue and clicks Generate.
 *
 * Scope note: reels_per_period is honored literally (this script loops that
 * many times, round-robining across the plan's configured channels). Social
 * image/carousel counts are NOT multiplied per run — the underlying planner
 * (pipeline/src/social/planner.ts) generates one image_post + one carousel per
 * channel per call, so running this cron on the plan's own period cadence
 * ('day' or 'week') already matches "N per period" for those without faking
 * content variety this script has no real way to generate yet.
 *
 * Run via cron (daily — daily_premium plans generate every run, weekly_lite
 * plans skip themselves until 7 days have passed since last_generated_at):
 *   cd pipeline && npx tsx src/scripts/content-cadence-cron.ts
 */

import 'dotenv/config'
import pg from 'pg'
// NOTE: pipeline/src/video/index.tsx is the Remotion outreach-video composition
// entry point, not a barrel export — import planner/store directly instead.
import { createVideoAssetDrafts } from '../video/planner.js'
import { saveVideoAssetDrafts } from '../video/store.js'
import type { VideoPlatform } from '../video/types.js'
import { createSocialAssetDrafts, saveSocialAssetDrafts } from '../social/index.js'
import type { SocialPlatform } from '../social/types.js'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const REEL_CHANNELS = new Set(['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'x'])

interface DuePlan {
  id: string
  workspace_id: string
  tier: 'weekly_lite' | 'daily_premium'
  channels: string[]
  reels_per_period: number
  business_name: string
  industry: string | null
  city: string | null
  lead_id: string | null
}

async function main() {
  const { rows: plans } = await pool.query<DuePlan>(
    `SELECT cp.id, cp.workspace_id, cp.tier, cp.channels, cp.reels_per_period,
            gw.business_name, gw.industry, gw.city, gw.lead_id
     FROM content_cadence_plans cp
     JOIN growth_workspaces gw ON gw.id = cp.workspace_id
     WHERE cp.active = true
       AND (
         (cp.period = 'day'  AND (cp.last_generated_at IS NULL OR cp.last_generated_at < now() - interval '1 day')) OR
         (cp.period = 'week' AND (cp.last_generated_at IS NULL OR cp.last_generated_at < now() - interval '7 days'))
       )`
  )

  if (!plans.length) {
    console.log('[ContentCadence] No plans due.')
    return
  }
  console.log(`[ContentCadence] ${plans.length} plan(s) due.`)

  for (const plan of plans) {
    try {
      await generateForPlan(plan)
    } catch (e: any) {
      console.error(`[ContentCadence] ${plan.business_name}: ${e.message}`)
    }
  }
}

async function generateForPlan(plan: DuePlan) {
  const sourceImageUrl = plan.lead_id ? await resolveSourceImage(plan.lead_id) : null
  // Minimal audit-shaped context — planners only read business_name/niche/city off it.
  const audit = { business_name: plan.business_name, niche: plan.industry ?? 'local service', city: plan.city ?? 'your area' } as any

  const reelChannels = plan.channels.filter((c) => REEL_CHANNELS.has(c)) as VideoPlatform[]
  let reelIds: string[] = []
  if (reelChannels.length && sourceImageUrl) {
    const drafts = Array.from({ length: plan.reels_per_period }, (_, i) =>
      createVideoAssetDrafts({
        audit,
        workspaceId: plan.workspace_id,
        platforms: [reelChannels[i % reelChannels.length]],
        mode: 'reel',
        sourceImageUrl,
      })[0]
    )
    reelIds = await saveVideoAssetDrafts(drafts)
  } else if (reelChannels.length && !sourceImageUrl) {
    console.log(`  [ContentCadence] ${plan.business_name}: no source image found — skipping reels this run.`)
  }

  const socialDrafts = createSocialAssetDrafts({
    audit,
    workspaceId: plan.workspace_id,
    platforms: plan.channels as SocialPlatform[],
  })
  const socialIds = await saveSocialAssetDrafts(socialDrafts)

  await pool.query(`UPDATE content_cadence_plans SET last_generated_at = now(), updated_at = now() WHERE id = $1`, [plan.id])
  console.log(`  [ContentCadence] ${plan.business_name}: ${reelIds.length} reel(s), ${socialIds.length} social asset(s) queued for approval.`)
}

async function resolveSourceImage(leadId: string): Promise<string | null> {
  const { rows } = await pool.query<{ business_brain: { media?: { hero_images?: string[]; gallery_images?: string[] } } | null }>(
    `SELECT business_brain FROM leads WHERE id = $1`,
    [leadId]
  )
  const media = rows[0]?.business_brain?.media
  return media?.hero_images?.[0] ?? media?.gallery_images?.[0] ?? null
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error('[ContentCadence] Fatal:', e)
    return pool.end()
  })
