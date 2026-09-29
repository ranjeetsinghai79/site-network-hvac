import { createHmac, timingSafeEqual } from 'node:crypto'
import { pool } from './db.js'
import { toE164 } from './client-comms.js'

// Per-client CRM: contacts → opportunities (pipeline stage) → events, plus a
// follow-up queue. Everything is scoped by reception_configs.id so a client's
// customers never mix with WebCrew's own `leads` pipeline.

export type Stage = 'new' | 'callback_requested' | 'booked' | 'cancelled' | 'escalated' | 'contacted' | 'won' | 'lost' | 'spam'
export type FollowUpKind = 'appointment_reminder' | 'callback_nudge'

// Owner-driven terminal stages — a later voice call never drags these backward.
const TERMINAL: Stage[] = ['won', 'lost']

/** Registers one call from a phone number: creates the contact or bumps its call count. */
export async function registerCallContact(configId: string, callerPhone: string | null): Promise<string | null> {
  const phone = toE164(callerPhone)
  try {
    if (!phone) {
      const { rows } = await pool.query(
        `INSERT INTO reception_contacts (config_id, call_count) VALUES ($1, 1) RETURNING id`, [configId])
      return rows[0]?.id ?? null
    }
    const { rows } = await pool.query(
      `INSERT INTO reception_contacts (config_id, phone, call_count)
       VALUES ($1, $2, 1)
       ON CONFLICT (config_id, phone) WHERE phone IS NOT NULL DO UPDATE SET
         call_count = reception_contacts.call_count + 1,
         last_call_at = NOW(), updated_at = NOW()
       RETURNING id`,
      [configId, phone])
    return rows[0]?.id ?? null
  } catch (e: any) {
    console.error('[CRM] registerCallContact failed:', e.message)
    return null
  }
}

export async function enrichContact(contactId: string, fields: { name?: string; email?: string; phone?: string | null; smsConsent?: boolean }): Promise<void> {
  try {
    await pool.query(
      `UPDATE reception_contacts SET
         name  = COALESCE(NULLIF($2,''), name),
         email = COALESCE(NULLIF($3,''), email),
         phone = COALESCE(phone, NULLIF($4,'')),
         sms_consent    = CASE WHEN $5::boolean IS TRUE THEN TRUE ELSE sms_consent END,
         sms_consent_at = CASE WHEN $5::boolean IS TRUE AND NOT sms_consent THEN NOW() ELSE sms_consent_at END,
         updated_at = NOW()
       WHERE id = $1`,
      [contactId, fields.name?.trim() ?? '', fields.email?.trim().toLowerCase() ?? '', toE164(fields.phone) ?? '', fields.smsConsent === true ? true : null])
  } catch (e: any) {
    console.error('[CRM] enrichContact failed:', e.message)
  }
}

export async function getContact(contactId: string): Promise<{ id: string; phone: string | null; email: string | null; name: string | null; smsConsent: boolean } | null> {
  const { rows } = await pool.query(`SELECT id, phone, email, name, sms_consent FROM reception_contacts WHERE id=$1`, [contactId])
  const r = rows[0]
  return r ? { id: r.id, phone: r.phone, email: r.email, name: r.name, smsConsent: r.sms_consent } : null
}

