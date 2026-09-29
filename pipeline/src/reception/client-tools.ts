import type { ReceptionConfig } from './types.js'
import { calPort, type CalBooking, type CalendarPort } from './cal-booking.js'
import { googlePort } from './google-calendar.js'
import * as crm from './crm.js'
import { sendClientSms, sendEmail, ownerTargets, formatWhen, manageBookingUrl, last10, toE164 } from './client-comms.js'
import { isValidEmail, notifyOwner } from './relay-shared.js'
import { getLeadContact, pool } from './db.js'
import { geminiText, GEMINI_FLASH } from '../tools/gemini.js'

// Client-mode AI Reception: the receptionist for a paying client's own business.
// Everything the WebCrew sales line does (pricing, trials, founder offers) is
// deliberately absent here. See gemini-live.ts for which declarations each mode gets.

const WEBCREW_URL = 'https://webcrew.app'
const DEFAULT_TIMEZONE = 'America/Los_Angeles'
const NUDGE_AFTER_MS = 2 * 60 * 60 * 1000
const MAX_FIND_ATTEMPTS = 3

export function isClientConfig(config: Pick<ReceptionConfig, 'website_url'>): boolean {
  return config.website_url.replace(/\/$/, '') !== WEBCREW_URL
}

const normalizeUrl = (url: string) => url.trim().toLowerCase().replace(/\/+$/, '')

// WebCrew's own demo configs (default: the HVAC test line) book on WebCrew's
// calendar so the demo works. A paying client NEVER falls back to it — no
// calendar means message-only. Override the list with DEMO_WEBSITE_URLS.
export function isDemoConfig(config: Pick<ReceptionConfig, 'website_url'>): boolean {
  return (process.env.DEMO_WEBSITE_URLS ?? 'https://webcrew.app/hvac-test').split(',').map(normalizeUrl).filter(Boolean).includes(normalizeUrl(config.website_url))
}

export function calendarFromConfig(config: ReceptionConfig, onAuthFailure?: (c: ReceptionConfig) => Promise<void>): CalendarPort | null {
  if (config.calendar_provider === 'google' && config.google_refresh_token_enc) return googlePort(config, onAuthFailure)
  if (config.cal_api_key && config.cal_event_type_id) {
    return calPort({ apiKey: config.cal_api_key, eventTypeId: config.cal_event_type_id, timezone: config.timezone ?? DEFAULT_TIMEZONE })
  }
  const envKey = process.env.CAL_DIY_API_KEY
  if (envKey && isDemoConfig(config)) {
    return calPort({ apiKey: envKey, eventTypeId: parseInt(process.env.CAL_EVENT_TYPE_ID ?? '6126925'), timezone: process.env.CAL_TIMEZONE ?? DEFAULT_TIMEZONE })
  }
  return null
}

// ── Call classification ───────────────────────────────────────────────────────
// Intent/urgency are inferred from the full transcript AFTER the call (see
// finishCall). A live classify tool was tried and removed: on Vertex's native-audio
// Live model it made the model emit MALFORMED_FUNCTION_CALL turns — silence on a
// phone line. Live behaviour is driven by the prompt + the tools below instead.

export const CALL_INTENTS = ['new_lead', 'existing_customer', 'appointment_booking', 'appointment_change', 'general_inquiry', 'emergency', 'vendor_sales', 'spam_or_wrong_number'] as const
export const CALL_URGENCIES = ['emergency', 'urgent', 'routine'] as const
export type CallIntent = typeof CALL_INTENTS[number]
export type CallUrgency = typeof CALL_URGENCIES[number]

export interface ClientCallInsights {
  summary: string
  sentiment: 'positive' | 'neutral' | 'negative'
  intent: CallIntent
  urgency: CallUrgency
}

const CLIENT_INSIGHTS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary:   { type: 'STRING' },
    sentiment: { type: 'STRING', enum: ['positive', 'neutral', 'negative'] },
    intent:    { type: 'STRING', enum: [...CALL_INTENTS] },
    urgency:   { type: 'STRING', enum: [...CALL_URGENCIES] },
  },
  required: ['summary', 'sentiment', 'intent', 'urgency'],
}

