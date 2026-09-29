import { pool, getReceptionConfigById } from './db.js'
import { formatWhen, manageBookingUrl, ownerTargets, sendClientSms, sendEmail } from './client-comms.js'
import { contactedUrl } from './crm.js'
import type { ReceptionConfig } from './types.js'

// Drains reception_follow_ups. Two kinds:
//   appointment_reminder — to the caller, SMS if they consented on the call, else email
//   callback_nudge       — to the business owner, if a lead is still unanswered
// Safe to run at any cadence and from more than one place: each row is claimed
// with FOR UPDATE SKIP LOCKED before it is sent.

const MAX_ATTEMPTS = 3

interface DueRow {
  id: string; config_id: string; kind: 'appointment_reminder' | 'callback_nudge'; attempts: number
  opportunity_id: string | null
  stage: string | null; booking_uid: string | null; booking_start: string | null; title: string | null; created_at: string | null
  contact_phone: string | null; contact_email: string | null; contact_name: string | null; sms_consent: boolean | null
}

type Outcome = 'sent' | 'skipped' | { deferMinutes: number }

const QUIET_START_HOUR = 21 // no texts at/after 9pm local
const QUIET_END_HOUR   = 8  // …or before 8am local (TCPA + basic courtesy)

/** Minutes until texting is allowed again in `timezone` (0 if allowed now). */
export function quietDelayMinutes(timezone: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(now)
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 12)
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? 0)
  if (hour >= QUIET_END_HOUR && hour < QUIET_START_HOUR) return 0
  const hoursUntil = (QUIET_END_HOUR - hour + 24) % 24
  return Math.max(1, hoursUntil * 60 - minute)
}

async function claimDue(limit: number): Promise<DueRow[]> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `SELECT f.id, f.config_id, f.kind, f.attempts, f.opportunity_id,
              o.stage, o.booking_uid, o.booking_start, o.title, o.created_at,
              c.phone AS contact_phone, c.email AS contact_email, c.name AS contact_name, c.sms_consent
       FROM reception_follow_ups f
       LEFT JOIN reception_opportunities o ON o.id = f.opportunity_id
       LEFT JOIN reception_contacts c ON c.id = f.contact_id
       WHERE f.status='pending' AND f.due_at <= NOW()
       ORDER BY f.due_at ASC LIMIT $1
       FOR UPDATE OF f SKIP LOCKED`, [limit])
    if (rows.length) {
      // Push due_at out so a crash mid-send re-delivers later instead of instantly re-claiming.
      await client.query(`UPDATE reception_follow_ups SET attempts = attempts + 1, due_at = NOW() + interval '10 minutes' WHERE id = ANY($1::uuid[])`, [rows.map(r => r.id)])
    }
    await client.query('COMMIT')
    return rows
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}

async function sendReminder(row: DueRow, config: ReceptionConfig): Promise<Outcome> {
  if (row.stage !== 'booked' || !row.booking_start || !row.booking_uid) return 'skipped'
  if (new Date(row.booking_start).getTime() < Date.now()) return 'skipped'
  const tz = config.timezone ?? 'America/Los_Angeles'
  const when = formatWhen(row.booking_start, tz)
  const first = (row.contact_name ?? '').trim().split(/\s+/)[0] || 'there'
  const manage = manageBookingUrl(row.booking_uid)

  const phone = row.sms_consent ? row.contact_phone : null
  const canText = phone !== null
  const delay = canText ? quietDelayMinutes(tz) : 0
  const msUntilStart = new Date(row.booking_start).getTime() - Date.now()
  // Overnight: hold the text until morning if that still leaves 30+ minutes; otherwise email only.
  if (delay > 0 && msUntilStart - delay * 60_000 > 30 * 60_000) return { deferMinutes: delay }

  if (phone && delay === 0) {
    const ok = await sendClientSms(config, phone, `Reminder from ${config.business_name}: ${first}, your appointment is ${when}. Need to change it? ${manage} Reply STOP to opt out. – ${config.business_name}`)
    if (ok) return 'sent'
  }
  if (row.contact_email) {
    const ok = await sendEmail([row.contact_email], `Reminder: your appointment with ${config.business_name}`, `Hi ${first},\n\nA reminder that your appointment with ${config.business_name} is ${when}.\n\nNeed to change or cancel it? ${manage}\n\n— ${config.business_name}`)
    if (ok) return 'sent'
  }
  // Neither channel worked or was permitted. Retry (transient failure) unless there was never a channel.
  if (!canText && !row.contact_email) return 'skipped'
  if (delay > 0 && !row.contact_email) return 'skipped' // too close to start to defer, and no email fallback
  throw new Error('reminder delivery failed')
}

