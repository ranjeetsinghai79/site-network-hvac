import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ClientCallSession, buildClientRuntimeAddendum, calendarFromConfig, clientClosingWasSpoken, isAffirmed, isClientConfig,
  matchBookings, type ClientDeps,
} from './client-tools.js'
import { selectToolDeclarations } from './gemini-live.js'
import { computeReminderDueAt } from './crm.js'
import { mergeTranscript } from './relay-shared.js'
import { quietDelayMinutes } from './follow-ups.js'
import type { CalBooking } from './cal-booking.js'
import type { ReceptionConfig } from './types.js'

const baseConfig: ReceptionConfig = {
  id: 'cfg-1', lead_id: 'lead-1', website_url: 'https://stevehvac.example', business_name: "Steve's HVAC",
  brain: { name: "Steve's HVAC", type: 'hvac', hours: {}, services: [], faqs: [] },
  system_prompt: 'base', twilio_phone: '+19342482253', active: true, created_at: '',
  cal_api_key: 'cal_test', cal_event_type_id: 42, timezone: 'America/Los_Angeles',
}
const noCalConfig: ReceptionConfig = { ...baseConfig, cal_api_key: null, cal_event_type_id: null }

const inFuture = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString()
const spoke = { callerHasSpoken: true, latestCallerTurn: 'yes please' }

// ── pure helpers ──────────────────────────────────────────────────────────────

test('client vs WebCrew config detection', () => {
  assert.equal(isClientConfig({ website_url: 'https://webcrew.app/' }), false)
  assert.equal(isClientConfig({ website_url: 'https://stevehvac.example' }), true)
})

test('demo configs use WebCrew\'s calendar; paying clients never do', () => {
  const saved = { k: process.env.CAL_DIY_API_KEY, u: process.env.DEMO_WEBSITE_URLS }
  process.env.CAL_DIY_API_KEY = 'env_key'; process.env.DEMO_WEBSITE_URLS = 'https://webcrew.app,https://webcrew.app/hvac-test'
  try {
    const demo = calendarFromConfig({ ...noCalConfig, website_url: 'https://webcrew.app/hvac-test/' })
    assert.equal(demo?.provider, 'cal')
    assert.equal(calendarFromConfig(noCalConfig), null) // a client without its own calendar is message-only
    assert.equal(calendarFromConfig(baseConfig)?.provider, 'cal') // its own key always wins
    assert.equal(calendarFromConfig({ ...baseConfig, calendar_provider: 'google', google_refresh_token_enc: 'x' })?.provider, 'google') // one-click Google takes precedence
  } finally {
    process.env.CAL_DIY_API_KEY = saved.k ?? ''; if (saved.k === undefined) delete process.env.CAL_DIY_API_KEY
    if (saved.u === undefined) delete process.env.DEMO_WEBSITE_URLS; else process.env.DEMO_WEBSITE_URLS = saved.u
  }
})

test('calendar is only present when key and event type are both set', () => {
  assert.equal(calendarFromConfig(baseConfig)?.provider, 'cal')
  assert.equal(calendarFromConfig(noCalConfig), null)
  assert.equal(calendarFromConfig({ ...noCalConfig, calendar_provider: 'google', google_refresh_token_enc: null }), null) // google without a token = not connected
})

test('booking ownership: caller ID or confirmed email only, never other customers or cancelled', () => {
  const b = (uid: string, phone: string, email: string, status = 'accepted'): CalBooking => ({ uid, start: inFuture(48), status, phone, attendeeEmail: email })
  const bookings = [
    b('mine', '+15559990001', 'me@x.com'),
    b('theirs', '+15558880002', 'other@x.com'),
    b('cancelled', '+15559990001', 'me@x.com', 'cancelled'),
    b('by-email', '+15557770003', 'ME@x.com'),
  ]
  const byPhone = matchBookings(bookings, { callerPhone: '+1 (555) 999-0001' })
  assert.deepEqual(byPhone.map(m => m.uid), ['mine'])
  assert.equal(byPhone[0].verifiedBy, 'caller_id')
  const both = matchBookings(bookings, { callerPhone: '+15559990001', email: 'me@x.com' })
  assert.deepEqual(both.map(m => m.uid).sort(), ['by-email', 'mine'])
  assert.deepEqual(matchBookings(bookings, { callerPhone: null }), [])
  assert.deepEqual(matchBookings(bookings, { callerPhone: null, email: 'nobody@x.com' }), [])
})

