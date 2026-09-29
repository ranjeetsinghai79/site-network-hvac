export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { logLeadEventByPhone, getDb } from '@/lib/db'

// Validate Twilio's X-Twilio-Signature so forged POSTs can't drive our
// auto-reply (which would send SMS to an attacker-chosen number = toll fraud).
async function validTwilioSig(req: NextRequest, url: string, params: URLSearchParams): Promise<boolean> {
  if (process.env.SKIP_TWILIO_VALIDATION === 'true') return true
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) return true // not configured — fail open so setup isn't blocked
  const signature = req.headers.get('x-twilio-signature')
  if (!signature) return false
  const keys = [...params.keys()].sort()
  let data = url
  for (const k of keys) data += k + (params.get(k) ?? '')
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)))
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  return diff === 0
}

const CALENDLY = 'https://calendly.com/ranjeetsinghai79/30min'

const AUTO_REPLIES: Record<string, string> = {
  'how much':     `WebCrew: $0 for the demo site — you only pay $299 if you love it. $49/mo for AI reception + Google management. Book 5 min call: ${CALENDLY}`,
  'price':        `WebCrew: Demo = FREE. Keep it: $299 once. AI team (calls + Google + reviews): $49/mo. Chat now: ${CALENDLY}`,
  'interested':   `WebCrew: Excellent! Let's set it up. Book a quick call: ${CALENDLY} — takes 5 min.`,
  'yes':          `WebCrew: Let's go! Book here: ${CALENDLY} — I'm open 9–6 PST.`,
  'call':         `WebCrew: Book here: ${CALENDLY} — pick a time that works, I'm open 9–6 PST.`,
  'info':         `WebCrew: We build free demo sites overnight + AI reception that answers calls 24/7. $49/mo. See yours: ${CALENDLY}`,
  'lead generation': `WebCrew: Yes — AI reception captures every call as a lead + sends you SMS alerts. Details: ${CALENDLY}`,
  'ads':          `WebCrew: We focus on organic (Google Business Profile + reviews + SEO) for free. Paid ads add-on available. Book: ${CALENDLY}`,
}

function getAutoReply(body: string): string | null {
  const lower = body.toLowerCase()
  for (const [trigger, reply] of Object.entries(AUTO_REPLIES)) {
    if (lower.includes(trigger)) return reply
  }
  return null
}

async function sendSms(to: string, body: string, from: string, accountSid: string, authToken: string) {
  await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    }
  )
}

// Twilio sends POST with application/x-www-form-urlencoded
export async function POST(req: NextRequest) {
  const text   = await req.text()
  const params = new URLSearchParams(text)

  if (!await validTwilioSig(req, req.url, params)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const messageSid    = params.get('MessageSid') ?? ''
  const msgStatus     = params.get('MessageStatus') ?? params.get('SmsStatus') ?? ''
  const from          = params.get('From') ?? ''
  const to            = params.get('To') ?? ''
  const body          = params.get('Body') ?? ''
  const errorCode     = params.get('ErrorCode') ?? ''

  // ── Delivery status callback (outbound) ──────────────────────────────────
  if (msgStatus && !body) {
    const eventType = msgStatus === 'delivered'   ? 'sms_delivered'
                    : msgStatus === 'failed'       ? 'sms_failed'
                    : msgStatus === 'undelivered'  ? 'sms_undelivered'
                    : null
    if (eventType) {
      await logLeadEventByPhone(to, eventType, { sid: messageSid, error: errorCode || undefined })
        .catch(() => {})
    }
    return new NextResponse('<?xml version="1.0"?><Response/>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  // ── Inbound reply ─────────────────────────────────────────────────────────
  if (from && body) {
    const leadId = await logLeadEventByPhone(from, 'sms_reply', { body, sid: messageSid })
      .catch(() => null)

    // Mark lead as conversation_active
    if (leadId) {
      const db = await getDb()
      await db.query(
        `UPDATE leads SET status = 'conversation_active' WHERE id = $1 AND status = 'outreach_sent'`,
        [leadId]
      ).catch(() => {})
    }

    // Auto-reply
    const reply = getAutoReply(body)
    const accountSid = process.env.TWILIO_ACCOUNT_SID ?? ''
    const authToken  = process.env.TWILIO_AUTH_TOKEN  ?? ''

    if (reply && accountSid && authToken) {
      await sendSms(from, reply, to, accountSid, authToken).catch(() => {})
      if (leadId) {
        const db = await getDb()
        await db.query(
          `INSERT INTO lead_events (lead_id, event_type, detail) VALUES ($1, 'sms_auto_reply', $2)`,
          [leadId, JSON.stringify({ body: reply })]
        ).catch(() => {})
      }
    }

    return new NextResponse('<?xml version="1.0"?><Response/>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  return new NextResponse('<?xml version="1.0"?><Response/>', {
    headers: { 'Content-Type': 'text/xml' },
  })
}
