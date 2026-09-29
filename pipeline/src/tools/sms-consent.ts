/**
 * sms-consent.ts — TCPA gate for outbound marketing SMS.
 *
 * canTextNow()/loadTextableSet() are the canonical gate every send site
 * should use — a number is textable only if BOTH an active (non-revoked)
 * consent event exists in consent_events (migration-v9) AND leads.sms_opt_out
 * is not true. Consent is captured by the CF Worker on:
 *   - contact/audit form submit with SMS opt-in checkbox (express_written)
 *   - inbound SMS reply (inbound_reply)
 * STOP sets both leads.sms_opt_out=true and revokes consent_events — checking
 * only one of the two can desync from the other, so always check both.
 *
 * Fail-closed: missing DATABASE_URL, DB error, or no match → NO send.
 * ALLOW_COLD_SMS=true bypasses the gate — you accept TCPA exposure
 * ($500–$1,500 statutory damages per text) and 10DLC campaign suspension risk.
 * Cold leads without consent should get EMAIL outreach (sheets-outreach.ts).
 */

import pg from 'pg'

let _pool: pg.Pool | null = null
function getPool(): pg.Pool | null {
  if (!process.env.DATABASE_URL) return null
  if (!_pool) _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
  return _pool
}

const COLD_SMS_OVERRIDE = process.env.ALLOW_COLD_SMS === 'true'
let warnedOverride = false
function warnOverride(): void {
  if (warnedOverride) return
  warnedOverride = true
  console.warn('⚠️  ALLOW_COLD_SMS=true — TCPA consent gate BYPASSED. Cold SMS to scraped numbers = $500–$1,500 exposure per text.')
}

/** Canonical US comparison key: last 10 digits. */
export function phoneKey(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10)
}

export function consentSetAllows(set: Set<string>, phone: string): boolean {
  return set.has('*') || set.has(phoneKey(phone))
}

/**
 * Canonical "can I text this number right now" check — the ONE gate every
 * send site should use. Checks consent_events AND cross-checks leads.sms_opt_out,
 * which the CF Worker's STOP handler sets independently. The two can desync
 * (a number can show active consent_events while leads.sms_opt_out=true, or
 * vice versa) — always require both. Fail-closed.
 */
export async function canTextNow(phone: string): Promise<boolean> {
  if (COLD_SMS_OVERRIDE) { warnOverride(); return true }
  const key = phoneKey(phone)
  if (key.length !== 10) return false
  const pool = getPool()
  if (!pool) return false
  try {
    const res = await pool.query(
      `SELECT
         NOT EXISTS (
           SELECT 1 FROM leads
           WHERE (RIGHT(regexp_replace(phone,'\\D','','g'),10) = $1
               OR RIGHT(regexp_replace(international_phone,'\\D','','g'),10) = $1)
             AND sms_opt_out = TRUE
         )
         AND EXISTS (
           SELECT 1 FROM consent_events
           WHERE channel = 'sms' AND revoked_at IS NULL
             AND RIGHT(regexp_replace(contact,'\\D','','g'),10) = $1
         ) AS can_text`,
      [key]
    )
    return res.rows[0]?.can_text === true
  } catch (e: any) {
    console.warn(`[Consent] canTextNow lookup failed (${e.message}) — failing closed, SMS blocked`)
    return false
  }
}

/**
 * Bulk variant of canTextNow for batch scripts — one query instead of one per row.
 * Returns the intersection: consented AND not opted out. LEFT JOINs leads
 * since a sheet-sourced number may have no matching leads row at all.
 */
export async function loadTextableSet(): Promise<Set<string>> {
  if (COLD_SMS_OVERRIDE) { warnOverride(); return new Set(['*']) }
  const pool = getPool()
  if (!pool) return new Set()
  try {
    const res = await pool.query(
      `SELECT DISTINCT RIGHT(regexp_replace(ce.contact, '\\D', '', 'g'), 10) AS key
       FROM consent_events ce
       LEFT JOIN leads l
         ON RIGHT(regexp_replace(l.phone,'\\D','','g'),10) = RIGHT(regexp_replace(ce.contact,'\\D','','g'),10)
         OR RIGHT(regexp_replace(l.international_phone,'\\D','','g'),10) = RIGHT(regexp_replace(ce.contact,'\\D','','g'),10)
       WHERE ce.channel = 'sms' AND ce.revoked_at IS NULL
         AND COALESCE(l.sms_opt_out, FALSE) = FALSE`
    )
    return new Set<string>(res.rows.map((r: any) => r.key).filter((k: string) => k?.length === 10))
  } catch (e: any) {
    console.warn(`[Consent] loadTextableSet failed (${e.message}) — failing closed`)
    return new Set()
  }
}