export async function logEvent(configId: string, contactId: string | null, opportunityId: string | null, eventType: string, detail: Record<string, unknown> = {}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO reception_events (config_id, contact_id, opportunity_id, event_type, detail) VALUES ($1,$2,$3,$4,$5)`,
      [configId, contactId, opportunityId, eventType, JSON.stringify(detail)])
  } catch (e: any) {
    console.error('[CRM] logEvent failed:', e.message)
  }
}

/** One opportunity per call. Returns the existing one when the call already has a card. */
export async function ensureCallOpportunity(opts: {
  configId: string; contactId: string; callSid: string | null
  intent?: string; urgency?: string; title?: string; notes?: string
}): Promise<string | null> {
  try {
    if (opts.callSid) {
      const existing = await pool.query(
        `SELECT id FROM reception_opportunities WHERE config_id=$1 AND source_call_sid=$2 LIMIT 1`, [opts.configId, opts.callSid])
      if (existing.rows[0]) {
        await updateOpportunityDetails(existing.rows[0].id, opts)
        return existing.rows[0].id
      }
    }
    const { rows } = await pool.query(
      `INSERT INTO reception_opportunities (config_id, contact_id, title, intent, urgency, notes, source_call_sid)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [opts.configId, opts.contactId, opts.title ?? null, opts.intent ?? null, opts.urgency ?? null, opts.notes ?? null, opts.callSid])
    const id = rows[0]?.id ?? null
    if (id) await logEvent(opts.configId, opts.contactId, id, 'opportunity_created', { intent: opts.intent ?? null, urgency: opts.urgency ?? null })
    return id
  } catch (e: any) {
    console.error('[CRM] ensureCallOpportunity failed:', e.message)
    return null
  }
}

export async function updateOpportunityDetails(oppId: string, fields: { intent?: string; urgency?: string; title?: string; notes?: string }): Promise<void> {
  try {
    await pool.query(
      `UPDATE reception_opportunities SET
         intent  = COALESCE(NULLIF($2,''), intent),
         urgency = COALESCE(NULLIF($3,''), urgency),
         title   = COALESCE(NULLIF($4,''), title),
         notes   = COALESCE(NULLIF($5,''), notes),
         updated_at = NOW()
       WHERE id = $1`,
      [oppId, fields.intent ?? '', fields.urgency ?? '', fields.title ?? '', fields.notes ?? ''])
  } catch (e: any) {
    console.error('[CRM] updateOpportunityDetails failed:', e.message)
  }
}

/** Moves a card to a new stage and logs the transition. No-ops for owner-set terminal stages. */
export async function setStage(configId: string, oppId: string, stage: Stage, detail: Record<string, unknown> = {}, onlyFrom?: Stage[]): Promise<boolean> {
  try {
    const cur = await pool.query(`SELECT stage, contact_id FROM reception_opportunities WHERE id=$1`, [oppId])
    const from = cur.rows[0]?.stage as Stage | undefined
    if (!from || from === stage || TERMINAL.includes(from)) return false
    if (onlyFrom && !onlyFrom.includes(from)) return false
    await pool.query(`UPDATE reception_opportunities SET stage=$2, stage_changed_at=NOW(), updated_at=NOW() WHERE id=$1`, [oppId, stage])
    await logEvent(configId, cur.rows[0].contact_id, oppId, 'stage_changed', { from, to: stage, ...detail })
    return true
  } catch (e: any) {
    console.error('[CRM] setStage failed:', e.message)
    return false
  }
}

export async function setBooking(oppId: string, uid: string | null, startISO: string | null): Promise<void> {
  try {
    await pool.query(`UPDATE reception_opportunities SET booking_uid=$2, booking_start=$3, updated_at=NOW() WHERE id=$1`, [oppId, uid, startISO])
  } catch (e: any) {
    console.error('[CRM] setBooking failed:', e.message)
  }
}

/** An earlier call's card that owns this booking — lets a reschedule/cancel move the SAME card instead of forking a duplicate. */
export async function findOpportunityByBooking(configId: string, bookingUid: string): Promise<{ id: string; contactId: string } | null> {
  try {
    const { rows } = await pool.query(
      `SELECT id, contact_id FROM reception_opportunities WHERE config_id=$1 AND booking_uid=$2 ORDER BY created_at DESC LIMIT 1`, [configId, bookingUid])
    return rows[0] ? { id: rows[0].id, contactId: rows[0].contact_id } : null
  } catch (e: any) {
    console.error('[CRM] findOpportunityByBooking failed:', e.message)
    return null
  }
}

