/**
 * drip-followup.ts
 *
 * Follow-up drip for consented leads that haven't replied to initial outreach.
 * TCPA-gated: only texts numbers with an active consent_events row, then
 * (optionally) scrubs against a litigator list as an extra safety layer.
 * Absence of consent → skipped, never sent (cold leads get email instead,
 * see sheets-outreach.ts).
 *
 * Run via cron (daily):
 *   cd pipeline && npx tsx src/scripts/drip-followup.ts
 *
 * Drip schedule:
 *   Day 3  — follow-up 1: "Just checking in…" + demo link
 *   Day 10 — follow-up 2: social proof + last-chance offer
 *
 * Skips: no consent on file, opted-out, already in conversation, no phone,
 * no demo site
 */

import 'dotenv/config'
import pg from 'pg'
import Twilio from 'twilio'
import { loadTextableSet, consentSetAllows } from '../tools/sms-consent.js'
import { checkLitigatorList } from '../tools/tcpa-litigator-check.js'

const pool   = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const client = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
const FROM   = process.env.TWILIO_FROM_NUMBER ?? ''
const DRY    = process.env.DRY_RUN === 'true'

// ── SMS templates ─────────────────────────────────────────────────────────────

function followUp1(name: string, niche: string, city: string, demoUrl: string): string {
  return `Hi! Just checking in — we built ${name} a free ${niche} website in ${city}. Still available if you want to take a look: ${demoUrl}\n\nReply YES — $0 setup, 30-day free trial, then $297/mo flat. Reply STOP to opt out.`
}

function followUp2(name: string, niche: string, demoUrl: string): string {
  return `Last check-in for ${name}. Your free site is still live at ${demoUrl}\n\nSeveral ${niche} businesses in your area have already activated theirs. Happy to hand yours over anytime — just reply YES. Reply STOP to opt out.`
}

// ── Phone normalization ───────────────────────────────────────────────────────

function toE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

// ── Gate a batch of rows: consent (required) + litigator scrub (best-effort) ──

async function gateRows<T extends { phone: string }>(
  rows: T[],
  consentSet: Set<string>,
  stats: { noConsent: number; litigatorBlocked: number; badPhone: number }
): Promise<Array<T & { e164: string }>> {
  const out: Array<T & { e164: string }> = []
  for (const row of rows) {
    const e164 = toE164(row.phone)
    if (!e164) { stats.badPhone++; continue }
    if (!consentSetAllows(consentSet, row.phone)) { stats.noConsent++; continue }

    const litigator = await checkLitigatorList(e164)
    if (litigator.listed) {
      stats.litigatorBlocked++
      console.warn(`  [!] Skipped ${e164} — litigator-list hit (${litigator.detail ?? litigator.source})`)
      continue
    }

    out.push({ ...row, e164 })
  }
  return out
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Drip Follow-Up${DRY ? ' (DRY RUN)' : ''} ===`)
  console.log(new Date().toISOString())

  if (!FROM && !DRY) {
    console.error('TWILIO_FROM_NUMBER not set')
    process.exit(1)
  }

  const now = new Date()
  let sent1 = 0, sent2 = 0, failed = 0
  const stats = { noConsent: 0, litigatorBlocked: 0, badPhone: 0 }

  const consentSet = await loadTextableSet()
  if (consentSet.size === 0 && !consentSet.has('*')) {
    console.log('⛔  No consented numbers on file — nothing to follow up.')
    await pool.end()
    return
  }
  console.log(`Consent   : ${consentSet.has('*') ? 'GATE BYPASSED (ALLOW_COLD_SMS)' : `${consentSet.size} numbers with active SMS consent`}`)

  // ── Follow-up 1: sms_sent 3+ days ago, no reply, no follow-up yet ────────
  const q1 = await pool.query<{
    id: string; name: string; niche: string; city: string; phone: string;
    cloudflare_url: string; vercel_url: string
  }>(
    `SELECT id, name, niche, city, phone, cloudflare_url, vercel_url
     FROM leads
     WHERE phone IS NOT NULL
       AND sms_opt_out IS NOT TRUE
       AND follow_up_1_sent_at IS NULL
       AND status IN ('sms_sent','outreach_sent')
       AND sms_sent_at IS NOT NULL
       AND sms_sent_at < NOW() - INTERVAL '3 days'
     ORDER BY sms_sent_at ASC
     LIMIT 200`
  )

  const eligible1 = await gateRows(q1.rows, consentSet, stats)

  for (const row of eligible1) {
    const demoUrl = row.cloudflare_url ?? row.vercel_url ?? 'webcrew.app'
    const sms = followUp1(row.name, row.niche ?? 'business', row.city ?? 'your city', demoUrl)

    if (DRY) {
      console.log(`[DRY] FU1 → ${row.name} (${row.e164}): ${sms.slice(0, 80)}…`)
      continue
    }
    try {
      await client.messages.create({ to: row.e164, from: FROM, body: sms })
      await pool.query(`UPDATE leads SET follow_up_1_sent_at = $1 WHERE id = $2`, [now.toISOString(), row.id])
      console.log(`  FU1 → ${row.name} (${row.e164})`)
      sent1++
      await new Promise(r => setTimeout(r, 250)) // 4 SMS/sec rate limit
    } catch (e: any) {
      console.error(`  [!] FU1 failed for ${row.name}: ${e.message}`)
      failed++
    }
  }

  // ── Follow-up 2: FU1 sent 7+ days ago, still no reply ───────────────────
  const q2 = await pool.query<{
    id: string; name: string; niche: string; phone: string;
    cloudflare_url: string; vercel_url: string
  }>(
    `SELECT id, name, niche, phone, cloudflare_url, vercel_url
     FROM leads
     WHERE phone IS NOT NULL
       AND sms_opt_out IS NOT TRUE
       AND follow_up_1_sent_at IS NOT NULL
       AND follow_up_2_sent_at IS NULL
       AND status IN ('sms_sent','outreach_sent')
       AND follow_up_1_sent_at < NOW() - INTERVAL '7 days'
     ORDER BY follow_up_1_sent_at ASC
     LIMIT 200`
  )

  const eligible2 = await gateRows(q2.rows, consentSet, stats)

  for (const row of eligible2) {
    const demoUrl = row.cloudflare_url ?? row.vercel_url ?? 'webcrew.app'
    const sms = followUp2(row.name, row.niche ?? 'business', demoUrl)

    if (DRY) {
      console.log(`[DRY] FU2 → ${row.name} (${row.e164}): ${sms.slice(0, 80)}…`)
      continue
    }
    try {
      await client.messages.create({ to: row.e164, from: FROM, body: sms })
      await pool.query(`UPDATE leads SET follow_up_2_sent_at = $1 WHERE id = $2`, [now.toISOString(), row.id])
      console.log(`  FU2 → ${row.name} (${row.e164})`)
      sent2++
      await new Promise(r => setTimeout(r, 250))
    } catch (e: any) {
      console.error(`  [!] FU2 failed for ${row.name}: ${e.message}`)
      failed++
    }
  }

  console.log(`\nDone — FU1 sent: ${sent1} | FU2 sent: ${sent2} | Failed: ${failed}`)
  console.log(`No consent: ${stats.noConsent} | Litigator-blocked: ${stats.litigatorBlocked} | Bad phone: ${stats.badPhone}`)
  await pool.end()
}

main().catch(e => {
  console.error('[Drip] Fatal:', e.message)
  process.exit(1)
})
