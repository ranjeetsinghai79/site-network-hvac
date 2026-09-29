import assert from 'node:assert/strict'
import test from 'node:test'
import { computeSlots, DEFAULT_SETTINGS, googlePort, normalizeSettings, zonedWallToUtc } from './google-calendar.js'
import { decryptToken, encryptToken } from './token-crypto.js'
import type { ReceptionConfig } from './types.js'

const LA = 'America/Los_Angeles'

test('wall-clock → UTC is DST-correct', () => {
  assert.equal(zonedWallToUtc(2026, 7, 15, 9, 0, LA).toISOString(), '2026-07-15T16:00:00.000Z')   // PDT, UTC-7
  assert.equal(zonedWallToUtc(2026, 1, 15, 9, 0, LA).toISOString(), '2026-01-15T17:00:00.000Z')   // PST, UTC-8
  assert.equal(zonedWallToUtc(2026, 3, 8, 9, 0, LA).toISOString(), '2026-03-08T16:00:00.000Z')    // DST starts 3am that day: 9am is already PDT
  assert.equal(zonedWallToUtc(2026, 11, 1, 9, 0, LA).toISOString(), '2026-11-01T17:00:00.000Z')   // DST ends: 9am is PST
  assert.equal(zonedWallToUtc(2026, 9, 18, 9, 0, 'America/New_York').toISOString(), '2026-09-18T13:00:00.000Z')
})

test('settings from the browser are clamped and defaulted', () => {
  assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS)
  const s = normalizeSettings({ durationMin: 99999, leadTimeHours: -5, bufferMin: 'x', hours: { mon: ['17:00', '08:00'], tue: null, wed: ['09:00', '12:30'], sat: ['bad', 'x'] } })
  assert.equal(s.durationMin, 240); assert.equal(s.leadTimeHours, 0); assert.equal(s.bufferMin, 0)
  assert.deepEqual(s.hours.mon, ['08:00', '17:00'])   // inverted range rejected → default
  assert.equal(s.hours.tue, null); assert.deepEqual(s.hours.wed, ['09:00', '12:30']); assert.equal(s.hours.sat, null)
})

// Fri 2026-09-18 08:00 PDT
const NOW = new Date('2026-09-18T15:00:00Z')

test('slots: owner hours only, lead time respected, weekends skipped, 3/day cap', () => {
  const slots = computeSlots(NOW, LA, { ...DEFAULT_SETTINGS, leadTimeHours: 2 }, [])
  assert.ok(slots.length > 0 && slots.length <= 9)
  assert.equal(slots[0].time, '2026-09-18T17:00:00.000Z')            // 10:00 PDT: 08:00 now + 2h lead → first whole hour is 10:00
  assert.ok(slots.every(s => !/Sat|Sun/.test(s.label)))              // Sat/Sun closed by default
  assert.ok(slots.filter(s => s.label.startsWith('Fri')).length <= 3)
  for (const s of slots) { const h = Number(new Date(s.time).toLocaleString('en-US', { timeZone: LA, hour: 'numeric', hourCycle: 'h23' })); assert.ok(h >= 8 && h < 17) }
})

test('slots: busy time blocks overlapping starts, buffer widens the block, 90-minute visits step by 30', () => {
  const busy = [{ start: Date.parse('2026-09-18T17:00:00Z'), end: Date.parse('2026-09-18T18:00:00Z') }]   // 10:00–11:00 PDT busy
  const times = computeSlots(NOW, LA, { ...DEFAULT_SETTINGS }, busy).map(s => s.time)
  assert.ok(!times.includes('2026-09-18T17:00:00.000Z')); assert.ok(times.includes('2026-09-18T18:00:00.000Z'))
  const buffered = computeSlots(NOW, LA, { ...DEFAULT_SETTINGS, bufferMin: 30 }, [{ start: Date.parse('2026-09-18T19:00:00Z'), end: Date.parse('2026-09-18T20:00:00Z') }]).map(s => s.time)
  assert.ok(!buffered.includes('2026-09-18T18:00:00.000Z'))           // 11:00 visit + 30m buffer would run into the 12:00 block
  const ninety = computeSlots(NOW, LA, { ...DEFAULT_SETTINGS, durationMin: 90 }, [], { perDay: 6, max: 6 }).map(s => s.time)
  assert.equal(new Date(ninety[1]).getTime() - new Date(ninety[0]).getTime(), 30 * 60_000)
})

test('slots: nothing bookable when every day is closed', () => {
  const closed = { ...DEFAULT_SETTINGS, hours: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null } }
  assert.deepEqual(computeSlots(NOW, LA, closed, []), [])
})

test('refresh tokens are encrypted at rest and round-trip', async () => {
  process.env.CALENDAR_TOKEN_KEY = Buffer.alloc(32, 7).toString('base64')
  const enc = await encryptToken('1//refresh-token-abc')
  assert.ok(!enc.includes('refresh-token')); assert.notEqual(enc, await encryptToken('1//refresh-token-abc'))   // random IV
  assert.equal(await decryptToken(enc), '1//refresh-token-abc')
  await assert.rejects(decryptToken(enc.slice(0, -4) + 'AAAA'))       // tampering fails auth
})

// ── API behaviour against a mocked Google ────────────────────────────────────

