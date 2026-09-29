import type { ReceptionConfig } from './types.js'
import { getLeadContact, createShortLink } from './db.js'
import { geminiText, GEMINI_FLASH } from '../tools/gemini.js'
import { PLAN_CATALOG } from './plan-catalog.js'
import { RECEPTION_OFFER } from './reception-contract.js'

// Pure helpers + owner/caller notification senders shared between the Twilio
// relay (phone calls) and the browser relay (webcrew.app avatar widget).
// None of this is Twilio-specific — it's conversation-state logic and plain
// fetch calls to Resend/ntfy/Twilio's SMS API (not Media Streams audio).

export function hasSpeechEnergy(base64Pcm16: string, threshold: number): boolean {
  const pcm = Buffer.from(base64Pcm16, 'base64')
  if (pcm.length < 2) return false
  let sumSquares = 0
  const samples = Math.floor(pcm.length / 2)
  for (let i = 0; i < samples; i++) {
    const sample = pcm.readInt16LE(i * 2)
    sumSquares += sample * sample
  }
  return Math.sqrt(sumSquares / samples) >= threshold
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value)
}

export function callerSaidDone(value: string): boolean {
  const normalized = value.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim()
  return /\b(no|nope|done|goodbye|bye|nothing else|that's all|that is all|all good|thank you|thanks)\b/.test(normalized)
}

// Channel-neutral: the phone relay's closing says "calling WebCrew", the
// browser widget's says "chatting with WebCrew" — both must pass this gate.
export function closingWasSpoken(value: string): boolean {
  const normalized = value.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim()
  return /thank you for (calling|chatting with) webcrew/.test(normalized) && /have a (great|wonderful|good) day/.test(normalized)
}

// ─── Owner notifications — email (Resend) + SMS (Twilio) + optional ntfy push ──
// SMS goes to the client's own phone (leads.phone) when a lead_id resolves one.
// ntfy is a free bonus channel — install the app, subscribe to NTFY_TOPIC.

export async function notifyOwner(
  type: 'escalation' | 'message',
  args: { reason?: string; caller_name?: string; caller_phone?: string; caller_email?: string; message?: string },
  config: ReceptionConfig,
  callerPhone: string | null,
  extra?: { actionUrl?: string }
) {
  const internalEmail = process.env.OWNER_NOTIFY_EMAIL ?? 'pavan.harati@gmail.com'
  const ntfyTopic  = process.env.NTFY_TOPIC  // e.g. "webcrew-leads-xk92" — set in Cloud Run
  const resendKey  = process.env.RESEND_API_KEY
  const from       = process.env.OUTREACH_FROM_EMAIL ?? 'hello@webcrew.app'

  // This config belongs to a deployed paying client (lead_id set) — their own
  // lead alert must land in THEIR inbox, not just WebCrew's internal one. The
  // internal address always stays cc'd too, since this path has never been
  // exercised against a real paying client yet — keep visibility until proven.
  const clientContact = config.lead_id ? await getLeadContact(config.lead_id) : null
  const recipients = clientContact?.email
    ? [clientContact.email, internalEmail]
    : [internalEmail]

  const isEscalation = type === 'escalation'
  const title = isEscalation
    ? `🚨 Escalation — ${config.business_name}`
    : `🔔 New Lead — ${args.caller_name ?? 'Unknown'} | ${config.business_name}`

  const lines: string[] = []
  if (isEscalation) {
    lines.push(`Caller needs human help immediately.`)
    if (args.reason)    lines.push(`Reason: ${args.reason}`)
    if (callerPhone)    lines.push(`Caller phone: ${callerPhone}`)
  } else {
    if (args.caller_name)  lines.push(`Name: ${args.caller_name}`)
    if (args.caller_phone || callerPhone) lines.push(`Phone: ${args.caller_phone ?? callerPhone}`)
    if (args.caller_email) lines.push(`Email: ${args.caller_email}`)
    if (args.message)      lines.push(`\nNotes: ${args.message}`)
  }
  if (extra?.actionUrl) lines.push(`\nMark as contacted (one tap): ${extra.actionUrl}`)
  const body = lines.join('\n')

  // 1. ntfy.sh push notification (free, instant to phone)
  if (ntfyTopic) {
    fetch(`https://ntfy.sh/${ntfyTopic}`, {
      method: 'POST',
      headers: { Title: title, Priority: isEscalation ? 'urgent' : 'default', Tags: isEscalation ? 'rotating_light' : 'bell' },
      body,
    }).then(r => r.ok ? console.log('[Relay] ntfy push sent') : console.warn('[Relay] ntfy push failed'))
      .catch(e => console.warn('[Relay] ntfy error:', e.message))
  }

  // 1.5. Real SMS to the client's own phone — the "instant SMS alert" the
  // pricing page promises. ntfy above requires the client to have installed
  // a third-party app; this is the actual guaranteed channel.
  const smsSid  = process.env.TWILIO_ACCOUNT_SID
  const smsAuth = process.env.TWILIO_AUTH_TOKEN
  const smsFrom = process.env.TWILIO_FROM_NUMBER ?? process.env.TWILIO_PHONE_NUMBER
  if (clientContact?.phone && smsSid && smsAuth && smsFrom) {
    const smsBody = isEscalation
      ? `WebCrew: caller needs help now on ${config.business_name}'s line${callerPhone ? ` (${callerPhone})` : ''}.${args.reason ? ` Reason: ${args.reason}` : ''}`
      : `WebCrew: new lead for ${config.business_name} — ${args.caller_name ?? 'caller'}${(args.caller_phone ?? callerPhone) ? `, ${args.caller_phone ?? callerPhone}` : ''}. ${extra?.actionUrl ? `Mark contacted: ${extra.actionUrl}` : 'Check email for details.'}`
    fetch(`https://api.twilio.com/2010-04-01/Accounts/${smsSid}/Messages.json`, {
      method:  'POST',
      headers: {
        Authorization:  `Basic ${Buffer.from(`${smsSid}:${smsAuth}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: smsFrom, To: clientContact.phone, Body: smsBody }).toString(),
    }).then(r => r.ok ? console.log(`[Relay] Owner SMS sent to ${clientContact.phone}`) : console.warn('[Relay] Owner SMS failed'))
      .catch(e => console.warn('[Relay] Owner SMS error:', e.message))
  }

  // 2. Resend email notification (free tier 3k/month)
  if (resendKey) {
    fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        from,
        to:      recipients,
        subject: title,
        text:    body,
      }),
    }).then(r => r.ok ? console.log(`[Relay] Owner email sent to ${recipients.join(', ')}`) : console.warn('[Relay] Owner email failed'))
      .catch(e => console.warn('[Relay] Owner email error:', e.message))
  } else {
    console.warn('[Relay] Owner notification skipped — RESEND_API_KEY not set')
  }
}