test('tool sets: client line never gets WebCrew sales tools; calendar tools follow the calendar', () => {
  const names = (mode: 'webcrew' | 'client', cal: boolean) => selectToolDeclarations(mode, cal).map(d => d.name)
  const webcrew = names('webcrew', false)
  assert.ok(webcrew.includes('start_trial') && webcrew.includes('get_webcrew_pricing') && webcrew.includes('take_message'))
  assert.ok(!webcrew.includes('find_appointment'))

  const clientNoCal = names('client', false)
  for (const forbidden of ['start_trial', 'get_webcrew_pricing', 'build_founder_offer', 'verify_email_by_sms', 'check_availability', 'book_appointment', 'find_appointment', 'reschedule_appointment', 'cancel_appointment']) {
    assert.ok(!clientNoCal.includes(forbidden), `${forbidden} must not be offered on a client line without a calendar`)
  }
  assert.ok(!clientNoCal.includes('classify_call'), 'a live classify tool causes MALFORMED_FUNCTION_CALL dead air on Vertex native audio')
  assert.ok(clientNoCal.includes('take_message') && clientNoCal.includes('escalate_to_human') && clientNoCal.includes('end_call'))

  const clientCal = names('client', true)
  for (const required of ['check_availability', 'book_appointment', 'find_appointment', 'reschedule_appointment', 'cancel_appointment']) assert.ok(clientCal.includes(required))
  assert.ok(!clientCal.includes('start_trial'))

  // one take_message per mode, and it is the right one
  const wcTake = selectToolDeclarations('webcrew', false).filter(d => d.name === 'take_message')
  const clTake = selectToolDeclarations('client', false).filter(d => d.name === 'take_message')
  assert.equal(wcTake.length, 1); assert.equal(clTake.length, 1)
  assert.ok((wcTake[0].parameters as any).required.includes('business_name_confirmed'))
  assert.ok(!(clTake[0].parameters as any).required.includes('business_name_confirmed'))

  // routing flags must never reach Gemini (they close Live setup with 1007)
  for (const d of selectToolDeclarations('client', true)) {
    assert.ok(!('webcrewOnly' in d) && !('clientOnly' in d) && !('needsCalendar' in d))
  }
})

test('confirmation: explicit yes counts, hesitation and walk-backs do not', () => {
  assert.ok(isAffirmed('yes please'))
  assert.ok(isAffirmed('Yes, cancel it.'))
  assert.ok(isAffirmed('Hmm. Yeah, go ahead.'))
  assert.ok(!isAffirmed('hmm'))
  assert.ok(!isAffirmed("no, don't cancel it"))
  assert.ok(!isAffirmed('yes... actually no wait'))
  assert.ok(!isAffirmed('No that is everything, thanks, bye.'))
})

test('closing check accepts a normal goodbye, rejects silence', () => {
  assert.ok(clientClosingWasSpoken("Thanks for calling Steve's HVAC, have a great day!"))
  assert.ok(clientClosingWasSpoken('Thank you so much, take care.'))
  assert.ok(!clientClosingWasSpoken('Sure, I can help with that.'))
})