async function withGoogle(handler: (url: string, init: RequestInit) => { status?: number; body?: unknown }, run: (calls: string[]) => Promise<void>) {
  process.env.CALENDAR_TOKEN_KEY = Buffer.alloc(32, 7).toString('base64'); process.env.GOOGLE_CALENDAR_CLIENT_ID = 'id'; process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'secret'
  const realFetch = globalThis.fetch; const calls: string[] = []
  globalThis.fetch = (async (input: any, init: RequestInit = {}) => {
    const url = String(input); calls.push(`${init.method ?? 'GET'} ${url.replace('https://www.googleapis.com/calendar/v3', '')}`)
    if (url.includes('oauth2.googleapis.com/token')) return new Response(JSON.stringify({ access_token: 'at', expires_in: 3600 }), { status: 200 })
    const r = handler(url, init); return new Response(r.status === 204 ? null : JSON.stringify(r.body ?? {}), { status: r.status ?? 200 })
  }) as typeof fetch
  try { await run(calls) } finally { globalThis.fetch = realFetch }
}

const cfg = async (id: string): Promise<ReceptionConfig> => ({
  id, website_url: 'https://x.example', business_name: "Steve's HVAC", brain: {} as any, system_prompt: '', active: true, created_at: '', timezone: LA,
  calendar_provider: 'google', google_refresh_token_enc: await encryptToken('rt'), calendar_settings: { durationMin: 60 },
})

test('google: books with an invite, tags the event as ours, and refuses a slot that was just taken', async () => {
  const start = new Date(Date.now() + 26 * 3600_000); start.setMinutes(0, 0, 0)
  let busy = false; let inserted: any = null
  await withGoogle((url, init) => {
    if (url.includes('/events?') && (init.method ?? 'GET') === 'GET') return { body: { items: busy ? [{ id: 'other', status: 'confirmed', start: { dateTime: start.toISOString() }, end: { dateTime: new Date(start.getTime() + 3600_000).toISOString() } }] : [] } }
    if (init.method === 'POST') { inserted = JSON.parse(String(init.body)); return { body: { id: 'evt1', htmlLink: 'https://cal/evt1', start: { dateTime: start.toISOString() } } } }
    return {}
  }, async calls => {
    const port = googlePort(await cfg('cfg-book'))
    const ok = await port.createBooking({ start: start.toISOString(), name: 'Pat Lee', email: 'pat@x.com', phone: '+15559990001', notes: 'AC out' })
    assert.equal(ok.ok, true); assert.equal(ok.uid, 'evt1')
    assert.ok(calls.some(c => c.startsWith('POST /calendars/primary/events?sendUpdates=all')))
    assert.deepEqual(inserted.attendees, [{ email: 'pat@x.com', displayName: 'Pat Lee' }])
    assert.equal(inserted.extendedProperties.private.webcrew, '1'); assert.equal(inserted.extendedProperties.private.phone, '+15559990001')
    assert.equal(new Date(inserted.end.dateTime).getTime() - new Date(inserted.start.dateTime).getTime(), 3600_000)
    busy = true
    const taken = await port.createBooking({ start: start.toISOString(), name: 'Sam', email: 's@x.com' })
    assert.equal(taken.ok, false); assert.match(String(taken.error), /just taken/)
  })
})

test('google: lookup only returns events the receptionist created; reschedule keeps the visit length; cancel treats 410 as done', async () => {
  const s0 = new Date(Date.now() + 48 * 3600_000).toISOString(), e0 = new Date(Date.now() + 49.5 * 3600_000).toISOString()   // a 90-min visit
  let patched: any = null
  await withGoogle((url, init) => {
    if (url.includes('privateExtendedProperty=webcrew%3D1')) return { body: { items: [{ id: 'evt9', status: 'confirmed', summary: 'Pat — appointment', start: { dateTime: s0 }, end: { dateTime: e0 }, attendees: [{ email: 'pat@x.com', displayName: 'Pat Lee' }, { email: 'owner@x.com', self: true }], extendedProperties: { private: { phone: '+15559990001', name: 'Pat Lee' } } }] } }
    if (init.method === 'PATCH') { patched = JSON.parse(String(init.body)); return { body: { id: 'evt9', start: patched.start } } }
    if (init.method === 'DELETE') return { status: 410 }
    if (url.includes('/events/evt9')) return { body: { id: 'evt9', start: { dateTime: s0 }, end: { dateTime: e0 } } }
    return { body: { items: [] } }
  }, async () => {
    const port = googlePort(await cfg('cfg-manage'))
    const found = await port.listUpcomingBookings({})
    assert.equal(found.bookings.length, 1); assert.equal(found.bookings[0].phone, '+15559990001'); assert.equal(found.bookings[0].attendeeEmail, 'pat@x.com')
    assert.equal((await port.listUpcomingBookings({ attendeeEmail: 'PAT@x.com' })).bookings.length, 1)
    assert.equal((await port.listUpcomingBookings({ attendeeEmail: 'other@x.com' })).bookings.length, 0)
    const newStart = new Date(Date.now() + 72 * 3600_000).toISOString()
    const moved = await port.rescheduleBooking({ uid: 'evt9', start: newStart })
    assert.equal(moved.ok, true)
    assert.equal(Date.parse(patched.end.dateTime) - Date.parse(patched.start.dateTime), 90 * 60_000)
    assert.equal((await port.cancelBooking({ uid: 'evt9' })).ok, true)
  })
})

test('google: revoked connection is reported once, and the receptionist falls back instead of throwing', async () => {
  process.env.CALENDAR_TOKEN_KEY = Buffer.alloc(32, 7).toString('base64'); process.env.GOOGLE_CALENDAR_CLIENT_ID = 'id'; process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'secret'
  const realFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })) as typeof fetch
  let notified = 0
  try {
    const port = googlePort(await cfg('cfg-revoked'), async () => { notified++ })
    const r = await port.getAvailableSlots()
    assert.deepEqual(r.slots, []); assert.equal(r.error, 'calendar_disconnected'); assert.equal(notified, 1)
    assert.equal((await port.createBooking({ start: new Date().toISOString(), name: 'a', email: 'a@b.co' })).ok, false)
  } finally { globalThis.fetch = realFetch }
})
