/**
 * sms-outreach.ts
 *
 * Sends personalized outreach SMS to qualified leads after site is deployed.
 * Two tiers, two message styles, same flat offer:
 *   Tier 1 (no website)   → impulse close, show demo
 *   Tier 2 (bad website)  → upgrade pitch, show score
 * Both: $0 setup, 30-day free trial, then $297/mo flat (AI Front Office).
 *
 * Safety:
 *   - Skips leads with sms_opt_out=true
 *   - Skips leads already sms_sent=true
 *   - Dry-run mode logs without sending
 *   - Rate: 1 SMS per lead, 1s delay between sends
 *
 * Run:
 *   npx tsx src/scripts/send-outreach.ts
 *
 * Env:
 *   TWILIO_ACCOUNT_SID   AC...
 *   TWILIO_AUTH_TOKEN    ...
 *   TWILIO_FROM_NUMBER   +1XXXXXXXXXX
 *   SMS_DRY_RUN=true     (default false)
 */

import type { Lead, AgentResult } from '../types.js'
import { logCost } from '../tools/cost-tracker.js'
import { canTextNow } from '../tools/sms-consent.js'

const DRY_RUN = process.env.SMS_DRY_RUN === 'true' || process.env.DRY_RUN === 'true'

// ─── Twilio client (lazy init) ────────────────────────────────────────────────

let _twilio: any = null

async function getTwilio() {
  if (_twilio) return _twilio
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) {
    throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set in .env')
  }
  const { default: twilio } = await import('twilio')
  _twilio = twilio(sid, token)
  return _twilio
}

// ─── Message templates ────────────────────────────────────────────────────────

function buildMessage(lead: Lead): string {
  const tier = lead.tier ?? (lead.website ? 'tier2' : 'tier1')
  const demoUrl = lead.vercel_url ?? lead.cloudflare_url ?? ''

  if (!demoUrl) {
    throw new Error(`No demo URL for ${lead.name} — deploy first`)
  }

  if (tier === 'tier1') {
    const label = NICHE_LABEL[lead.niche] ?? lead.niche
    const city  = lead.city ?? ''

    if (lead.site_broken) {
      const domain = lead.website ? new URL(lead.website).hostname : 'your website'
      return [
        `Hey — noticed ${domain} is down right now. Every day it's down you're losing customers to competitors.`,
        `I rebuilt it overnight and it's already live: ${demoUrl}`,
        `AI also answers your calls 24/7 so you never miss a job. $0 setup, 30-day free trial, then $297/mo flat. Reply YES to go live or STOP to opt out.`,
      ].join('\n')
    }

    // Track A: no website — demo built, impulse close
    return [
      `Hey — I built a free ${label} website for ${lead.name} overnight. It's already live, go check it out:`,
      demoUrl,
      `If you want to keep it: $0 setup, 30-day free trial, then $297/mo flat — includes the site + an AI that answers your calls 24/7 and books jobs while you're working. Reply YES to claim it or STOP to opt out.`,
    ].join('\n')
  }

  // Tier 2 — has a website, pitch upgrade + AI receptionist
  const domain = lead.website ? (() => { try { return new URL(lead.website).hostname } catch { return lead.website! } })() : 'your site'
  const scoreNote = lead.site_score ? ` It scored ${lead.site_score}/100 on Google speed — that's hurting you on mobile.` : ''
  return [
    `Hey — I took a look at ${domain}.${scoreNote} Customers are probably bouncing before they even call you.`,
    `I rebuilt it and added an AI that answers every call 24/7 — books jobs while you're on the job. See it: ${demoUrl}`,
    `$0 setup, 30-day free trial, then $297/mo flat, no contracts. Reply YES to talk or STOP to opt out.`,
  ].join('\n')
}

// ─── Niche labels (beauty/wellness focused) ───────────────────────────────────
const NICHE_LABEL: Record<string, string> = {
  hvac: 'HVAC', roofing: 'roofing', dentist: 'dental', medspa: 'med spa',
  lawfirm: 'law firm', cleaning: 'cleaning', 'auto-detailing': 'auto detailing',
  'junk-removal': 'junk removal', daycare: 'daycare', remodeling: 'remodeling',
  restaurant: 'restaurant', 'luxury-realestate': 'real estate',
  'skin-clinic': 'skin & aesthetics', 'iv-therapy': 'IV therapy', 'nail-studio': 'nail studio',
  orthodontist: 'orthodontics', 'weight-loss-clinic': 'weight loss', salon: 'salon', barbershop: 'barbershop',
}

