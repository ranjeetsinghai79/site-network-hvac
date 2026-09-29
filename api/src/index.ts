/**
 * Webcrew API — Cloudflare Worker
 * Deploy: cd api && npx wrangler deploy
 * Domain: api.webcrew.app
 *
 * Routes:
 *   POST /leads          — contact form submissions from all deployed sites
 *   POST /sms/reply      — Twilio inbound SMS webhook + Gemini reply agent
 *   GET  /hitl           — HITL approval page (Ranjeet reviews + sends demo link)
 *   POST /hitl/send      — sends demo SMS + email to lead after approval
 *   GET  /health         — uptime check
 */

export interface Env {
  RESEND_API_KEY: string
  TWILIO_ACCOUNT_SID: string
  TWILIO_AUTH_TOKEN: string
  TWILIO_FROM_NUMBER: string
  LEADS_SHEET_ID: string
  GOOGLE_SERVICE_ACCOUNT_JSON: string
  NOTIFICATION_EMAIL: string       // pavan.harati@gmail.com
  CALENDLY_URL: string
  HITL_SECRET?: string             // shared secret for approval links (set via wrangler secret)
  NEON_DATABASE_URL?: string
  DATABASE_URL?: string
  VERTEX_PROJECT_ID?: string
  VERTEX_CREDITS_PROJECT_ID?: string
  VERTEX_SERVICE_ACCOUNT_JSON?: string
  GOOGLE_AI_API_KEY?: string       // fallback only — prefer GOOGLE_SERVICE_ACCOUNT_JSON + Vertex AI
  RECEPTION_SERVER_URL?: string
  RECEPTION_PROVISION_SECRET?: string
  CAL_WEBHOOK_SECRET?: string
  GOOGLE_REVIEW_URL_TEMPLATE?: string  // e.g. "https://g.page/r/{placeId}/review"
  SKIP_TWILIO_VALIDATION?: string      // set to 'true' only to bypass signature check (debug)
  STRIPE_SECRET_KEY?: string           // Sofia's own key — set via `wrangler secret put`, start with pipeline's sk_test_ key, NOT admin's live key
  CAL_DIY_API_KEY?: string             // Cal.com v2 API key — same account as voice reception's cal-booking.ts
  CAL_EVENT_TYPE_ID?: string           // defaults to the same event type voice reception uses (6126925)
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException?(): void
}

const VOICE_SYSTEM_PROMPT = `You are WebCrew's friendly AI receptionist. Solve the caller's immediate problem first. Learn their name, business, biggest missed-call or follow-up pain, and desired next step. Explain only the WebCrew capability relevant to that pain. Ask one short question at a time. Never pressure the caller. Keep every spoken response under 160 characters.`

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function encodeVoiceHistory(history: ChatMessage[]): string {
  const bytes = new TextEncoder().encode(JSON.stringify(history.slice(-8)))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeVoiceHistory(value: string | null): ChatMessage[] {
  if (!value) return []
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const parsed = JSON.parse(new TextDecoder().decode(bytes))
    return Array.isArray(parsed) ? parsed.slice(-8) : []
  } catch { return [] }
}

async function handleInboundVoice(req: Request, env: Env, configId: string, mode: 'inbound' | 'overflow' | 'outbound' = 'inbound'): Promise<Response> {
  const form = new URLSearchParams(await req.text())
  if (!(await validateTwilioSignature(env, req, form))) {
    return new Response('Invalid signature', { status: 403 })
  }

  const safeConfig = configId.replace(/[^a-zA-Z0-9_-]/g, '')
  const action = `https://api.webcrew.app/voice/continue/${safeConfig}?step=0`
  const leadName = new URL(req.url).searchParams.get('leadName')?.slice(0, 80) ?? ''
  const opening = mode === 'overflow'
    ? 'I am sorry for the brief delay. You reached WebCrew&apos;s recovery assistant. What were you calling about?'
    : mode === 'outbound'
      ? `Hi${leadName ? ` ${xmlEscape(leadName)}` : ''}, this is WebCrew&apos;s AI assistant following up about helping your business capture more leads. Is now a good time for one quick question?`
      : 'Hi, you reached WebCrew&apos;s AI receptionist. What would you like help solving in your business today?'
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" speechTimeout="auto" timeout="5" action="${xmlEscape(action)}" method="POST">
    <Say voice="Polly.Joanna-Neural">${opening}</Say>
  </Gather>
  <Say voice="Polly.Joanna-Neural">I did not hear a response. Please call back anytime. We are available twenty four seven.</Say>
</Response>`

  return new Response(twiml, { headers: { 'Content-Type': 'text/xml; charset=utf-8' } })
}

async function handleOutboundCall(req: Request, env: Env): Promise<Response> {
  if (!env.RECEPTION_PROVISION_SECRET || req.headers.get('Authorization') !== `Bearer ${env.RECEPTION_PROVISION_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  const payload = await req.json() as { to?: string; configId?: string; leadName?: string }
  if (!payload.to || !payload.configId) return new Response(JSON.stringify({ error: 'to and configId required' }), { status: 400 })

  const voiceUrl = new URL(`https://api.webcrew.app/voice/outbound/${encodeURIComponent(payload.configId)}`)
  if (payload.leadName) voiceUrl.searchParams.set('leadName', payload.leadName)
  const statusUrl = new URL('https://api.webcrew.app/call-status')
  statusUrl.searchParams.set('configId', payload.configId)
  statusUrl.searchParams.set('biz', 'WebCrew')
  statusUrl.searchParams.set('flow', 'outbound_outreach')
  const params = new URLSearchParams({
    To: payload.to,
    From: env.TWILIO_FROM_NUMBER,
    Url: voiceUrl.toString(),
    Method: 'POST',
    StatusCallback: statusUrl.toString(),
    StatusCallbackMethod: 'POST',
    StatusCallbackEvent: 'initiated ringing answered completed',
    MachineDetection: 'Enable',
  })
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  const result: any = await response.json()
  return new Response(JSON.stringify(response.ok ? { ok: true, callSid: result.sid, status: result.status } : { ok: false, error: result.message }), {
    status: response.ok ? 200 : response.status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function handleVoiceContinue(req: Request, env: Env, configId: string, url: URL): Promise<Response> {
  const form = new URLSearchParams(await req.text())
  if (!(await validateTwilioSignature(env, req, form))) return new Response('Invalid signature', { status: 403 })

  const speech = (form.get('SpeechResult') ?? '').trim()
  const step = Math.min(Number(url.searchParams.get('step') ?? '0') || 0, 6)
  const history = decodeVoiceHistory(url.searchParams.get('history'))
  const done = step >= 5 || /\b(goodbye|bye|that is all|that's all|no thank you)\b/i.test(speech)
  const reply = speech
    ? (await geminiSMSReply(env, VOICE_SYSTEM_PROMPT, history, speech).catch(() => null))?.reply ?? ''
    : 'I did not catch that. Could you say it once more?'
  const spoken = reply || 'I can help with missed calls, lead follow-up, and appointment booking. What is the biggest problem you want to solve?'
  const nextHistory = [...history, { role: 'user' as const, text: speech }, { role: 'model' as const, text: spoken }]

  if (done) {
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna-Neural">${xmlEscape(spoken)} Thank you for calling WebCrew. We will follow up shortly.</Say><Hangup/></Response>`, { headers: { 'Content-Type': 'text/xml; charset=utf-8' } })
  }

  const action = `https://api.webcrew.app/voice/continue/${configId}?step=${step + 1}&history=${encodeURIComponent(encodeVoiceHistory(nextHistory))}`
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" speechTimeout="auto" timeout="6" action="${xmlEscape(action)}" method="POST">
    <Say voice="Polly.Joanna-Neural">${xmlEscape(spoken)}</Say>
  </Gather>
  <Say voice="Polly.Joanna-Neural">Thank you for calling WebCrew. We will follow up shortly.</Say>
</Response>`
  return new Response(twiml, { headers: { 'Content-Type': 'text/xml; charset=utf-8' } })
}

// ─── Twilio webhook signature validation ────────────────────────────────────
// Without this, anyone can POST forged inbound SMS / call-status events to our
// public webhooks — triggering auto-replies (SMS toll fraud), fake build
// requests, and Gemini calls (cost). Twilio signs each request:
//   signature = base64( HMAC-SHA1( authToken, fullUrl + sorted(key+value)... ) )
async function validateTwilioSignature(env: Env, req: Request, params: URLSearchParams): Promise<boolean> {
  if (env.SKIP_TWILIO_VALIDATION === 'true') return true
  const authToken = env.TWILIO_AUTH_TOKEN
  if (!authToken) return true // not configured yet — fail open so setup isn't blocked

  const signature = req.headers.get('X-Twilio-Signature')
  if (!signature) return false

  // Reconstruct the exact URL Twilio signed. Behind Cloudflare this is the
  // public https URL; strip any cf/query noise Twilio would not have signed
  // for a form POST (Twilio signs the URL exactly as configured).
  const url = req.url

  const keys = [...params.keys()].sort()
  let data = url
  for (const k of keys) data += k + (params.get(k) ?? '')

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)))

  // constant-time-ish compare
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  return diff === 0
}

// ─── Contact form lead ────────────────────────────────────────────────────

interface ContactLead {
  firstName: string
  lastName?: string
  phone?: string
  email?: string
  currentWebsite?: string
  service?: string
  message?: string
  source: string
  businessName: string
  businessNiche: string
  businessOwnerPhone?: string   // injected by builder from lead data
  businessOwnerEmail?: string   // injected by builder from lead data
  submittedAt: string
  smsConsent?: boolean
  consentTimestamp?: string
  consentLanguage?: string
  painPoints?: string
  missedCalls?: string
  urgency?: string
  additionalNotes?: string
  referredBy?: string   // affiliate referral_code captured client-side from ?ref=
  templateStyle?: string   // 'editorial' | 'zigzag' — self-serve style picker, see missed-call-landing.tsx
  city?: string
  state?: string
  googleMapsLink?: string  // raw share-link, parsed to lat/lng in resolveMapsLatLng() before storage
  interestOnly?: boolean   // true = "add AI to my existing site" widget lead — capture + sales follow-up only, never auto-build a new site (see missed-call-landing.tsx's "keep my site" path)
  previewConfigId?: string  // reception_configs.id of the "paste your URL" preview they claimed — tracking only, see website-preview-landing.tsx
}

// sms_conversations is keyed by exact-string phone match against Twilio's
// `From` on inbound replies, which is always strict E.164 — unlike leads.phone
// lookups elsewhere (which compare last-10-digits via regexp, tolerant of
// format), this key must be normalized up front or a form-typed number like
// "(415) 606-0079" will never match the reply and Sofia can never pin it.
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10 ? `+1${digits.slice(-10)}` : phone
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// Dropdown labels read fine in a table cell but break grammar mid-sentence
// ("You told us that Not getting enough qualified leads."). This gives each
// pain point a real clause for prose use in the prospect-facing email.
const PAIN_SENTENCES: Record<string, string> = {
  'Missing calls while on jobs': 'calls are slipping through while your team is out on jobs',
  'Calls going unanswered after hours': 'calls are going unanswered after hours',
  'Slow lead follow-up': 'follow-up on new leads is too slow',
  'Not qualifying callers before booking': "callers aren't getting qualified before they land on your calendar",
  'Too much time spent answering repeat questions': 'your team spends too much time answering the same questions',
  'Leads disappearing before they schedule': 'leads keep disappearing before they schedule',
  "Don't have a website yet": "there's no website to send customers to yet",
}

function titleCase(value: string): string {
  return value.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1))
}

function prepareLeadValuePlan(lead: ContactLead) {
  const selectedPain = lead.painPoints?.trim() || ''
  const prospectNotes = lead.additionalNotes?.replace(/\s+/g, ' ').trim() || ''
  // "Other" is a form control, not a useful description. Reflect the prospect's
  // own explanation when they supplied one, and fall back gracefully if not.
  const pain = selectedPain === 'Other'
    ? (prospectNotes.slice(0, 500) || 'a business challenge that needs a closer look')
    : (selectedPain || 'the pressure points in your front office')
  const painSentence = selectedPain === 'Other'
    ? (prospectNotes.slice(0, 300) || 'something specific is getting in the way')
    : (PAIN_SENTENCES[selectedPain] || 'the pressure points in your front office are costing you business')
  const plans: Record<string, { recommendation: string; firstValue: string; nextQuestion: string }> = {
    "Don't have a website yet": {
      recommendation: 'Get a real website live fast, then layer an AI receptionist on top so every visitor and every call gets captured, not just the ones who happen to find you.',
      firstValue: "Pick your style below and tell us about your business — we'll have a live site ready to look at, no cost or obligation.",
      nextQuestion: 'Which style fits your business better — bold and editorial, or clean and professional?',
    },
    'Missing calls while on jobs': {
      recommendation: 'Route unanswered calls to an AI receptionist that qualifies the caller and protects your focus while you are working.',
      firstValue: 'Start by listing the five questions every new caller asks. Those answers become the first version of your reception playbook.',
      nextQuestion: 'Which calls are most valuable—and which ones interrupt your team without becoming real jobs?',
    },
    'Calls going unanswered after hours': {
      recommendation: 'Add after-hours answering, qualification and next-day booking so good callers do not reach a competitor first.',
      firstValue: 'Review the last two weeks of calls by hour. That quickly shows the window where revenue is leaking.',
      nextQuestion: 'What should happen when an urgent caller reaches you after hours?',
    },
    'Slow lead follow-up': {
      recommendation: 'Respond immediately, preserve the conversation context and keep following up until the lead books or clearly declines.',
      firstValue: 'Measure the minutes between each new enquiry and the first useful response. That is the first number we should improve.',
      nextQuestion: 'Where do new enquiries arrive today—phone, forms, text, email or several places?',
    },
    'Not qualifying callers before booking': {
      recommendation: 'Use a short qualification flow before showing appointment options, so the calendar contains better opportunities.',
      firstValue: 'Write down the three facts that decide whether a caller is a strong fit. We can turn those into a consistent call flow.',
      nextQuestion: 'What must be true before a caller deserves time on your calendar?',
    },
    'Too much time spent answering repeat questions': {
      recommendation: 'Build a living business knowledge base so routine questions are answered consistently while unusual cases reach a person.',
      firstValue: 'Collect the ten questions your team repeats most. Automating those creates the fastest time savings.',
      nextQuestion: 'Which repeated question consumes the most time or creates the most confusion?',
    },
    'Leads disappearing before they schedule': {
      recommendation: 'Use context-aware follow-up and a simple booking handoff that removes delay and makes the next step obvious.',
      firstValue: 'Check where the last ten interested leads stopped responding. The common stopping point usually reveals the first workflow to fix.',
      nextQuestion: 'What normally happens between a prospect saying “interested” and receiving a confirmed appointment?',
    },
  }
  const selected = plans[selectedPain] ?? {
    recommendation: 'Map the customer journey first, then automate the highest-friction handoff without forcing your business into a generic workflow.',
    firstValue: 'Describe one recent customer you should have won but lost. That story usually reveals the best first automation.',
    nextQuestion: 'If we fixed one part of the business this month, which result would matter most?',
  }
  return { pain, painSentence, ...selected }
}

// ─── Resend email ─────────────────────────────────────────────────────────

async function sendEmail(env: Env, to: string, subject: string, html: string): Promise<void> {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'WebCrew <leads@webcrew.app>',
      reply_to: 'leads@webcrew.app',
      to,
      subject,
      html,
    }),
  })
}

// ─── Twilio SMS ───────────────────────────────────────────────────────────

async function sendSms(env: Env, to: string, body: string, fromOverride?: string): Promise<void> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_FROM_NUMBER) return
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`
  const fromNumber = fromOverride || env.TWILIO_FROM_NUMBER
  // Twilio requires From and To to be on the same channel — a bare SMS From
  // with a `whatsapp:`-prefixed To (or vice versa) is rejected outright.
  const from = to.startsWith('whatsapp:') ? `whatsapp:${fromNumber}` : fromNumber
  const params = new URLSearchParams({ To: to, From: from, Body: body })
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })
}

// Neon SQL-over-HTTP: POST https://<endpoint-host>/sql with Neon-Connection-String header.
// Response: { rows: [...], rowCount, command }
async function neonQuery(env: Env, query: string, params: unknown[] = []): Promise<any | null> {
  const cs = env.DATABASE_URL || env.NEON_DATABASE_URL
  if (!cs) return null
  try {
    const host = cs.replace(/^postgres(ql)?:\/\/[^@]+@/, '').split('/')[0].split('?')[0]
    const res = await fetch(`https://${host}/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Neon-Connection-String': cs,
      },
      body: JSON.stringify({ query, params }),
    })
    if (!res.ok) {
      console.error(`[Neon] HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
      return null
    }
    return await res.json()
  } catch (e: any) {
    console.error(`[Neon] fetch error: ${e?.message ?? e}`)
    return null
  }
}

// Short-link redirect for SMS-texted URLs (Stripe checkout links are long).
// TTL matches Stripe Checkout Session's own default 24h expiry — a stale
// short link should die with the session it points at. Falls back to the
// original long URL if the DB write fails, so a Neon hiccup never blocks
// a real send.
async function createShortLink(env: Env, targetUrl: string): Promise<string> {
  const code = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
  const result = await neonQuery(
    env,
    `INSERT INTO short_links (code, target_url, expires_at) VALUES ($1, $2, NOW() + interval '24 hours') RETURNING code`,
    [code, targetUrl]
  )
  if (!result?.rows?.[0]) return targetUrl
  return `https://api.webcrew.app/s/${code}`
}

async function handleShortLinkRedirect(code: string, env: Env): Promise<Response> {
  if (!/^[a-f0-9]{8}$/.test(code)) return new Response('Not found', { status: 404 })
  const result = await neonQuery(
    env,
    `SELECT target_url FROM short_links WHERE code = $1 AND expires_at > NOW()`,
    [code]
  )
  const targetUrl = result?.rows?.[0]?.target_url
  if (!targetUrl) {
    return new Response('This link has expired. Please ask WebCrew to send a new one.', { status: 410 })
  }
  return new Response(null, { status: 302, headers: { Location: targetUrl } })
}

// Canonical "can I text this number right now" check — every outbound SMS
// send site in this file should call this before sending. Two consent
// mechanisms exist (consent_events.revoked_at, set by inbound-reply/form
// capture; leads.sms_opt_out, set only by the STOP handler below) and they
// can desync — a number can show active consent_events while
// leads.sms_opt_out=true. Always require both. Fail-closed on any DB error.
async function canTextNow(env: Env, phone: string): Promise<boolean> {
  const res = await neonQuery(env, `
    SELECT
      NOT EXISTS (
        SELECT 1 FROM leads
        WHERE (RIGHT(regexp_replace(phone,'\\D','','g'),10) = RIGHT(regexp_replace($1,'\\D','','g'),10)
            OR RIGHT(regexp_replace(international_phone,'\\D','','g'),10) = RIGHT(regexp_replace($1,'\\D','','g'),10))
          AND sms_opt_out = TRUE
      )
      AND EXISTS (
        SELECT 1 FROM consent_events
        WHERE channel = 'sms' AND revoked_at IS NULL
          AND RIGHT(regexp_replace(contact,'\\D','','g'),10) = RIGHT(regexp_replace($1,'\\D','','g'),10)
      ) AS can_text
  `, [phone])
  return res?.rows?.[0]?.can_text === true
}

// Per-IP throttle for public unauthenticated endpoints (/leads, /audit).
// Both accept attacker-controlled fields with real-money side effects —
// /leads sends a real SMS to any `businessOwnerPhone` in the request body
// with no consent gate (it's meant to be the demo site's real owner,
// injected server-side, but nothing stops a direct POST from supplying an
// arbitrary number), /audit triggers real PageSpeed/Firecrawl API calls.
// Fails open on a DB error — a Neon hiccup should never block a real lead.
async function isRateLimited(env: Env, req: Request, endpoint: string, limit: number, windowMinutes: number): Promise<boolean> {
  const ip = req.headers.get('CF-Connecting-IP')
  if (!ip) return false // can't identify the caller — nothing to throttle against
  try {
    const result = await neonQuery(
      env,
      `SELECT count(*)::int AS n FROM public_form_submissions
       WHERE ip_address = $1 AND endpoint = $2 AND created_at > NOW() - ($3 || ' minutes')::interval`,
      [ip, endpoint, String(windowMinutes)]
    )
    const count = result?.rows?.[0]?.n ?? 0
    if (count >= limit) return true
    await neonQuery(env, `INSERT INTO public_form_submissions (ip_address, endpoint) VALUES ($1, $2)`, [ip, endpoint])
    return false
  } catch (e: any) {
    console.error('[RateLimit] check failed (failing open):', e?.message ?? e)
    return false
  }
}

function rateLimitedResponse(): Response {
  return new Response(JSON.stringify({ error: 'Too many requests — please try again later.' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

// Records TCPA SMS consent (express_written from forms, inbound_reply from SMS).
// Pipeline senders check consent_events before any outbound SMS — without a row
// here the number is email-only. Dedup: skips if active consent already exists.
async function recordSmsConsent(
  env: Env,
  phone: string,
  consentType: 'express_written' | 'inbound_reply',
  source: string,
  consentText: string,
  req?: Request
): Promise<void> {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return
  const e164 = `+1${digits.slice(-10)}`
  await neonQuery(
    env,
    `INSERT INTO consent_events (channel, contact, consent_type, source, consent_text, ip_address, user_agent)
     SELECT 'sms', $1, $2, $3, $4, $5, $6
     WHERE NOT EXISTS (
       SELECT 1 FROM consent_events WHERE channel = 'sms' AND contact = $1 AND revoked_at IS NULL
     )`,
    [
      e164, consentType, source, consentText.slice(0, 500),
      req?.headers.get('CF-Connecting-IP') ?? null,
      req?.headers.get('User-Agent') ?? null,
    ]
  )
}

// Logs an inbound-SMS activity event against the matching lead's timeline.
async function logSmsEvent(
  env: Env,
  phone: string,
  eventType: 'sms_replied' | 'sms_opted_out',
  detail?: Record<string, unknown>
): Promise<void> {
  const lead = await neonQuery(
    env,
    `SELECT id FROM leads WHERE phone = $1 OR international_phone = $1 LIMIT 1`,
    [phone]
  )
  const leadId = lead?.rows?.[0]?.id
  if (!leadId) return
  await neonQuery(
    env,
    `INSERT INTO lead_events (lead_id, event_type, detail) VALUES ($1, $2, $3)`,
    [leadId, eventType, detail ? JSON.stringify(detail) : null]
  )
}

// ─── Google Sheets append ─────────────────────────────────────────────────

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const WEBSITE_LEADS_TAB = 'Website Inbound Leads'

async function appendToSheets(env: Env, lead: ContactLead): Promise<void> {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON || !env.LEADS_SHEET_ID) return
  try {
    const token = await getVertexToken(env.GOOGLE_SERVICE_ACCOUNT_JSON, SHEETS_SCOPE)
    const row = [
      lead.submittedAt || new Date().toISOString(),
      lead.firstName || '', lead.lastName || '', lead.phone || '', lead.email || '',
      lead.businessName || '', lead.businessNiche || '', lead.currentWebsite || '',
      lead.painPoints || '', lead.missedCalls || '', lead.urgency || '',
      lead.additionalNotes || '', lead.smsConsent ? 'YES' : 'NO', lead.source || '',
    ]
    const range = encodeURIComponent(`${WEBSITE_LEADS_TAB}!A1`)
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${env.LEADS_SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] }),
      }
    )
    if (!res.ok) console.error('[Sheets] append failed:', await res.text())
  } catch (e) {
    console.error('[Sheets] append error:', e)
  }
}

// ─── Instant Sofia engagement for genuine top-of-funnel submissions ────────
// A webcrew.app form submitter (no businessOwnerPhone — see ContactLead
// comment below) IS the WebCrew prospect, unlike a deployed client demo
// site's own contact form (where the submitter is that client's customer).
// Creates the leads row Sofia needs to pin this person, seeds
// sms_conversations, and replaces the old canned opener SMS with one Sofia
// (Gemini) writes from their actual submitted pain point — so the very next
// reply is picked up by the full stage machine in handleSMSWebhook.

// Google Maps share links commonly embed exact coordinates either as
// `@lat,lng` (the map viewport) or `!3d<lat>!4d<lng>` (the pinned place) in
// the resolved URL — but short-form share links (maps.app.goo.gl/...) only
// carry those once redirected. Follow the redirect, then regex the final URL.
//
// Real bug found live (2026-09-13): a submitter pasted a link that redirected
// straight to a third-party business's own website (safeway.com), not a
// Google Maps page at all — the old version happily extracted whatever it
// could and moved on. Never trust a link just because it was pasted into the
// "Google Maps link" field: after following redirects, the final host must
// actually BE Google Maps, or this returns null (falls back to city-level
// address text in service-areas.tsx) instead of pointing at the wrong place.
const GOOGLE_MAPS_HOSTS = /(^|\.)google\.[a-z.]+$|(^|\.)goo\.gl$/i

async function resolveMapsLatLng(link: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(link, { redirect: 'follow' })
    const finalUrl = res.url || link
    let host: string
    try {
      host = new URL(finalUrl).hostname
    } catch {
      return null
    }
    if (!GOOGLE_MAPS_HOSTS.test(host)) {
      console.error(`[resolveMapsLatLng] rejected non-Google-Maps link: ${link} -> resolved to ${host}`)
      return null
    }
    const pinMatch = finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
    if (pinMatch) return { lat: parseFloat(pinMatch[1]), lng: parseFloat(pinMatch[2]) }
    const viewportMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (viewportMatch) return { lat: parseFloat(viewportMatch[1]), lng: parseFloat(viewportMatch[2]) }
    return null
  } catch {
    return null
  }
}

async function insertWebLead(env: Env, lead: ContactLead, phone: string): Promise<string | null> {
  const coords = lead.googleMapsLink ? await resolveMapsLatLng(lead.googleMapsLink) : null
  const res = await neonQuery(env, `
    INSERT INTO leads (place_id, name, phone, email, niche, city, state, latitude, longitude, status, source, referred_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'web_inquiry', 'webcrew_web_form', $10)
    RETURNING id
  `, [
    `web-${crypto.randomUUID()}`,
    lead.businessName || lead.firstName || 'WebCrew lead',
    phone || null, lead.email || null, lead.businessNiche || null,
    lead.city || null, lead.state || null,
    coords?.lat ?? null, coords?.lng ?? null,
    lead.referredBy || null,
  ])
  return res?.rows?.[0]?.id ?? null
}

// Triggers the same unattended build pipeline Tier-1 scraped leads get
// (brand analysis -> config -> images -> deploy -> AI Reception), via the
// reception Node server's existing /pipeline-trigger route (already
// auth'd + already called by this Worker for /provision and /warm-trigger —
// see RECEPTION_SERVER_URL usages below). Fire-and-forget: the free demo
// site is built overnight regardless of whether Sofia's SMS conversation
// ever happens, matching the "wake up to a live link" promise on the site.
// The landing page's "Business type" dropdown uses plain-English labels
// ("Contractors", "Auto services") that don't match pipeline/src/types.ts's
// PipelineConfig.niche keys ('hvac', 'auto-detailing', ...) verbatim. Map the
// known labels to their real niche key; anything else (the "Other local
// business" free-text path) gets slugified and safely falls through to
// builder.ts's generic-business template rather than 404ing on a guess.
const NICHE_LABEL_TO_KEY: Record<string, string> = {
  hvac: 'hvac', contractors: 'remodeling', plumbers: 'plumbing', electricians: 'electricians',
  roofers: 'roofing', cleaning: 'cleaning', 'auto services': 'auto-detailing',
  salons: 'salon', spas: 'medspa', 'home services': 'remodeling',
}

function normalizeNiche(label: string | undefined): string {
  const key = (label || '').trim().toLowerCase()
  if (NICHE_LABEL_TO_KEY[key]) return NICHE_LABEL_TO_KEY[key]
  return key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'hvac'
}

async function triggerAutomatedBuild(env: Env, leadId: string, lead: ContactLead): Promise<void> {
  if (!env.RECEPTION_SERVER_URL || !env.RECEPTION_PROVISION_SECRET) {
    console.error(`[pipeline-trigger] skipped for lead ${leadId}: missing RECEPTION_SERVER_URL or RECEPTION_PROVISION_SECRET`)
    return
  }
  try {
    const res = await fetch(`${env.RECEPTION_SERVER_URL}/pipeline-trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RECEPTION_PROVISION_SECRET}` },
      body: JSON.stringify({
        leadId,
        config: {
          niche: normalizeNiche(lead.businessNiche),
          templateStyle: lead.templateStyle || 'editorial',
          city: lead.city || '',
          state: lead.state || '',
        },
      }),
    })
    const text = await res.text().catch(() => '')
    console.log(`[pipeline-trigger] lead ${leadId} -> ${env.RECEPTION_SERVER_URL}/pipeline-trigger => HTTP ${res.status} ${text.slice(0, 200)}`)
  } catch (e: any) {
    console.error(`[pipeline-trigger] failed for lead ${leadId}: ${e?.message ?? e}`)
  }
}

