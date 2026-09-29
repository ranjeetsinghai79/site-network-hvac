/**
 * visibility-check.ts
 *
 * Checks a business website's actual AI-readiness BEFORE outreach.
 * Finds real gaps so the SMS leads with a specific finding, not a generic pitch.
 *
 * Checks:
 *   1. llms.txt — AI crawlers read this first
 *   2. Structured data — LocalBusiness / FAQPage schema in HTML
 *   3. robots.txt — whether AI bots (GPTBot, ClaudeBot) are blocked
 *
 * Result feeds directly into SMS copy: "your site has no llms.txt — ChatGPT can't read you"
 */

export interface AiVisibilityResult {
  has_llms_txt:     boolean
  has_schema:       boolean
  ai_bots_allowed:  boolean
  score:            number   // 0–3
  gaps:             string[] // human-readable gap labels
  website:          string
}

const TIMEOUT_MS = 7000
const BOT_UA = 'WebCrewBot/1.0 (+https://webcrew.app)'

export async function checkAIVisibility(website: string): Promise<AiVisibilityResult> {
  const base = website.replace(/\/$/, '').replace(/^http:\/\//, 'https://')
  const gaps: string[] = []
  let score = 0

  // ── 1. llms.txt ─────────────────────────────────────────────────────────────
  let has_llms_txt = false
  try {
    const r = await fetch(`${base}/llms.txt`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': BOT_UA },
    })
    if (r.ok) {
      const text = await r.text()
      has_llms_txt = text.trim().length > 20
    }
  } catch {}
  if (has_llms_txt) score++
  else gaps.push('no llms.txt')

  // ── 2. Structured data ───────────────────────────────────────────────────────
  let has_schema = false
  try {
    const r = await fetch(base, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': BOT_UA },
    })
    if (r.ok) {
      const html = await r.text()
      has_schema =
        html.includes('"@type"') &&
        (html.includes('LocalBusiness') || html.includes('Organization') || html.includes('FAQPage'))
    }
  } catch {}
  if (has_schema) score++
  else gaps.push('no structured data')

  // ── 3. robots.txt — AI bot access ───────────────────────────────────────────
  let ai_bots_allowed = true
  try {
    const r = await fetch(`${base}/robots.txt`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': BOT_UA },
    })
    if (r.ok) {
      const txt = await r.text()
      const blocksAll = txt.match(/User-agent:\s*\*[\s\S]*?Disallow:\s*\/(?!\S)/m)
      const blocksGpt = txt.match(/User-agent:\s*GPTBot[\s\S]*?Disallow:\s*\//m)
      const blocksClaude = txt.match(/User-agent:\s*ClaudeBot[\s\S]*?Disallow:\s*\//m)
      ai_bots_allowed = !blocksAll && !blocksGpt && !blocksClaude
    }
    // no robots.txt = bots allowed
  } catch {}
  if (ai_bots_allowed) score++
  else gaps.push('AI bots blocked')

  return { has_llms_txt, has_schema, ai_bots_allowed, score, gaps, website: base }
}

// ── Build personalized Tier 2 SMS from visibility gaps ───────────────────────

export function buildVisibilityGapSMS(params: {
  businessName: string
  website: string
  niche: string
  result: AiVisibilityResult
}): string {
  const { businessName, website, niche, result } = params
  let domain = website
  try { domain = new URL(website).hostname } catch {}

  const { has_llms_txt, has_schema, ai_bots_allowed, score } = result

  // Site has real problems — generic "losing customers" angle
  if (score === 0 || (!has_llms_txt && !has_schema)) {
    return [
      `Hey — I looked at ${domain} and Google can't properly read what ${businessName} does. That means customers who search for you might not find you.`,
      `We fix it overnight + add an AI that answers every call 24/7 so you never miss a booking. $0 setup, 30-day free trial, then $297/mo flat, no contracts.`,
      `Reply YES to talk or STOP to opt out.`,
    ].join('\n')
  }

  // Missing one thing — site is OK but incomplete
  if (!has_llms_txt || !has_schema) {
    return [
      `Hey — ${domain} looks decent but it's missing some things that help Google and other searches find ${businessName}.`,
      `We clean that up + add an AI that answers your calls 24/7 and books jobs while you're working. $0 setup, 30-day free trial, then $297/mo flat.`,
      `Reply YES to see what we'd do or STOP to opt out.`,
    ].join('\n')
  }

  // AI bots blocked — frame as "missing customers"
  if (!ai_bots_allowed) {
    return [
      `Hey — ${domain} is accidentally blocking some search tools from finding ${businessName}. Easy fix.`,
      `We handle it + set you up with an AI that answers every call 24/7. $0 setup, 30-day free trial, then $297/mo flat.`,
      `Reply YES to talk or STOP to opt out.`,
    ].join('\n')
  }

  // Site is actually solid — pitch AI receptionist only
  return [
    `Hey — ${domain} looks good. One thing missing: when customers call ${businessName} after hours or when you're busy, what happens?`,
    `We add an AI that answers every call 24/7, qualifies leads, and books jobs automatically. $0 setup, 30-day free trial, then $297/mo flat.`,
    `Reply YES to try it or STOP to opt out.`,
  ].join('\n')
}