/** One structured Gemini pass over the finished call: what the caller wanted, how urgent it was, how they felt. */
export async function generateClientCallInsights(transcript: string): Promise<ClientCallInsights | null> {
  try {
    const raw = await geminiText(
      `You are analysing a phone call answered by an AI receptionist for a local service business. Return:
- summary: 2-3 factual sentences — what the caller wanted, what was resolved or promised, whether follow-up is needed. No speculation.
- sentiment: the caller's overall sentiment.
- intent: new_lead (wants to become a customer), existing_customer (issue or question about past/current work), appointment_booking, appointment_change (reschedule or cancel), general_inquiry (hours, location, services), emergency (immediate safety risk only), vendor_sales (someone selling to the business), spam_or_wrong_number.
- urgency: emergency = immediate safety risk (gas smell, carbon monoxide, fire, flooding, sparking); urgent = needs same/next-day service but no safety risk (no heat or AC in extreme weather, active leak); routine = everything else.

Transcript:
${transcript || '(no speech detected)'}`,
      { model: GEMINI_FLASH, responseMimeType: 'application/json', responseSchema: CLIENT_INSIGHTS_SCHEMA },
    )
    const p = JSON.parse(raw)
    if (typeof p.summary !== 'string' || !['positive', 'neutral', 'negative'].includes(p.sentiment)) return null
    return {
      summary: p.summary,
      sentiment: p.sentiment,
      intent: (CALL_INTENTS as readonly string[]).includes(p.intent) ? p.intent : 'general_inquiry',
      urgency: (CALL_URGENCIES as readonly string[]).includes(p.urgency) ? p.urgency : 'routine',
    }
  } catch (e: any) {
    console.warn('[Client] call insights failed:', e.message)
    return null
  }
}

// ── Caller ↔ booking verification ─────────────────────────────────────────────

export interface MatchedBooking extends CalBooking { verifiedBy: 'caller_id' | 'email' }

/** A caller may only see/modify bookings tied to their own caller ID (phone recorded at booking) or a confirmed booking email. */
export function matchBookings(bookings: CalBooking[], who: { callerPhone: string | null; email?: string | null }): MatchedBooking[] {
  const phone = last10(who.callerPhone)
  const email = who.email?.trim().toLowerCase()
  const out: MatchedBooking[] = []
  for (const b of bookings) {
    if (b.status === 'cancelled' || b.status === 'rejected') continue
    if (phone.length === 10 && last10(b.phone) === phone) out.push({ ...b, verifiedBy: 'caller_id' })
    else if (email && b.attendeeEmail?.trim().toLowerCase() === email) out.push({ ...b, verifiedBy: 'email' })
  }
  return out
}

export function clientClosingWasSpoken(value: string): boolean {
  const normalized = value.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim()
  return /\bthank(s| you)\b/.test(normalized) && /(have a (great|wonderful|good|nice|lovely)|take care|goodbye|bye)/.test(normalized)
}

// ── Prompt addendum (applied at connect time, so it also upgrades configs whose
// stored system_prompt was written before these tools existed) ─────────────────

export function buildClientRuntimeAddendum(config: ReceptionConfig, calendarEnabled: boolean): string {
  const biz = config.business_name
  const appointments = calendarEnabled
    ? `APPOINTMENTS (calendar is connected):
- New booking: check_availability → offer at least two specific times → get the name and confirm the callback number → ask the SMS consent question once → book_appointment. An email is optional: offer it once ("want a calendar invite by email too?") and if they give one, spell it back and get a yes; never require it or keep asking.
- Change or cancel an existing appointment: call find_appointment FIRST. It matches by caller ID, and by booking email if the caller gives one (spell it back and get a yes before passing email_confirmed=true). Tell the caller only what it returns. To move it: check_availability for a new time, then reschedule_appointment. To cancel: get an explicit yes, then cancel_appointment. Then offer to rebook.
- Never claim an appointment was booked, moved, or cancelled unless the tool returned success.`
    : `APPOINTMENTS (calendar is NOT connected):
- You cannot book, move, or cancel appointments. Never offer specific times or say anything is booked.
- If the caller wants an appointment, capture their name, callback number, and what they need with take_message, and tell them the team will call back to confirm a time.`
  return `CLIENT MODE — these rules override anything above that conflicts.
You are the receptionist for ${biz}. Callers are ${biz}'s customers. You do not work for WebCrew; never mention WebCrew unless the caller asks who provides this receptionist.

HANDLING BY CALL TYPE (work out which applies from what the caller says):
  - New customer wanting service: understand the need, then book (or take a message if scheduling is not connected).
  - Existing customer with an issue or question about past or current work: listen, capture it with take_message. Do not diagnose or promise outcomes. If they are upset or ask for a person, offer a transfer.
  - Appointment booking / reschedule / cancel: use the appointment tools below.
  - General question (hours, location, services): answer only from the business information above; if you don't know, say so and offer take_message.
  - Safety emergency (gas smell, carbon monoxide alarm, fire or smoke, flooding, sparking): give the safety instruction first (leave the property; call 911 or the gas utility), then offer an immediate transfer and call escalate_to_human when they say yes. Do not book a routine slot.
  - Urgent but not a safety risk (no heat or AC in extreme weather, an active leak, or anyone vulnerable at home: an infant, an elderly person, a medical condition): the earliest routine opening is NOT an answer if it is more than about 24 hours away. Call check_availability. If a slot opens within roughly the next 24 hours, offer it and say you are flagging it urgent. Otherwise, or if they say they need someone now, tell them plainly when the next opening is and offer an immediate transfer to the team. If they decline or it cannot connect, use take_message with urgency=urgent (emergency when a vulnerable person has no heat or AC) so the owner is alerted right away. Never let a booking days away be the only thing you offer for an urgent problem.
  - Vendors, solicitations, robocalls, wrong numbers: do not engage; say you can't help with that, direct solicitations to the business email, and end the call.

${appointments}

TAKING A MESSAGE: take_message needs the caller's name, a confirmed callback number, what they need, and their answer to the SMS consent question. Email is optional — if given, spell it back and get a yes.

TRANSFERS: only after offering and hearing an explicit yes. In an emergency, offer the transfer immediately.

CLOSING: when the caller is finished, say a brief warm goodbye such as "Thanks for calling ${biz}, have a great day!" and then call end_call.`
}