async function sendNudge(row: DueRow, config: ReceptionConfig): Promise<Outcome> {
  if (!row.opportunity_id || (row.stage !== 'new' && row.stage !== 'callback_requested')) return 'skipped'
  const delay = quietDelayMinutes(config.timezone ?? 'America/Los_Angeles')
  if (delay > 0) return { deferMinutes: delay }
  const targets = await ownerTargets(config)
  const who = row.contact_name?.trim() || 'A caller'
  const mins = row.created_at ? Math.max(1, Math.round((Date.now() - new Date(row.created_at).getTime()) / 60_000)) : null
  const detail = `${who}${row.contact_phone ? ` (${row.contact_phone})` : ''} ${row.title ? `— ${row.title}` : ''}`.trim()
  const link = contactedUrl(row.opportunity_id)

  const [emailed, texted] = await Promise.all([
    sendEmail(targets.emails, `Unreturned lead — ${config.business_name}`, `This lead${mins ? ` came in ${mins} minutes ago and` : ''} hasn't been marked as contacted:\n\n${detail}\n\nCall them back, then tap to clear this reminder:\n${link}`),
    targets.phone
      ? sendClientSms(config, targets.phone, `${config.business_name}: unreturned lead — ${detail}. Mark contacted: ${link}`)
      : Promise.resolve(false),
  ])
  if (!emailed && !texted) throw new Error('nudge delivery failed')
  return 'sent'
}

export async function runDueFollowUps(limit = 50): Promise<{ sent: number; skipped: number; failed: number; deferred: number }> {
  const totals = { sent: 0, skipped: 0, failed: 0, deferred: 0 }
  const due = await claimDue(limit)
  for (const row of due) {
    try {
      const config = await getReceptionConfigById(row.config_id)
      if (!config || !config.active) {
        await pool.query(`UPDATE reception_follow_ups SET status='skipped', last_error='config inactive' WHERE id=$1`, [row.id])
        totals.skipped++
        continue
      }
      const outcome = row.kind === 'appointment_reminder' ? await sendReminder(row, config) : await sendNudge(row, config)
      if (typeof outcome === 'object') {
        // Quiet hours: put it back, without spending a delivery attempt.
        await pool.query(`UPDATE reception_follow_ups SET status='pending', attempts=GREATEST(attempts-1,0), due_at = NOW() + ($2 || ' minutes')::interval WHERE id=$1`, [row.id, String(outcome.deferMinutes)])
        totals.deferred++
        continue
      }
      await pool.query(
        `UPDATE reception_follow_ups SET status=$2, sent_at = CASE WHEN $2='sent' THEN NOW() ELSE sent_at END, last_error=NULL WHERE id=$1`,
        [row.id, outcome])
      totals[outcome]++
    } catch (e: any) {
      const exhausted = row.attempts + 1 >= MAX_ATTEMPTS
      await pool.query(
        `UPDATE reception_follow_ups SET status=$2, last_error=$3 WHERE id=$1`,
        [row.id, exhausted ? 'failed' : 'pending', String(e.message).slice(0, 300)]).catch(() => {})
      totals.failed++
      console.error(`[FollowUps] ${row.kind} ${row.id} failed (attempt ${row.attempts + 1}/${MAX_ATTEMPTS}): ${e.message}`)
    }
  }
  return totals
}