// Track C: audit-first SMS for tier2 leads (has website but needs work)
// Sends audit link instead of demo — builds trust before pitch.
export function buildAuditSMS(lead: Lead, auditUrl?: string): string {
  const domain = lead.website ? (() => { try { return new URL(lead.website).hostname } catch { return lead.website! } })() : null
  const label = NICHE_LABEL[lead.niche] ?? lead.niche
  const firstName = lead.name.split(' ')[0]
  const score = lead.site_score ? ` (scored ${lead.site_score}/100)` : ''

  if (auditUrl) {
    // Has audit report — send link directly
    return [
      `Hi ${firstName} — ran a free AI audit on ${domain ?? lead.name}${score}.`,
      `Found issues hurting your bookings. See your report: ${auditUrl}`,
      `Reply STOP to opt out.`,
    ].join(' ')
  }

  // No audit URL yet — teaser SMS
  return [
    `Hi ${firstName} — I ran a free AI audit on ${domain ?? lead.name}${score}.`,
    `Found 3 issues hurting your ${label} bookings.`,
    `Want your full report? Reply YES. Reply STOP to opt out.`,
  ].join(' ')
}

// Keep old name for backwards compatibility
export function buildWarmTeaseSMS(lead: Lead): string {
  return buildAuditSMS(lead)
}

// ─── Send single SMS ──────────────────────────────────────────────────────────

export async function sendSMS(to: string, body: string): Promise<{ sid: string }> {
  const from = process.env.TWILIO_FROM_NUMBER
  if (!from) throw new Error('TWILIO_FROM_NUMBER not set')

  if (DRY_RUN) {
    console.log(`[SMS DRY-RUN] → ${to}`)
    console.log(`  ${body.replace(/\n/g, '\n  ')}`)
    return { sid: 'dry-run' }
  }

  // TCPA gate — callers should check canTextNow() first and skip gracefully;
  // this throw is the backstop against any path that forgets to.
  if (!(await canTextNow(to))) {
    throw new Error(`Not textable (opted out or no SMS consent) for ${to} — TCPA gate. Use email outreach, or ALLOW_COLD_SMS=true to override.`)
  }

  const client = await getTwilio()
  const msg = await client.messages.create({ to, from, body })
  // Each 160-char SMS = 1 segment @ $0.0079; estimate segments
  const segments = Math.ceil(body.length / 160)
  await logCost({ service: 'twilio_sms', units: segments, note: `to ${to}` })
  return { sid: msg.sid }
}

// ─── Outreach agent (pipeline integration) ───────────────────────────────────

export async function runSMSOutreachAgent(lead: Lead): Promise<AgentResult<Lead>> {
  // Guard: must have demo URL
  const demoUrl = lead.vercel_url ?? lead.cloudflare_url
  if (!demoUrl) {
    return { success: false, error: 'No deployed URL — run deployer first' }
  }

  // Guard: must have phone
  if (!lead.phone) {
    console.log(`[SMS] ${lead.name} — no phone, skip`)
    return { success: true, data: { ...lead } }
  }

  // Guard: already sent
  if (lead.sms_sent) {
    console.log(`[SMS] ${lead.name} — already sent (${lead.sms_sent_at}), skip`)
    return { success: true, data: { ...lead } }
  }

  // Guard: textable — fresh DB check (not lead.sms_opt_out, which can be stale
  // in-memory) covers both opt-out and active-consent in one atomic read.
  if (!DRY_RUN && !(await canTextNow(lead.phone))) {
    console.log(`[SMS] ${lead.name} — not textable (opted out or no consent), skip`)
    return { success: true, data: { ...lead } }
  }

  try {
    const message = buildMessage(lead)
    console.log(`[SMS] Sending to ${lead.name} (${lead.phone})...`)

    const { sid } = await sendSMS(lead.phone, message)
    const sentAt = new Date().toISOString()

    console.log(`  ✓ Sent — SID: ${sid}`)

    return {
      success: true,
      data: {
        ...lead,
        sms_sent: true,
        sms_sent_at: sentAt,
        status: 'sms_sent',
      },
    }
  } catch (e: any) {
    console.error(`[SMS] Failed for ${lead.name}: ${e.message}`)
    return { success: false, error: e.message }
  }
}