async function engageWithSofia(env: Env, lead: ContactLead, valuePlan: ReturnType<typeof prepareLeadValuePlan>): Promise<void> {
  if (!lead.phone) return
  const phone = toE164(lead.phone)
  const fallbackOpener = `WebCrew: Thanks${lead.firstName ? `, ${lead.firstName}` : ''}. We reviewed your ${lead.painPoints || 'business'} concern. First step: ${valuePlan.firstValue.slice(0, 90)} Reply STOP to opt out; HELP for help.`

  // Don't disturb an already-active conversation on this number (repeat
  // submission, or some other prior contact) — send the plain confirmation
  // instead of re-seeding state Sofia is already mid-conversation on.
  const existing = await neonQuery(env, `SELECT phone FROM sms_conversations WHERE phone=$1`, [phone]).catch(() => null)
  if (existing?.rows?.[0] ?? existing?.[0]) {
    await sendSms(env, phone, fallbackOpener).catch(() => {})
    return
  }

  const leadId = await insertWebLead(env, lead, phone).catch((e) => {
    console.error(`[Sofia] insertWebLead failed: ${e?.message ?? e}`)
    return null
  })

  // Fire the same unattended build pipeline scraped Tier-1 leads get — the
  // free demo site Sofia's opener below promises shouldn't depend on this
  // SMS conversation going anywhere, so it's triggered here regardless of
  // how the reply thread plays out. Skipped entirely for an interestOnly
  // ("add AI to my existing site") lead — they explicitly want to KEEP
  // their current site, so auto-building them a new one would be wasted
  // spend (Gemini/image-gen/GitHub/Cloudflare Pages) and wrong.
  if (leadId && !lead.interestOnly) await triggerAutomatedBuild(env, leadId, lead)

  const visitorName = `${lead.firstName}${lead.lastName ? ' ' + lead.lastName : ''}`.trim()
  const openerSystemPrompt = lead.interestOnly
    ? `You are Sofia, WebCrew's AI Front Office Manager. A prospect just submitted webcrew.app's own contact form asking to add a talking AI sales/reception assistant to their EXISTING website (they explicitly want to keep it, not get a new one) at ${lead.currentWebsite || 'their site'} — given below as context only, they have NOT said anything to you yet, this is trigger data, not a message from them. Write the FIRST outbound SMS to them: acknowledge their specific pain point in one short clause, tell them you'll follow up to get the AI widget set up on their existing site (no new website, no rebuild), and offer "or reply CALL and I'll ring you right now" as an alternative. Never say "demo site" or imply a new site is being built. One question or one CTA, never both stacked. Max 160 chars strongly preferred, hard cap 300. Sign "— Sofia, WebCrew" on its own line at the end. Never invent details not given below.`
    : `You are Sofia, WebCrew's AI Front Office Manager. A prospect just submitted webcrew.app's own contact form describing their business and pain point — given below as context only, they have NOT said anything to you yet, this is trigger data, not a message from them. Write the FIRST outbound SMS to them: acknowledge their specific pain point in one short clause, tell them you'll get them a free demo site to look at with zero cost or obligation, and offer "or reply CALL and I'll ring you right now" as an alternative. One question or one CTA, never both stacked. Max 160 chars strongly preferred, hard cap 300. Sign "— Sofia, WebCrew" on its own line at the end. Never invent details not given below.`
  const triggerContext = `Business: ${lead.businessName} (${lead.businessNiche}). Contact: ${visitorName || 'them'}. Pain point: ${lead.painPoints || 'not specified'}. Urgency: ${lead.urgency || 'not specified'}. Missed calls/week: ${lead.missedCalls || 'not specified'}. Their notes: ${lead.additionalNotes || 'none'}.`

  let opener = fallbackOpener
  try {
    const sofia = await geminiSMSReply(env, openerSystemPrompt, [], triggerContext)
    if (sofia?.reply) opener = sofia.reply
  } catch (e: any) {
    console.error(`[Sofia] opener Gemini error: ${e?.message ?? e}`)
  }

  await sendSms(env, phone, opener).catch(() => {})
  await neonQuery(env, `
    INSERT INTO sms_conversations (phone, stage, last_reply, messages, lead_id)
    VALUES ($1, 'initial', $2, $3::jsonb, $4)
    ON CONFLICT(phone) DO NOTHING
  `, [phone, opener, JSON.stringify([{ role: 'model', text: opener }]), leadId]).catch(() => {})
}

// ─── POST /leads handler ──────────────────────────────────────────────────

