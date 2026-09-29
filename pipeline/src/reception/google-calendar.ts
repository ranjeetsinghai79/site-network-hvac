import type { ReceptionConfig } from './types.js'
import type { BookingResult, CalBooking, CalendarPort, SlotResult } from './cal-booking.js'
import { decryptToken } from './token-crypto.js'

// Native Google Calendar booking for client receptionists. The client signs in with
// Google once (dashboard → "Connect Google Calendar"); we hold an encrypted refresh
// token and only ever touch events we created (extendedProperties.private.webcrew=1),
// plus read the calendar's busy times to avoid double-booking.

const GCAL = 'https://www.googleapis.com/calendar/v3'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface CalendarSettings {
  durationMin: number
  leadTimeHours: number
  bufferMin: number
  hours: Record<Weekday, [string, string] | null>   // 24h "HH:MM" local to the calendar's timezone
}

export const DEFAULT_SETTINGS: CalendarSettings = {
  durationMin: 60,
  leadTimeHours: 2,
  bufferMin: 0,
  hours: { mon: ['08:00', '17:00'], tue: ['08:00', '17:00'], wed: ['08:00', '17:00'], thu: ['08:00', '17:00'], fri: ['08:00', '17:00'], sat: null, sun: null },
}

const DAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/** Owner-editable settings are untrusted JSON — clamp everything to sane values. */
export function normalizeSettings(raw: unknown): CalendarSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<CalendarSettings>
  const clamp = (v: unknown, min: number, max: number, dflt: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : dflt)
  const hours = { ...DEFAULT_SETTINGS.hours }
  for (const d of DAYS) {
    const h = (r.hours as any)?.[d]
    if (h === null) hours[d] = null
    else if (Array.isArray(h) && HHMM.test(h[0]) && HHMM.test(h[1]) && h[0] < h[1]) hours[d] = [h[0], h[1]]
  }
  return { durationMin: clamp(r.durationMin, 15, 240, 60), leadTimeHours: clamp(r.leadTimeHours, 0, 72, 2), bufferMin: clamp(r.bufferMin, 0, 120, 0), hours }
}

// ── timezone math (no libraries) ──────────────────────────────────────────────

function partsIn(date: Date, tz: string) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(date)
  const n = (t: string) => Number(p.find(x => x.type === t)!.value)
  return { y: n('year'), m: n('month'), d: n('day'), h: n('hour'), min: n('minute'), s: n('second') }
}

/** The UTC instant at which the wall clock in `tz` reads y-m-d hh:mm. DST-safe (re-checks the offset at the guess). */
export function zonedWallToUtc(y: number, m: number, d: number, hh: number, mm: number, tz: string): Date {
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm, 0)
  let guess = wallAsUtc
  for (let i = 0; i < 2; i++) {
    const p = partsIn(new Date(guess), tz)
    const seen = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, 0)
    guess += wallAsUtc - seen
  }
  return new Date(guess)
}

/** Local calendar date `offsetDays` after `now`, plus its weekday, in `tz`. */
function localDay(now: Date, offsetDays: number, tz: string) {
  const p = partsIn(now, tz)
  const base = new Date(Date.UTC(p.y, p.m - 1, p.d + offsetDays))
  return { y: base.getUTCFullYear(), m: base.getUTCMonth() + 1, d: base.getUTCDate(), dow: DAYS[base.getUTCDay()] }
}

const [MIN, HOUR] = [60_000, 3_600_000]
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))

export interface Busy { start: number; end: number }

/** Bookable slots: inside owner hours, after the lead time, not overlapping busy time. Up to 3 per day, 9 total. */
export function computeSlots(now: Date, tz: string, settings: CalendarSettings, busy: Busy[], opts: { days?: number; perDay?: number; max?: number } = {}): { time: string; label: string }[] {
  const { days = 7, perDay = 3, max = 9 } = opts
  const step = settings.durationMin % 60 === 0 ? 60 : 30
  const earliest = now.getTime() + settings.leadTimeHours * HOUR
  const out: { time: string; label: string }[] = []
  for (let off = 0; off < days && out.length < max; off++) {
    const day = localDay(now, off, tz)
    const window = settings.hours[day.dow]
    if (!window) continue
    let taken = 0
    for (let t = toMin(window[0]); t + settings.durationMin <= toMin(window[1]) && taken < perDay && out.length < max; t += step) {
      const start = zonedWallToUtc(day.y, day.m, day.d, Math.floor(t / 60), t % 60, tz).getTime()
      const end = start + (settings.durationMin + settings.bufferMin) * MIN
      if (start < earliest) continue
      if (busy.some(b => start < b.end && end > b.start)) continue
      const iso = new Date(start).toISOString()
      out.push({ time: iso, label: new Date(start).toLocaleString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) })
      taken++
    }
  }
  return out
}