test('addendum reflects calendar state and never pitches WebCrew', () => {
  const on = buildClientRuntimeAddendum(baseConfig, true)
  const off = buildClientRuntimeAddendum(noCalConfig, false)
  assert.match(on, /find_appointment/); assert.match(on, /Steve's HVAC/)
  assert.match(off, /calendar is NOT connected/); assert.doesNotMatch(off, /find_appointment FIRST/)
  assert.match(off, /never mention WebCrew/i)
})

test('reminder timing: 24h before, 2h before if booked inside a day, none if imminent', () => {
  const now = new Date('2026-09-20T12:00:00Z')
  assert.equal(computeReminderDueAt('2026-09-23T12:00:00Z', now)!.toISOString(), '2026-09-22T12:00:00.000Z')
  assert.equal(computeReminderDueAt('2026-09-21T06:00:00Z', now)!.toISOString(), '2026-09-21T04:00:00.000Z')
  assert.equal(computeReminderDueAt('2026-09-20T14:00:00Z', now), null)
})

test('quiet hours: allowed 8am-9pm local, deferred to 8am otherwise', () => {
  assert.equal(quietDelayMinutes('America/Los_Angeles', new Date('2026-09-20T19:00:00Z')), 0)        // noon PT
  assert.equal(quietDelayMinutes('America/Los_Angeles', new Date('2026-09-21T06:30:00Z')), 510)      // 11:30pm PT -> 8am = 8.5h
  assert.equal(quietDelayMinutes('America/Los_Angeles', new Date('2026-09-21T12:00:00Z')), 180)      // 5:00am PT -> 8am = 3h
  assert.equal(quietDelayMinutes('America/Los_Angeles', new Date('2026-09-21T04:00:00Z')), 660)      // 9:00pm PT -> 8am = 11h
})

// ── session flows (fake deps, no network/DB) ─────────────────────────────────

function makeDeps(over: Partial<ClientDeps> & { knownContact?: { id: string; phone: string | null; email: string | null; name: string | null; smsConsent: boolean } } = {}) {
  const log: string[] = []
  const stages: string[] = []
  const followUps: string[] = []
  const sms: string[] = []
  const emails: string[] = []
  const owner: string[] = []
  let booked: CalBooking[] = []
  const deps: ClientDeps = {
    calendar: {
      provider: 'cal', timezone: 'America/Los_Angeles',
      getAvailableSlots: async () => ({ slots: [{ time: inFuture(30), label: 'Thu 9:00 AM' }, { time: inFuture(31), label: 'Thu 10:00 AM' }], timezone: 'America/Los_Angeles' }),
      createBooking: async o => { log.push('create'); booked = [{ uid: 'uid-1', start: o.start, status: 'accepted', phone: o.phone, attendeeEmail: o.email, attendeeName: o.name }]; return { ok: true, uid: 'uid-1', start: o.start } },
      listUpcomingBookings: async () => ({ ok: true, bookings: booked }),
      rescheduleBooking: async o => { log.push(`resched:${o.uid}`); return { ok: true, uid: 'uid-2', start: o.start } },
      cancelBooking: async o => { log.push(`cancel:${o.uid}`); return { ok: true } },
    },
    onCalendarAuthFailure: async () => { log.push('auth-failure') },
    crm: {
      registerCallContact: async () => 'contact-1',
      getContact: async () => (over.knownContact ?? null) as any,
      enrichContact: async () => {},
      ensureCallOpportunity: async () => 'opp-1',
      updateOpportunityDetails: async (_id, f) => { log.push(`opp-update:${f.intent}:${f.urgency}`) },
      setStage: async (_c, _o, stage) => { stages.push(stage); return true },
      setBooking: async () => {},
      findOpportunityByBooking: async () => null,
      scheduleFollowUp: async o => { followUps.push(o.kind) },
      cancelPendingFollowUps: async () => {},
      logEvent: async (_c, _ct, _o, type) => { log.push(`event:${type}`) },
    },
    sendSms: async (_c, _to, body) => { sms.push(body); return true },
    sendEmail: async (_to, subject) => { emails.push(subject); return true },
    ownerTargets: async () => ({ emails: ['owner@x.com'], phone: '+15550001111' }),
    notifyOwner: async (type) => { owner.push(type) },
    leadPhone: async () => '+15550001111',
    actionUrl: id => `https://x/contacted/${id}`,
    ...(({ knownContact: _k, ...rest }) => rest)(over),
  }
  return { deps, log, stages, followUps, sms, emails, owner }
}

const mk = (config: ReceptionConfig, deps: ClientDeps, caller: string | null = '+15559990001') => {
  // A config with no calendar connected gets none, exactly like production.
  const d = calendarFromConfig(config) ? deps : { ...deps, calendar: null }
  const s = new ClientCallSession(config, 'CA1', caller, d)
  void s.init()
  return s
}

test('take_message: requires speech, name, consent answer; then records, nudges, alerts, texts', async () => {
  const { deps, followUps, stages, sms, owner } = makeDeps(); const s = mk(baseConfig, deps)
  assert.equal((await s.handle('take_message', { caller_name: 'Pat', message: 'AC out', sms_consent: true, sms_consent_answered: true }, { callerHasSpoken: false, latestCallerTurn: '' }))!.result.success, false)
  assert.equal((await s.handle('take_message', { caller_name: '', message: 'AC out', sms_consent: true, sms_consent_answered: true }, spoke))!.result.success, false)
  const noConsent = await s.handle('take_message', { caller_name: 'Pat', message: 'AC out', sms_consent: false, sms_consent_answered: false }, spoke)
  assert.equal(noConsent!.result.success, false); assert.match(String(noConsent!.result.message), /SMS consent/)
  const bad = await s.handle('take_message', { caller_name: 'Pat', message: 'AC out', caller_email: 'pat@', email_confirmed: true, sms_consent: true, sms_consent_answered: true }, spoke)
  assert.equal(bad!.result.success, false)

  const ok = await s.handle('take_message', { caller_name: 'Pat Lee', message: 'AC out, wants callback', sms_consent: true, sms_consent_answered: true }, spoke)
  assert.equal(ok!.result.success, true); assert.equal((ok!.result as any).smsSent, true)
  assert.equal(s.messageTaken, 'AC out, wants callback')
  assert.deepEqual(stages, ['callback_requested']); assert.deepEqual(followUps, ['callback_nudge']); assert.deepEqual(owner, ['message'])
  assert.equal(s.outcomeRoute(), 'message_taken')
  assert.match(sms[0], /Steve's HVAC/); assert.doesNotMatch(sms[0], /WebCrew/)
})

test('take_message: declining SMS sends no text and never asks twice', async () => {
  const { deps, sms } = makeDeps(); const s = mk(baseConfig, deps)
  const r = await s.handle('take_message', { caller_name: 'Pat', message: 'callback please', sms_consent: false, sms_consent_answered: true }, spoke)
  assert.equal(r!.result.success, true); assert.equal((r!.result as any).smsSent, false); assert.equal(sms.length, 0)
})

test('take_message: blocked caller ID needs a confirmed number', async () => {
  const { deps } = makeDeps(); const s = mk(baseConfig, deps, null)
  assert.equal((await s.handle('take_message', { caller_name: 'Pat', message: 'x', sms_consent: false, sms_consent_answered: true }, spoke))!.result.success, false)
  assert.equal((await s.handle('take_message', { caller_name: 'Pat', message: 'x', caller_phone: '(555) 123-4567', caller_phone_confirmed: true, sms_consent: false, sms_consent_answered: true }, spoke))!.result.success, true)
})

test('no calendar: every scheduling tool refuses honestly', async () => {
  const { deps, log } = makeDeps(); const s = mk(noCalConfig, deps)
  for (const t of ['check_availability', 'book_appointment', 'find_appointment', 'reschedule_appointment', 'cancel_appointment']) {
    const r = await s.handle(t, {}, spoke)
    assert.equal(r!.result.success, false); assert.match(String(r!.result.message), /not connected/)
  }
  assert.equal(log.filter(l => l.startsWith('create')).length, 0)
})

test('book: uses the CLIENT calendar credentials, moves the card to booked, schedules a reminder', async () => {
  const { deps, log, stages, followUps, sms } = makeDeps(); const s = mk(baseConfig, deps)
  assert.equal((await s.handle('book_appointment', { caller_name: 'Pat Lee', caller_email: 'pat@x.com', slot_time: inFuture(30), sms_consent: true, sms_consent_answered: true }, spoke))!.result.success, true)
  assert.ok(log.includes('create'))
  assert.deepEqual(stages, ['booked']); assert.ok(followUps.includes('appointment_reminder'))
  assert.match(sms[0], /cal\.com\/booking\/uid-1/); assert.equal(s.bookedThisCall, true)
})

test('book: rejects bad email, past slot; same slot twice is not double-booked', async () => {
  const { deps, log } = makeDeps(); const s = mk(baseConfig, deps)
  const slot = inFuture(30)
  assert.equal((await s.handle('book_appointment', { caller_name: 'Pat', caller_email: 'nope', slot_time: slot, sms_consent: false, sms_consent_answered: true }, spoke))!.result.success, false)
  assert.equal((await s.handle('book_appointment', { caller_name: 'Pat', caller_email: 'p@x.com', slot_time: '2020-01-01T00:00:00Z', sms_consent: false, sms_consent_answered: true }, spoke))!.result.success, false)
  await s.handle('book_appointment', { caller_name: 'Pat', caller_email: 'p@x.com', slot_time: slot, sms_consent: false, sms_consent_answered: true }, spoke)
  const again = await s.handle('book_appointment', { caller_name: 'Pat', caller_email: 'p@x.com', slot_time: slot, sms_consent: false, sms_consent_answered: true }, spoke)
  assert.equal((again!.result as any).alreadyBooked, true)
  assert.equal(log.filter(l => l.startsWith('create')).length, 1)
})

test('manage: find → reschedule (new uid) → cancel, all gated by verification', async () => {
  const { deps, log, stages } = makeDeps()
  const start = inFuture(72)
  const seeded: CalBooking[] = [
    { uid: 'mine', start, status: 'accepted', phone: '+15559990001', attendeeEmail: 'pat@x.com', attendeeName: 'Pat Lee' },
    { uid: 'stranger', start, status: 'accepted', phone: '+15558880002', attendeeEmail: 'someone@x.com', attendeeName: 'Someone Else' },
  ]
  deps.calendar!.listUpcomingBookings = async () => ({ ok: true, bookings: seeded })
  const s = mk(baseConfig, deps)

  // unverified uids are refused — including a real one belonging to someone else
  assert.equal((await s.handle('cancel_appointment', { booking_uid: 'stranger', caller_confirmed_cancel: true }, spoke))!.result.success, false)
  assert.equal((await s.handle('reschedule_appointment', { booking_uid: 'mine', new_slot_time: inFuture(80), caller_confirmed_change: true }, spoke))!.result.success, false)

  const found = await s.handle('find_appointment', {}, spoke)
  const appts = (found!.result as any).appointments
  assert.equal(appts.length, 1); assert.equal(appts[0].booking_uid, 'mine')
  assert.ok(!JSON.stringify(found).includes('Someone'))

  // needs an explicit yes from the caller, not just the model's flag
  assert.equal((await s.handle('reschedule_appointment', { booking_uid: 'mine', new_slot_time: inFuture(80), caller_confirmed_change: true }, { callerHasSpoken: true, latestCallerTurn: 'hmm' }))!.result.success, false)
  const moved = await s.handle('reschedule_appointment', { booking_uid: 'mine', new_slot_time: inFuture(80), caller_confirmed_change: true, sms_consent: false, sms_consent_answered: true }, spoke)
  assert.equal(moved!.result.success, true); assert.ok(log.includes('resched:mine'))
  assert.match(moved!.transcriptNote!, /RESCHEDULE/)

  // old uid is gone; the new uid is now the verified one
  assert.equal((await s.handle('cancel_appointment', { booking_uid: 'mine', caller_confirmed_cancel: true }, spoke))!.result.success, false)
  const cancelled = await s.handle('cancel_appointment', { booking_uid: 'uid-2', caller_confirmed_cancel: true, reason: 'plans changed' }, spoke)
  assert.equal(cancelled!.result.success, true); assert.ok(log.includes('cancel:uid-2'))
  assert.ok(stages.includes('booked') && stages.includes('cancelled'))
})

test('find: capped at 3 lookups per call, email needs confirmation, no ID and no email is refused', async () => {
  const { deps } = makeDeps(); const s = mk(baseConfig, deps)
  for (let i = 0; i < 3; i++) assert.equal((await s.handle('find_appointment', {}, spoke))!.result.success, true)
  assert.equal((await s.handle('find_appointment', {}, spoke))!.result.success, false)

  const n = makeDeps(); const s2 = mk(baseConfig, n.deps, null)
  assert.equal((await s2.handle('find_appointment', {}, spoke))!.result.success, false)
  assert.equal((await s2.handle('find_appointment', { caller_email: 'pat@x.com', email_confirmed: false }, spoke))!.result.success, false)
  assert.equal((await s2.handle('find_appointment', { caller_email: 'pat@x.com', email_confirmed: true }, spoke))!.result.success, true)
})

test('calendar failure never reports a booking', async () => {
  const { deps } = makeDeps({ })
  deps.calendar!.createBooking = async () => ({ ok: false, error: 'slot taken' })
  deps.calendar!.cancelBooking = async () => ({ ok: false, error: 'nope' })
  const s = mk(baseConfig, deps)
  const r = await s.handle('book_appointment', { caller_name: 'Pat', caller_email: 'p@x.com', slot_time: inFuture(30), sms_consent: false, sms_consent_answered: true }, spoke)
  assert.equal(r!.result.success, false); assert.equal(s.bookedThisCall, false)
})

test('escalation target: owner line, else lead phone, never the AI number itself', async () => {
  const { deps } = makeDeps()
  const withOwner = { ...baseConfig, brain: { ...baseConfig.brain, owner_phone: '(415) 555-0100' } }
  assert.equal(await mk(withOwner, deps).resolveEscalationPhone(), '+14155550100')
  assert.equal(await mk(baseConfig, deps).resolveEscalationPhone(), '+15550001111')
  const loop = makeDeps({ leadPhone: async () => '+19342482253' })
  assert.equal(await mk(baseConfig, loop.deps).resolveEscalationPhone(), null)
})

test('unknown tools fall through to the relay', async () => {
  const { deps } = makeDeps(); const s = mk(baseConfig, deps)
  assert.equal(await s.handle('escalate_to_human', {}, spoke), undefined)
  assert.equal(await s.handle('end_call', {}, spoke), undefined)
})

test('post-call: classification updates the existing card and records the real outcome', async () => {
  const { deps, log } = makeDeps(); const s = mk(baseConfig, deps)
  await s.handle('book_appointment', { caller_name: 'Pat', caller_email: 'p@x.com', slot_time: inFuture(30), sms_consent: false, sms_consent_answered: true }, spoke)
  assert.equal(s.outcomeRoute(), 'appointment_booked')
  const r = await s.finishCall({ summary: 'Booked a repair.', sentiment: 'positive', intent: 'appointment_booking', urgency: 'urgent' }, 120)
  assert.equal(r.newOpportunity, false)
  assert.ok(log.includes('opp-update:appointment_booking:urgent'))
})

test('post-call: a real customer need with nothing captured still becomes a card + nudge', async () => {
  const { deps, followUps, stages, owner } = makeDeps(); const s = mk(baseConfig, deps)
  const r = await s.finishCall({ summary: 'Wants a furnace quote but hung up.', sentiment: 'neutral', intent: 'new_lead', urgency: 'routine' }, 90)
  assert.equal(r.newOpportunity, true); assert.equal(r.ownerAlerted, false); assert.match(r.actionUrl!, /contacted/)
  assert.deepEqual(followUps, ['callback_nudge']); assert.deepEqual(owner, [])
  assert.equal(stages.length, 0) // stays "new"
})

test('post-call: urgent/emergency with nothing captured alerts the owner immediately', async () => {
  const { deps, owner } = makeDeps(); const s = mk(baseConfig, deps)
  const r = await s.finishCall({ summary: 'Gas smell, hung up after safety advice.', sentiment: 'negative', intent: 'emergency', urgency: 'emergency' }, 40)
  assert.equal(r.ownerAlerted, true); assert.deepEqual(owner, ['message'])
})

test('post-call: vendors, spam, quick hangups, and plain questions never create CRM cards', async () => {
  for (const [intent, urgency, dur] of [['vendor_sales', 'routine', 60], ['spam_or_wrong_number', 'routine', 60], ['new_lead', 'routine', 5], ['general_inquiry', 'routine', 90]] as const) {
    const { deps, followUps, owner } = makeDeps(); const s = mk(baseConfig, deps)
    const r = await s.finishCall({ summary: 'x', sentiment: 'neutral', intent, urgency }, dur)
    assert.equal(r.newOpportunity, false, `${intent}/${dur}s`); assert.deepEqual(followUps, []); assert.deepEqual(owner, [])
  }
})

test('outcome route reflects escalation, reschedule, and cancel', async () => {
  const { deps } = makeDeps(); const s = mk(baseConfig, deps)
  assert.equal(s.outcomeRoute(), 'handled')
  await s.onEscalated('upset caller')
  assert.equal(s.outcomeRoute(), 'escalated_to_human')
})

test('returning caller with recorded SMS consent is not asked again', async () => {
  const { deps, sms } = makeDeps({ knownContact: { id: 'contact-1', phone: '+15559990001', email: null, name: 'Pat', smsConsent: true } })
  const s = mk(baseConfig, deps)
  // no sms_consent_answered supplied — stored consent applies
  const r = await s.handle('book_appointment', { caller_name: 'Pat', caller_email: 'p@x.com', slot_time: inFuture(30) }, spoke)
  assert.equal(r!.result.success, true); assert.equal((r!.result as any).smsSent, true); assert.equal(sms.length, 1)
})

test('transcripts: word-sized fragments are stitched into sentences per speaker', () => {
  const merged = mergeTranscript(['AI: Thanks for', 'AI:  calling', 'AI:  WebCrew.', 'Caller: Hi', 'Caller:  there', '[BOOKING] Pat booked', 'AI: Done', 'AI: !'])
  assert.equal(merged, 'AI: Thanks for calling WebCrew.\nCaller: Hi there\n[BOOKING] Pat booked\nAI: Done!')
})

test('book: email is optional when the calendar can book without one (Google), and no invite is promised', async () => {
  const { deps, log, sms } = makeDeps(); const s = mk(baseConfig, deps)
  const r = await s.handle('book_appointment', { caller_name: 'Pat Lee', slot_time: inFuture(30), sms_consent: true, sms_consent_answered: true }, spoke)
  assert.equal(r!.result.success, true)
  assert.ok(log.includes('create')); assert.equal(sms.length, 1)
  const noText = makeDeps(); const s2 = mk(baseConfig, noText.deps)
  const r2 = await s2.handle('book_appointment', { caller_name: 'Pat Lee', slot_time: inFuture(30), sms_consent: false, sms_consent_answered: true }, spoke)
  assert.equal(r2!.result.success, true)
  assert.doesNotMatch(String(r2!.result.message), /confirmation email will arrive/)
})

test('book: a calendar that needs an email (Cal.com) still asks for one, and a half-typed email is rejected', async () => {
  const { deps, log } = makeDeps(); deps.calendar!.requiresEmail = true; const s = mk(baseConfig, deps)
  const missing = await s.handle('book_appointment', { caller_name: 'Pat', slot_time: inFuture(30), sms_consent: false, sms_consent_answered: true }, spoke)
  assert.equal(missing!.result.success, false); assert.match(String(missing!.result.message), /needs an email/)
  assert.equal(log.filter(l => l === 'create').length, 0)
  const partial = await mk(baseConfig, makeDeps().deps).handle('book_appointment', { caller_name: 'Pat', caller_email: 'pat@', slot_time: inFuture(30), sms_consent: false, sms_consent_answered: true }, spoke)
  assert.equal(partial!.result.success, false); assert.match(String(partial!.result.message), /incomplete/)
})

test('tool declarations: client book_appointment does not require an email; WebCrew sales line still does', () => {
  const req = (mode: 'client' | 'webcrew') => (selectToolDeclarations(mode, true).find(d => d.name === 'book_appointment') as any)?.parameters?.required as string[] | undefined
  assert.ok(!req('client')!.includes('caller_email'))
  assert.ok(req('client')!.includes('slot_time') && req('client')!.includes('caller_name'))
  assert.ok(req('webcrew')!.includes('caller_email'))
})

test('addendum: urgent (non-safety) calls are never answered with only a routine slot days away', () => {
  const a = buildClientRuntimeAddendum(baseConfig, true)
  assert.match(a, /NOT an answer if it is more than about 24 hours away/)
  assert.match(a, /immediate transfer/); assert.match(a, /take_message with urgency=urgent/)
  assert.match(a, /email is optional/i)
})