// ── Tool declarations (client mode) ───────────────────────────────────────────
// Kept here, next to the handlers that implement them; gemini-live.ts merges
// them into TOOL_DECLARATIONS.

export const CLIENT_TOOL_DECLARATIONS = [
  {
    name: 'take_message',
    description: 'Record a callback request or message from a caller who has spoken and given their details. Never call before the caller has responded to your greeting.',
    parameters: {
      type: 'OBJECT',
      properties: {
        caller_name:  { type: 'STRING', description: "Caller's name as they gave it" },
        caller_phone: { type: 'STRING', description: 'Callback number, only if different from the number they called from' },
        caller_phone_confirmed: { type: 'BOOLEAN', description: 'True only after you read the callback number back digit by digit and the caller confirmed it. Not needed when calling from a real caller ID.' },
        caller_email: { type: 'STRING', description: 'Optional. Complete email including domain.' },
        email_confirmed: { type: 'BOOLEAN', description: 'True only after you spelled the email back and the caller confirmed it. Required if caller_email is given.' },
        message: { type: 'STRING', description: 'Factual summary: what the caller needs, any address/service details, and when they would like a callback' },
        urgency: { type: 'STRING', enum: [...CALL_URGENCIES] },
        sms_consent: { type: 'BOOLEAN', description: 'Caller explicitly said yes to a confirmation text' },
        sms_consent_answered: { type: 'BOOLEAN', description: 'True once the caller heard the SMS disclosure and clearly answered yes or no this call' },
      },
      required: ['caller_name', 'message', 'sms_consent', 'sms_consent_answered'],
    },
    clientOnly: true,
  },
  {
    name: 'find_appointment',
    description: "Look up the caller's upcoming appointments so they can be moved or cancelled. Matches by caller ID and, if provided and confirmed, by booking email. Call before reschedule_appointment or cancel_appointment.",
    parameters: {
      type: 'OBJECT',
      properties: {
        caller_email: { type: 'STRING', description: 'Email the appointment was booked under, if the caller gave one' },
        email_confirmed: { type: 'BOOLEAN', description: 'True only after spelling the email back and getting a yes' },
      },
      required: [],
    },
    clientOnly: true, needsCalendar: true,
  },
  {
    name: 'reschedule_appointment',
    description: 'Move an appointment found by find_appointment to a new slot from check_availability. Only after the caller confirmed the new time.',
    parameters: {
      type: 'OBJECT',
      properties: {
        booking_uid:   { type: 'STRING', description: 'booking_uid returned by find_appointment' },
        new_slot_time: { type: 'STRING', description: 'ISO datetime of the new slot from check_availability' },
        caller_confirmed_change: { type: 'BOOLEAN', description: 'True only after the caller explicitly agreed to move it to that time' },
        sms_consent: { type: 'BOOLEAN', description: 'Caller said yes to a confirmation text (reuse the earlier answer if already asked)' },
        sms_consent_answered: { type: 'BOOLEAN', description: 'True if the SMS consent question has been answered this call' },
      },
      required: ['booking_uid', 'new_slot_time', 'caller_confirmed_change'],
    },
    clientOnly: true, needsCalendar: true,
  },
  {
    name: 'cancel_appointment',
    description: 'Cancel an appointment found by find_appointment. Only after the caller explicitly says yes to cancelling it.',
    parameters: {
      type: 'OBJECT',
      properties: {
        booking_uid: { type: 'STRING', description: 'booking_uid returned by find_appointment' },
        caller_confirmed_cancel: { type: 'BOOLEAN', description: 'True only after the caller explicitly said yes to cancelling' },
        reason: { type: 'STRING', description: 'Reason the caller gave, if any' },
      },
      required: ['booking_uid', 'caller_confirmed_cancel'],
    },
    clientOnly: true, needsCalendar: true,
  },
]

// ── Per-call session ──────────────────────────────────────────────────────────

export interface ClientDeps {
  /** Inject a calendar (tests); undefined = build from the config, null = none. */
  calendar?: CalendarPort | null
  onCalendarAuthFailure: (config: ReceptionConfig) => Promise<void>
  crm: Pick<typeof crm, 'registerCallContact' | 'getContact' | 'enrichContact' | 'ensureCallOpportunity' | 'updateOpportunityDetails' | 'setStage' | 'setBooking' | 'findOpportunityByBooking' | 'scheduleFollowUp' | 'cancelPendingFollowUps' | 'logEvent'>
  sendSms: typeof sendClientSms
  sendEmail: typeof sendEmail
  ownerTargets: typeof ownerTargets
  notifyOwner: typeof notifyOwner
  leadPhone: (leadId: string) => Promise<string | null>
  actionUrl: (oppId: string) => string
}