// ── Google API ────────────────────────────────────────────────────────────────

export class CalendarAuthError extends Error {}

const tokenCache = new Map<string, { token: string; exp: number }>()

function oauthClient() {
  const id = process.env.GOOGLE_CALENDAR_CLIENT_ID ?? process.env.GOOGLE_OAUTH_CLIENT_ID
  const secret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!id || !secret) throw new Error('Google Calendar OAuth client is not configured')
  return { id, secret }
}

/** Test seam for scripts/google-calendar-selftest.ts: drive googlePort with a token from another identity (a service
 *  account) instead of a client's OAuth refresh token. Not used by any production path. */
export function primeAccessTokenForTest(configId: string, token: string, ttlMs = 50 * 60_000): void {
  tokenCache.set(configId, { token, exp: Date.now() + ttlMs })
}

async function accessToken(config: Pick<ReceptionConfig, 'id' | 'google_refresh_token_enc'>): Promise<string> {
  const hit = tokenCache.get(config.id)
  if (hit && hit.exp > Date.now() + 60_000) return hit.token
  if (!config.google_refresh_token_enc) throw new CalendarAuthError('not connected')
  const refresh = await decryptToken(config.google_refresh_token_enc)
  const { id, secret } = oauthClient()
  const res = await fetch(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: 'refresh_token' }).toString(),
  })
  const data = await res.json() as any
  if (!res.ok) {
    if (data?.error === 'invalid_grant') throw new CalendarAuthError('Google revoked or expired the calendar connection')
    throw new Error(`Google token refresh failed: ${data?.error_description ?? data?.error ?? res.status}`)
  }
  tokenCache.set(config.id, { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 })
  return data.access_token
}