async function handleLeadSubmission(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (await isRateLimited(env, req, 'leads', 5, 10)) return rateLimitedResponse()
  const lead: ContactLead = await req.json()
  const visitorName = `${lead.firstName}${lead.lastName ? ' ' + lead.lastName : ''}`
  const contact = lead.phone || lead.email || 'unknown'
  const valuePlan = prepareLeadValuePlan(lead)

  // Everything below is notification/SMS/build side-effects, not something
  // the submitter needs to wait on — backgrounded via ctx.waitUntil (same
  // pattern as handleSMSWebhook/handleCallStatus elsewhere in this file) so
  // the form gets an instant response instead of blocking on Gemini/Twilio/
  // Resend/Sheets/pipeline-trigger round trips one after another.
  ctx.waitUntil((async () => {
  // 1. Notify us — every lead logged to our email
  await sendEmail(
    env,
    env.NOTIFICATION_EMAIL || 'leads@webcrew.app',
    `Website form lead · ${lead.businessName} — ${visitorName}`,
    `
    <h2>New contact form submission</h2>
    <table>
      <tr><td><b>Business:</b></td><td>${lead.businessName} (${lead.businessNiche})</td></tr>
      <tr><td><b>Visitor:</b></td><td>${visitorName}</td></tr>
      <tr><td><b>Phone:</b></td><td>${lead.phone || '—'}</td></tr>
      <tr><td><b>Email:</b></td><td>${lead.email || '—'}</td></tr>
      <tr><td><b>Interest:</b></td><td>${lead.interestOnly ? 'Add AI widget to EXISTING site (no new build)' : 'New site build'}</td></tr>
      <tr><td><b>Current website:</b></td><td>${lead.currentWebsite || '—'}</td></tr>
      ${lead.previewConfigId ? `<tr><td><b>From preview:</b></td><td>reception_configs id ${lead.previewConfigId}</td></tr>` : ''}
      <tr><td><b>Service:</b></td><td>${lead.service || '—'}</td></tr>
      <tr><td><b>Message:</b></td><td>${lead.message || '—'}</td></tr>
      <tr><td><b>Pain point:</b></td><td>${lead.painPoints || '—'}</td></tr>
      <tr><td><b>Missed calls/week:</b></td><td>${lead.missedCalls || '—'}</td></tr>
      <tr><td><b>Urgency:</b></td><td>${lead.urgency || '—'}</td></tr>
      <tr><td><b>Prospect's own notes:</b></td><td>${lead.additionalNotes ? escapeHtml(lead.additionalNotes) : '—'}</td></tr>
      <tr><td><b>SMS consent:</b></td><td>${lead.smsConsent ? 'Yes' : 'No'}</td></tr>
      <tr><td><b>Source:</b></td><td>${lead.source}</td></tr>
      <tr><td><b>Time:</b></td><td>${lead.submittedAt}</td></tr>
    </table>
    <h3>Prepared response notes</h3>
    <p><b>Start by acknowledging:</b> ${escapeHtml(valuePlan.pain)}</p>
    <p><b>Likely solution:</b> ${escapeHtml(valuePlan.recommendation)}</p>
    <p><b>Value to provide immediately:</b> ${escapeHtml(valuePlan.firstValue)}</p>
    <p><b>Best next question:</b> ${escapeHtml(valuePlan.nextQuestion)}</p>
    `
  )

  // WebCrew prospects receive useful, problem-specific value immediately. This
  // is transactional email about their submitted enquiry, not a drip campaign.
  // Client-facing copy only — no internal diagnostic labels, no "reply with
  // your answer" homework framing. One job: get them on the call.
  if (lead.email && lead.source === 'webcrew.app/missed-call-landing') {
    const businessName = titleCase(lead.businessName?.trim() || 'your business')
    const firstName = escapeHtml(lead.firstName || 'there')
    const bookingUrl = escapeHtml(env.CALENDLY_URL || 'https://webcrew.app')
    await sendEmail(
      env,
      lead.email,
      `${lead.firstName ? `${lead.firstName}, ` : ''}here's the fix for ${businessName}`,
      `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#172033;line-height:1.65">
        <h2>Got it — ${escapeHtml(valuePlan.painSentence)}.</h2>
        <p>Hi ${firstName},</p>
        <p>Thanks for reaching out. That's a fixable problem, and here's what usually works: ${escapeHtml(valuePlan.recommendation)}</p>
        <div style="padding:18px 20px;background:#f6f7f9;border-left:4px solid #ff6b1a;border-radius:8px">
          <b>A quick win you can try today</b><br>${escapeHtml(valuePlan.firstValue)}
        </div>
        <p style="margin:24px 0"><a href="${bookingUrl}" style="display:inline-block;padding:12px 18px;background:#172033;color:#fff;text-decoration:none;border-radius:7px;font-weight:700">Book a free 15-min call →</a></p>
        <p>On the call, we'll work out ${escapeHtml(valuePlan.nextQuestion.charAt(0).toLowerCase() + valuePlan.nextQuestion.slice(1))} — then map out exactly what to fix first for ${escapeHtml(businessName)}.</p>
        <p>Prefer to talk right now? Call our live AI receptionist — it'll get you booked instantly: <a href="tel:+19182555151">(918) 255-5151</a></p>
        <p>— The WebCrew team</p>
        <p style="color:#6b7280;font-size:12px">You received this email because you submitted an enquiry at webcrew.app.</p>
      </div>`
    )
  }

  // 2. SMS the business owner — "you just got a lead on your demo site!"
  // This is the killer hook. They see proof of value before paying.
  if (lead.businessOwnerPhone && await canTextNow(env, lead.businessOwnerPhone)) {
    await sendSms(
      env,
      lead.businessOwnerPhone,
      `📲 ${lead.businessName}: New inquiry from ${visitorName} (${contact}) via your demo site!\n\nReply INTERESTED to claim this site — ${env.CALENDLY_URL || 'webcrew.app'}`
    )
  }

  // 3. Email the business owner (if we have their email)
  if (lead.businessOwnerEmail) {
    await sendEmail(
      env,
      lead.businessOwnerEmail,
      `You just got a new customer inquiry — ${lead.businessName}`,
      `
      <h2>Someone contacted your business through your demo website!</h2>
      <p><b>${visitorName}</b> just submitted a contact request:</p>
      <ul>
        <li>Phone: ${lead.phone || '—'}</li>
        <li>Email: ${lead.email || '—'}</li>
        <li>Looking for: ${lead.service || lead.message || '—'}</li>
      </ul>
      <p>This is what your website can do for you — 24/7, on autopilot.</p>
      <p><a href="${env.CALENDLY_URL || 'https://webcrew.app'}">Book a 15-min call to activate your site →</a></p>
      <hr>
      <p style="color:#999;font-size:12px">This demo was built by Webcrew. You're not live yet — <a href="${env.CALENDLY_URL}">get live today</a>.</p>
      `
    )
  }

  // 4. Google Sheets log
  await appendToSheets(env, lead)

  // 5. Record TCPA SMS consent — form checkbox is the express written consent
  if (lead.phone && lead.smsConsent === true && lead.consentLanguage) {
    await recordSmsConsent(
      env, lead.phone, 'express_written', lead.source || 'webcrew.app/contact',
      lead.consentLanguage,
      req
    ).catch(() => {})

    // Genuine top-of-funnel prospects (no businessOwnerPhone — see
    // ContactLead comment) get engaged by Sofia directly so their next
    // reply is picked up by the full stage machine. A deployed client's
    // demo-site customer keeps today's plain confirmation unchanged.
    if (!lead.businessOwnerPhone) {
      await engageWithSofia(env, lead, valuePlan).catch(() => {})
    } else {
      await sendSms(
        env,
        lead.phone,
        `WebCrew: Thanks${lead.firstName ? `, ${lead.firstName}` : ''}. We reviewed your ${lead.painPoints || 'business'} concern. First step: ${valuePlan.firstValue.slice(0, 90)} Reply STOP to opt out; HELP for help.`
      ).catch(() => {})
    }
  }
  })().catch((e) => console.error(`[handleLeadSubmission] background work failed: ${e?.message ?? e}`)))

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

// ─── POST /affiliate-apply handler ────────────────────────────────────────

async function handleAffiliateApply(req: Request, env: Env): Promise<Response> {
  if (await isRateLimited(env, req, 'affiliate-apply', 5, 10)) return rateLimitedResponse()
  const { name, email, promotionPlan, websiteUrl } = await req.json() as {
    name: string; email: string; promotionPlan?: string; websiteUrl?: string
  }

  if (!name || !email) {
    return new Response(JSON.stringify({ error: 'name and email required' }), {
      status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  await neonQuery(
    env,
    `INSERT INTO affiliates (name, email, promotion_plan, website_url) VALUES ($1, $2, $3, $4)`,
    [name, email, promotionPlan || null, websiteUrl || null]
  )

  await sendEmail(
    env,
    env.NOTIFICATION_EMAIL || 'leads@webcrew.app',
    `New affiliate application — ${name}`,
    `<h2>New affiliate program application</h2>
     <p><b>Name:</b> ${escapeHtml(name)}</p>
     <p><b>Email:</b> ${escapeHtml(email)}</p>
     <p><b>Website/social:</b> ${websiteUrl ? escapeHtml(websiteUrl) : '—'}</p>
     <p><b>Promotion plan:</b> ${promotionPlan ? escapeHtml(promotionPlan) : '—'}</p>
     <p>Review and, if approved, assign a referral_code in the affiliates table, then email it to them.</p>`
  )

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

// ─── SMS reply handler (Twilio webhook) ──────────────────────────────────────

const OPT_OUT_WORDS = ['stop', 'unsubscribe', 'quit', 'opt out', 'remove me']
// Word-boundary patterns, not raw substrings — a plain `includes('interested')`
// check never matches a bare "Interest" reply, and (worse) it substring-matches
// inside "not interested" and fires the build-now path on a decline.
const YES_PATTERNS = [
  /\byes\b/, /\byeah\b/, /\byep\b/, /\binterest(ed)?\b/,
  /\bsounds good\b/, /\blet'?s do it\b/, /\bi want\b/, /\bsign me up\b/,
]
const NEGATION_RE = /\b(not|no|n't|never|don'?t|doesn'?t)\b/

// CANCEL is a CTIA-mandatory opt-out keyword — must still work as one — but a
// plain substring match on "cancel" swallowed every natural "please cancel my
// appointment" as a full SMS opt-out instead of reaching the booking-cancel
// handler below. Real bug found in production audit: the booking confirmation
// SMS literally said "Reply CANCEL to cancel" and every reply to it silently
// unsubscribed the customer while leaving the appointment booked. Fix: only
// treat "cancel" as opt-out when it's the ENTIRE message (± trailing
// punctuation) — the standalone-keyword form CTIA actually requires — so
// "cancel my appointment" falls through to real cancellation instead.
const CANCEL_OPT_OUT_RE = /^\s*cancel\s*[.!]?\s*$/i

function isOptOut(text: string): boolean {
  const t = text.toLowerCase()
  return OPT_OUT_WORDS.some(w => t.includes(w)) || CANCEL_OPT_OUT_RE.test(text)
}

function isYes(text: string): boolean {
  const t = text.toLowerCase().trim()
  if (NEGATION_RE.test(t) && !/^(yes|yeah|yep)\b/.test(t)) return false
  return YES_PATTERNS.some(re => re.test(t))
}

// ─── GCP Service Account → Vertex AI token (crypto.subtle RSA, CF Workers compatible) ───

async function getVertexToken(
  serviceAccountJson: string,
  scope = 'https://www.googleapis.com/auth/cloud-platform'
): Promise<string> {
  const sa = JSON.parse(serviceAccountJson)
  const now = Math.floor(Date.now() / 1000)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payload = btoa(JSON.stringify({
    iss: sa.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const signingInput = `${header}.${payload}`
  const pemBody = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  const keyData = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const jwt = `${signingInput}.${sigB64}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }).toString(),
  })
  const tokenData: any = await tokenRes.json()
  return tokenData.access_token
}

type ChatMessage = { role: 'user' | 'model'; text: string }
type SofiaResult = { reply: string; commit: boolean; wantsCall: boolean; desiredPlan: PlanKey | null; needsHuman: boolean }

// Must list the same keys as PLAN_CATALOG below — kept as its own literal
// (not derived via Object.keys(PLAN_CATALOG)) because this const initializes
// at module-load time, before PLAN_CATALOG's declaration further down the
// file; deriving it here would throw (temporal dead zone).
const PLAN_KEYS = ['website_only', 'website_hosted', 'ai_front_office', 'ai_reception_only', 'everything', 'marketing_only'] as const

const SOFIA_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply:       { type: 'STRING' },
    commit:      { type: 'BOOLEAN' },
    wantsCall:   { type: 'BOOLEAN' },
    desiredPlan: { type: 'STRING', enum: [...PLAN_KEYS, 'none'] },
    needsHuman:  { type: 'BOOLEAN' },
  },
  required: ['reply', 'commit'],
}

function parseSofiaJson(text: string): SofiaResult | null {
  try {
    const j = JSON.parse(text)
    if (typeof j.reply === 'string' && j.reply.trim() && typeof j.commit === 'boolean') {
      const desiredPlan = (PLAN_KEYS as readonly string[]).includes(j.desiredPlan) ? (j.desiredPlan as PlanKey) : null
      return { reply: j.reply.trim(), commit: j.commit, wantsCall: j.wantsCall === true, desiredPlan, needsHuman: j.needsHuman === true }
    }
  } catch {}
  return null
}

// ─── AI Studio free-tier daily quota guard ────────────────────────────────────
// Same table/pattern already proven in pipeline/src/reception/gemini-live.ts
// (ai_studio_key_usage, migration-v25) — reused here via neonQuery since the
// Worker can't import that Node module directly. Every inbound SMS now costs
// a Gemini call (not just keyword-matched ones), so a Vertex outage could
// burn through the free cap in a burst; skip AI Studio once over budget
// rather than firing a request that will just 429.
// NOTE: 20/day is a conservative placeholder — verify the real cap for this
// key against the AI Studio dashboard (a comment elsewhere in this codebase
// claims 250 RPD for the same model family; the two numbers disagree).
const AI_STUDIO_DAILY_CAP = 20
const AI_STUDIO_USAGE_KEY = 'sms-worker'

async function aiStudioUnderCap(env: Env): Promise<boolean> {
  const res = await neonQuery(env, `SELECT call_count FROM ai_studio_key_usage WHERE key_name=$1 AND usage_date=CURRENT_DATE`, [AI_STUDIO_USAGE_KEY])
  return (res?.rows?.[0]?.call_count ?? 0) < AI_STUDIO_DAILY_CAP
}

async function recordAiStudioUsage(env: Env): Promise<void> {
  await neonQuery(env, `
    INSERT INTO ai_studio_key_usage (key_name, usage_date, call_count)
    VALUES ($1, CURRENT_DATE, 1)
    ON CONFLICT (key_name, usage_date) DO UPDATE SET
      call_count = ai_studio_key_usage.call_count + 1, updated_at = NOW()
  `, [AI_STUDIO_USAGE_KEY])
}

const SOFIA_RETRY_REPROMPT = 'Your last response was not valid JSON matching the required schema. Reply with ONLY the JSON object, nothing else.'

// One provider call, with exactly one retry (same turn, same provider) if the
// response isn't parseable — a transient formatting slip shouldn't have to
// wait for the next inbound SMS to correct itself. HTTP errors don't retry
// here; the caller falls through to the next provider instead.
async function callGeminiJson(
  url: string, headers: Record<string, string>, contentsBase: any[],
  systemInstruction: string, generationConfig: Record<string, unknown>,
  reqId: string, label: string
): Promise<{ result: SofiaResult | null; httpFailed: boolean }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const contents = attempt === 0 ? contentsBase : [
      ...contentsBase,
      { role: 'model', parts: [{ text: '(invalid JSON — retrying)' }] },
      { role: 'user', parts: [{ text: SOFIA_RETRY_REPROMPT }] },
    ]
    const body = JSON.stringify({ system_instruction: { parts: [{ text: systemInstruction }] }, contents, generationConfig })
    try {
      const res = await fetch(url, { method: 'POST', headers, body })
      const json: any = await res.json()
      if (!res.ok || !json.candidates?.[0]) {
        console.error(`[Gemini][${reqId}] ${label} HTTP ${res.status} | ${json.error?.message?.slice(0, 150) ?? ''}`)
        return { result: null, httpFailed: true }
      }
      const rawText = json.candidates[0].content?.parts?.[0]?.text ?? ''
      const parsed = parseSofiaJson(rawText)
      if (parsed) return { result: parsed, httpFailed: false }
      // finishReason is the key diagnostic: MAX_TOKENS = truncation (raise
      // maxOutputTokens further), SAFETY = content filtered, anything else =
      // genuinely malformed output. Never log the phone/history — PII risk;
      // the raw model output for one turn is low-risk and is the whole point.
      console.error(`[Gemini][${reqId}] ${label} unparseable (attempt ${attempt + 1}/2) | finishReason=${json.candidates[0].finishReason} | raw="${rawText.slice(0, 300)}"`)
    } catch (e: any) {
      console.error(`[Gemini][${reqId}] ${label} error: ${e?.message ?? e}`)
      return { result: null, httpFailed: true }
    }
  }
  return { result: null, httpFailed: false }
}

async function geminiSMSReply(
  env: Env,
  systemPrompt: string,
  history: ChatMessage[],
  incomingMsg: string
): Promise<SofiaResult | null> {
  const reqId = crypto.randomUUID().slice(0, 8)

  // Build Gemini multi-turn contents — full conversation memory
  // History = previous turns. Append current user message last.
  //
  // "commit" replaces a flat keyword scan (isYes) for deciding whether to
  // spend real money building the site. A regex can't tell "yeah sure show
  // it to me" or "ok why not" from a literal "yes", and it false-positives
  // on "not interested". Gemini reads the actual stage-aware conversation
  // and emotional tone instead — the trigger action itself stays
  // code-controlled (see handleSMSWebhook), only the READ becomes semantic.
  const instruction = systemPrompt + `

RESPOND WITH JSON ONLY — no markdown, no code fences, no extra text:
{"reply": "<your SMS reply, max 160 chars>", "commit": <true|false>, "wantsCall": <true|false>, "desiredPlan": "<one of website_only|website_hosted|ai_front_office|ai_reception_only|everything|marketing_only|none>", "needsHuman": <true|false>}

"commit" = true ONLY when the lead has just given clear, genuine agreement to move forward RIGHT NOW at the current stage (e.g. see their site built, or take the concrete next step) — judge their actual intent and tone, not literal keywords. "yeah go for it", "sure why not", "ok show me", "let's see it", enthusiastic replies without the word yes — all count as true. Sarcasm, hesitation ("maybe", "let me think", "not sure yet"), objections, plain questions, or any decline are commit:false. Default to false when genuinely ambiguous — never guess true.

"wantsCall" = true ONLY when the lead explicitly asks to talk by phone right now or to be called ("can you call me", "just call me", "I'd rather talk", "phone me instead") — not for scheduling a future meeting (that's the booking stage) and not implied by general enthusiasm. Default false.

"desiredPlan" = which product they actually want, based on everything said so far — "none" if unclear or not yet discussed. Never state a specific dollar amount yourself in "reply" when discussing price — the system appends the real, approved number after your message automatically. Just acknowledge interest/ask a clarifying question instead.

"needsHuman" = true when you are out of your depth and a human should take over: they've seen your best/floor price and still decline, they're hostile/angry/threatening, they ask something outside what you can resolve (refunds, legal, complex technical disputes, explicit complaints about being scammed), or they explicitly ask for a manager/human and won't be satisfied by a callback offer. Default false — most conversations, even hard ones, don't need this.`

  const contents = [
    ...history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: 'user', parts: [{ text: incomingMsg }] },
  ]

  // 500, not 250 — JSON wrapping overhead + the prompt's own "hard cap 300
  // chars" reply allowance can approach a tight ceiling, and Gemini 2.5
  // Flash's default thinking budget can eat into it before any visible
  // output is produced. Cheap headroom on Flash pricing.
  const generationConfig = {
    maxOutputTokens: 500, temperature: 0.7,
    responseMimeType: 'application/json',
    responseSchema: SOFIA_RESPONSE_SCHEMA,
    thinkingConfig: { thinkingBudget: 0 },
  }

  // ── PRIMARY: Vertex AI on credits project ($300, webcrew-501006) ──────────
  const vertexSa = env.VERTEX_SERVICE_ACCOUNT_JSON || env.GOOGLE_SERVICE_ACCOUNT_JSON
  const vertexProjects = [
    env.VERTEX_CREDITS_PROJECT_ID || 'webcrew-501006',
    env.VERTEX_PROJECT_ID || 'gen-lang-client-0362421597',
  ]
  if (vertexSa) {
    const token = await getVertexToken(vertexSa).catch((e) => {
      console.error(`[Gemini][${reqId}] Vertex token error: ${e?.message ?? e}`)
      return null
    })
    if (token) {
      for (const vertexProject of vertexProjects) {
        const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${vertexProject}/locations/us-central1/publishers/google/models/gemini-3.8-flash:generateContent`
        const { result } = await callGeminiJson(
          url, { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          contents, instruction, generationConfig, reqId, `Vertex(${vertexProject})`
        )
        if (result) return result
      }
    }
  }

  // ── FALLBACK: AI Studio free tier ──────────────────────────────────────────
  if (env.GOOGLE_AI_API_KEY) {
    if (!(await aiStudioUnderCap(env))) {
      console.error(`[Gemini][${reqId}] AI Studio daily cap reached — skipping, falling through to hardcoded fallback`)
      return null
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${env.GOOGLE_AI_API_KEY}`
    const { result } = await callGeminiJson(url, { 'Content-Type': 'application/json' }, contents, instruction, generationConfig, reqId, 'AI Studio')
    recordAiStudioUsage(env).catch(() => {})
    return result
  }

  return null
}

// ─── Rolling conversation summary ─────────────────────────────────────────────
// History is capped at 40 raw messages (~20 exchanges) fed into every Sofia
// call — a long-running relationship would otherwise silently lose everything
// before that window with no trace. Rather than reaching for a vector-search/
// RAG pipeline (real complexity — embeddings, storage, retrieval — with no
// payoff yet at this system's actual conversation volume), fold whatever's
// about to fall off the window into a compact running summary instead, the
// same way a person remembers the gist of an old conversation without a
// transcript. Only fires when a conversation actually gets long, so cost is
// rare. If it fails, the old summary is kept — never blocks the reply.
async function summarizeConversation(env: Env, existingSummary: string, dropped: ChatMessage[]): Promise<string> {
  const transcript = dropped.map(m => `${m.role === 'user' ? 'Lead' : 'Sofia'}: ${m.text}`).join('\n')
  const prompt = `${existingSummary ? `Existing summary of this conversation so far:\n${existingSummary}\n\n` : ''}New messages to fold in:\n${transcript}\n\nWrite an updated, compact summary (3-5 sentences) of the WHOLE conversation so far — key facts, commitments, objections, and where things stand. Plain text only, no labels, no markdown.`

  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 300, temperature: 0.3 },
  })

  const vertexSa = env.VERTEX_SERVICE_ACCOUNT_JSON || env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (vertexSa) {
    const token = await getVertexToken(vertexSa).catch(() => null)
    if (token) {
      const vertexProject = env.VERTEX_CREDITS_PROJECT_ID || 'webcrew-501006'
      try {
        const res = await fetch(
          `https://us-central1-aiplatform.googleapis.com/v1/projects/${vertexProject}/locations/us-central1/publishers/google/models/gemini-3.8-flash:generateContent`,
          { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body }
        )
        const json: any = await res.json()
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
        if (res.ok && text) return text
      } catch (e: any) {
        console.error(`[Summary] Vertex error: ${e?.message ?? e}`)
      }
    }
  }
  if (env.GOOGLE_AI_API_KEY && await aiStudioUnderCap(env)) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${env.GOOGLE_AI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
      )
      const json: any = await res.json()
      recordAiStudioUsage(env).catch(() => {})
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      if (res.ok && text) return text
    } catch (e: any) {
      console.error(`[Summary] AI Studio error: ${e?.message ?? e}`)
    }
  }
  return existingSummary
}

// ─── Async: look up lead by phone, provision Gemini Live reception ────────────

async function triggerReceptionProvision(env: Env, phone: string): Promise<void> {
  const data = await neonQuery(env,
    `SELECT id, name, website FROM leads WHERE phone = $1 AND tier = 'tier2' AND website IS NOT NULL LIMIT 1`,
    [phone])
  const lead = data?.rows?.[0]
  if (!lead?.website) {
    console.log(`[Provision] No tier2 lead with website found for ${phone}`)
    return
  }

  console.log(`[Provision] Triggering reception for ${lead.name}: ${lead.website}`)
  await fetch(`${env.RECEPTION_SERVER_URL}/provision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env.RECEPTION_PROVISION_SECRET ? { Authorization: `Bearer ${env.RECEPTION_PROVISION_SECRET}` } : {}),
    },
    body: JSON.stringify({ websiteUrl: lead.website, businessName: lead.name, leadId: lead.id }),
  })
}

// ─── SMS Sales Agent helpers ──────────────────────────────────────────────────

// Promotional SIGNUP window — this founding-offer signup deadline is capped
// at whichever comes first: 7 days from now, or PROMO_DEADLINE. This is
// separate from the trial LENGTH (30 days, see reception-contract.ts's
// trialDays, kept in sync by hand) — it's how long a lead has to sign up
// to get this offer, not how long their trial runs once they do. Not a
// manufactured scarcity trick — AI Reception currently runs on free Vertex
// AI credits that expire in late September, so this window is when it's
// actually free for WebCrew to run, not just free to the customer.
// Referenced by both the SMS (here) and voice
// (pipeline/src/reception/webcrew-prompt.ts, kept in sync by hand) prompts.
const PROMO_DEADLINE = new Date('2026-09-25T23:59:59-05:00')

function trialWindowLabel(): string {
  const now = new Date()
  const oneWeekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const end = oneWeekOut < PROMO_DEADLINE ? oneWeekOut : PROMO_DEADLINE
  if (end <= now) return 'a free trial — ask the team for current terms' // deadline passed, don't quote a stale date
  const dateLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `30-day free trial (sign up by ${dateLabel} at the latest — this founding window won't last)`
}

function buildSalesPrompt(p: {
  leadName: string; leadNiche: string; leadCity: string; leadTier: string
  convStage: string; demoUrl: string; lastMessage: string; lastReply: string
  offeredPrice: number; calendlyUrl: string; historyLen: number
  conversationSummary?: string; leadSource?: string; callContext?: string
}): string {
  const name  = p.leadName  || 'the business owner'
  const niche = p.leadNiche || 'local business'
  const city  = p.leadCity  || 'your city'
  const cal   = p.calendlyUrl || 'webcrew.app'
  const trial = trialWindowLabel()
  const exchanges = Math.floor(p.historyLen / 2)  // completed back-and-forth turns
  // Two entry paths land in stage 'initial' with opposite framing needs: a
  // cold-scraped lead is replying to OUR "we built you a site" outreach, but
  // a webcrew.app form submitter (source='webcrew_web_form', see
  // handleLeadSubmission) proactively reached out describing their own pain
  // point — telling them "we built you a website" would be false and
  // confusing since nothing has been built for them yet.
  const isInboundWebLead = p.leadSource === 'webcrew_web_form'

  const stageBehavior: Record<string, string> = {
    initial: isInboundWebLead
      ? `STAGE 1 — THEY JUST REACHED OUT TO US DIRECTLY on webcrew.app describing their own problem. We already sent one text asking about their goals/pain point and offering an instant call — this is their reply to that. Acknowledge their specific situation, then explain we'll build them a free demo site to look at — no cost, no obligation. If they give any go-ahead — in ANY wording — set commit=true right now. If they'd rather just talk it through, tell them to say "call me" and we'll ring them immediately. DO NOT mention the calendar yet. DO NOT name a price yet.`
      : `STAGE 1 — THEY'RE REPLYING TO OUR OUTREACH. Our outreach said: "We built ${name !== 'the business owner' ? name : 'them'} a brand-new website — no upfront cost to see it. Sounds like a plan?" Their reply is a reaction to THAT. If they clearly agree — in ANY wording, not just the literal word "yes" — set commit=true right now and reply with something like "Awesome — building it now, ready in about 10 minutes! I'll text you the link." Do NOT make them repeat "yes" if they already gave clear agreement once; that just loses the deal. If skeptical → reassure: zero risk to look, $0 setup, and a 30-day free trial once they're ready to go live. If they ask a question → answer it honestly and short. DO NOT mention the calendar. DO NOT name a price yet.`,
    interested: `STAGE 2 — BUILDING TRUST. They're engaged but haven't clearly agreed yet. Answer their questions honestly. Reassure: it's already built for their business specifically, seeing it costs nothing, $0 setup and a 30-day free trial when they're ready. The moment they give a real go-ahead — however they phrase it — set commit=true immediately, don't ask them to confirm again. DO NOT mention the calendar. DO NOT name a price yet.`,
    qualifying: `STAGE 3 — STILL WARMING UP. They're talking but not committed. Ask ONE light question about their business ("How do most of your customers find you right now?") then tie it back: "That's exactly what the site fixes. Want to see it?" If their answer to that (or anything after) is a real agreement, set commit=true right then. DO NOT mention the calendar.`,
    presenting: `STAGE 4 — SOFT CLOSE. Frame it zero-risk: "It's already built. Seeing it is free — $0 setup, and a 30-day free trial before anything bills." Ask if they want you to send it over. The instant they say yes in any form, set commit=true — don't loop back and ask again. Still NO calendar link unless they ask to talk.`,
    building:   `Their custom ${niche} site is being built right now with their real business info, photos, and reviews — takes ~10 minutes. Keep them excited. Ask what matters most to them (photo gallery, booking, reviews) so we highlight it.`,
    demo_sent:  `STAGE 5 — DEMO REVIEW. We sent their site${p.demoUrl ? ': ' + p.demoUrl : ''}. Ask if they had a chance to look and what they think. If they LIKE it → say something like "It's yours — $0 setup, ${trial}. Want me to walk you through what's next?" Set desiredPlan="ai_front_office" — that's the default pitch. Only mention a different product (website only, hosting-only, AI Reception only) if THEY ask for something narrower or say the bundle is more than they need. Do NOT state a dollar amount — the system appends it. If they want changes → "Easy — we handle customizations on a quick free call." DO NOT push.`,
    price_asked:`STAGE 6a — BUDGET FIRST, ALWAYS. Do NOT state, hint at, or estimate any dollar figure this turn — not even a range. Your ONLY job: warmly pivot to their budget before pricing anything, e.g. "Before I get you exact numbers — what's a comfortable monthly budget for you? I'll find the best fit." Set desiredPlan to whatever they've shown interest in (default ai_front_office). The system will show the real price on the turn after they answer — your job right now is just to ask, naturally, like a real SDR qualifying budget before pitching.`,
    negotiating:`STAGE 6b — CLOSING THE DEAL. They've stated (or the system already asked for) their budget. Stay warm and flexible — we have real room to work with, never a flat "no." Set desiredPlan to what they want; the system computes and appends the actual number using their stated budget — never invent one yourself. The instant they agree to a number the system has shown them, set commit=true and confirm warmly: "Deal! You're all set — $0 today, ${trial}. Any customizations you want? We handle those on a quick free call." Then share: ${cal}. If they've already seen your best/floor number and still say no, or the conversation is getting hostile or going somewhere you can't resolve, set needsHuman=true and tell them warmly a team member will personally follow up — don't keep re-pitching the same thing.`,
    booking:    `STAGE 7 — BOOKING. They agreed or want to talk. Share the calendar: ${cal} — "Pick any time — 10 min, no prep needed. We'll finalize everything and handle any customizations." Our specialist Ranjeet joins the call to get them fully set up.`,
    booked:     `STAGE 8 — CONFIRMED. Call is scheduled. Confirm warmly: "Perfect — see you then! We'll walk through your site, make any tweaks you want, and get it live under your name." Keep it short.`,
    support:    `SUPPORT MODE. Existing customer with a question, issue, or complaint. Empathize FIRST ("I'm so sorry — let me look into this right now"), solve or escalate to Ranjeet second. No selling.`,
  }

  const behavior = stageBehavior[p.convStage] ?? `Stage: ${p.convStage}. Move them one step forward. One question per message.`

  return `You are Sofia, WebCrew's AI Front Office Manager & Account Manager. You are a woman — warm, sharp, confident, never pushy. You combine a world-class receptionist, an empathetic support agent, and a trained SDR (sales development rep). You handle the FULL customer journey: greeting → diagnosis → qualification → value → booking → confirmation → support.

SDR PLAYBOOK — you are a real salesperson, not a script-reader:
• Discovery before pitch: understand their real pain and what they're actually trying to achieve before selling anything. A price with no context always sounds expensive; a price attached to a problem they already told you about sounds cheap.
• Read the emotion, not just the words: skeptical, rushed, excited, annoyed, suspicious — match your tone and pace to theirs. A rushed lead needs brevity; a skeptical one needs proof, not more enthusiasm.
• Objections are information, not rejection. "Too expensive" usually means "I don't see the value yet" or "I don't trust this yet" — understand which one before you respond to it.
• Make it a no-brainer: $0 setup (normally $499), ${trial}, cancel anytime — there is close to zero real risk to trying it. Lead with this when hesitation, not price, is the real blocker.
• Never argue, never guilt-trip, never sound desperate. A calm "no worries, I'm here when you're ready" wins more deals long-term than pressure ever does.
• Know when you're out of your depth: if you've shown your best offer and they still say no, or things turn hostile, or they need something outside what you can resolve — hand off to a human (needsHuman=true) instead of looping the same pitch on repeat.

LEAD: ${name} | ${niche} business | ${city}
CONVERSATION STAGE: ${p.convStage} (${exchanges} exchanges so far)
${p.demoUrl ? `DEMO SITE: ${p.demoUrl}` : 'NO DEMO BUILT YET'}
${p.conversationSummary ? `\nEARLIER IN THIS CONVERSATION (summarized — older messages, not shown verbatim below):\n${p.conversationSummary}\n` : ''}
${p.callContext ? `\nRECENT PHONE CALL (they also called/were called — use only to avoid repeating questions, confirm anything important):\n${p.callContext}\n` : ''}

YOUR OBJECTIVE RIGHT NOW (follow this exactly — do not skip ahead):
${behavior}

THE LIFECYCLE (never skip stages):
1. REPLY TO OUTREACH — they respond to "we built you a website, no upfront cost — sounds like a plan?"
2. TRUST — answer questions, zero-risk framing, get YES
3. BUILD — site built with their real photos/reviews, ~10 min
4. DEMO — they see it, react, own it emotionally
5. BUDGET FIRST — always ask their comfortable monthly budget before any number is shown
6. PRICE — the system shows the real approved number based on their budget; their agreement is the commit signal
7. CUSTOMIZE + BOOK — "changes handled on a quick free call" → calendar
8. CONFIRM — Ranjeet closes on the call

⛔ CALENDAR RULE (strict): NEVER share ${cal} unless (a) price agreed / deal confirmed, OR (b) they explicitly ask to talk/call/book. Sharing the calendar before they've seen their site is a FAILURE.
⛔ PRICING RULE (strict): NEVER state a specific dollar amount yourself, ever — the system inserts the real, approved number after your reply automatically, always based on the desiredPlan you set. ALWAYS ask their comfortable monthly budget before any price gets discussed — never skip straight to a number, even if they ask directly ("how much?" gets answered with a budget question, not a price). We have genuine room to flex within approved limits — never respond to a budget objection with a flat "no," always keep the conversation moving toward SOME plan that fits. "everything" and "marketing_only" are NOT available yet (marketing product isn't built) — if they want those, acknowledge interest warmly and say we'll notify them the moment it's ready; never quote a price or promise a timeline for either.
⛔ LOCATION RULE: ${p.leadCity ? `Their city is ${p.leadCity}.` : `You DON'T know their city — say "your city" or "your area", NEVER guess or invent a city name.`}

WEBCREW PRODUCTS (context only — do not list these unprompted; default-pitch AI Front Office unless they ask for something narrower):
• AI Front Office (desiredPlan="ai_front_office") — the default pitch. Website + 24/7 AI phone reception + appointment booking + lead capture/nurture/follow-ups + revenue recovery + weekly Google Business Profile posts + review replies + reporting.
• Website only (desiredPlan="website_only") — a custom website, one-time, no monthly commitment. For someone who just wants a site, nothing ongoing.
• Website, hosted + maintained (desiredPlan="website_hosted") — website + hosting + weekly GBP posts/review replies + weekly report, no AI reception.
• AI Reception only (desiredPlan="ai_reception_only") — 24/7 AI phone reception + booking, no website (for someone who already has a site).
• Everything + Marketing / Marketing only — NOT available yet, coming soon. Acknowledge interest, never quote or promise a date.

OBJECTION HANDLING:
• "Not interested" → "Totally understand! Out of curiosity, what would need to change for it to make sense?"
• "I already have someone" → "That's great! I'd love to show you what's different — no pressure. What are they doing for you now?"
• "Send me info / email" → "Happy to! What matters most — more calls, reviews, or Google rankings? I'll tailor it."
• "Need to think" → "Makes sense. What's your main question? I'll answer it right now."
• "Too busy" → "Totally get it — this takes 2 min by text. What's the one thing you'd fix about how customers find you?"
• "Who is this?" → "This is Sofia from WebCrew! We build websites for local businesses. Reply STOP anytime to opt out."
• "How did you get my number?" → "Found it in public business directories — sorry for the cold text! Reply STOP anytime to opt out."
• "How much is it?" / "What's the price?" → never answer with a number. Pivot: "Depends what fits you best — what's a comfortable monthly budget for you?" Set desiredPlan based on context.
• "That's too expensive" / states a budget after seeing a number → never decline. Set desiredPlan (their stated interest, or ai_front_office by default) and acknowledge you're working out a number that fits — the system appends the actual approved figure, which may be a flexed rate on the same plan or a lighter plan that still covers their real need. If they've already seen your floor number and still object, that's a needsHuman=true moment, not another round of the same pitch.
• Angry / hostile / accusatory → acknowledge their exact concern first, no defensiveness. If it doesn't de-escalate quickly, set needsHuman=true.
• Complex technical question, refund dispute, or legal question → "Great question — let me get you to someone who can give you the exact right answer." Set needsHuman=true.

TONE & FORMAT — non-negotiable:
• Human phrasing: "Got it," "Perfect," "I can definitely help with that" — never "Certainly, I can assist"
• Max 160 chars strongly preferred (1 SMS segment). Hard cap 300.
• Exactly ONE question or ONE call-to-action per message — never two asks
• No emojis unless they send one first
• Never repeat anything from your previous messages (you have the full history above)
• Never make up pricing, features, or timelines
• If you sign, ALWAYS put the signature on its own line, separated by a blank line:

— Sofia, WebCrew

• Sign ONLY your very first message; never sign again after that`
}

// Strip trailing "business/businesses" so "local business businesses" never happens
// business(es)? matches "business" OR "businesses"
function nicheLabel(niche: string): string {
  return (niche || 'local business').replace(/\s*business(es)?\s*$/i, '').trim() || 'local'
}

function buildFallback(
  msgBody: string, leadNiche: string, leadCity: string,
  convStage: string, historyLen: number, calendlyUrl?: string
): string {
  const cal   = calendlyUrl || 'webcrew.app'
  const niche = nicheLabel(leadNiche)

  if (/price|cost|how much|charge|fee|what.*(it|this) cost/i.test(msgBody))
    return `Great question — let me pull up the right number for you.`
  if (/\b(book|schedule|call me|appointment|let'?s talk|set up a (call|time))\b/i.test(msgBody))
    return `Happy to chat! Here's my calendar: ${cal}\n\nPick any time — 10 min, no prep needed.`
  if (/complaint|issue|problem|not working|broken|fix|wrong/i.test(msgBody))
    return `I'm so sorry to hear that — let me fix this right away. What's going on?`
  if (/demo|site|website|link|see it/i.test(msgBody) && convStage === 'demo_sent')
    return `Did you get a chance to look at it yet?`

  // First contact (no history) — they're replying to our outreach
  if (historyLen === 0)
    return `Hi! Sofia here from WebCrew. We built your ${niche} business a new website — no upfront cost to see it. Reply YES to see it, or STOP to opt out.\n\n— Sofia, WebCrew`

  // They've replied before but Gemini failed — keep moving toward YES
  return `Totally fair question! The site's already built for your business — seeing it costs nothing. Reply YES and I'll send it over.`
}

function upgradeStage(msgBody: string, reply: string, currentStage: string, historyLen: number): string {
  const order = ['initial','interested','qualifying','presenting','building','demo_sent','price_asked','negotiating','booking','booked','support','closed']
  let next = currentStage
  const exchanges = Math.floor(historyLen / 2)

  // Gradual lifecycle progression — one stage per meaningful exchange
  if (currentStage === 'initial'    && msgBody.trim().length > 1) next = 'interested'   // they replied → diagnose
  if (currentStage === 'interested' && exchanges >= 2)            next = 'qualifying'   // pain shared → qualify
  if (currentStage === 'qualifying' && exchanges >= 3)            next = 'presenting'   // qualified → pitch value

  // Keyword jumps (override gradual flow)
  if (/price|cost|how much|charge|pay|fee/i.test(msgBody) && !['negotiating','booked','closed'].includes(currentStage)) next = 'price_asked'
  if (['price_asked','negotiating'].includes(currentStage) && /\$\s*\d+|\d+\s*(dollar|buck|month|\/mo)/i.test(msgBody)) next = 'negotiating'

  // Booking ONLY on explicit user intent — never because our reply mentioned it
  if (/\b(book|schedule|call me|appointment|let'?s talk|set up a (call|time)|when can (we|you))\b/i.test(msgBody)
      && !['booked','closed'].includes(currentStage)) next = 'booking'
  if (currentStage === 'booking' && /confirm|booked|scheduled|see you|talk soon/i.test(reply)) next = 'booked'

  const ci = order.indexOf(currentStage)
  const ni = order.indexOf(next)
  return ni > ci ? next : currentStage
}

// ─── Plan catalog + budget resolver ───────────────────────────────────────
// Single source of truth for SMS (here). Mirrored — same names, prices,
// floors — in pipeline/src/reception/ for voice (webcrew-prompt.ts /
// twilio-relay.ts / browser-relay.ts) and admin/src/lib/plans.ts for
// checkout. No shared package across these 4 runtimes today (matches how
// CAL_EVENT_TYPE_ID etc. are already duplicated per-runtime) — keep all
// copies in sync by hand when a price changes.
type PlanKey = 'website_only' | 'website_hosted' | 'ai_front_office' | 'ai_reception_only' | 'everything' | 'marketing_only'

interface PlanDef {
  name: string
  price: number         // list price, cents
  floor?: number         // never sell below this, cents — absent means no discount at all
  ladder?: number[]      // negotiation steps, cents, first entry = list price
  billing: 'one_time' | 'subscription'
  available: boolean     // false = not sellable yet (marketing isn't built) — waitlist only
  blurb: string
}

const PLAN_CATALOG: Record<PlanKey, PlanDef> = {
  website_only: {
    name: 'Website only', price: 39900, floor: 19900, ladder: [39900, 29900, 19900], billing: 'one_time', available: true,
    blurb: 'A custom website, yours outright — no monthly commitment.',
  },
  website_hosted: {
    name: 'Website, hosted + maintained', price: 4900, floor: 2900, ladder: [4900, 2900],
    billing: 'subscription', available: true,
    blurb: 'Hosting + weekly Google Business Profile posts + review replies + weekly report.',
  },
  ai_front_office: {
    name: 'AI Front Office', price: 29700, floor: 17900, ladder: [29700, 22900, 17900],
    billing: 'subscription', available: true,
    blurb: 'Website + 24/7 AI reception + booking + lead capture + nurture/follow-ups + revenue recovery.',
  },
  ai_reception_only: {
    name: 'AI Reception only', price: 19900, floor: 12900, ladder: [19900, 15900, 12900],
    billing: 'subscription', available: true,
    blurb: '24/7 AI phone reception + booking — no website included.',
  },
  everything: {
    name: 'Everything + Marketing', price: 49900, billing: 'subscription', available: false,
    blurb: 'Website + AI Reception + Lead Gen + Marketing — coming soon.',
  },
  marketing_only: {
    name: 'Marketing only', price: 24900, billing: 'subscription', available: false,
    blurb: 'Marketing only — coming soon.',
  },
}

// The AI decides WHICH plan and WHETHER to move forward (desiredPlan,
// commit) — same separation already proven by `commit` driving the Stripe
// checkout call while the amount itself stays code-controlled. This
// function decides the actual number, so a free-text model can never
// invent or discount a figure outside the approved ladder. `pushbackCount`
// steps through a plan's ladder (0 = list price, 1 = next rung, ...),
// clamped to the last rung (the floor). Returns null if the plan isn't
// sellable yet, or if a stated budget falls below even the floor — the
// caller should fall back to cheapestPlanUnder() in that case, never a flat
// decline.
function resolveOffer(planKey: PlanKey, statedBudgetCents: number, pushbackCount: number): { amountCents: number; atFloor: boolean } | null {
  const plan = PLAN_CATALOG[planKey]
  if (!plan.available) return null
  const ladder = plan.ladder ?? [plan.price]
  const rung = Math.min(Math.max(pushbackCount, 0), ladder.length - 1)
  let amountCents = ladder[rung]
  const floor = plan.floor ?? plan.price
  if (statedBudgetCents > 0 && statedBudgetCents < amountCents) {
    if (statedBudgetCents < floor) return null
    amountCents = Math.max(statedBudgetCents, floor)
  }
  return { amountCents, atFloor: amountCents <= floor }
}

// "Never just say no" fallback: the closest available plan that still fits
// under a stated budget, picked by highest floor-under-budget (closest to
// what they can actually pay, not just the cheapest thing we sell).
function cheapestPlanUnder(statedBudgetCents: number): PlanKey | null {
  const candidates = (Object.entries(PLAN_CATALOG) as [PlanKey, PlanDef][])
    .filter(([, p]) => p.available)
    .map(([key, p]) => [key, p.floor ?? p.price] as const)
    .filter(([, floor]) => floor <= statedBudgetCents)
    .sort((a, b) => b[1] - a[1])
  return candidates[0]?.[0] ?? null
}

// Parses the dollar amount out of a message (e.g. "May be 50", "$99", "how
// about 75 bucks"). Returns 0 if no amount is found. This is what feeds
// resolveOffer()'s statedBudgetCents — the AI itself never states or judges
// a dollar figure, only this regex does.
function extractOfferedPrice(msgBody: string): number {
  const dollarMatch = msgBody.match(/\$\s*(\d+(?:\.\d{1,2})?)/)
  if (dollarMatch) return Math.round(parseFloat(dollarMatch[1]))
  const wordMatch = msgBody.match(/(\d+(?:\.\d{1,2})?)\s*(?:dollar|buck)s?\b/i)
  if (wordMatch) return Math.round(parseFloat(wordMatch[1]))
  return 0
}

// ─── Cal.com booking (Worker port of pipeline/src/reception/cal-booking.ts) ──
// Same Cal.com v2 API — voice reception's version reads CAL_DIY_API_KEY from
// process.env at module scope, which doesn't exist in the Workers runtime, so
// the key is threaded through as a parameter here instead. Everything else
// (plain fetch, response shape) is unchanged from the pipeline version.

interface CalSlot { time: string; label: string }
interface CalBookingResult { ok: boolean; meetingUrl?: string; start?: string; error?: string }

const CAL_BASE = 'https://api.cal.com/v2'
// SMS has no reliable way to detect the lead's real timezone (voice reception
// can ask; a text thread can't without adding a question to every booking
// flow). Fixed to WebCrew's own business timezone until that's worth solving.
const DEFAULT_SMS_BOOKING_TZ = 'America/Chicago'

function calHeaders(apiKey: string, version = '2024-08-13') {
  return { Authorization: `Bearer ${apiKey}`, 'cal-api-version': version, 'Content-Type': 'application/json' }
}

async function getCalSlots(apiKey: string, eventTypeId: string, timezone: string, daysAhead = 5): Promise<CalSlot[]> {
  const startTime = new Date()
  startTime.setHours(startTime.getHours() + 1, 0, 0, 0)
  const endTime = new Date(startTime)
  endTime.setDate(endTime.getDate() + daysAhead)
  const params = new URLSearchParams({
    startTime: startTime.toISOString(), endTime: endTime.toISOString(),
    eventTypeId, timeZone: timezone,
  })
  try {
    const res = await fetch(`${CAL_BASE}/slots/available?${params}`, { headers: calHeaders(apiKey, '2024-09-23') })
    const data: any = await res.json()
    if (!res.ok) return []
    const slotsByDay = data?.data?.slots ?? {}
    const slots: CalSlot[] = []
    for (const daySlots of Object.values(slotsByDay)) {
      for (const s of (daySlots as any[]).slice(0, 2)) {
        const dt = new Date(s.time)
        const label = dt.toLocaleString('en-US', {
          timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit', hour12: true,
        })
        slots.push({ time: s.time, label })
        if (slots.length >= 3) break
      }
      if (slots.length >= 3) break
    }
    return slots
  } catch (e: any) {
    console.error(`[Cal] slots fetch error: ${e?.message ?? e}`)
    return []
  }
}

async function createCalBooking(apiKey: string, opts: {
  eventTypeId: string; start: string; name: string; email: string; phone?: string; timezone: string
}): Promise<CalBookingResult> {
  try {
    const body: any = {
      eventTypeId: Number(opts.eventTypeId), start: opts.start,
      attendee: { name: opts.name, email: opts.email, timeZone: opts.timezone, language: 'en' },
    }
    if (opts.phone) body.metadata = { phone: opts.phone }
    const res = await fetch(`${CAL_BASE}/bookings`, { method: 'POST', headers: calHeaders(apiKey), body: JSON.stringify(body) })
    const data: any = await res.json()
    if (!res.ok) return { ok: false, error: data?.error?.message ?? 'booking failed' }
    return { ok: true, start: data?.data?.start, meetingUrl: data?.data?.meetingUrl ?? data?.data?.location }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) }
  }
}

async function cancelCalBooking(apiKey: string, bookingUid: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${CAL_BASE}/bookings/${bookingUid}/cancel`, {
      method: 'POST', headers: calHeaders(apiKey), body: JSON.stringify({ cancellationReason: reason }),
    })
    const data: any = await res.json()
    if (!res.ok) return { ok: false, error: data?.error?.message ?? 'cancel failed' }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) }
  }
}

// Best-effort match of a free-text reply against previously-offered slot
// labels — e.g. "the first one", "tuesday", "10am works". Not full NLP; if
// nothing matches, Sofia's normal reply just asks them to pick again.
function matchOfferedSlot(msgBody: string, slots: CalSlot[]): CalSlot | null {
  const body = msgBody.toLowerCase().trim()
  const ordinalWords = ['first', 'second', 'third']
  const ordinalIdx = ordinalWords.findIndex(w => body.includes(w))
  if (ordinalIdx >= 0 && slots[ordinalIdx]) return slots[ordinalIdx]
  const numMatch = body.match(/\b([123])\b/)
  if (numMatch && slots[Number(numMatch[1]) - 1]) return slots[Number(numMatch[1]) - 1]
  for (const slot of slots) {
    const [weekday, monthDay] = slot.label.split(',').map(s => s.trim())
    if (weekday && body.includes(weekday.toLowerCase())) return slot
    if (monthDay && body.includes(monthDay.toLowerCase().replace(/\s+/g, ' ').split(' ').slice(0, 2).join(' '))) return slot
  }
  return null
}

// ─── Outbound AI voice call (via reception's Gemini Live /warm-trigger) ──────
// Fully built already — pipeline/src/reception/server.ts:262's /warm-trigger
// already threads triggerType:'form_submit' into the call's system prompt
// (twilio-relay.ts) and the call already has real Cal.com booking +
// escalate_to_human as Gemini Live tools. It just had zero callers. Only ever
// call this after the lead affirmatively asks for a call in an SMS reply —
// the form's consent checkbox covers texts, not calls, so a blind auto-dial
// on raw form submission would be a TCPA problem. See Sofia's wantsCall flag.
const WEBCREW_SALES_CONFIG_ID = '2eb501f4-8af2-4b2c-b60f-5e5dfeec8c8e'

async function triggerOutboundCall(env: Env, opts: { to: string; leadName?: string }): Promise<void> {
  if (!env.RECEPTION_SERVER_URL || !env.RECEPTION_PROVISION_SECRET) return
  try {
    await fetch(`${env.RECEPTION_SERVER_URL}/warm-trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RECEPTION_PROVISION_SECRET}` },
      body: JSON.stringify({
        to: opts.to, configId: WEBCREW_SALES_CONFIG_ID,
        leadName: opts.leadName, triggerType: 'form_submit',
      }),
    })
  } catch (e: any) {
    console.error(`[Sofia] /warm-trigger call error: ${e?.message ?? e}`)
  }
}

// ─── SMS webhook handler ──────────────────────────────────────────────────────

// A text sent to a paying client's OWN AI Reception number belongs to that client's
// customer conversation, not WebCrew's sales funnel. Without this, Sofia (WebCrew's
// sales agent) would answer a client's customer with a website pitch.
interface ClientLine { configId: string; business: string; ownerEmail: string | null; ownerPhone: string | null }

async function lookupClientLine(env: Env, to: string): Promise<ClientLine | null> {
  if (!env.NEON_DATABASE_URL && !env.DATABASE_URL) return null
  const digits = to.replace(/\D/g, '').slice(-10)
  if (digits.length < 10) return null
  const res = await neonQuery(env,
    `SELECT rc.id, rc.business_name, l.email AS owner_email, l.phone AS owner_phone
       FROM reception_configs rc LEFT JOIN leads l ON l.id = rc.lead_id
      WHERE rc.active = TRUE AND rc.twilio_phone IS NOT NULL
        AND RIGHT(regexp_replace(rc.twilio_phone,'\\D','','g'),10) = $1
        AND rtrim(rc.website_url,'/') <> 'https://webcrew.app'
      LIMIT 1`, [digits])
  const row = res?.rows?.[0] ?? res?.[0]
  return row ? { configId: row.id, business: row.business_name, ownerEmail: row.owner_email ?? null, ownerPhone: row.owner_phone ?? null } : null
}

async function handleSMSWebhook(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const raw     = await req.text()
  const params  = new URLSearchParams(raw)

  if (!await validateTwilioSignature(env, req, params)) {
    return new Response('Forbidden', { status: 403 })
  }

  const from    = params.get('From') ?? ''
  const to      = params.get('To') ?? ''
  const msgBody = (params.get('Body') ?? '').trim()

  const twiml = (msg: string) => new Response(
    `<?xml version="1.0"?><Response><Message>${msg.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</Message></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
  const emptyTwiml = () => new Response('<?xml version="1.0"?><Response/>', { headers: { 'Content-Type': 'text/xml' } })

  if (!from || !msgBody) return emptyTwiml()

  const clientLine = await lookupClientLine(env, to)
  const fromDigits = from.replace(/\D/g, '').slice(-10)

  if (!clientLine) ctx.waitUntil(logSmsEvent(env, from, 'sms_replied', { body: msgBody }).catch(() => {}))

  // ── 0. Client line: STOP / HELP / forward to the business owner ─────────────
  if (clientLine) {
    if (isOptOut(msgBody)) {
      ctx.waitUntil(neonQuery(env,
        `UPDATE reception_contacts SET sms_consent=FALSE, updated_at=NOW()
          WHERE config_id=$1 AND RIGHT(regexp_replace(phone,'\\D','','g'),10)=$2`, [clientLine.configId, fromDigits]).catch(() => {}))
      return twiml(`${clientLine.business}: You have been unsubscribed and will receive no further messages from this number.`)
    }
    if (/^help\s*$/i.test(msgBody)) {
      return twiml(`${clientLine.business}: Reply STOP to opt out. Msg&Data rates may apply. To reach us, call this number.`)
    }
    ctx.waitUntil((async () => {
      await neonQuery(env, `INSERT INTO reception_events (config_id, event_type, detail) VALUES ($1,'inbound_sms',$2)`,
        [clientLine.configId, JSON.stringify({ from, body: msgBody.slice(0, 500) })]).catch(() => {})
      const subject = `Text from a customer — ${clientLine.business}`
      const bodyHtml = `<p>A customer texted <strong>${clientLine.business}</strong>'s line.</p><p><strong>From:</strong> ${from}</p><p><strong>Message:</strong> ${msgBody.replace(/&/g, '&amp;').replace(/</g, '&lt;').slice(0, 500)}</p><p>Reply to them directly from your own phone.</p>`
      if (clientLine.ownerEmail) await sendEmail(env, clientLine.ownerEmail, subject, bodyHtml).catch(() => {})
      await sendEmail(env, env.NOTIFICATION_EMAIL, subject, bodyHtml).catch(() => {})
      if (clientLine.ownerPhone) await sendSms(env, clientLine.ownerPhone, `${clientLine.business}: customer text from ${from}: "${msgBody.slice(0, 120)}"`).catch(() => {})
    })())
    // One acknowledgement per customer per 12h, so two auto-responders can never ping-pong.
    const recent = await neonQuery(env,
      `SELECT 1 FROM reception_events WHERE config_id=$1 AND event_type='inbound_sms_ack' AND detail->>'from'=$2 AND created_at > NOW() - interval '12 hours' LIMIT 1`,
      [clientLine.configId, from])
    if ((recent?.rows ?? recent ?? []).length > 0) return emptyTwiml()
    ctx.waitUntil(neonQuery(env, `INSERT INTO reception_events (config_id, event_type, detail) VALUES ($1,'inbound_sms_ack',$2)`,
      [clientLine.configId, JSON.stringify({ from })]).catch(() => {}))
    return twiml(`Thanks — ${clientLine.business} got your message and will get back to you shortly.`)
  }

  // ── 1. STOP / opt-out (TCPA — hardcoded, never AI) ──────────────────────
  // TCPA requires: immediate stop, confirmation message, no further messages
  if (isOptOut(msgBody)) {
    ctx.waitUntil((async () => {
      await neonQuery(env, `UPDATE leads SET sms_opt_out=TRUE, updated_at=NOW() WHERE RIGHT(regexp_replace(phone,'\\D','','g'),10)=RIGHT(regexp_replace($1,'\\D','','g'),10) OR RIGHT(regexp_replace(international_phone,'\\D','','g'),10)=RIGHT(regexp_replace($1,'\\D','','g'),10)`, [from]).catch(() => {})
      // Match on digits, not the raw string — `from` may arrive `whatsapp:`-prefixed
      // while the consent row was recorded (via recordSmsConsent) as bare E.164.
      // An exact-string match here would silently fail to revoke a WhatsApp opt-out.
      await neonQuery(env, `UPDATE consent_events SET revoked_at=NOW() WHERE channel='sms' AND RIGHT(regexp_replace(contact,'\\D','','g'),10)=RIGHT(regexp_replace($1,'\\D','','g'),10) AND revoked_at IS NULL`, [from]).catch(() => {})
      await neonQuery(env, `INSERT INTO sms_conversations (phone,stage,last_message) VALUES ($1,'closed',$2) ON CONFLICT(phone) DO UPDATE SET stage='closed', last_message=$2, updated_at=NOW()`, [from, msgBody]).catch(() => {})
    })())
    // TCPA-exact: must confirm unsubscribe, must say "no more messages"
    return twiml("WEBCREW: You have been unsubscribed and will receive no further messages from this number. Contact hello@webcrew.app if you need anything.")
  }

  // ── 1b. HELP keyword (10DLC / CTIA requirement — hardcoded, never AI) ────
  if (/^help\s*$/i.test(msgBody.trim())) {
    return twiml("WEBCREW: Sofia here from WebCrew — we build websites for local businesses. For support: hello@webcrew.app or webcrew.app. Reply STOP to opt out. Msg&Data rates may apply.")
  }

  // A caller may reply with an email while still speaking to the live
  // receptionist. Capture this before the normal SMS sales conversation.
  if (env.NEON_DATABASE_URL && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(msgBody)) {
    const pending = await neonQuery(env,
      `UPDATE reception_email_verifications
       SET email=$2, status='verified', verified_at=NOW()
       WHERE id=(SELECT id FROM reception_email_verifications
                 WHERE phone=$1 AND status='pending' AND expires_at>NOW()
                 ORDER BY created_at DESC LIMIT 1)
       RETURNING id`,
      [from, msgBody.toLowerCase()]
    ).catch(() => null)
    if (pending?.rows?.[0]) {
      return twiml('Thanks — your email was verified. Please stay on the call while the receptionist confirms it.')
    }
  }

  // ── 1c. Inbound reply = consent to continue the conversation (TCPA) ──────
  // Unlocks outbound SMS for this number in the pipeline's consent gate.
  ctx.waitUntil(recordSmsConsent(env, from, 'inbound_reply', 'sms_inbound', msgBody, req).catch(() => {}))

  // ── 2. Owner appointment confirmation (existing clients) ─────────────────
  if (env.NEON_DATABASE_URL) {
    const ownerRows = await neonQuery(env,
      `SELECT id, attendee_name, attendee_phone, business_name, review_link
       FROM cal_bookings WHERE business_owner_phone=$1
       AND host_confirmed IS NULL AND host_confirm_sent_at IS NOT NULL
       AND end_time > NOW() - INTERVAL '24 hours'
       ORDER BY end_time DESC LIMIT 1`,
      [from]
    )
    const ob = ownerRows?.rows?.[0]
    if (ob) {
      const ownerYes = /^(yes|y|yeah|yep|showed|attended|came)/i.test(msgBody.trim())
      const ownerNo  = /^(no|n|nope|didn'?t|no.?show|miss)/i.test(msgBody.trim())
      if (ownerYes || ownerNo) {
        ctx.waitUntil((async () => {
          if (ownerYes) {
            await neonQuery(env, `UPDATE cal_bookings SET host_confirmed=TRUE, host_confirmed_at=NOW() WHERE id=$1`, [ob.id]).catch(() => {})
            if (ob.attendee_phone && await canTextNow(env, ob.attendee_phone)) {
              const first = (ob.attendee_name || 'there').split(' ')[0]
              await sendSms(env, ob.attendee_phone, `Hi ${first}! Thanks for visiting ${ob.business_name}. Mind leaving a quick review? ${ob.review_link || 'https://webcrew.app/review'}`)
              await neonQuery(env, `UPDATE cal_bookings SET review_request_sent_at=NOW() WHERE id=$1`, [ob.id]).catch(() => {})
            }
          } else {
            await neonQuery(env, `UPDATE cal_bookings SET host_confirmed=FALSE, host_confirmed_at=NOW(), status='no_show' WHERE id=$1`, [ob.id]).catch(() => {})
            if (ob.attendee_phone && await canTextNow(env, ob.attendee_phone)) {
              const first = (ob.attendee_name || 'there').split(' ')[0]
              await sendSms(env, ob.attendee_phone, `Hi ${first}! Looks like you missed your appointment at ${ob.business_name}. Easy to rebook: ${env.CALENDLY_URL || 'webcrew.app'}`)
            }
          }
        })())
        return twiml(ownerYes
          ? `Got it! We'll send ${(ob.attendee_name || 'them').split(' ')[0]} a review request now. Thanks!`
          : `Got it — we'll reach out to help them reschedule. Thanks for letting us know!`)
      }
    }
  }

  // ── 2b. Attendee-initiated reschedule ─────────────────────────────────────
  // Only real path to move an existing booking used to be canceling via
  // Cal.com's own link and rebooking from scratch — no voice or SMS tool
  // existed to originate a reschedule. Checked before the cancel handler
  // below so "reschedule" (which doesn't contain "cancel") never collides
  // with it, and an ambiguous "cancel and reschedule" prefers offering new
  // times over a bare cancellation. Reuses the same real-slots + pending_slots
  // + stage='booking' short-circuit (3b below) the original booking flow
  // uses, instead of new pick-a-slot logic.
  const RESCHEDULE_RE = /\b(resched\w*|move (my|the) (appointment|booking|meeting)|change (my|the) (appointment|time|booking)|different time|another time)\b/i
  if (env.NEON_DATABASE_URL && env.CAL_DIY_API_KEY && RESCHEDULE_RE.test(msgBody)) {
    const activeBooking = await neonQuery(env, `
      SELECT id, booking_uid, business_name, event_type_id FROM cal_bookings
      WHERE attendee_phone=$1 AND status='confirmed' AND start_time > NOW()
      ORDER BY start_time ASC LIMIT 1
    `, [from])
    const bk = activeBooking?.rows?.[0] ?? activeBooking?.[0]
    if (bk) {
      const slots = await getCalSlots(env.CAL_DIY_API_KEY, bk.event_type_id || env.CAL_EVENT_TYPE_ID || '6126925', DEFAULT_SMS_BOOKING_TZ)
      if (slots.length) {
        const cancelResult = await cancelCalBooking(env.CAL_DIY_API_KEY, bk.booking_uid, 'Rescheduling by attendee via SMS')
        if (cancelResult.ok) {
          await neonQuery(env, `UPDATE cal_bookings SET status='cancelled' WHERE id=$1`, [bk.id]).catch(() => {})
          const slotsMsg = `No problem — here's what's open:\n${slots.map((s, i) => `${i + 1}. ${s.label}`).join('\n')}\n\nReply with the one that works.`
          await neonQuery(env, `
            INSERT INTO sms_conversations (phone, stage, last_reply, pending_slots)
            VALUES ($1, 'booking', $2, $3::jsonb)
            ON CONFLICT(phone) DO UPDATE SET stage='booking', last_reply=$2, pending_slots=$3::jsonb, updated_at=NOW()
          `, [from, slotsMsg, JSON.stringify(slots)]).catch(() => {})
          return twiml(slotsMsg)
        }
        console.error(`[Cal] Reschedule-cancel failed for booking ${bk.booking_uid}: ${cancelResult.error}`)
      }
    }
    // No active booking, or no slots available — fall through to normal
    // Sofia handling rather than a dead end.
  }

  // ── 2c. Attendee-initiated booking cancellation ───────────────────────────
  // "cancel" is now only treated as an SMS opt-out when it's the entire
  // message (see isOptOut/CANCEL_OPT_OUT_RE) — any other message containing
  // "cancel" reaches here instead. Real bug this closes: the booking
  // confirmation SMS used to say "Reply CANCEL to cancel," and every reply
  // silently opted the customer out of SMS while leaving the appointment
  // booked. Only acts when there's a real upcoming booking for this phone,
  // and skips if the message negates the cancel intent ("don't cancel").
  if (env.NEON_DATABASE_URL && env.CAL_DIY_API_KEY
      && /\bcancel\b/i.test(msgBody) && !NEGATION_RE.test(msgBody.replace(/\bcancel\b/i, ''))) {
    const activeBooking = await neonQuery(env, `
      SELECT id, booking_uid, business_name FROM cal_bookings
      WHERE attendee_phone=$1 AND status='confirmed' AND start_time > NOW()
      ORDER BY start_time ASC LIMIT 1
    `, [from])
    const bk = activeBooking?.rows?.[0] ?? activeBooking?.[0]
    if (bk) {
      const result = await cancelCalBooking(env.CAL_DIY_API_KEY, bk.booking_uid, 'Cancelled by attendee via SMS')
      if (result.ok) {
        await neonQuery(env, `UPDATE cal_bookings SET status='cancelled' WHERE id=$1`, [bk.id]).catch(() => {})
        ctx.waitUntil(sendEmail(env, env.NOTIFICATION_EMAIL,
          `❌ Appointment cancelled via SMS — ${bk.business_name || 'a client'}`,
          `<p>Attendee ${from} cancelled their appointment (booking ${bk.booking_uid}) by texting "${msgBody.slice(0, 120)}".</p>`
        ).catch(() => {}))
        return twiml(`Done — your appointment is cancelled. Want to pick a new time? Just say the word.`)
      }
      console.error(`[Cal] SMS cancel failed for booking ${bk.booking_uid}: ${result.error}`)
      // Cal.com call failed — fall through to normal Sofia handling rather
      // than leaving them stuck on a dead end.
    }
    // No active booking found for this phone — "cancel" wasn't about an
    // appointment (could be a subscription-cancel request or unrelated);
    // fall through to normal Sofia handling, where needsHuman can catch it.
  }

  // ── 2d. Missed-call callback request ──────────────────────────────────────
  // A customer replying "CALL" to the missed-call recovery SMS (handleCallStatus)
  // is asking for one immediate AI voice callback. Matched on phone + a pending
  // (callback_requested=FALSE) missed_calls row within a short window — same
  // phone-only matching convention as 2b/2c above and reception_email_verifications,
  // no per-client config lookup needed since missed_calls.config_id already ties
  // the row to the right business. The window + explicit-keyword requirement are
  // what make this one invited, one-time call rather than a standing voice-consent
  // grant — do not widen the regex or the window without re-checking that reasoning.
  if (env.NEON_DATABASE_URL) {
    const missedRows = await neonQuery(env, `
      SELECT id, config_id FROM missed_calls
      WHERE caller=$1 AND callback_requested=FALSE
        AND created_at > NOW() - INTERVAL '60 minutes'
      ORDER BY created_at DESC LIMIT 1
    `, [from])
    const missedCall = missedRows?.rows?.[0] ?? missedRows?.[0]
    if (missedCall && /^\s*(call( me)?|yes|y)\b/i.test(msgBody)) {
      ctx.waitUntil((async () => {
        let callSid: string | null = null
        let status = 'failed'
        try {
          if (env.RECEPTION_SERVER_URL && env.RECEPTION_PROVISION_SECRET && missedCall.config_id) {
            const res = await fetch(`${env.RECEPTION_SERVER_URL}/warm-trigger`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RECEPTION_PROVISION_SECRET}` },
              body: JSON.stringify({ to: from, configId: missedCall.config_id, from: to || undefined, triggerType: 'missed_call_callback' }),
            })
            const result = await res.json().catch(() => null) as any
            callSid = result?.callSid ?? null
            status = res.ok ? 'initiated' : 'failed'
          }
        } catch (e: any) {
          console.error(`[MissedCallCallback] trigger failed: ${e.message}`)
        }
        await neonQuery(env, `
          UPDATE missed_calls SET callback_requested=TRUE, callback_requested_at=NOW(),
                 callback_sid=$2, callback_sent_at=NOW(), callback_status=$3
          WHERE id=$1
        `, [missedCall.id, callSid, status]).catch(() => {})
      })())
      return twiml(`Calling you now!`)
    }
  }

  // ── 3. Load full conversation context + history ───────────────────────────
  const convRows = await neonQuery(env, `SELECT stage, demo_url, offered_price, last_message, last_reply, messages, lead_id, summary, pending_slots, desired_plan, price_pushback_count FROM sms_conversations WHERE phone=$1`, [from])
  const conv = convRows?.rows?.[0] ?? convRows?.[0]

  // leads.phone has NO unique constraint — the same real phone number can end
  // up on more than one leads row (e.g. a sheet-sourced test/duplicate entry
  // alongside a manually-created one), and which row is "current" has nothing
  // to do with which was created first. Once a conversation has resolved a
  // lead identity once, PIN it (sms_conversations.lead_id) and always look up
  // by that id on every later turn — never re-run the fuzzy phone match again,
  // or the conversation can silently flip identity mid-conversation depending
  // on unrelated row activity. Only the very first turn (no pin yet) does the
  // best-effort fuzzy match, tie-broken by most-recently-active row.
  const leadRows = conv?.lead_id
    ? await neonQuery(env, `SELECT id, name, niche, city, tier, cloudflare_url, vercel_url, source, email FROM leads WHERE id=$1`, [conv.lead_id])
    : await neonQuery(env, `
        SELECT id, name, niche, city, tier, cloudflare_url, vercel_url, source, email FROM leads
        WHERE RIGHT(regexp_replace(phone,'\\D','','g'),10)=RIGHT(regexp_replace($1,'\\D','','g'),10)
           OR RIGHT(regexp_replace(international_phone,'\\D','','g'),10)=RIGHT(regexp_replace($1,'\\D','','g'),10)
        ORDER BY updated_at DESC LIMIT 1
      `, [from])
  const lead = leadRows?.rows?.[0] ?? leadRows?.[0]

  const convStage    = (conv?.stage        ?? 'initial') as string
  const demoUrl      = (conv?.demo_url     ?? lead?.cloudflare_url ?? lead?.vercel_url ?? '') as string
  const offeredPrice = (conv?.offered_price ?? 0) as number
  const lastMessage  = (conv?.last_message  ?? '') as string
  const lastReply    = (conv?.last_reply    ?? '') as string
  const leadId       = (lead?.id    ?? '') as string
  const leadName     = (lead?.name  ?? '') as string
  const leadNiche    = (lead?.niche ?? 'local business') as string
  const leadCity     = (lead?.city  ?? '') as string   // empty = unknown → Sofia says "your city", never guesses
  const leadTier     = (lead?.tier  ?? 'tier1') as string
  const leadSource   = (lead?.source ?? '') as string
  const leadEmail    = (lead?.email  ?? '') as string
  const cal          = env.CALENDLY_URL || 'webcrew.app'
  let conversationSummary = (conv?.summary ?? '') as string

  // Full chat history — last 20 turns (40 messages) to stay within context.
  // Anything older than that lives in conversationSummary instead (see below).
  let history: ChatMessage[] = []
  try {
    const raw = typeof conv?.messages === 'string' ? JSON.parse(conv.messages) : (conv?.messages ?? [])
    history = Array.isArray(raw) ? raw.slice(-40) : []
  } catch {}

  // ── 3b. Booking-stage slot pick — a reply while real Cal.com slots are
  // pending (see the newStage==='booking' block below) is checked against
  // those offered labels before Sofia's normal turn runs. A match books
  // directly and short-circuits; no match falls through to a normal Sofia
  // reply, which naturally asks again.
  if (convStage === 'booking' && env.CAL_DIY_API_KEY) {
    let pendingSlots: CalSlot[] = []
    try {
      const raw = typeof conv?.pending_slots === 'string' ? JSON.parse(conv.pending_slots) : (conv?.pending_slots ?? [])
      pendingSlots = Array.isArray(raw) ? raw : []
    } catch {}
    const picked = pendingSlots.length ? matchOfferedSlot(msgBody, pendingSlots) : null
    if (picked) {
      const booking = await createCalBooking(env.CAL_DIY_API_KEY, {
        eventTypeId: env.CAL_EVENT_TYPE_ID || '6126925',
        start: picked.time,
        name: leadName || 'WebCrew lead',
        email: leadEmail || `${from.replace(/\D/g, '')}@sms.webcrew.app`,
        phone: from,
        timezone: DEFAULT_SMS_BOOKING_TZ,
      })
      if (booking.ok) {
        const confirmReply = `Booked — ${picked.label}! ${booking.meetingUrl ? `Details: ${booking.meetingUrl}` : "We'll see you then!"}\n\n— Sofia, WebCrew`
        const bookedHistory: ChatMessage[] = [
          ...history, { role: 'user' as const, text: msgBody }, { role: 'model' as const, text: confirmReply },
        ].slice(-40)
        ctx.waitUntil((async () => {
          await neonQuery(env, `
            INSERT INTO sms_conversations (phone, stage, last_message, last_reply, messages, lead_id, pending_slots)
            VALUES ($1,'booked',$2,$3,$4::jsonb,$5,NULL)
            ON CONFLICT(phone) DO UPDATE SET
              stage='booked', last_message=$2, last_reply=$3, messages=$4::jsonb,
              lead_id=COALESCE(sms_conversations.lead_id,$5), pending_slots=NULL, updated_at=NOW()
          `, [from, msgBody, confirmReply, JSON.stringify(bookedHistory), leadId || null]).catch(() => {})
          await sendEmail(env, env.NOTIFICATION_EMAIL,
            `✅ Booked via SMS — ${leadName || from} (${leadNiche})`,
            `<p>Real Cal.com booking confirmed by Sofia over SMS: <b>${picked.label}</b>${booking.meetingUrl ? ` — <a href="${booking.meetingUrl}">${booking.meetingUrl}</a>` : ''}</p><p>Phone: ${from}</p>`
          ).catch(() => {})
        })())
        return twiml(confirmReply)
      }
      console.error(`[Sofia] Cal.com booking failed for ${from}: ${booking.error}`)
      // Booking API failed — fall through to a normal Sofia turn rather than leaving them stuck.
    }
  }

  // ── 4/5. Sofia (Gemini) reads full context + tone, decides the reply AND
  // whether this message is a genuine commit to move forward — one call
  // replaces the old flat keyword gate + separate free-text reply, so
  // wording like "yeah sure" or "ok show me" closes the loop as reliably
  // as a literal "yes", and "not interested" can never false-trigger it.
  const skipBuildStages = ['building', 'demo_sent', 'booked', 'closed', 'support']

  // Symmetric fix to voice's getRecentCallerContext (pipeline/src/reception/
  // db.ts) reading sms_conversations — Sofia should know about a recent call
  // too, not just voice knowing about SMS. Same Neon Postgres both ways, so
  // this is a plain query, not a cross-service call. Only worth fetching on
  // the first turn of a conversation — after that it's already folded into
  // the ongoing history/summary, no need to re-query every message.
  let callContext = ''
  if (history.length === 0) {
    const calls = await neonQuery(env,
      `SELECT created_at, transcript, message_taken FROM call_logs WHERE caller_number=$1 ORDER BY created_at DESC LIMIT 2`,
      [from]
    ).catch(() => null)
    const rows = calls?.rows ?? calls ?? []
    if (rows.length) {
      callContext = rows.map((r: any) => `Call on ${r.created_at}: ${(r.transcript || r.message_taken || '').slice(-1200)}`).join('\n')
    }
  }

  const systemPrompt = buildSalesPrompt({
    leadName, leadNiche, leadCity, leadTier,
    convStage, demoUrl, lastMessage, lastReply, offeredPrice, calendlyUrl: cal,
    historyLen: history.length, conversationSummary, leadSource, callContext,
  })
  const fallback = buildFallback(msgBody, leadNiche, leadCity, convStage, history.length, cal)

  let reply = fallback
  let commit = false
  let wantsCall = false
  let needsHuman = false
  let sofiaDesiredPlan: PlanKey | null = null
  let sofiaAnswered = false
  try {
    const sofia = await geminiSMSReply(env, systemPrompt, history, msgBody)
    if (sofia) {
      reply = sofia.reply
      commit = sofia.commit
      wantsCall = sofia.wantsCall
      needsHuman = sofia.needsHuman
      sofiaDesiredPlan = sofia.desiredPlan
      sofiaAnswered = true
    } else {
      console.warn(`[Sofia] Gemini returned no valid reply for ${from} | stage=${convStage} | msg="${msgBody.slice(0,40)}"`)
    }
  } catch (e: any) {
    console.error(`[Sofia] Gemini error for ${from}: ${e?.message ?? e}`)
  }

  // Gemini unavailable this turn — fall back to the old keyword read so an
  // unambiguous "yes"/"interested" still closes the loop during an outage,
  // rather than silently losing the commit signal entirely.
  if (!sofiaAnswered) commit = isYes(msgBody)

  // Which plan is actually in play: this turn's read if Sofia gave one,
  // else whatever was already established, else the default flagship pitch
  // (matches "default-pitch $297, branch on pushback"). Persisted below so
  // it carries forward even on turns where Gemini doesn't restate it.
  const persistedDesiredPlan: PlanKey | null =
    (PLAN_KEYS as readonly string[]).includes(conv?.desired_plan) ? (conv.desired_plan as PlanKey) : null
  const desiredPlan: PlanKey = sofiaDesiredPlan || persistedDesiredPlan || 'ai_front_office'

  // Lead explicitly asked to be called — fire the outbound AI voice call
  // (see triggerOutboundCall above). Independent of commit/booking-stage
  // logic below; a lead can ask for a call at any point in the conversation.
  if (wantsCall && from) {
    ctx.waitUntil(triggerOutboundCall(env, { to: from, leadName }))
  }

  // Sofia judged herself out of her depth — floor price already shown and
  // still declined, hostility, or something outside what she can resolve.
  // HITL: email Ranjeet so a human picks this up instead of the bot looping
  // the same pitch. Independent of commit/stage — can fire at any point.
  if (needsHuman) {
    ctx.waitUntil(sendEmail(env, env.NOTIFICATION_EMAIL,
      `🆘 Sofia needs a human — ${leadName || from} (${leadNiche})`,
      `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
        <h2 style="color:#dc2626">🆘 Sofia flagged this conversation for a human</h2>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:6px 0;color:#666;width:90px"><b>Business</b></td><td>${leadName || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#666"><b>Niche</b></td><td>${leadNiche}</td></tr>
          <tr><td style="padding:6px 0;color:#666"><b>City</b></td><td>${leadCity || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#666"><b>Phone</b></td><td>${from}</td></tr>
          <tr><td style="padding:6px 0;color:#666"><b>Stage</b></td><td>${convStage}</td></tr>
          <tr><td style="padding:6px 0;color:#666"><b>They said</b></td><td>"${msgBody.slice(0,160)}"</td></tr>
          <tr><td style="padding:6px 0;color:#666"><b>Sofia's reply</b></td><td>"${reply.slice(0,160)}"</td></tr>
        </table>
        <p>Reply directly by texting ${from}, or call them — the AI has told them a team member will follow up.</p>
      </div>`).catch(() => {}))
  }

  // Demand capture for the two SKUs that aren't sellable yet — only once per
  // switch INTO wanting one, not every turn of the same interest.
  if (!PLAN_CATALOG[desiredPlan].available && desiredPlan !== persistedDesiredPlan) {
    ctx.waitUntil(neonQuery(env,
      `INSERT INTO waitlist_signups (phone, email, plan_key, source) VALUES ($1, $2, $3, 'sms')`,
      [from, leadEmail || null, desiredPlan]
    ).catch(() => {}))
  }

  if (commit && !skipBuildStages.includes(convStage) && PLAN_CATALOG[desiredPlan].available) {
    const confirmMsg = sofiaAnswered
      ? reply
      : (leadName
          ? `On it! I'm building a custom ${leadNiche} site for ${leadName} in ${leadCity} now. Ready in ~10 min — I'll text you the link! - Sofia`
          : `On it! Building your custom site now — should be ready in ~10 min. I'll text you the link! - Sofia`)
    const updatedHistory: ChatMessage[] = [
      ...history,
      { role: 'user' as const, text: msgBody },
      { role: 'model' as const, text: confirmMsg },
    ].slice(-40)
    ctx.waitUntil((async () => {
      await neonQuery(env, `INSERT INTO build_requests (phone,name,niche,city,status) VALUES ($1,$2,$3,$4,'pending') ON CONFLICT DO NOTHING`, [from, leadName, leadNiche, leadCity]).catch(() => {})
      await neonQuery(env, `
        INSERT INTO sms_conversations (phone, stage, last_message, last_reply, messages, lead_id)
        VALUES ($1, 'building', $2, $3, $4::jsonb, $5)
        ON CONFLICT(phone) DO UPDATE SET
          stage='building', last_message=$2, last_reply=$3,
          messages=$4::jsonb, lead_id=COALESCE(sms_conversations.lead_id,$5), updated_at=NOW()
      `, [from, msgBody, confirmMsg, JSON.stringify(updatedHistory), leadId || null]).catch(() => {})
      if (leadId) {
        await neonQuery(env, `UPDATE leads SET status='conversation_active', updated_at=NOW() WHERE id=$1`, [leadId]).catch(() => {})
      }
      await notifyHITL(env, from, leadName, leadNiche, leadCity, '').catch(() => {})
    })())
    return twiml(confirmMsg)
  }

  const newStage = upgradeStage(msgBody, reply, convStage, history.length)
  // Now the actual input to resolveOffer() below — a lead counter-offering a
  // number is what lets the budget-negotiation ladder respond to it.
  const extractedPrice = extractOfferedPrice(msgBody)

  // Deterministic price resolution — same separation as `commit` above: the
  // AI decided WHICH plan (desiredPlan) and WHETHER to move forward
  // (commit); this decides the actual number, so a free-text model can
  // never invent or discount a figure outside the approved ladder.
  // pushbackCountUsed is read BEFORE any increment below — every non-
  // committing turn spent discussing price (including the first) advances
  // the ladder one rung for the NEXT turn, simple and predictable rather
  // than trying to semantically detect "was that a real objection."
  const POST_DEMO_STAGES = ['demo_sent', 'price_asked', 'negotiating']
  const PRICE_DISCUSSION_STAGES = ['price_asked', 'negotiating']
  const pushbackCountUsed = (conv?.price_pushback_count ?? 0) as number
  let nextPushbackCount = pushbackCountUsed
  let finalOfferedPrice = Math.max(offeredPrice, extractedPrice)
  const plan = PLAN_CATALOG[desiredPlan]
  const priceLabelFor = (p: PlanDef, cents: number) => p.billing === 'one_time' ? `$${(cents / 100).toFixed(0)} one-time` : `$${(cents / 100).toFixed(0)}/mo`
  const priceLabel = (cents: number) => priceLabelFor(plan, cents)

  let checkoutOffer: { amountCents: number; atFloor: boolean } | null = null
  if (POST_DEMO_STAGES.includes(newStage) && plan.available) {
    const statedBudgetCents = extractedPrice > 0 ? extractedPrice * 100 : 0
    checkoutOffer = resolveOffer(desiredPlan, statedBudgetCents, pushbackCountUsed)
  }

  // Autonomous close: the moment Sofia judges genuine agreement to move
  // forward at a post-demo stage, send a real Stripe checkout link for the
  // resolved plan/amount — don't wait for a human call. demoUrl is required
  // for the AI Front Office / hosted-website bundle (reliable proxy for
  // "don't send a link for a site that doesn't exist yet"); AI Reception
  // only needs no site build, so it's exempt from that check.
  const needsDemo = desiredPlan === 'ai_front_office' || desiredPlan === 'website_hosted' || desiredPlan === 'website_only'
  if (commit && leadId && checkoutOffer && (!needsDemo || demoUrl) && Math.round(offeredPrice * 100) !== checkoutOffer.amountCents) {
    const checkoutUrl = await createStripeCheckoutLink(env, {
      leadId, leadName: leadName || 'your business', leadNiche,
      planKey: desiredPlan, amountCents: checkoutOffer.amountCents,
    })
    if (checkoutUrl) {
      const shortCheckoutUrl = await createShortLink(env, checkoutUrl)
      const billingLine = plan.billing === 'subscription'
        ? `$0 today, your ${trialWindowLabel()} starts right away, then ${priceLabel(checkoutOffer.amountCents)}.`
        : `${priceLabel(checkoutOffer.amountCents)} — one payment, it's yours.`
      reply = `${reply}\n\nSet up here: ${shortCheckoutUrl}\n\n${billingLine} Once it's confirmed I'll text you the moment it's live. Prefer to talk it through first? Just say the word and I'll get you on a quick call.`
      finalOfferedPrice = checkoutOffer.amountCents / 100
      nextPushbackCount = 0
      ctx.waitUntil(notifyAutoClose(env, { phone: from, leadName: leadName || from, leadNiche, leadCity, amountCents: checkoutOffer.amountCents, checkoutUrl }))
    }
  } else if (!commit && checkoutOffer && PRICE_DISCUSSION_STAGES.includes(newStage)) {
    const statedBudgetCents = extractedPrice > 0 ? extractedPrice * 100 : 0
    if (pushbackCountUsed === 0 && statedBudgetCents === 0) {
      // Budget-first, always: haven't asked yet and they haven't volunteered
      // one — ask instead of quoting. Code-enforced, not just prompted, so
      // this holds even if Gemini's own reply forgets to ask.
      reply = `${reply}\n\nWhat's a comfortable monthly budget for you? I'll find the best fit.`
      nextPushbackCount = 1
    } else {
      // Budget known (either just stated, or we already asked once and
      // they're still discussing) — show the resolved number, never a raw
      // AI-invented figure. Advance the ladder for the next turn.
      reply = `${reply}\n\n${plan.name}: ${priceLabel(checkoutOffer.amountCents)}${plan.billing === 'subscription' ? ' (after $0 setup + 30-day trial)' : ''}.`
      finalOfferedPrice = checkoutOffer.amountCents / 100
      nextPushbackCount = pushbackCountUsed + 1
    }
  } else if (!checkoutOffer && POST_DEMO_STAGES.includes(newStage) && !plan.available) {
    reply = `${reply}\n\nThat one's not live yet, but I've got you on the list — I'll text you the second it's ready!`
  } else if (!checkoutOffer && POST_DEMO_STAGES.includes(newStage) && extractedPrice > 0) {
    // Available plan, but their stated budget is below even its floor —
    // offer the closest cheaper plan instead of a flat decline.
    const cheaper = cheapestPlanUnder(extractedPrice * 100)
    if (cheaper && cheaper !== desiredPlan) {
      const cp = PLAN_CATALOG[cheaper]
      reply = `${reply}\n\nThat's tight for ${plan.name} — but ${cp.name} fits at ${priceLabelFor(cp, cp.price)}. Want that instead?`
    } else {
      reply = `${reply}\n\nLet's get you on a quick free call — our team can work out something that fits: ${cal}`
    }
  }

  // Append this turn to history, cap at 40 messages (~20 back-and-forth turns).
  // Once a conversation is mature (already at the cap), every further turn
  // pushes 2 old messages off the window — fold them into the running summary
  // instead of just dropping them. Small, cheap call (short prompt, low
  // output cap); a genuinely long conversation is already the high-value case
  // worth the extra Gemini call to not lose context on.
  const combinedTurn: ChatMessage[] = [
    ...history,
    { role: 'user' as const,  text: msgBody },
    { role: 'model' as const, text: reply   },
  ]
  let updatedHistory = combinedTurn
  if (combinedTurn.length > 40) {
    const dropped = combinedTurn.slice(0, combinedTurn.length - 40)
    updatedHistory = combinedTurn.slice(combinedTurn.length - 40)
    conversationSummary = await summarizeConversation(env, conversationSummary, dropped).catch(() => conversationSummary)
  }

  // Real Cal.com slots the first turn a conversation reaches booking stage —
  // replaces the static Calendly link with actual open times (matched
  // against a reply by the 3b short-circuit above on the next turn).
  let slotsForPersist: CalSlot[] | null = null
  if (newStage === 'booking' && convStage !== 'booking' && env.CAL_DIY_API_KEY) {
    const slots = await getCalSlots(env.CAL_DIY_API_KEY, env.CAL_EVENT_TYPE_ID || '6126925', DEFAULT_SMS_BOOKING_TZ)
    if (slots.length) {
      slotsForPersist = slots
      reply = `${reply}\n\nOpen times:\n${slots.map((s, i) => `${i + 1}. ${s.label}`).join('\n')}\n\nReply with the one that works.`
    }
  }

  // HITL: deal reached booking stage → email Ranjeet to jump in and close live
  if (newStage === 'booking' && convStage !== 'booking') {
    ctx.waitUntil(sendEmail(env, env.NOTIFICATION_EMAIL,
      `📞 HOT — booking stage: ${leadName || from} (${leadNiche})`,
      `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
        <h2 style="color:#16a34a">📞 Lead ready to book — jump in now</h2>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:6px 0;color:#666;width:90px"><b>Business</b></td><td>${leadName || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#666"><b>Niche</b></td><td>${leadNiche}</td></tr>
          <tr><td style="padding:6px 0;color:#666"><b>City</b></td><td>${leadCity || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#666"><b>Phone</b></td><td>${from}</td></tr>
          <tr><td style="padding:6px 0;color:#666"><b>Agreed $</b></td><td>${offeredPrice > 0 ? '$' + offeredPrice : '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#666"><b>Demo</b></td><td>${demoUrl ? `<a href="https://${demoUrl.replace(/^https?:\/\//,'')}">${demoUrl}</a>` : '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#666"><b>They said</b></td><td>"${msgBody.slice(0,120)}"</td></tr>
        </table>
        <p>Sofia sent them the calendar. Watch for the booking + close the deal on the call.</p>
      </div>`).catch(() => {}))
  }

  // Price negotiation is over once a deal is booked or dead — don't carry a
  // stale ladder rung into whatever conversation comes next.
  if (['booking', 'booked', 'closed'].includes(newStage)) nextPushbackCount = 0

  ctx.waitUntil(
    neonQuery(env, `
      INSERT INTO sms_conversations (phone, stage, demo_url, offered_price, last_message, last_reply, messages, lead_id, summary, pending_slots, desired_plan, price_pushback_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb, $11, $12)
      ON CONFLICT(phone) DO UPDATE SET
        stage         = $2,
        demo_url      = COALESCE(NULLIF($3,''), sms_conversations.demo_url),
        offered_price = CASE WHEN $4 > 0 THEN $4 ELSE sms_conversations.offered_price END,
        last_message  = $5,
        last_reply    = $6,
        messages      = $7::jsonb,
        lead_id       = COALESCE(sms_conversations.lead_id, $8),
        summary       = $9,
        pending_slots = CASE WHEN $10::jsonb IS NOT NULL THEN $10::jsonb
                             WHEN $2 <> 'booking' THEN NULL
                             ELSE sms_conversations.pending_slots END,
        desired_plan  = $11,
        price_pushback_count = $12,
        updated_at    = NOW()
    `, [from, newStage, demoUrl, finalOfferedPrice, msgBody, reply, JSON.stringify(updatedHistory), leadId || null, conversationSummary || null, slotsForPersist ? JSON.stringify(slotsForPersist) : null, desiredPlan, nextPushbackCount]).catch(() => {})
  )

  return twiml(reply)
}

// ─── POST /audit handler ──────────────────────────────────────────────────

// ─── POST /waitlist handler ────────────────────────────────────────────────
// Demand capture for the two not-yet-built SKUs (everything/marketing_only)
// from webcrew.app's pricing page directly — same waitlist_signups table
// Sofia/voice write to when a lead asks for either mid-conversation.
async function handleWaitlistSignup(req: Request, env: Env): Promise<Response> {
  if (await isRateLimited(env, req, 'waitlist', 5, 10)) return rateLimitedResponse()
  const body = await req.json() as { email?: string; planKey?: string }
  if (!body.email || !(PLAN_KEYS as readonly string[]).includes(body.planKey ?? '')) {
    return new Response(JSON.stringify({ error: 'email and a valid planKey are required' }), {
      status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
  await neonQuery(env,
    `INSERT INTO waitlist_signups (email, plan_key, source) VALUES ($1, $2, 'webcrew.app/pricing')`,
    [body.email, body.planKey]
  ).catch(() => {})
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

async function handleAuditRequest(req: Request, env: Env): Promise<Response> {
  if (await isRateLimited(env, req, 'audit', 5, 10)) return rateLimitedResponse()
  const { name, email, phone, websiteUrl, source, referredBy } = await req.json() as {
    name: string; email: string; phone?: string; websiteUrl: string; source?: string; referredBy?: string
  }

  if (!email || !websiteUrl) {
    return new Response(JSON.stringify({ error: 'email and websiteUrl required' }), {
      status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  // 1. Notify us immediately
  await sendEmail(
    env,
    env.NOTIFICATION_EMAIL || 'pavan.harati@gmail.com',
    `🔍 Free Audit Request: ${name} — ${websiteUrl}`,
    `<p><b>${name}</b> requested a free audit for <a href="${websiteUrl}">${websiteUrl}</a></p>
     <p>Email: ${email}</p><p>Phone: ${phone || '—'}</p><p>Source: ${source || 'webcrew.app'}</p>`
  )

  // Record TCPA SMS consent — audit form requires phone + SMS opt-in checkbox
  if (phone) {
    await recordSmsConsent(
      env, phone, 'express_written', source || 'webcrew.app/audit',
      'Audit form SMS opt-in: agreed to receive follow-up texts from WebCrew about the website audit. Consent is not a condition of purchase.',
      req
    ).catch(() => {})

    // Audit submitters are always genuine top-of-funnel prospects (unlike
    // /leads, which also serves deployed clients' own demo-site customers) —
    // engage them with Sofia the same way instead of emailing a report and
    // going silent until they happen to read it.
    const [firstName, ...rest] = name.split(' ')
    const auditLead: ContactLead = {
      firstName: firstName || name, lastName: rest.join(' ') || undefined,
      phone, email, businessName: name, businessNiche: '',
      currentWebsite: websiteUrl, source: source || 'webcrew.app/audit',
      painPoints: `their current site (${websiteUrl})`,
      submittedAt: new Date().toISOString(),
      referredBy,
    }
    await engageWithSofia(env, auditLead, prepareLeadValuePlan(auditLead)).catch(() => {})
  }

  // 2. Run audit async (don't block response — use waitUntil pattern via background promise)
  runAuditAndEmail(env, { name, email, phone, websiteUrl }).catch(e =>
    console.error('[Audit] Failed:', e.message)
  )

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

async function runAuditAndEmail(env: Env, opts: {
  name: string; email: string; phone?: string; websiteUrl: string
}): Promise<void> {
  const { name, email, websiteUrl } = opts

  // 1. PageSpeed (mobile) — free, no key needed for basic quota
  let speedScore = 0; let lcp = '—'; let cls = '—'; let fid = '—'
  try {
    const psUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(websiteUrl)}&strategy=mobile`
    const ps = await fetch(psUrl)
    if (ps.ok) {
      const psData: any = await ps.json()
      speedScore = Math.round((psData.lighthouseResult?.categories?.performance?.score ?? 0) * 100)
      lcp = psData.lighthouseResult?.audits?.['largest-contentful-paint']?.displayValue ?? '—'
      cls = psData.lighthouseResult?.audits?.['cumulative-layout-shift']?.displayValue ?? '—'
      fid = psData.lighthouseResult?.audits?.['total-blocking-time']?.displayValue ?? '—'
    }
  } catch { /* non-blocking */ }

  // 2. Fetch homepage HTML for basic SEO checks
  let hasTitle = false; let hasMeta = false; let hasH1 = false
  let hasSchema = false; let isHttps = websiteUrl.startsWith('https')
  let htmlSnippet = ''
  try {
    const pageRes = await fetch(websiteUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebCrewBot/1.0)' } })
    const html = await pageRes.text()
    htmlSnippet = html.slice(0, 6000)
    hasTitle  = /<title[^>]*>[^<]+<\/title>/i.test(html)
    hasMeta   = /meta[^>]+name=["']description["'][^>]+content=["'][^"']{10,}/i.test(html)
    hasH1     = /<h1[^>]*>[^<]+<\/h1>/i.test(html)
    hasSchema = html.includes('application/ld+json')
  } catch { /* non-blocking */ }

  // 3. Gemini audit summary
  let auditSummary = ''; let grade = 'C'; let topFixes: string[] = []
  if (env.GOOGLE_AI_API_KEY) {
    try {
      const prompt = `You are a professional website auditor. Analyze this website: ${websiteUrl}

PageSpeed mobile score: ${speedScore}/100
LCP: ${lcp} | CLS: ${cls} | TBT: ${fid}
Has title tag: ${hasTitle} | Has meta description: ${hasMeta} | Has H1: ${hasH1}
Has schema markup: ${hasSchema} | HTTPS: ${isHttps}

Homepage HTML snippet:
${htmlSnippet}

Write a concise audit report in JSON format:
{
  "grade": "A/B/C/D/F",
  "overall_score": 0-100,
  "headline": "one punchy sentence about the site",
  "summary": "2-3 sentences on the biggest issues",
  "top_3_fixes": ["fix 1", "fix 2", "fix 3"],
  "wins": ["what they do well 1", "what they do well 2"]
}

Be honest and specific. If score < 50, be direct about the problems.`

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${env.GOOGLE_AI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
      )
      const json: any = await res.json()
      const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        grade = parsed.grade ?? 'C'
        auditSummary = parsed.summary ?? ''
        topFixes = parsed.top_3_fixes ?? []
      }
    } catch { /* non-blocking */ }
  }

  const gradeColor = grade === 'A' ? '#16a34a' : grade === 'B' ? '#2563eb' : grade === 'C' ? '#d97706' : '#dc2626'
  const scoreColor = speedScore >= 80 ? '#16a34a' : speedScore >= 50 ? '#d97706' : '#dc2626'

  // 4. Send HTML email with audit results
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px">

    <!-- Header -->
    <div style="background:#111827;border-radius:16px;padding:32px;margin-bottom:24px;text-align:center">
      <div style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:1.4rem;color:#B5880E;margin-bottom:8px">WebCrew</div>
      <h1 style="color:#fff;font-size:1.6rem;font-weight:800;margin:0 0 8px;letter-spacing:-0.02em">Your FREE Website Audit</h1>
      <p style="color:rgba(255,255,255,0.6);margin:0;font-size:0.9rem">${websiteUrl}</p>
    </div>

    <!-- Grade card -->
    <div style="background:#fff;border-radius:16px;padding:28px;margin-bottom:20px;border:1px solid rgba(0,0,0,0.08);box-shadow:0 2px 20px rgba(0,0,0,0.06)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div>
          <div style="font-size:0.7rem;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#6b7280;margin-bottom:4px">OVERALL GRADE</div>
          <div style="font-size:3.5rem;font-weight:800;color:${gradeColor};line-height:1">${grade}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:0.7rem;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#6b7280;margin-bottom:4px">PAGESPEED (MOBILE)</div>
          <div style="font-size:3rem;font-weight:800;color:${scoreColor};line-height:1">${speedScore}<span style="font-size:1rem;color:#6b7280">/100</span></div>
        </div>
      </div>
      ${auditSummary ? `<p style="color:#374151;font-size:0.95rem;line-height:1.7;margin:0;padding:16px;background:#f9fafb;border-radius:8px;border-left:3px solid ${gradeColor}">${auditSummary}</p>` : ''}
    </div>

    <!-- Core vitals -->
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px;border:1px solid rgba(0,0,0,0.08)">
      <div style="font-size:0.75rem;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#6b7280;margin-bottom:16px">Core Web Vitals</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        ${[
          { label: 'LCP', val: lcp, tip: 'Largest Contentful Paint' },
          { label: 'CLS', val: cls, tip: 'Cumulative Layout Shift' },
          { label: 'TBT', val: fid, tip: 'Total Blocking Time' },
        ].map(v => `
          <div style="background:#f9fafb;border-radius:8px;padding:12px;text-align:center">
            <div style="font-size:0.6rem;color:#9ca3af;margin-bottom:4px">${v.tip}</div>
            <div style="font-size:1rem;font-weight:700;color:#111827">${v.val}</div>
            <div style="font-size:0.65rem;color:#6b7280;font-weight:700">${v.label}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- SEO checks -->
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px;border:1px solid rgba(0,0,0,0.08)">
      <div style="font-size:0.75rem;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#6b7280;margin-bottom:16px">SEO Checklist</div>
      ${[
        { label: 'Title Tag', ok: hasTitle },
        { label: 'Meta Description', ok: hasMeta },
        { label: 'H1 Heading', ok: hasH1 },
        { label: 'Schema Markup', ok: hasSchema },
        { label: 'HTTPS Secure', ok: isHttps },
      ].map(c => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6">
          <div style="width:20px;height:20px;border-radius:50%;background:${c.ok ? '#dcfce7' : '#fee2e2'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px">
            ${c.ok ? '✓' : '✗'}
          </div>
          <div style="font-size:0.88rem;color:${c.ok ? '#16a34a' : '#dc2626'};font-weight:${c.ok ? '500' : '600'}">${c.label} — ${c.ok ? 'Good' : 'Missing'}</div>
        </div>`).join('')}
    </div>

    ${topFixes.length ? `
    <!-- Top 3 fixes -->
    <div style="background:#fff;border-radius:16px;padding:24px;margin-bottom:20px;border:1px solid rgba(0,0,0,0.08)">
      <div style="font-size:0.75rem;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#6b7280;margin-bottom:16px">Top 3 Quick Wins</div>
      ${topFixes.map((fix, i) => `
        <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #f3f4f6">
          <div style="width:24px;height:24px;border-radius:6px;background:#B5880E;color:#fff;font-weight:700;font-size:0.75rem;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div>
          <div style="font-size:0.88rem;color:#374151;line-height:1.5">${fix}</div>
        </div>`).join('')}
    </div>` : ''}

    <!-- CTA -->
    <div style="background:linear-gradient(135deg,#111827,#1f2937);border-radius:16px;padding:32px;text-align:center">
      <h2 style="color:#fff;font-size:1.3rem;font-weight:800;margin:0 0 12px;letter-spacing:-0.02em">Want us to fix all of this — FREE?</h2>
      <p style="color:rgba(255,255,255,0.7);font-size:0.9rem;margin:0 0 24px;line-height:1.6">We'll build you a completely new, high-performance website. You only pay if you love it.</p>
      <a href="https://webcrew.app/#contact" style="display:inline-block;background:#B5880E;color:#fff;font-weight:700;padding:14px 32px;border-radius:100px;text-decoration:none;font-size:0.95rem">
        Get My FREE Demo Site →
      </a>
    </div>

    <p style="text-align:center;color:#9ca3af;font-size:0.75rem;margin-top:24px">
      WebCrew · <a href="https://webcrew.app/privacy" style="color:#9ca3af">Privacy Policy</a> · <a href="https://webcrew.app/terms" style="color:#9ca3af">Terms</a>
    </p>
  </div>
</body>
</html>`

  await sendEmail(env, email, `Your FREE Website Audit — ${websiteUrl.replace(/https?:\/\//, '')}`, html)
  console.log(`[Audit] Report sent to ${email} for ${websiteUrl}`)
}

// ─── Survey handler ───────────────────────────────────────────────────────

const SURVEY_RESPONSES_TAB = 'Survey Responses'

async function appendSurveyToSheets(env: Env, row: string[]): Promise<void> {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON || !env.LEADS_SHEET_ID) return
  try {
    const token = await getVertexToken(env.GOOGLE_SERVICE_ACCOUNT_JSON, SHEETS_SCOPE)
    const range = encodeURIComponent(`${SURVEY_RESPONSES_TAB}!A1`)
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${env.LEADS_SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] }),
      }
    )
    if (!res.ok) console.error('[Survey] Sheets append failed:', await res.text())
  } catch (e) {
    console.error('[Survey] Sheets append error:', e)
  }
}

async function writeSurveyToNeon(env: Env, data: Record<string, string>): Promise<void> {
  await neonQuery(env,
    `INSERT INTO survey_responses (name, biz, phone, niche, pain, has_website, ai_want, budget)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      data.name || null, data.biz || null, data.phone || null,
      data.niche || null,
      Array.isArray(data.pain) ? (data.pain as unknown as string[]).join(', ') : (data.pain || null),
      data.has_website || null, data.ai_want || null, data.budget || null,
    ])
}

async function handleSurveySubmission(req: Request, env: Env): Promise<Response> {
  const data = await req.json() as Record<string, string>
  const { name, biz, phone, niche, pain, has_website, ai_want, budget } = data
  const painStr = Array.isArray(pain) ? (pain as unknown as string[]).join(', ') : (pain || '—')
  const dateStr = new Date().toISOString().split('T')[0]

  // 1. Email notification (instant)
  await sendEmail(
    env,
    env.NOTIFICATION_EMAIL || 'pavan.harati@gmail.com',
    `📋 Survey: ${name || '?'} — ${biz || 'Unknown'}`,
    `<table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;">
      <tr><td style="padding:6px 12px;color:#666"><b>Date</b></td><td style="padding:6px 12px">${dateStr}</td></tr>
      <tr><td style="padding:6px 12px;color:#666"><b>Name</b></td><td style="padding:6px 12px">${name || '—'}</td></tr>
      <tr><td style="padding:6px 12px;color:#666"><b>Business</b></td><td style="padding:6px 12px">${biz || '—'}</td></tr>
      <tr><td style="padding:6px 12px;color:#666"><b>Phone</b></td><td style="padding:6px 12px">${phone || '—'}</td></tr>
      <tr><td style="padding:6px 12px;color:#666"><b>Niche</b></td><td style="padding:6px 12px">${niche || '—'}</td></tr>
      <tr><td style="padding:6px 12px;color:#666"><b>Pain point</b></td><td style="padding:6px 12px">${painStr}</td></tr>
      <tr><td style="padding:6px 12px;color:#666"><b>Has website</b></td><td style="padding:6px 12px">${has_website || '—'}</td></tr>
      <tr><td style="padding:6px 12px;color:#666"><b>AI want</b></td><td style="padding:6px 12px">${ai_want || '—'}</td></tr>
      <tr><td style="padding:6px 12px;color:#666"><b>Budget</b></td><td style="padding:6px 12px">${budget || '—'}</td></tr>
    </table>`
  )

  // 2. Neon DB (persistent, queryable)
  await writeSurveyToNeon(env, data)

  // 3. Google Sheets (async log)
  appendSurveyToSheets(env, [dateStr, name||'', biz||'', phone||'', niche||'', painStr, has_website||'', ai_want||'', budget||'']).catch(() => {})

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

// ─── HITL: approval page + send demo ─────────────────────────────────────

function hitlToken(secret: string, phone: string): string {
  // Simple token: first 16 chars of base64(secret+phone) — good enough for internal tool
  return btoa(`${secret}:${phone}`).slice(0, 24).replace(/[+/=]/g, 'x')
}

function handleHITLPage(url: URL, env: Env): Response {
  const phone   = url.searchParams.get('phone') ?? ''
  const name    = url.searchParams.get('name') ?? 'Business'
  const niche   = url.searchParams.get('niche') ?? ''
  const city    = url.searchParams.get('city') ?? ''
  const email   = url.searchParams.get('email') ?? ''
  const token   = url.searchParams.get('token') ?? ''
  const secret  = env.HITL_SECRET ?? 'webcrew-hitl-2024'

  if (!phone || token !== hitlToken(secret, phone)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const sendUrl = `/hitl/send?phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(name)}&niche=${encodeURIComponent(niche)}&city=${encodeURIComponent(city)}&email=${encodeURIComponent(email)}&token=${token}`

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>WebCrew HITL — Send Demo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 32px; max-width: 480px; width: 100%; }
    h1 { font-size: 1.4rem; font-weight: 800; margin-bottom: 4px; }
    .sub { color: #888; font-size: 0.85rem; margin-bottom: 24px; }
    .lead-box { background: #111; border: 1px solid #2a2a2a; border-radius: 10px; padding: 16px; margin-bottom: 24px; }
    .lead-row { display: flex; gap: 8px; margin-bottom: 6px; font-size: 0.88rem; }
    .lead-label { color: #666; min-width: 60px; }
    label { display: block; font-size: 0.8rem; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
    input { width: 100%; background: #111; border: 1px solid #333; border-radius: 8px; padding: 12px 14px; color: #fff; font-size: 0.95rem; outline: none; margin-bottom: 20px; }
    input:focus { border-color: #7c3aed; }
    button { width: 100%; background: #7c3aed; color: #fff; font-weight: 700; font-size: 1rem; padding: 14px; border: none; border-radius: 10px; cursor: pointer; }
    button:hover { background: #6d28d9; }
    .warn { color: #f59e0b; font-size: 0.8rem; margin-top: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 Send Demo to Lead</h1>
    <p class="sub">Paste the Cloudflare Pages URL below and hit send.</p>

    <div class="lead-box">
      <div class="lead-row"><span class="lead-label">Name</span><span>${name}</span></div>
      <div class="lead-row"><span class="lead-label">Niche</span><span>${niche}</span></div>
      <div class="lead-row"><span class="lead-label">City</span><span>${city}</span></div>
      <div class="lead-row"><span class="lead-label">Phone</span><span>${phone}</span></div>
      ${email ? `<div class="lead-row"><span class="lead-label">Email</span><span>${email}</span></div>` : ''}
    </div>

    <form method="POST" action="${sendUrl}">
      <label>Demo URL (Cloudflare Pages)</label>
      <input type="url" name="demoUrl" placeholder="https://their-business.pages.dev" required autofocus>
      <button type="submit">✅ Approve &amp; Send Demo</button>
    </form>
    <p class="warn">⚠ This sends an SMS${email ? ' + email' : ''} to the lead immediately.</p>
  </div>
</body>
</html>`

  return new Response(html, { headers: { 'Content-Type': 'text/html' } })
}

async function handleHITLSend(req: Request, url: URL, env: Env): Promise<Response> {
  const phone  = url.searchParams.get('phone') ?? ''
  const name   = url.searchParams.get('name') ?? 'there'
  const niche  = url.searchParams.get('niche') ?? 'local business'
  const city   = url.searchParams.get('city') ?? 'your area'
  const email  = url.searchParams.get('email') ?? ''
  const token  = url.searchParams.get('token') ?? ''
  const secret = env.HITL_SECRET ?? 'webcrew-hitl-2024'

  if (!phone || token !== hitlToken(secret, phone)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const formData = await req.formData()
  const demoUrl = formData.get('demoUrl')?.toString() ?? ''
  if (!demoUrl) return new Response('Missing demoUrl', { status: 400 })

  const label = name.length > 20 ? name.slice(0, 18) + '…' : name

  // SMS to lead — re-check consent even though a human approved this send;
  // the lead may have opted out between the demo build and this click.
  if (await canTextNow(env, phone)) {
    const smsBody = `Hi ${label}! Your free ${niche} website is live → ${demoUrl}\n\nLove it? $0 setup, 30-day free trial, then $297/mo flat. Reply STOP to opt out. -WebCrew`
    await sendSms(env, phone, smsBody)
  }

  // Email to lead (if available)
  if (email && env.RESEND_API_KEY) {
    await sendEmail(env, email, `Your free ${niche} demo site is live! 🚀`,
      `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,sans-serif">
      <div style="max-width:560px;margin:0 auto;padding:40px 20px">
        <div style="background:#111827;border-radius:16px;padding:32px;text-align:center;margin-bottom:24px">
          <div style="font-weight:800;font-size:1.2rem;color:#B5880E;margin-bottom:8px">WebCrew</div>
          <h1 style="color:#fff;font-size:1.5rem;font-weight:800;margin:0 0 8px">Your Free Demo Site is Live! 🎉</h1>
          <p style="color:rgba(255,255,255,0.6);margin:0;font-size:0.9rem">${niche} · ${city}</p>
        </div>
        <div style="background:#fff;border-radius:16px;padding:28px;border:1px solid rgba(0,0,0,0.08);text-align:center">
          <p style="color:#374151;font-size:1rem;margin:0 0 24px;line-height:1.6">Hi ${name}! We built your <b>${niche}</b> business in <b>${city}</b> a complete demo website — for free. See it below:</p>
          <a href="${demoUrl}" style="display:inline-block;background:#7c3aed;color:#fff;font-weight:700;padding:14px 32px;border-radius:100px;text-decoration:none;font-size:1rem;margin-bottom:20px">View Your Demo Site →</a>
          <p style="color:#6b7280;font-size:0.85rem;margin:0">Love it? <b>$0 setup</b> today, a <b>30-day free trial</b>, then a flat <b>$297/mo</b> for the full AI Front Office — site, 24/7 AI reception, booking, SMS follow-up, GBP posts, review replies.</p>
        </div>
        <p style="text-align:center;color:#9ca3af;font-size:0.75rem;margin-top:20px">
          WebCrew · <a href="https://webcrew.app/privacy" style="color:#9ca3af">Privacy</a> · Reply STOP to opt out of SMS
        </p>
      </div></body></html>`
    )
  }

  // Confirm to Ranjeet
  await sendEmail(env, env.NOTIFICATION_EMAIL,
    `✅ Demo sent: ${name} (${niche}, ${city})`,
    `<p>Demo sent to <b>${name}</b> (${phone}${email ? ' / ' + email : ''}) for <b>${niche}</b> in <b>${city}</b>.</p><p>Demo URL: <a href="${demoUrl}">${demoUrl}</a></p>`
  )

  return new Response(`<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f0f0f;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
    <div style="text-align:center;padding:40px">
      <div style="font-size:3rem;margin-bottom:16px">✅</div>
      <h2 style="margin:0 0 8px">Demo sent to ${name}!</h2>
      <p style="color:#888;margin:0">SMS${email ? ' + email' : ''} delivered. Good luck 🚀</p>
    </div>
  </body></html>`, { headers: { 'Content-Type': 'text/html' } })
}

// ─── Send HITL notification to Ranjeet when lead says YES ──────────────────

async function notifyHITL(env: Env, phone: string, name: string, niche: string, city: string, email: string): Promise<void> {
  const secret = env.HITL_SECRET ?? 'webcrew-hitl-2024'
  const token  = hitlToken(secret, phone)
  const approveUrl = `https://api.webcrew.app/hitl?phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(name)}&niche=${encodeURIComponent(niche)}&city=${encodeURIComponent(city)}&email=${encodeURIComponent(email)}&token=${token}`

  await sendEmail(env, env.NOTIFICATION_EMAIL,
    `⚡ YES received — Build needed: ${name} (${niche}, ${city})`,
    `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
      <h2 style="color:#7c3aed">⚡ New YES — Action Required</h2>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px 0;color:#666;width:80px"><b>Name</b></td><td>${name}</td></tr>
        <tr><td style="padding:6px 0;color:#666"><b>Niche</b></td><td>${niche}</td></tr>
        <tr><td style="padding:6px 0;color:#666"><b>City</b></td><td>${city}</td></tr>
        <tr><td style="padding:6px 0;color:#666"><b>Phone</b></td><td>${phone}</td></tr>
        ${email ? `<tr><td style="padding:6px 0;color:#666"><b>Email</b></td><td>${email}</td></tr>` : ''}
      </table>
      <p style="background:#f3f4f6;padding:12px;border-radius:8px;font-family:monospace;font-size:0.85rem">
        cd /Users/pavanharati/Documents/WebsiteDeveloper/pipeline<br>
        LEAD_PHONE=${phone} npm run pipeline
      </p>
      <p style="margin-top:20px">Once built, approve &amp; send the demo:</p>
      <a href="${approveUrl}" style="display:inline-block;background:#7c3aed;color:#fff;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:1rem;margin-top:8px">
        🚀 Approve &amp; Send Demo
      </a>
      <p style="color:#999;font-size:0.75rem;margin-top:16px">Link expires never. Token: ${token}</p>
    </div>`
  )
}

// ─── Stripe checkout link (autonomous close) ─────────────────────────────────
// Checkout Sessions (not the Payment Links API) via plain fetch (no SDK,
// matches every other Stripe integration in this repo). Inline price_data —
// no need to pre-create a Price object, Checkout Sessions support both
// one-time and recurring price_data directly. mode/amount now come from the
// resolved plan+offer (PLAN_CATALOG/resolveOffer above) instead of a single
// hardcoded flat rate. metadata[lead_id] gets set directly on the object
// admin/src/app/api/stripe/webhook/route.ts already reads off
// checkout.session.completed, so that webhook needs no changes. Subscription
// mode doesn't accept payment_intent_data — subscription_data is the
// equivalent (mirrors admin/src/app/api/clients/onboard/route.ts:45-46);
// one-time (payment) mode is the reverse, uses payment_intent_data instead.
async function createStripeCheckoutLink(
  env: Env,
  opts: { leadId: string; leadName: string; leadNiche: string; planKey: PlanKey; amountCents: number }
): Promise<string | null> {
  if (!env.STRIPE_SECRET_KEY) {
    console.error('[Stripe] STRIPE_SECRET_KEY not set — cannot create checkout link')
    return null
  }
  const plan = PLAN_CATALOG[opts.planKey]
  const isSubscription = plan.billing === 'subscription'
  const desc = `WebCrew ${plan.name} — ${opts.leadName} (${opts.leadNiche})`
  const p = new URLSearchParams()
  p.set('mode', isSubscription ? 'subscription' : 'payment')
  p.set('metadata[lead_id]', opts.leadId)
  p.set('metadata[plan]', opts.planKey)
  p.set('success_url', 'https://webcrew.app/thank-you?session_id={CHECKOUT_SESSION_ID}')
  p.set('cancel_url', 'https://webcrew.app')
  p.set('line_items[0][price_data][currency]', 'usd')
  p.set('line_items[0][price_data][product_data][name]', desc)
  p.set('line_items[0][price_data][unit_amount]', String(opts.amountCents))
  p.set('line_items[0][quantity]', '1')
  if (isSubscription) {
    p.set('line_items[0][price_data][recurring][interval]', 'month')
    // Sofia's reply text (line ~1922) promises "$0 today, trial starts right
    // away" — without this the checkout session had no trial configured and
    // Stripe would charge the full amount immediately on card entry,
    // contradicting that promise. 30 matches RECEPTION_OFFER.trialDays.
    p.set('subscription_data[trial_period_days]', '30')
    p.set('subscription_data[metadata][lead_id]', opts.leadId)
    p.set('subscription_data[metadata][plan]', opts.planKey)
  } else {
    p.set('payment_intent_data[metadata][lead_id]', opts.leadId)
    p.set('payment_intent_data[metadata][plan]', opts.planKey)
  }

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: p.toString(),
    })
    const session: any = await res.json()
    if (!res.ok || !session.url) {
      console.error(`[Stripe] checkout session failed: ${session.error?.message ?? res.status}`)
      return null
    }
    return session.url as string
  } catch (e: any) {
    console.error(`[Stripe] checkout session error: ${e?.message ?? e}`)
    return null
  }
}

// QA-only visibility email — fires every time Sofia closes autonomously
// (payment link generated), not just for the human-call path. First time
// this system can move money unsupervised, so under-notifying is the
// riskier default; no "jump in now" urgency, this is awareness not action.
async function notifyAutoClose(env: Env, opts: {
  phone: string; leadName: string; leadNiche: string; leadCity: string; amountCents: number; checkoutUrl: string
}): Promise<void> {
  const dollars = (opts.amountCents / 100).toFixed(0)
  await sendEmail(env, env.NOTIFICATION_EMAIL,
    `💰 Auto-closed: ${opts.leadName}, link sent for $${dollars}`,
    `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
      <h2 style="color:#16a34a">💰 Sofia sent a payment link autonomously</h2>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px 0;color:#666;width:90px"><b>Business</b></td><td>${opts.leadName}</td></tr>
        <tr><td style="padding:6px 0;color:#666"><b>Niche</b></td><td>${opts.leadNiche}</td></tr>
        <tr><td style="padding:6px 0;color:#666"><b>City</b></td><td>${opts.leadCity || '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#666"><b>Phone</b></td><td>${opts.phone}</td></tr>
        <tr><td style="padding:6px 0;color:#666"><b>Amount</b></td><td>$${dollars}</td></tr>
        <tr><td style="padding:6px 0;color:#666"><b>Link</b></td><td><a href="${opts.checkoutUrl}">${opts.checkoutUrl}</a></td></tr>
      </table>
      <p>No action needed — this is for visibility/QA. Watch for the payment webhook to fire once they pay.</p>
    </div>`
  ).catch(() => {})
}

// ─── POST /call-status — Twilio missed-call recovery ─────────────────────────
// Set this as statusCallback on the client's Twilio number in reception/server.ts
// Twilio fires when CallStatus = no-answer | busy | failed

async function handleCallStatus(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const body = await req.text()
  const p = new URLSearchParams(body)

  if (!await validateTwilioSignature(env, req, p)) {
    return new Response('Forbidden', { status: 403 })
  }

  const callStatus = p.get('CallStatus') ?? ''
  const caller     = p.get('From') ?? ''
  const to         = p.get('To') ?? ''
  const callSid    = p.get('CallSid') ?? ''
  const callDuration = Number(p.get('CallDuration') ?? p.get('Duration') ?? '')
  const url        = new URL(req.url)
  const configId   = url.searchParams.get('configId') ?? ''
  const businessName = decodeURIComponent(url.searchParams.get('biz') ?? 'us')
  const flow       = url.searchParams.get('flow') ?? 'inbound'

  // Outbound outreach and recovery calls must never recursively trigger
  // another recovery attempt. Their lifecycle is still available in Twilio.
  if (flow === 'outbound_outreach' || flow === 'recovery') {
    return new Response('ok', { status: 200 })
  }

  // Twilio considers the call "completed" as soon as our initial <Say> and
  // <Connect> answer it, even when the AI stream never becomes usable. Treat
  // very short completed inbound calls as missed calls too.
  const shortCompleted = callStatus === 'completed' && Number.isFinite(callDuration) && callDuration <= 15
  if ((!['no-answer', 'busy', 'failed'].includes(callStatus) && !shortCompleted) || !caller) {
    return new Response('ok', { status: 200 })
  }

  const recoveryStatus = shortCompleted ? 'short-completed' : callStatus

  console.log(`[MissedCall] ${recoveryStatus} from ${caller} → ${businessName} (${configId})`)

  ctx.waitUntil((async () => {
    if (!env.NEON_DATABASE_URL) return

    // Always log the missed call, but only send an SMS when there is an active
    // consent record. A caller ID alone is not SMS consent.
    const optOutCheck = await neonQuery(
      env,
      `SELECT sms_opt_out FROM leads WHERE phone = $1 OR international_phone = $1 LIMIT 1`,
      [caller]
    )
    // Log to missed_calls table
    await neonQuery(
      env,
      `INSERT INTO missed_calls (config_id, caller, business_name, call_sid, call_status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT DO NOTHING`,
      [configId || null, caller, businessName, callSid || null, recoveryStatus]
    )

    // Update last_missed_call_at on lead (if matched)
    await neonQuery(
      env,
      `UPDATE leads SET last_missed_call_at = NOW()
       WHERE phone = $1 OR international_phone = $1`,
      [caller]
    )

    const consentCheck = await neonQuery(
      env,
      `SELECT 1 FROM consent_events WHERE channel='sms' AND contact=$1 AND revoked_at IS NULL LIMIT 1`,
      [caller]
    )
    if (optOutCheck?.rows?.[0]?.sms_opt_out || !consentCheck?.rows?.length) {
      console.log(`[MissedCall] ${caller} has no active SMS consent — logged only`)
      return
    }

    // Several quick retries are one missed-call incident. Log every attempt,
    // but send at most one recovery SMS per caller in a ten-minute window.
    const recentRecovery = await neonQuery(
      env,
      `SELECT 1 FROM missed_calls
       WHERE caller=$1 AND sms_sent=TRUE AND created_at > NOW()-INTERVAL '10 minutes'
       LIMIT 1`,
      [caller]
    )
    if (recentRecovery?.rows?.length) {
      console.log(`[MissedCall] Recent recovery already sent to ${caller} — suppressing duplicate`)
      return
    }

    // Send recovery SMS only to an opted-in caller. Sent FROM the client's own
    // number (the one that was actually called), not the shared outreach
    // number — so the reply below arrives on that same number's thread and a
    // "CALL" reply's disclosed AI callback isn't confused with a human offer.
    const smsBody = `Hi! You just called ${businessName} but we missed you. Reply CALL and we'll ring you right back with an AI assistant who can help now, or call us directly at ${to}.`
    await sendSms(env, caller, smsBody, to)

    // Mark SMS sent in missed_calls
    await neonQuery(
      env,
      `UPDATE missed_calls SET sms_sent = TRUE, sms_sent_at = NOW()
       WHERE call_sid = $1`,
      [callSid]
    )

    // Update lead record too
    await neonQuery(
      env,
      `UPDATE leads SET missed_call_sms_sent_at = NOW()
       WHERE phone = $1 OR international_phone = $1`,
      [caller]
    )

    console.log(`[MissedCall] Recovery SMS sent to ${caller}`)
  })())

  return new Response('ok', { status: 200 })
}

// ─── POST /cal-webhook — Cal.com booking lifecycle webhook ───────────────────
// Configure in Cal.com → Settings → Developer → Webhooks → add URL:
//   https://api.webcrew.app/cal-webhook
// Subscribe to ALL events:
//   BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_RESCHEDULED, BOOKING_NO_SHOW

async function handleCalWebhook(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const payload: any = await req.json()
  const trigger = (payload.triggerEvent ?? payload.trigger ?? '').toUpperCase()
  const booking = payload.payload ?? payload

  const HANDLED = ['BOOKING_CREATED','BOOKING_CONFIRMED','BOOKING_CANCELLED',
                   'BOOKING_RESCHEDULED','BOOKING_REJECTED','BOOKING_NO_SHOW',
                   'MEETING_ENDED']
  if (!HANDLED.includes(trigger)) {
    return new Response('ignored', { status: 200 })
  }

  const uid           = booking.uid ?? booking.bookingId ?? ''
  const startTime     = booking.startTime ?? ''
  const endTime       = booking.endTime ?? ''
  const attendee      = booking.attendees?.[0] ?? {}
  const atName        = attendee.name ?? ''
  const atEmail       = attendee.email ?? ''
  const atPhone       = booking.metadata?.phone ?? attendee.phone ?? ''
  const eventTypeId   = String(booking.eventTypeId ?? '')
  const hostName      = booking.organizer?.name ?? booking.user?.name ?? ''
  const businessName  = booking.metadata?.businessName ?? hostName
  const rescheduleUid = booking.rescheduleUid ?? null  // new uid after reschedule
  const organizerEmail = booking.organizer?.email ?? booking.user?.email ?? ''
  const organizerPhone = booking.organizer?.phone ?? ''

  if (!uid) return new Response('missing uid', { status: 400 })

  ctx.waitUntil((async () => {
    if (!env.NEON_DATABASE_URL) return

    // Resolve business owner phone — try Cal.com payload first, then leads table by organizer email
    let businessOwnerPhone: string | null = organizerPhone || null
    if (!businessOwnerPhone && organizerEmail) {
      const bizMatch = await neonQuery(
        env,
        `SELECT COALESCE(international_phone, phone) AS phone FROM leads
         WHERE email = $1 OR business_email = $1 LIMIT 1`,
        [organizerEmail]
      )
      businessOwnerPhone = bizMatch?.rows?.[0]?.phone || null
    }

    // Match to lead by email or phone (attendee — for analytics linkage)
    let leadId: string | null = null
    if (atEmail || atPhone) {
      const match = await neonQuery(
        env,
        `SELECT id FROM leads WHERE email = $1 OR phone = $2 OR international_phone = $2 LIMIT 1`,
        [atEmail || null, atPhone || null]
      )
      leadId = match?.rows?.[0]?.id ?? null
    }

    // ── BOOKING_CREATED / BOOKING_CONFIRMED ──────────────────────────────────
    if (['BOOKING_CREATED','BOOKING_CONFIRMED'].includes(trigger)) {
      if (!startTime) return

      await neonQuery(
        env,
        `INSERT INTO cal_bookings
           (booking_uid, lead_id, attendee_name, attendee_email, attendee_phone,
            business_name, event_type_id, start_time, end_time, status, business_owner_phone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'confirmed',$10)
         ON CONFLICT (booking_uid) DO UPDATE SET
           status = 'confirmed',
           attendee_phone = COALESCE(EXCLUDED.attendee_phone, cal_bookings.attendee_phone),
           business_owner_phone = COALESCE(EXCLUDED.business_owner_phone, cal_bookings.business_owner_phone),
           start_time = EXCLUDED.start_time,
           end_time   = EXCLUDED.end_time`,
        [uid, leadId, atName||null, atEmail||null, atPhone||null,
         businessName||null, eventTypeId||null, startTime, endTime, businessOwnerPhone||null]
      )
      console.log(`[Cal] CONFIRMED ${uid} → ${atName} at ${startTime}`)

      // Confirmation SMS to attendee
      if (atPhone && env.TWILIO_ACCOUNT_SID && await canTextNow(env, atPhone)) {
        const dtStr = new Date(startTime).toLocaleString('en-US',
          { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit',
            timeZone: 'America/Los_Angeles' })
        await sendSms(env, atPhone,
          `Your appointment with ${businessName} is confirmed for ${dtStr}. Need to change or cancel it? Just reply and let us know.`)
      }

      if (env.NOTIFICATION_EMAIL) {
        await sendEmail(env, env.NOTIFICATION_EMAIL,
          `📅 Booking: ${atName} → ${businessName}`,
          `<p><b>${atName}</b> booked with <b>${businessName}</b> for ${startTime}</p>
           <p>Phone: ${atPhone||'—'} | Email: ${atEmail||'—'}</p>`)
      }
    }

    // ── BOOKING_RESCHEDULED ───────────────────────────────────────────────────
    else if (trigger === 'BOOKING_RESCHEDULED') {
      // Mark old booking rescheduled, upsert new booking uid
      await neonQuery(
        env,
        `UPDATE cal_bookings SET status = 'rescheduled' WHERE booking_uid = $1`,
        [uid]
      )
      if (rescheduleUid && startTime) {
        await neonQuery(
          env,
          `INSERT INTO cal_bookings
             (booking_uid, lead_id, attendee_name, attendee_email, attendee_phone,
              business_name, event_type_id, start_time, end_time, status, business_owner_phone)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'confirmed',$10)
           ON CONFLICT (booking_uid) DO UPDATE SET
             status = 'confirmed',
             business_owner_phone = COALESCE(EXCLUDED.business_owner_phone, cal_bookings.business_owner_phone),
             start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time`,
          [rescheduleUid, leadId, atName||null, atEmail||null, atPhone||null,
           businessName||null, eventTypeId||null, startTime, endTime, businessOwnerPhone||null]
        )
      }
      console.log(`[Cal] RESCHEDULED ${uid} → ${rescheduleUid} at ${startTime}`)

      // Reschedule confirmation SMS
      if (atPhone && env.TWILIO_ACCOUNT_SID && startTime && await canTextNow(env, atPhone)) {
        const dtStr = new Date(startTime).toLocaleString('en-US',
          { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit',
            timeZone: 'America/Los_Angeles' })
        await sendSms(env, atPhone,
          `Your appointment with ${businessName} has been rescheduled to ${dtStr}. See you then!`)
      }
    }

    // ── BOOKING_CANCELLED / BOOKING_REJECTED ─────────────────────────────────
    else if (['BOOKING_CANCELLED','BOOKING_REJECTED'].includes(trigger)) {
      await neonQuery(
        env,
        `UPDATE cal_bookings SET status = 'cancelled' WHERE booking_uid = $1`,
        [uid]
      )
      console.log(`[Cal] CANCELLED ${uid} (${atName})`)

      // Rebook SMS — send 24h later via send-review-requests pattern
      // For now, send immediately with a soft rebook nudge
      if (atPhone && env.TWILIO_ACCOUNT_SID && await canTextNow(env, atPhone)) {
        const bookUrl = env.CALENDLY_URL || 'webcrew.app'
        await sendSms(env, atPhone,
          `Your appointment with ${businessName} was cancelled. Want to rebook? Pick a new time here: ${bookUrl}`)
      }
    }

    // ── BOOKING_NO_SHOW ───────────────────────────────────────────────────────
    else if (trigger === 'BOOKING_NO_SHOW') {
      await neonQuery(
        env,
        `UPDATE cal_bookings SET status = 'no_show' WHERE booking_uid = $1`,
        [uid]
      )
      console.log(`[Cal] NO_SHOW ${uid} (${atName})`)

      // Re-engagement SMS
      if (atPhone && env.TWILIO_ACCOUNT_SID && await canTextNow(env, atPhone)) {
        const bookUrl = env.CALENDLY_URL || 'webcrew.app'
        await sendSms(env, atPhone,
          `Hi ${atName.split(' ')[0]}! We missed you at your ${businessName} appointment. Easy to rebook here: ${bookUrl}`)
      }
    }

    // ── MEETING_ENDED — review request is handled by send-review-requests.ts ─
    else if (trigger === 'MEETING_ENDED') {
      await neonQuery(
        env,
        `UPDATE cal_bookings SET status = 'completed' WHERE booking_uid = $1`,
        [uid]
      )
      console.log(`[Cal] MEETING_ENDED ${uid}`)
    }
  })())

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── Main worker ──────────────────────────────────────────────────────────

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    const method = req.method

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    if (url.pathname === '/leads' && method === 'POST') {
      return handleLeadSubmission(req, env, ctx)
    }

    if (url.pathname === '/audit' && method === 'POST') {
      return handleAuditRequest(req, env)
    }

    if (url.pathname === '/waitlist' && method === 'POST') {
      return handleWaitlistSignup(req, env)
    }

    if (url.pathname === '/affiliate-apply' && method === 'POST') {
      return handleAffiliateApply(req, env)
    }

    // Survey submissions from webcrew.app/survey
    if (url.pathname === '/survey' && method === 'POST') {
      return handleSurveySubmission(req, env)
    }

    // Twilio inbound SMS webhook
    if (url.pathname === '/sms/reply' && method === 'POST') {
      return handleSMSWebhook(req, env, ctx)
    }

    // Twilio inbound voice webhook. This small edge endpoint keeps TwiML valid
    // and connects the call to the existing Cloud Run WebSocket relay.
    if (url.pathname.startsWith('/voice/continue/') && method === 'POST') {
      const configId = url.pathname.slice('/voice/continue/'.length)
      if (!configId) return new Response('Missing config ID', { status: 400 })
      return handleVoiceContinue(req, env, configId, url)
    }
    if (url.pathname.startsWith('/voice/overflow/') && method === 'POST') {
      const configId = url.pathname.slice('/voice/overflow/'.length)
      if (!configId) return new Response('Missing config ID', { status: 400 })
      return handleInboundVoice(req, env, configId, 'overflow')
    }
    if (url.pathname.startsWith('/voice/outbound/') && method === 'POST') {
      const configId = url.pathname.slice('/voice/outbound/'.length)
      if (!configId) return new Response('Missing config ID', { status: 400 })
      return handleInboundVoice(req, env, configId, 'outbound')
    }
    if (url.pathname.startsWith('/voice/') && method === 'POST') {
      const configId = url.pathname.slice('/voice/'.length)
      if (!configId) return new Response('Missing config ID', { status: 400 })
      return handleInboundVoice(req, env, configId)
    }

    if (url.pathname === '/outbound/call' && method === 'POST') {
      return handleOutboundCall(req, env)
    }

    // HITL approval flow
    if (url.pathname === '/hitl' && method === 'GET') {
      return handleHITLPage(url, env)
    }
    if (url.pathname === '/hitl/send' && method === 'POST') {
      return handleHITLSend(req, url, env)
    }

    // Twilio call-status webhook (missed call recovery)
    if (url.pathname === '/call-status' && method === 'POST') {
      return handleCallStatus(req, env, ctx)
    }

    // Cal.com booking webhook
    if (url.pathname === '/cal-webhook' && method === 'POST') {
      return handleCalWebhook(req, env, ctx)
    }

    // Twilio "Voice Fallback URL" target for every WebCrew number. Twilio calls this only when the primary webhook
    // (the reception server) errors or times out, so it must not depend on that server or the database.
    if (url.pathname === '/voice-fallback' && (method === 'POST' || method === 'GET')) {
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">Thanks for calling. We are having a technical problem and cannot take your call right now. Please try again in a few minutes.</Say>
  <Hangup/>
</Response>`, { headers: { 'Content-Type': 'text/xml' } })
    }

    if (url.pathname === '/health' && method === 'GET') {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (url.pathname.startsWith('/s/') && method === 'GET') {
      return handleShortLinkRedirect(url.pathname.slice(3), env)
    }

    return new Response('Not found', { status: 404 })
  },
}