// ─── Caller confirmation SMS ──────────────────────────────────────────────────

export async function sendCallerConfirmationSMS(toPhone: string, callerName: string, businessName: string): Promise<boolean> {
  const sid  = process.env.TWILIO_ACCOUNT_SID
  const auth = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER ?? process.env.TWILIO_PHONE_NUMBER
  if (!sid || !auth || !from) { console.warn('[Relay] Caller SMS skipped — Twilio creds missing'); return false }

  const body = `Hi ${callerName}, this is ${businessName}. Thanks for speaking with our AI receptionist — we've saved your request and next steps. Reply here anytime with questions. Reply STOP to opt out or HELP for help. – ${businessName}`
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method:  'POST',
      headers: {
        Authorization:  `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: toPhone, Body: body }).toString(),
    })
    if (res.ok) { console.log(`[Relay] Caller SMS sent to ${toPhone}`); return true }
    const e = await res.json() as any
    console.warn(`[Relay] Caller SMS failed: ${e?.message}`)
    return false
  } catch (e: any) {
    console.warn(`[Relay] Caller SMS error: ${e.message}`)
    return false
  }
}

// ─── Booking confirmation SMS ──────────────────────────────────────────────────
// Fires right after a real Cal.com booking succeeds, while the caller is still
// on the line — the point is proof-of-real: they see a text land with the
// actual booked time before they've even hung up.

export async function sendBookingConfirmationSMS(
  toPhone: string,
  callerName: string,
  startISO: string,
  meetingUrl: string | null | undefined,
  timezone: string,
  businessName: string
): Promise<boolean> {
  const sid  = process.env.TWILIO_ACCOUNT_SID
  const auth = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER ?? process.env.TWILIO_PHONE_NUMBER
  if (!sid || !auth || !from) { console.warn('[Relay] Booking SMS skipped — Twilio creds missing'); return false }

  const when = new Date(startISO).toLocaleString('en-US', {
    timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
  const body = `Hi ${callerName}, you're booked for ${when}.${meetingUrl ? ` Details: ${meetingUrl}` : ''} Reply STOP to unsubscribe or HELP for help. – ${businessName}`
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method:  'POST',
      headers: {
        Authorization:  `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: toPhone, Body: body }).toString(),
    })
    if (res.ok) { console.log(`[Relay] Booking confirmation SMS sent to ${toPhone}`); return true }
    const e = await res.json() as any
    console.warn(`[Relay] Booking SMS failed: ${e?.message}`)
    return false
  } catch (e: any) {
    console.warn(`[Relay] Booking SMS error: ${e.message}`)
    return false
  }
}

// ─── Caller confirmation email ────────────────────────────────────────────────

export async function sendCallerConfirmationEmail(toEmail: string, callerName: string, businessName: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.OUTREACH_FROM_EMAIL ?? 'hello@webcrew.app'
  if (!key) { console.warn('[Relay] Email confirmation skipped — RESEND_API_KEY missing'); return false }

  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0a0a0a;color:#fff;padding:40px 20px;">
<div style="max-width:520px;margin:0 auto;background:#111827;border-radius:12px;padding:32px 36px;border:1px solid rgba(255,255,255,0.08);">
  <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:2px;text-transform:uppercase;">${businessName}</p>
  <h2 style="margin:0 0 20px;font-size:22px;font-weight:800;">We received your request</h2>
  <p style="color:rgba(255,255,255,0.75);line-height:1.7;">Hey ${callerName},</p>
  <p style="color:rgba(255,255,255,0.75);line-height:1.7;">Thanks for speaking with our AI receptionist. We've saved your request and the next steps discussed on the call.</p>
  <p style="color:rgba(255,255,255,0.75);line-height:1.7;">A ${businessName} team member will follow up to help with your needs.</p>
  <p style="margin-top:28px;color:rgba(255,255,255,0.5);font-size:13px;">Questions? Reply to this email or text us at the number you just called.<br>— The ${businessName} Team</p>
</div></body></html>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        from,
        to:      [toEmail],
        subject: `We received your ${businessName} request`,
        html,
      }),
    })
    if (res.ok) { console.log(`[Relay] Confirmation email sent to ${toEmail}`); return true }
    const e = await res.json() as any
    console.warn(`[Relay] Confirmation email failed: ${e?.message}`)
    return false
  } catch (e: any) {
    console.warn(`[Relay] Confirmation email error: ${e.message}`)
    return false
  }
}

// ─── Call transcript + summary — sent after every real completed call ────────
// "message"/"escalation" notifyOwner already covers calls where a lead was
// captured or a transfer requested; this covers the rest (questions answered,
// no action needed, caller hung up) so every completed call gets a summary,
// not just the ones that produced a lead.

const CALL_INSIGHTS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary:   { type: 'STRING' },
    sentiment: { type: 'STRING', enum: ['positive', 'neutral', 'negative'] },
  },
  required: ['summary', 'sentiment'],
}

/** One structured Gemini call producing both the summary (emailed + persisted) and a sentiment tag (persisted only). */
export async function generateCallInsights(transcript: string): Promise<{ summary: string; sentiment: 'positive' | 'neutral' | 'negative' } | null> {
  try {
    const raw = await geminiText(
      `Analyze this phone call transcript for the business owner. Provide a 2-3 sentence factual summary (what the caller wanted, what was resolved or promised, whether follow-up is needed — no speculation) and an overall caller sentiment.\n\nTranscript:\n${transcript || '(no speech detected)'}`,
      { model: GEMINI_FLASH, responseMimeType: 'application/json', responseSchema: CALL_INSIGHTS_SCHEMA }
    )
    const parsed = JSON.parse(raw)
    if (typeof parsed.summary === 'string' && ['positive', 'neutral', 'negative'].includes(parsed.sentiment)) {
      return { summary: parsed.summary, sentiment: parsed.sentiment }
    }
    return null
  } catch (e: any) {
    console.warn('[Relay] Call insights generation failed:', e.message)
    return null
  }
}

export async function sendCallSummary(
  config: ReceptionConfig,
  callerPhone: string | null,
  summary: string,
  transcript: string,
  durationSec: number,
  actionUrl?: string
): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY
  const from      = process.env.OUTREACH_FROM_EMAIL ?? 'hello@webcrew.app'
  const internalEmail = process.env.OWNER_NOTIFY_EMAIL ?? 'pavan.harati@gmail.com'
  if (!resendKey) { console.warn('[Relay] Call summary skipped — RESEND_API_KEY not set'); return }

  const clientContact = config.lead_id ? await getLeadContact(config.lead_id) : null
  const recipients = clientContact?.email ? [clientContact.email, internalEmail] : [internalEmail]

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        from,
        to:      recipients,
        subject: `Call summary — ${config.business_name} (${Math.round(durationSec / 60) || 1} min)`,
        text:    `Caller: ${callerPhone ?? 'unknown'}\nDuration: ${durationSec}s\n\nSummary:\n${summary}${actionUrl ? `\n\nThis caller wasn't followed up on. Mark as contacted (one tap): ${actionUrl}` : ''}\n\nFull transcript:\n${transcript || '(no speech detected)'}`,
      }),
    })
    if (res.ok) console.log(`[Relay] Call summary sent to ${recipients.join(', ')}`)
    else console.warn('[Relay] Call summary email failed')
  } catch (e: any) {
    console.warn('[Relay] Call summary email error:', e.message)
  }
}

// ─── Call-triggered trial checkout ────────────────────────────────────────────
// Created directly from this Node process rather than proxying through the
// Cloudflare Worker (api/src/index.ts) — mirrors this repo's existing pattern
// of duplicating small, stable business logic across the Worker/Node split
// (see plan-catalog.ts's own comment on why PLAN_CATALOG is copied, not
// shared). pipeline/.env already has the matching STRIPE_SECRET_KEY (test
// mode), so no new secret is needed, and this avoids a live-call-path
// dependency on the Worker being up.

const TRIAL_PLAN_KEY = 'ai_front_office' as const
const TRIAL_DAYS = RECEPTION_OFFER.trialDays

export async function createTrialCheckoutLink(leadId: string, leadName: string): Promise<string | null> {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) { console.error('[Relay] STRIPE_SECRET_KEY not set — cannot create trial checkout link'); return null }

  const plan = PLAN_CATALOG[TRIAL_PLAN_KEY]
  const appEnv = process.env.APP_ENV === 'qa' ? 'qa' : 'production'
  const publicSiteUrl = (process.env.PUBLIC_SITE_URL ?? 'https://webcrew.app').replace(/\/$/, '')
  const p = new URLSearchParams()
  p.set('mode', 'subscription')
  p.set('metadata[lead_id]', leadId)
  p.set('metadata[plan]', TRIAL_PLAN_KEY)
  p.set('metadata[environment]', appEnv)
  p.set('success_url', `${publicSiteUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}`)
  p.set('cancel_url', publicSiteUrl)
  p.set('line_items[0][price_data][currency]', 'usd')
  p.set('line_items[0][price_data][product_data][name]', `WebCrew ${plan.name} — ${leadName}`)
  p.set('line_items[0][price_data][unit_amount]', String(plan.price))
  p.set('line_items[0][price_data][recurring][interval]', 'month')
  p.set('line_items[0][quantity]', '1')
  p.set('subscription_data[trial_period_days]', String(TRIAL_DAYS))
  p.set('subscription_data[metadata][lead_id]', leadId)
  p.set('subscription_data[metadata][plan]', TRIAL_PLAN_KEY)
  p.set('subscription_data[metadata][environment]', appEnv)

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method:  'POST',
      headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    p.toString(),
    })
    const session = await res.json() as any
    if (!res.ok || !session.url) {
      console.error(`[Relay] Trial checkout session failed: ${session.error?.message ?? res.status}`)
      return null
    }
    return session.url as string
  } catch (e: any) {
    console.error('[Relay] Trial checkout session error:', e.message)
    return null
  }
}

export async function sendTrialCheckoutSMS(toPhone: string, checkoutUrl: string): Promise<boolean> {
  const sid  = process.env.TWILIO_ACCOUNT_SID
  const auth = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER ?? process.env.TWILIO_PHONE_NUMBER
  if (!sid || !auth || !from) { console.warn('[Relay] Trial checkout SMS skipped — Twilio creds missing'); return false }

  const shortUrl = await createShortLink(checkoutUrl)
  const body = `Hi, this is WebCrew. Start your free trial here (card required, nothing charged until the trial ends): ${shortUrl} Reply STOP to opt out. – WebCrew`
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method:  'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({ From: from, To: toPhone, Body: body }).toString(),
    })
    if (res.ok) { console.log(`[Relay] Trial checkout SMS sent to ${toPhone}`); return true }
    const e = await res.json() as any
    console.warn(`[Relay] Trial checkout SMS failed: ${e?.message}`)
    return false
  } catch (e: any) {
    console.warn('[Relay] Trial checkout SMS error:', e.message)
    return false
  }
}

/**
 * The relays push one transcript line per speech fragment ("AI: Thanks for", "AI:  calling"…). Merge
 * consecutive fragments from the same speaker so stored transcripts and summary emails read as sentences.
 */
export function mergeTranscript(lines: string[]): string {
  const out: string[] = []
  let who: string | null = null
  for (const line of lines) {
    const m = line.match(/^(AI|Caller|Visitor): ?([\s\S]*)$/)
    if (!m) { out.push(line); who = null; continue }
    if (who === m[1] && out.length) out[out.length - 1] += m[2]
    else { out.push(`${m[1]}: ${m[2]}`); who = m[1] }
  }
  return out.map(l => l.replace(/[ \t]+/g, ' ').trim()).join('\n')
}