async function gcal(token: string, path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`${GCAL}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}))
  if (res.status === 401) throw new CalendarAuthError('Google rejected the calendar token')
  return { ok: res.ok, status: res.status, data }
}

/** Busy intervals on the primary calendar in [from, to). Excludes one event (the one being moved). */
async function listBusy(token: string, from: Date, to: Date, tz: string, excludeId?: string): Promise<Busy[]> {
  const q = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250', timeZone: tz })
  const r = await gcal(token, `/calendars/primary/events?${q}`)
  if (!r.ok) throw new Error(r.data?.error?.message ?? `events.list ${r.status}`)
  const busy: Busy[] = []
  for (const e of (r.data.items ?? []) as any[]) {
    if (e.id === excludeId || e.status === 'cancelled' || e.transparency === 'transparent') continue
    if (e.attendees?.find((a: any) => a.self)?.responseStatus === 'declined') continue
    if (e.start?.dateTime) busy.push({ start: Date.parse(e.start.dateTime), end: Date.parse(e.end.dateTime) })
    else if (e.start?.date) {   // all-day and marked busy
      const [y, m, d] = e.start.date.split('-').map(Number), [y2, m2, d2] = e.end.date.split('-').map(Number)
      busy.push({ start: zonedWallToUtc(y, m, d, 0, 0, tz).getTime(), end: zonedWallToUtc(y2, m2, d2, 0, 0, tz).getTime() })
    }
  }
  return busy
}

const toBooking = (e: any): CalBooking => ({
  uid: e.id, start: e.start?.dateTime, end: e.end?.dateTime, status: e.status === 'cancelled' ? 'cancelled' : 'accepted', title: e.summary,
  attendeeName: e.extendedProperties?.private?.name ?? e.attendees?.find((a: any) => !a.self)?.displayName,
  attendeeEmail: e.attendees?.find((a: any) => !a.self)?.email,
  phone: e.extendedProperties?.private?.phone, notes: e.description,
})

/** Called when Google says the connection is dead so the owner is told to reconnect instead of the AI silently failing. */
export type AuthFailureHandler = (config: ReceptionConfig) => Promise<void>

export function googlePort(config: ReceptionConfig, onAuthFailure?: AuthFailureHandler): CalendarPort {
  const settings = normalizeSettings(config.calendar_settings)
  const timezone = config.timezone ?? 'America/Los_Angeles'
  const guard = async <T>(fn: (token: string) => Promise<T>, fail: (msg: string) => T): Promise<T> => {
    try { return await fn(await accessToken(config)) }
    catch (e: any) {
      if (e instanceof CalendarAuthError) { tokenCache.delete(config.id); await onAuthFailure?.(config).catch(() => {}); return fail('calendar_disconnected') }
      return fail(e.message)
    }
  }
  return {
    provider: 'google', timezone,

    getAvailableSlots: () => guard(async token => {
      const now = new Date()
      const busy = await listBusy(token, now, new Date(now.getTime() + 9 * 24 * HOUR), timezone)
      return { slots: computeSlots(now, timezone, settings, busy), timezone }
    }, error => ({ slots: [], timezone, error })),

    createBooking: o => guard(async token => {
      const start = new Date(o.start), end = new Date(start.getTime() + settings.durationMin * MIN)
      if (!Number.isFinite(start.getTime())) return { ok: false, error: 'invalid start time' }
      // Re-check right before writing: the slot list can be a minute old.
      const clash = (await listBusy(token, new Date(start.getTime() - HOUR), new Date(end.getTime() + HOUR), timezone))
        .some(b => start.getTime() < b.end + settings.bufferMin * MIN && end.getTime() > b.start)
      if (clash) return { ok: false, error: 'That time was just taken' }
      const r = await gcal(token, '/calendars/primary/events?sendUpdates=all', {
        method: 'POST',
        body: JSON.stringify({
          summary: `${o.name} — appointment`,
          description: `Booked by your AI receptionist.\nPhone: ${o.phone ?? 'n/a'}${o.notes ? `\nNotes: ${o.notes}` : ''}`,
          start: { dateTime: start.toISOString(), timeZone: timezone }, end: { dateTime: end.toISOString(), timeZone: timezone },
          ...(o.email ? { attendees: [{ email: o.email, displayName: o.name }] } : {}),
          extendedProperties: { private: { webcrew: '1', phone: o.phone ?? '', name: o.name } },
        }),
      })
      if (!r.ok) return { ok: false, error: r.data?.error?.message ?? `events.insert ${r.status}` }
      return { ok: true, uid: r.data.id, start: r.data.start?.dateTime ?? start.toISOString(), meetingUrl: r.data.htmlLink }
    }, error => ({ ok: false, error })),

    listUpcomingBookings: o => guard(async token => {
      const q = new URLSearchParams({ timeMin: new Date().toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '50', privateExtendedProperty: 'webcrew=1' })
      const r = await gcal(token, `/calendars/primary/events?${q}`)
      if (!r.ok) return { ok: false, bookings: [], error: r.data?.error?.message ?? `events.list ${r.status}` }
      let bookings = (r.data.items ?? []).filter((e: any) => e.status !== 'cancelled' && e.start?.dateTime).map(toBooking)
      if (o.attendeeEmail) bookings = bookings.filter((b: CalBooking) => b.attendeeEmail?.toLowerCase() === o.attendeeEmail!.toLowerCase())
      return { ok: true, bookings }
    }, error => ({ ok: false, bookings: [], error })),

    rescheduleBooking: o => guard(async token => {
      const cur = await gcal(token, `/calendars/primary/events/${encodeURIComponent(o.uid)}`)
      if (!cur.ok) return { ok: false, error: cur.data?.error?.message ?? `events.get ${cur.status}` }
      const len = Date.parse(cur.data.end.dateTime) - Date.parse(cur.data.start.dateTime)
      const start = new Date(o.start), end = new Date(start.getTime() + len)
      const clash = (await listBusy(token, new Date(start.getTime() - HOUR), new Date(end.getTime() + HOUR), timezone, o.uid))
        .some(b => start.getTime() < b.end + settings.bufferMin * MIN && end.getTime() > b.start)
      if (clash) return { ok: false, error: 'That time was just taken' }
      const r = await gcal(token, `/calendars/primary/events/${encodeURIComponent(o.uid)}?sendUpdates=all`, {
        method: 'PATCH', body: JSON.stringify({ start: { dateTime: start.toISOString(), timeZone: timezone }, end: { dateTime: end.toISOString(), timeZone: timezone } }),
      })
      if (!r.ok) return { ok: false, error: r.data?.error?.message ?? `events.patch ${r.status}` }
      return { ok: true, uid: r.data.id, start: r.data.start?.dateTime ?? start.toISOString(), meetingUrl: r.data.htmlLink }
    }, error => ({ ok: false, error })),

    cancelBooking: o => guard(async token => {
      const r = await gcal(token, `/calendars/primary/events/${encodeURIComponent(o.uid)}?sendUpdates=all`, { method: 'DELETE' })
      // 404/410: already gone — the caller's intent is satisfied.
      return r.ok || r.status === 404 || r.status === 410 ? { ok: true } : { ok: false, error: r.data?.error?.message ?? `events.delete ${r.status}` }
    }, error => ({ ok: false, error })),
  }
}