const defaultDeps: ClientDeps = {
  onCalendarAuthFailure: async (config) => {
    // Google revoked/expired the connection: stop pretending we can book, and tell the owner how to fix it.
    await pool.query(`UPDATE reception_configs SET google_refresh_token_enc = NULL, calendar_provider = NULL, updated_at = NOW() WHERE id = $1`, [config.id])
    const t = await ownerTargets(config)
    await sendEmail(t.emails, `Reconnect your calendar — ${config.business_name}`, `Google disconnected your calendar, so your AI receptionist can't book appointments right now (it is taking messages instead).\n\nReconnect in one click from your dashboard: https://admin.webcrew.app/client/dashboard`)
  },
  crm,
  sendSms: sendClientSms,
  sendEmail,
  ownerTargets,
  notifyOwner,
  leadPhone: async (leadId) => (await getLeadContact(leadId))?.phone ?? null,
  actionUrl: crm.contactedUrl,
}

/** latestCallerTurn is the caller's speech over roughly the last dozen seconds — transcription arrives in fragments, so one chunk alone can miss a "yes". */
export interface ToolContext { callerHasSpoken: boolean; latestCallerTurn: string }
export interface ToolOutcome { result: Record<string, unknown>; transcriptNote?: string }

const AFFIRMATIVE = /\b(yes|yeah|yep|yup|please|correct|confirm|confirmed|go ahead|do it|sure|that's right|absolutely|definitely)\b/i
const NEGATION = /\b(no|nope|don't|dont|do not|never mind|nevermind|wait|hold on|stop|not)\b/i

/** True when the caller's recent speech is an explicit yes and their last sentence doesn't walk it back. */
export function isAffirmed(recentSpeech: string): boolean {
  const text = recentSpeech.trim()
  if (!AFFIRMATIVE.test(text)) return false
  const lastSentence = text.split(/[.!?]+/).map(t => t.trim()).filter(Boolean).pop() ?? ''
  return !NEGATION.test(lastSentence)
}

function isFutureIso(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const t = Date.parse(value)
  return Number.isFinite(t) && t > Date.now()
}

const firstName = (name: string | null | undefined) => (name ?? '').trim().split(/\s+/)[0] || 'there'

export class ClientCallSession {
  readonly calendar: CalendarPort | null
  messageTaken: string | undefined
  bookedThisCall = false
  private rescheduled = false
  private cancelled = false
  private escalated = false

  private contactId: string | null = null
  private oppId: string | null = null
  private smsConsent: boolean | null = null
  private verified = new Map<string, MatchedBooking>()
  private findAttempts = 0
  private lastBooking: { start: string; uid: string } | null = null
  private escalationPhone: string | null | undefined
  private deps: ClientDeps
  private ready: Promise<void> | null = null

  constructor(
    private config: ReceptionConfig,
    private callSid: string | null,
    private callerPhone: string | null,
    deps: Partial<ClientDeps> = {},
  ) {
    this.deps = { ...defaultDeps, ...deps }
    this.calendar = this.deps.calendar !== undefined ? this.deps.calendar : calendarFromConfig(config, this.deps.onCalendarAuthFailure)
  }

  /** Starts registering the caller in the CRM. Not awaited by the relay — handle() waits for it, so call setup isn't delayed. */
  init(): Promise<void> {
    this.ready = (async () => {
      this.contactId = await this.deps.crm.registerCallContact(this.config.id, this.callerPhone)
      // A returning caller who already agreed to confirmation texts isn't asked again.
      const known = this.contactId ? await this.deps.crm.getContact(this.contactId).catch(() => null) : null
      if (known?.smsConsent && known.phone) this.smsConsent = true
    })()
    return this.ready
  }

  private get biz() { return this.config.business_name }
  private get tz() { return this.calendar?.timezone ?? DEFAULT_TIMEZONE }

  private async ensureOpp(fields: { intent?: string; urgency?: string; title?: string; notes?: string } = {}): Promise<string | null> {
    if (this.oppId) return this.oppId
    if (!this.contactId) return null
    this.oppId = await this.deps.crm.ensureCallOpportunity({ configId: this.config.id, contactId: this.contactId, callSid: this.callSid, ...fields })
    return this.oppId
  }

  private destinationPhone(args: any): string | null {
    return this.callerPhone ?? (args.caller_phone_confirmed === true ? toE164(args.caller_phone) : null)
  }

  private consentBlock(args: any): ToolOutcome | null {
    if (args.sms_consent_answered === true) {
      this.smsConsent = args.sms_consent === true
      return null
    }
    if (this.smsConsent !== null) return null
    return { result: { success: false, message: 'You have not completed the SMS consent question. Ask exactly: "Would you like a confirmation text at this number? Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help." Wait for a clear yes or no, then retry with sms_consent_answered=true.' } }
  }

  async handle(name: string, args: any, ctx: ToolContext): Promise<ToolOutcome | undefined> {
    if (this.ready) await this.ready
    switch (name) {
      case 'take_message':           return this.takeMessage(args, ctx)
      case 'check_availability':     return this.checkAvailability()
      case 'book_appointment':       return this.book(args, ctx)
      case 'find_appointment':       return this.find(args)
      case 'reschedule_appointment': return this.reschedule(args, ctx)
      case 'cancel_appointment':     return this.cancel(args, ctx)
      default:                       return undefined
    }
  }

  // ── messages ────────────────────────────────────────────────────────────────

  private async takeMessage(a: any, ctx: ToolContext): Promise<ToolOutcome> {
    const fail = (message: string): ToolOutcome => ({ result: { success: false, message } })
    if (!ctx.callerHasSpoken) return fail('The caller has not spoken yet. Ask how you can help and wait for their reply.')
    const name = String(a.caller_name ?? '').trim()
    const message = String(a.message ?? '').trim()
    if (!name) return fail('Ask for the caller\'s name first.')
    if (!message) return fail('Capture what the caller needs in a short factual summary first.')
    const dest = this.destinationPhone(a)
    if (!dest) return fail('There is no verified callback number. Ask for one, read it back digit by digit, wait for a yes, then retry with caller_phone and caller_phone_confirmed=true.')
    const email = String(a.caller_email ?? '').trim()
    if (email && (!isValidEmail(email) || a.email_confirmed !== true)) {
      return fail('The email must be complete and confirmed. Spell it back including the domain and wait for a yes, then retry with email_confirmed=true — or omit the email, it is optional.')
    }
    const blocked = this.consentBlock(a)
    if (blocked) return blocked

    const urgency = (CALL_URGENCIES as readonly string[]).includes(a.urgency) ? a.urgency : undefined
    this.messageTaken = message
    if (this.contactId) await this.deps.crm.enrichContact(this.contactId, { name, email, phone: dest, smsConsent: this.smsConsent === true })
    const oppId = await this.ensureOpp({ urgency, title: message.slice(0, 120), notes: message })
    if (oppId) {
      await this.deps.crm.setStage(this.config.id, oppId, 'callback_requested', {}, ['new'])
      await this.deps.crm.scheduleFollowUp({ configId: this.config.id, contactId: this.contactId, opportunityId: oppId, kind: 'callback_nudge', dueAt: new Date(Date.now() + NUDGE_AFTER_MS) })
    }

    this.deps.notifyOwner('message', { caller_name: name, caller_phone: dest, caller_email: email || undefined, message: urgency === 'urgent' || urgency === 'emergency' ? `[${String(urgency).toUpperCase()}] ${message}` : message }, this.config, this.callerPhone, oppId ? { actionUrl: this.deps.actionUrl(oppId) } : undefined)
      .catch(e => console.error('[Client] owner alert failed:', e.message))

    const [smsSent, emailSent] = await Promise.all([
      this.smsConsent === true
        ? this.deps.sendSms(this.config, dest, `Hi ${firstName(name)}, this is ${this.biz}. We got your message and someone will get back to you shortly. Reply STOP to opt out or HELP for help. – ${this.biz}`)
        : Promise.resolve(false),
      email
        ? this.deps.sendEmail([email], `We received your message — ${this.biz}`, `Hi ${firstName(name)},\n\nThanks for calling ${this.biz}. We've noted your request and a team member will follow up.\n\n— ${this.biz}`)
        : Promise.resolve(false),
    ])
    return {
      result: {
        success: true, smsSent, emailSent,
        nextStep: `Message recorded and the team was alerted. Confirm only what actually succeeded (smsSent=${smsSent}, emailSent=${emailSent}). Ask "Is there anything else I can help you with?" and wait. When they are finished, say a warm goodbye and call end_call.`,
      },
      transcriptNote: `[MESSAGE] ${message}`,
    }
  }

  // ── scheduling ──────────────────────────────────────────────────────────────

  private noCalendar(): ToolOutcome {
    return { result: { success: false, message: 'Online scheduling is not connected for this business. Do not offer specific times or claim anything is booked. Use take_message so the team can call back to schedule.' } }
  }

  private async checkAvailability(): Promise<ToolOutcome> {
    if (!this.calendar) return this.noCalendar()
    const r = await this.calendar.getAvailableSlots()
    if (r.error || r.slots.length === 0) {
      return { result: { success: false, message: r.error ? 'The calendar could not be reached. Offer to take a message instead.' : 'No openings in the next 5 days. Offer to take a message so the team can find a time.', slots: [] } }
    }
    return { result: { success: true, message: `Available times (${r.timezone}). Offer at least two specific options.`, slots: r.slots, slotList: r.slots.map((s, i) => `${i + 1}. ${s.label}`).join('\n') } }
  }

  private async book(a: any, ctx: ToolContext): Promise<ToolOutcome> {
    if (!this.calendar) return this.noCalendar()
    const fail = (message: string): ToolOutcome => ({ result: { success: false, message } })
    const name = String(a.caller_name ?? '').trim()
    const email = String(a.caller_email ?? '').trim()
    if (!name) return fail('Ask for the caller\'s name first.')
    // Email is optional on calendars that can book without one (Google): forcing phone callers to spell an email is
    // where bookings stall. Cal.com genuinely needs an attendee email, so that provider still asks for it.
    if (email ? !isValidEmail(email) : this.calendar.requiresEmail) {
      return fail(email
        ? 'That email looks incomplete. Spell it back including the domain and wait for a yes, then retry — or leave it out, the email is optional.'
        : 'This calendar needs an email to book. Ask for it, spell it back including the domain, wait for a yes, then retry.')
    }
    if (!isFutureIso(a.slot_time)) return fail('slot_time must be an ISO datetime from check_availability, in the future.')
    const dest = this.destinationPhone(a)
    if (!dest) return fail('There is no verified callback number. Ask for one, read it back digit by digit, wait for a yes, then retry with caller_phone and caller_phone_confirmed=true.')
    const blocked = this.consentBlock(a)
    if (blocked) return blocked

    if (this.lastBooking && Date.parse(this.lastBooking.start) === Date.parse(a.slot_time)) {
      return { result: { success: true, alreadyBooked: true, start: this.lastBooking.start, message: 'That appointment is already booked. Do not book it again.' } }
    }

    const r = await this.calendar.createBooking({ start: a.slot_time, name, email: email || undefined, phone: dest, notes: a.notes })
    if (!r.ok || !r.uid || !r.start) return { result: { success: false, error: r.error, message: 'The booking did not go through. Do not say it is booked. Offer another time or take a message.' } }

    this.bookedThisCall = true
    this.lastBooking = { start: r.start, uid: r.uid }
    if (this.contactId) await this.deps.crm.enrichContact(this.contactId, { name, email, phone: dest, smsConsent: this.smsConsent === true })
    await this.recordBooking(r.uid, r.start, { intent: 'appointment_booking', title: `Appointment — ${name}`, notes: a.notes })

    const when = formatWhen(r.start, this.tz)
    const smsSent = this.smsConsent === true
      ? await this.deps.sendSms(this.config, dest, `Hi ${firstName(name)}, you're booked with ${this.biz} for ${when}. Manage or change it: ${manageBookingUrl(r.uid)} Reply STOP to opt out or HELP for help. – ${this.biz}`)
      : false
    return {
      result: { success: true, start: r.start, when, smsSent, message: `Appointment confirmed for ${when}. Confirmation text sent: ${smsSent}. Never say a text was sent unless smsSent is true. If smsSent is false: ${email ? 'say a confirmation email will arrive' : 'tell them they are on the calendar and the team will see it — do not promise a confirmation message'}.` },
      transcriptNote: `[BOOKING] ${name} booked at ${r.start} | UID:${r.uid}`,
    }
  }

  /** Points this call's CRM card at a booking, marks it booked, and (re)schedules the reminder. */
  private async recordBooking(uid: string, start: string, fields: { intent?: string; title?: string; notes?: string }, previousUid?: string): Promise<void> {
    if (previousUid && !this.oppId) {
      const prior = await this.deps.crm.findOpportunityByBooking(this.config.id, previousUid)
      if (prior) this.oppId = prior.id
    }
    const oppId = await this.ensureOpp(fields)
    if (!oppId) return
    await this.deps.crm.setBooking(oppId, uid, start)
    await this.deps.crm.setStage(this.config.id, oppId, 'booked', { booking_uid: uid, start })
    await this.deps.crm.cancelPendingFollowUps(oppId, 'callback_nudge')
    const due = crm.computeReminderDueAt(start)
    if (due) await this.deps.crm.scheduleFollowUp({ configId: this.config.id, contactId: this.contactId, opportunityId: oppId, kind: 'appointment_reminder', dueAt: due })
  }

  private async find(a: any): Promise<ToolOutcome> {
    if (!this.calendar) return this.noCalendar()
    if (this.findAttempts >= MAX_FIND_ATTEMPTS) {
      return { result: { success: false, message: 'Too many lookups on this call. Do not search again. Take a message so the team can help with the appointment.' } }
    }
    const email = String(a.caller_email ?? '').trim()
    if (email && (!isValidEmail(email) || a.email_confirmed !== true)) {
      return { result: { success: false, message: 'Spell the email back including the domain and wait for a yes, then retry with email_confirmed=true.' } }
    }
    if (!this.callerPhone && !email) {
      return { result: { success: false, message: 'There is no caller ID to match. Ask which email the appointment was booked under, confirm it, then retry.' } }
    }
    this.findAttempts++

    const [byPhone, byEmail] = await Promise.all([
      this.callerPhone ? this.calendar.listUpcomingBookings({}) : Promise.resolve({ ok: true, bookings: [] as CalBooking[] }),
      email ? this.calendar.listUpcomingBookings({ attendeeEmail: email }) : Promise.resolve({ ok: true, bookings: [] as CalBooking[] }),
    ])
    if (!byPhone.ok && !byEmail.ok) return { result: { success: false, message: 'The calendar could not be reached. Offer to take a message about the appointment instead.' } }

    const pool = [...byPhone.bookings, ...byEmail.bookings.filter(b => !byPhone.bookings.some(p => p.uid === b.uid))]
    const matches = matchBookings(pool, { callerPhone: this.callerPhone, email })
    for (const m of matches) this.verified.set(m.uid, m)

    if (matches.length === 0) {
      return { result: { success: true, found: 0, message: 'No upcoming appointment matches this caller. Do not reveal anyone else\'s appointments. Offer to book a new appointment or take a message.' } }
    }
    return {
      result: {
        success: true, found: matches.length,
        appointments: matches.map(m => ({ booking_uid: m.uid, when: formatWhen(m.start, this.tz), name_on_booking: firstName(m.attendeeName), matched_by: m.verifiedBy })),
        message: 'Read back only the day and time and confirm which one they mean before changing anything.',
      },
    }
  }

  private async reschedule(a: any, ctx: ToolContext): Promise<ToolOutcome> {
    if (!this.calendar) return this.noCalendar()
    const fail = (message: string): ToolOutcome => ({ result: { success: false, message } })
    const old = this.verified.get(String(a.booking_uid ?? ''))
    if (!old) return fail('That appointment has not been verified for this caller. Call find_appointment first and use a booking_uid it returned.')
    if (!isFutureIso(a.new_slot_time)) return fail('new_slot_time must be a future ISO datetime from check_availability.')
    if (a.caller_confirmed_change !== true || !isAffirmed(ctx.latestCallerTurn)) return fail('Read the new day and time back and wait for an explicit yes, then retry with caller_confirmed_change=true.')
    this.consentBlock(a)

    const r = await this.calendar.rescheduleBooking({ uid: old.uid, start: a.new_slot_time, reason: 'Rescheduled by caller via AI receptionist', rescheduledBy: old.attendeeEmail })
    if (!r.ok || !r.uid || !r.start) return { result: { success: false, error: r.error, message: 'The change did not go through and the original appointment is unchanged. Say so, then offer another time or take a message.' } }

    this.rescheduled = true
    this.verified.delete(old.uid)
    this.verified.set(r.uid, { ...old, uid: r.uid, start: r.start })
    await this.recordBooking(r.uid, r.start, { intent: 'appointment_change' }, old.uid)
    if (this.oppId) await this.deps.crm.logEvent(this.config.id, this.contactId, this.oppId, 'appointment_rescheduled', { from: old.start, to: r.start })

    const when = formatWhen(r.start, this.tz)
    const dest = this.callerPhone ?? toE164(old.phone)
    const smsSent = this.smsConsent === true && dest
      ? await this.deps.sendSms(this.config, dest, `Hi ${firstName(old.attendeeName)}, your ${this.biz} appointment is now ${when}. Manage it: ${manageBookingUrl(r.uid)} Reply STOP to opt out. – ${this.biz}`)
      : false
    return {
      result: { success: true, start: r.start, when, smsSent, message: `Appointment moved to ${when}. Confirmation text sent: ${smsSent}. Never say a text was sent unless smsSent is true.` },
      transcriptNote: `[RESCHEDULE] ${old.start} -> ${r.start} | UID:${r.uid}`,
    }
  }

  private async cancel(a: any, ctx: ToolContext): Promise<ToolOutcome> {
    if (!this.calendar) return this.noCalendar()
    const fail = (message: string): ToolOutcome => ({ result: { success: false, message } })
    const old = this.verified.get(String(a.booking_uid ?? ''))
    if (!old) return fail('That appointment has not been verified for this caller. Call find_appointment first and use a booking_uid it returned.')
    if (a.caller_confirmed_cancel !== true || !isAffirmed(ctx.latestCallerTurn)) return fail('Read the day and time back and ask "Do you want me to cancel it?" Wait for an explicit yes, then retry with caller_confirmed_cancel=true.')

    const r = await this.calendar.cancelBooking({ uid: old.uid, reason: String(a.reason ?? '').slice(0, 200) || undefined })
    if (!r.ok) return { result: { success: false, error: r.error, message: 'The cancellation did not go through and the appointment is still on the calendar. Say so and offer to take a message.' } }

    this.cancelled = true
    this.verified.delete(old.uid)
    const prior = await this.deps.crm.findOpportunityByBooking(this.config.id, old.uid)
    if (prior && !this.oppId) this.oppId = prior.id
    const oppId = await this.ensureOpp({ intent: 'appointment_change', title: `Cancelled appointment — ${old.attendeeName ?? ''}`.trim() })
    if (oppId) {
      await this.deps.crm.setStage(this.config.id, oppId, 'cancelled', { booking_uid: old.uid, start: old.start })
      await this.deps.crm.cancelPendingFollowUps(oppId)
      await this.deps.crm.logEvent(this.config.id, this.contactId, oppId, 'appointment_cancelled', { start: old.start, reason: a.reason ?? null })
    }

    const when = formatWhen(old.start, this.tz)
    this.deps.ownerTargets(this.config)
      .then(t => this.deps.sendEmail(t.emails, `Appointment cancelled — ${this.biz}`, `${old.attendeeName ?? 'A caller'} (${this.callerPhone ?? old.attendeeEmail ?? 'unknown'}) cancelled their ${when} appointment by phone.${a.reason ? `\nReason: ${a.reason}` : ''}`))
      .catch(e => console.error('[Client] cancel alert failed:', e.message))
    return {
      result: { success: true, message: `The ${when} appointment is cancelled. Offer to book a new time if they would like.` },
      transcriptNote: `[CANCEL] ${old.start} | UID:${old.uid}`,
    }
  }

  // ── end of call ─────────────────────────────────────────────────────────────

  /** What actually happened on the call, from the tools that ran — recorded as call_logs.route. */
  outcomeRoute(): string {
    if (this.escalated) return 'escalated_to_human'
    if (this.cancelled) return 'appointment_cancelled'
    if (this.rescheduled) return 'appointment_rescheduled'
    if (this.bookedThisCall) return 'appointment_booked'
    if (this.messageTaken) return 'message_taken'
    return 'handled'
  }

  /**
   * Applies the post-call classification to the CRM. A call that ended without a
   * booking or message but was a real customer need (or urgent) still becomes a
   * card, so nothing a caller asked for silently vanishes.
   */
  async finishCall(insights: ClientCallInsights, durationSec: number): Promise<{ newOpportunity: boolean; ownerAlerted: boolean; actionUrl?: string }> {
    if (this.ready) await this.ready
    const none = { newOpportunity: false, ownerAlerted: false }
    if (!this.contactId || insights.intent === 'vendor_sales' || insights.intent === 'spam_or_wrong_number') return none

    if (this.oppId) {
      await this.deps.crm.updateOpportunityDetails(this.oppId, { intent: insights.intent, urgency: insights.urgency })
      await this.deps.crm.logEvent(this.config.id, this.contactId, this.oppId, 'call_classified', { intent: insights.intent, urgency: insights.urgency, outcome: this.outcomeRoute() })
      return none
    }

    const customerNeed = ['new_lead', 'existing_customer', 'appointment_booking', 'appointment_change'].includes(insights.intent)
    if (durationSec < 15 || !(customerNeed || insights.urgency !== 'routine')) return none

    const oppId = await this.ensureOpp({ intent: insights.intent, urgency: insights.urgency, title: insights.summary.slice(0, 120), notes: insights.summary })
    if (!oppId) return none
    await this.deps.crm.logEvent(this.config.id, this.contactId, oppId, 'call_classified', { intent: insights.intent, urgency: insights.urgency, outcome: 'no_request_captured' })
    const pressing = insights.urgency !== 'routine'
    await this.deps.crm.scheduleFollowUp({ configId: this.config.id, contactId: this.contactId, opportunityId: oppId, kind: 'callback_nudge', dueAt: new Date(Date.now() + (pressing ? 15 * 60_000 : NUDGE_AFTER_MS)) })
    const actionUrl = this.deps.actionUrl(oppId)
    if (pressing) {
      this.deps.notifyOwner('message', { caller_name: 'Caller', caller_phone: this.callerPhone ?? undefined, message: `[${insights.urgency.toUpperCase()}] The call ended before a request was captured. ${insights.summary}` }, this.config, this.callerPhone, { actionUrl })
        .catch(e => console.error('[Client] urgent alert failed:', e.message))
    }
    return { newOpportunity: true, ownerAlerted: pressing, actionUrl }
  }

  // ── transfers ───────────────────────────────────────────────────────────────

  /** Who a live transfer dials: the scraped/entered owner line, else the lead contact — never the AI's own number (would loop). */
  async resolveEscalationPhone(): Promise<string | null> {
    if (this.escalationPhone !== undefined) return this.escalationPhone
    let phone = toE164(this.config.brain?.owner_phone)
    if (!phone && this.config.lead_id) phone = toE164(await this.deps.leadPhone(this.config.lead_id))
    if (phone && last10(phone) === last10(this.config.twilio_phone)) phone = null
    this.escalationPhone = phone
    return phone
  }

  async onEscalated(reason: string): Promise<void> {
    this.escalated = true
    const oppId = await this.ensureOpp({ title: reason.slice(0, 120) })
    if (oppId) {
      await this.deps.crm.setStage(this.config.id, oppId, 'escalated', { reason }, ['new', 'callback_requested'])
      await this.deps.crm.cancelPendingFollowUps(oppId, 'callback_nudge')
    }
  }
}