// ── Follow-ups ────────────────────────────────────────────────────────────────

/** When to remind a caller about an appointment: 24h before; 2h before if booked inside 24h; none if it's too soon to matter. */
export function computeReminderDueAt(startISO: string, now: Date = new Date()): Date | null {
  const start = new Date(startISO).getTime()
  const hoursAway = (start - now.getTime()) / 3_600_000
  if (!Number.isFinite(hoursAway) || hoursAway <= 3) return null
  if (hoursAway > 25) return new Date(start - 24 * 3_600_000)
  return new Date(start - 2 * 3_600_000)
}

export async function scheduleFollowUp(opts: {
  configId: string; contactId: string | null; opportunityId: string | null; kind: FollowUpKind; dueAt: Date
}): Promise<void> {
  try {
    // One pending follow-up of a kind per opportunity — a reschedule replaces, never stacks.
    if (opts.opportunityId) {
      await pool.query(
        `UPDATE reception_follow_ups SET status='skipped', last_error='superseded'
         WHERE opportunity_id=$1 AND kind=$2 AND status='pending'`, [opts.opportunityId, opts.kind])
    }
    await pool.query(
      `INSERT INTO reception_follow_ups (config_id, contact_id, opportunity_id, kind, due_at) VALUES ($1,$2,$3,$4,$5)`,
      [opts.configId, opts.contactId, opts.opportunityId, opts.kind, opts.dueAt.toISOString()])
  } catch (e: any) {
    console.error('[CRM] scheduleFollowUp failed:', e.message)
  }
}

export async function cancelPendingFollowUps(opportunityId: string, kind?: FollowUpKind): Promise<void> {
  try {
    await pool.query(
      `UPDATE reception_follow_ups SET status='skipped', last_error='opportunity changed'
       WHERE opportunity_id=$1 AND status='pending' AND ($2::text IS NULL OR kind=$2)`, [opportunityId, kind ?? null])
  } catch (e: any) {
    console.error('[CRM] cancelPendingFollowUps failed:', e.message)
  }
}

// ── Signed "mark contacted" links ─────────────────────────────────────────────
// Sent to the business owner in lead alerts so acknowledging a lead is one tap,
// with no login. HMAC over the opportunity id; no expiry needed — the action is
// idempotent and only moves a card from new/callback_requested to contacted.

function tokenSecret(): string {
  return process.env.RECEPTION_PROVISION_SECRET ?? ''
}

export function signOpportunityToken(oppId: string): string {
  return createHmac('sha256', tokenSecret()).update(`contacted:${oppId}`).digest('hex').slice(0, 32)
}

export function verifyOpportunityToken(oppId: string, token: string): boolean {
  if (!tokenSecret() || !token) return false
  const expected = Buffer.from(signOpportunityToken(oppId))
  const given = Buffer.from(token)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export function contactedUrl(oppId: string): string {
  const base = (process.env.RECEPTION_BASE_URL ?? 'https://ai-reception-459352382653.us-central1.run.app').replace(/\/$/, '')
  return `${base}/crm/contacted?o=${oppId}&t=${signOpportunityToken(oppId)}`
}

export async function markContacted(oppId: string): Promise<{ ok: boolean; business?: string }> {
  try {
    const { rows } = await pool.query(
      `SELECT o.config_id, o.stage, c.business_name FROM reception_opportunities o
       JOIN reception_configs c ON c.id = o.config_id WHERE o.id=$1`, [oppId])
    const r = rows[0]
    if (!r) return { ok: false }
    if (r.stage === 'new' || r.stage === 'callback_requested' || r.stage === 'escalated') {
      await setStage(r.config_id, oppId, 'contacted', { via: 'owner_link' })
      await cancelPendingFollowUps(oppId, 'callback_nudge')
    }
    return { ok: true, business: r.business_name }
  } catch (e: any) {
    console.error('[CRM] markContacted failed:', e.message)
    return { ok: false }
  }
}
