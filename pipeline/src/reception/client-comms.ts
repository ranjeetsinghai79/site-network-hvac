import type { ReceptionConfig } from './types.js'
import { getLeadContact } from './db.js'

// Outbound messages for CLIENT-mode receptions (a paying client's own customers).
// Unlike relay-shared.ts's WebCrew-branded senders, these send from the client's
// own Twilio number, so a customer's reply lands on the client's line and not in
// WebCrew's sales inbox.

const TWILIO_API = 'https://api.twilio.com/2010-04-01/Accounts'

export function toE164(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '')
  return digits.length >= 10 ? `+1${digits.slice(-10)}` : null
}

export function last10(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '').slice(-10)
}

export function formatWhen(startISO: string, timezone: string): string {
  return new Date(startISO).toLocaleString('en-US', {
    timeZone: timezone, weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

export function manageBookingUrl(uid: string): string {
  return `https://cal.com/booking/${encodeURIComponent(uid)}`
}

export async function sendClientSms(config: ReceptionConfig, to: string, body: string): Promise<boolean> {
  const sid  = process.env.TWILIO_ACCOUNT_SID
  const auth = process.env.TWILIO_AUTH_TOKEN
  const from = config.twilio_phone ?? process.env.TWILIO_FROM_NUMBER ?? process.env.TWILIO_PHONE_NUMBER
  const dest = toE164(to)
  if (!sid || !auth || !from || !dest) { console.warn('[ClientSMS] skipped — Twilio creds, sender, or destination missing'); return false }
  if (!config.twilio_phone) console.warn(`[ClientSMS] config ${config.id} has no twilio_phone — falling back to the shared sender`)
  try {
    const res = await fetch(`${TWILIO_API}/${sid}/Messages.json`, {
      method:  'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({ From: from, To: dest, Body: body }).toString(),
    })
    if (res.ok) return true
    const e = await res.json() as any
    console.warn(`[ClientSMS] failed (${config.business_name}): ${e?.code ?? ''} ${e?.message ?? res.status}`)
    return false
  } catch (e: any) {
    console.warn(`[ClientSMS] error: ${e.message}`)
    return false
  }
}

export async function sendEmail(to: string[], subject: string, text: string): Promise<boolean> {
  const key  = process.env.RESEND_API_KEY
  const from = process.env.OUTREACH_FROM_EMAIL ?? 'hello@webcrew.app'
  const recipients = to.filter(Boolean)
  if (!key || recipients.length === 0) { console.warn('[ClientEmail] skipped — RESEND_API_KEY or recipient missing'); return false }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ from, to: recipients, subject, text }),
    })
    if (res.ok) return true
    console.warn('[ClientEmail] failed:', res.status)
    return false
  } catch (e: any) {
    console.warn('[ClientEmail] error:', e.message)
    return false
  }
}

/** Where a business owner gets alerts: their own contact on the lead row, plus WebCrew's internal address. */
export async function ownerTargets(config: ReceptionConfig): Promise<{ emails: string[]; phone: string | null }> {
  const internal = process.env.OWNER_NOTIFY_EMAIL ?? 'pavan.harati@gmail.com'
  const contact = config.lead_id ? await getLeadContact(config.lead_id) : null
  return {
    emails: [...new Set([contact?.email, internal].filter((v): v is string => !!v))],
    phone:  toE164(contact?.phone),
  }
}
