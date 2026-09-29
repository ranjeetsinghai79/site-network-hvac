import { scoreSite } from '../tools/pagespeed.js'
import type { Lead, AgentResult } from '../types.js'

// Tier 1: no website → build from scratch ($299-499)
// Tier 2: has website but score < UPGRADE_THRESHOLD → premium upgrade ($500-999)
const UPGRADE_THRESHOLD = 45   // mobile score below this = shitty enough to pitch
const BAD_SITE_THRESHOLD = 60  // score below this = skip pipeline (between T2 and good)

// Temp/builder hosting = no real web presence → always Tier 1
const TEMP_DOMAINS = [
  'netlify.app', 'vercel.app', 'pages.dev', 'github.io',
  'wix.com', 'weebly.com', 'squarespace.com', 'godaddysites.com',
  'wordpress.com', 'webflow.io', 'sites.google.com',
]

function isTempDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return TEMP_DOMAINS.some(d => host.endsWith(d))
  } catch { return false }
}

export async function runSiteScorerAgent(lead: Lead): Promise<AgentResult<Lead>> {
  // ── Tier 1: No website — build from scratch ──────────────────────────────
  if (!lead.website) {
    console.log(`[SiteScorer] ${lead.name} — no website → TIER 1 ($299-499)`)
    return {
      success: true,
      data: { ...lead, tier: 'tier1', site_score: 0, site_issues: ['No website'], status: 'scored' },
    }
  }

  // ── Tier 1: Temp domain — treat as no real site ──────────────────────────
  if (isTempDomain(lead.website)) {
    const platform = TEMP_DOMAINS.find(d => lead.website!.includes(d)) ?? 'temp platform'
    console.log(`[SiteScorer] ${lead.name} — temp domain (${platform}) → TIER 1`)
    return {
      success: true,
      data: { ...lead, tier: 'tier1', site_score: 0, site_issues: [`Temp domain: ${platform}`], status: 'scored' },
    }
  }

  console.log(`[SiteScorer] Scoring ${lead.name} — ${lead.website}`)

  try {
    const score = await scoreSite(lead.website)

    // ── Broken site — build fresh, different SMS message ─────────────────
    if (score.broken) {
      console.log(`  Site broken/unreachable → TIER 1 (broken, build fresh)`)
      return {
        success: true,
        data: { ...lead, tier: 'tier1', site_broken: true, site_score: 0, site_issues: score.issues, status: 'scored' },
      }
    }

    // PageSpeed unavailable → treat as bad site, Tier 2 candidate
    if (!score.scored) {
      console.log(`  [!] PageSpeed unavailable → TIER 2 (unscored)`)
      return {
        success: true,
        data: { ...lead, tier: 'tier2', site_score: 0, site_issues: score.issues, status: 'scored' },
      }
    }

    // ── Tier 2: Bad site — warm tease SMS then build on YES ──────────────
    if (score.mobile_score < UPGRADE_THRESHOLD || score.issues.length >= 3) {
      console.log(`  Score ${score.mobile_score}/100 → TIER 2 warm tease`)
      return {
        success: true,
        data: {
          ...lead,
          tier: 'tier2',
          site_score: score.mobile_score,
          site_issues: score.issues,
          status: 'scored',
        },
      }
    }

    // ── Mediocre site (45-60) — skip for now, not bad enough to pitch ────
    if (score.mobile_score < BAD_SITE_THRESHOLD) {
      console.log(`  Score ${score.mobile_score}/100 — mediocre but skip (not pitch-worthy)`)
      return {
        success: true,
        data: { ...lead, site_score: score.mobile_score, status: 'skipped' },
      }
    }

    // ── Good site — skip ─────────────────────────────────────────────────
    console.log(`  Score ${score.mobile_score}/100 — good site, skip`)
    return {
      success: true,
      data: { ...lead, site_score: score.mobile_score, status: 'skipped' },
    }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
