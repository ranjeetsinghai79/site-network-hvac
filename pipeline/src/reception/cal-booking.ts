// Cal.com API v2 — appointment booking for AI Reception
// Docs: https://cal.com/docs/api-reference/v2

const CAL_BASE = 'https://api.cal.com/v2'
const ENV_API_KEY = process.env.CAL_DIY_API_KEY

// Per-config calendar credentials. WebCrew's own demo line uses the env key;
// every paying client brings their own Cal.com key + event type so bookings
// land on THEIR calendar, never WebCrew's.
export interface CalCreds {
  apiKey: string
  eventTypeId: number
  timezone: string
}

function calHeaders(version = '2024-08-13', apiKey = ENV_API_KEY) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'cal-api-version': version,
    'Content-Type': 'application/json',
  }
}

export interface SlotResult {
  slots: { time: string; label: string }[]
  timezone: string
  error?: string
}

export interface BookingResult {
  ok: boolean
  bookingId?: number
  uid?: string
  start?: string
  meetingUrl?: string
  error?: string
}

export interface CalBooking {
  uid: string
  id?: number
  start: string
  end?: string
  status: string
  title?: string
  attendeeName?: string
  attendeeEmail?: string
  phone?: string
  notes?: string
}

// Returns available slots for the next N days (default 5 business days)
export async function getAvailableSlots(
  eventTypeId: number,
  timezone: string,
  daysAhead = 5,
  apiKey = ENV_API_KEY,
): Promise<SlotResult> {
  if (!apiKey) return { slots: [], timezone, error: 'Calendar API key not set' }

  const startTime = new Date()
  startTime.setHours(startTime.getHours() + 1, 0, 0, 0) // start from next hour
  const endTime = new Date(startTime)
  endTime.setDate(endTime.getDate() + daysAhead)

  const params = new URLSearchParams({
    startTime: startTime.toISOString(),
    endTime:   endTime.toISOString(),
    eventTypeId: String(eventTypeId),
    timeZone:  timezone,
  })

  try {
    const res = await fetch(`${CAL_BASE}/slots/available?${params}`, {
      headers: calHeaders('2024-09-23', apiKey),
    })
    const data = await res.json() as any

    if (!res.ok) return { slots: [], timezone, error: data?.error?.message ?? 'slots fetch failed' }

    // data.data.slots = { "2024-06-27": [{ time: "...", ... }], ... }
    const slotsByDay = data?.data?.slots ?? {}
    const slots: { time: string; label: string }[] = []

    for (const [day, daySlots] of Object.entries(slotsByDay)) {
      for (const s of (daySlots as any[]).slice(0, 3)) { // max 3 per day
        const dt = new Date(s.time)
        const label = dt.toLocaleString('en-US', {
          timeZone: timezone,
          weekday: 'short', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit', hour12: true,
        })
        slots.push({ time: s.time, label })
        if (slots.length >= 9) break
      }
      if (slots.length >= 9) break
    }

    return { slots, timezone }
  } catch (e: any) {
    return { slots: [], timezone, error: e.message }
  }
}

export async function createBooking(opts: {
  eventTypeId: number
  start: string        // ISO datetime
  name: string
  email: string
  phone?: string
  notes?: string
  timezone: string
  apiKey?: string
}): Promise<BookingResult> {
  const apiKey = opts.apiKey ?? ENV_API_KEY
  if (!apiKey) return { ok: false, error: 'Calendar API key not set' }

  try {
    const body: any = {
      eventTypeId: opts.eventTypeId,
      start: opts.start,
      attendee: {
        name:     opts.name,
        email:    opts.email,
        timeZone: opts.timezone,
        language: 'en',
      },
    }
    if (opts.phone || opts.notes) {
      body.metadata = {}
      if (opts.phone) body.metadata.phone = opts.phone
      if (opts.notes) body.metadata.notes = opts.notes
    }

    const res = await fetch(`${CAL_BASE}/bookings`, {
      method:  'POST',
      headers: calHeaders('2024-08-13', apiKey),
      body:    JSON.stringify(body),
    })
    const data = await res.json() as any

    if (!res.ok) return { ok: false, error: data?.error?.message ?? 'booking failed' }

    const booking = data?.data
    return {
      ok:         true,
      bookingId:  booking?.id,
      uid:        booking?.uid,
      start:      booking?.start,
      meetingUrl: booking?.meetingUrl ?? booking?.location,
    }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

function toCalBooking(b: any): CalBooking {
  const attendee = b?.attendees?.[0]
  return {
    uid:           b.uid,
    id:            b.id,
    start:         b.start,
    end:           b.end,
    status:        b.status,
    title:         b.title,
    attendeeName:  attendee?.name,
    attendeeEmail: attendee?.email,
    phone:         b?.metadata?.phone,
    notes:         b?.metadata?.notes,
  }
}

// Upcoming (not past/cancelled) bookings on this calendar. Ownership matching
// against the caller happens in the caller-verification layer, not here — this
// is a raw calendar read.
export async function listUpcomingBookings(opts: {
  apiKey?: string
  eventTypeId?: number
  attendeeEmail?: string
}): Promise<{ ok: boolean; bookings: CalBooking[]; error?: string }> {
  const apiKey = opts.apiKey ?? ENV_API_KEY
  if (!apiKey) return { ok: false, bookings: [], error: 'Calendar API key not set' }

  const params = new URLSearchParams({ status: 'upcoming', sortStart: 'asc', take: '50' })
  if (opts.attendeeEmail) params.set('attendeeEmail', opts.attendeeEmail)
  if (opts.eventTypeId) params.set('eventTypeId', String(opts.eventTypeId))

  try {
    const res = await fetch(`${CAL_BASE}/bookings?${params}`, { headers: calHeaders('2024-08-13', apiKey) })
    const data = await res.json() as any
    if (!res.ok) return { ok: false, bookings: [], error: data?.error?.message ?? 'bookings lookup failed' }
    const rows: any[] = Array.isArray(data?.data) ? data.data : []
    return { ok: true, bookings: rows.filter(b => b?.uid).map(toCalBooking) }
  } catch (e: any) {
    return { ok: false, bookings: [], error: e.message }
  }
}

export async function rescheduleBooking(opts: {
  apiKey?: string
  uid: string
  start: string        // ISO datetime (UTC)
  reason?: string
  rescheduledBy?: string
}): Promise<BookingResult> {
  const apiKey = opts.apiKey ?? ENV_API_KEY
  if (!apiKey) return { ok: false, error: 'Calendar API key not set' }

  try {
    const body: any = { start: opts.start }
    if (opts.reason) body.reschedulingReason = opts.reason
    if (opts.rescheduledBy) body.rescheduledBy = opts.rescheduledBy
    const res = await fetch(`${CAL_BASE}/bookings/${encodeURIComponent(opts.uid)}/reschedule`, {
      method:  'POST',
      headers: calHeaders('2024-08-13', apiKey),
      body:    JSON.stringify(body),
    })
    const data = await res.json() as any
    if (!res.ok) return { ok: false, error: data?.error?.message ?? 'reschedule failed' }
    const booking = data?.data
    return {
      ok:         true,
      bookingId:  booking?.id,
      uid:        booking?.uid,
      start:      booking?.start,
      meetingUrl: booking?.meetingUrl ?? booking?.location,
    }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function cancelBooking(opts: {
  apiKey?: string
  uid: string
  reason?: string
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = opts.apiKey ?? ENV_API_KEY
  if (!apiKey) return { ok: false, error: 'Calendar API key not set' }

  try {
    const res = await fetch(`${CAL_BASE}/bookings/${encodeURIComponent(opts.uid)}/cancel`, {
      method:  'POST',
      headers: calHeaders('2024-08-13', apiKey),
      body:    JSON.stringify({ cancellationReason: opts.reason ?? 'Cancelled by caller via AI receptionist' }),
    })
    const data = await res.json() as any
    if (!res.ok) return { ok: false, error: data?.error?.message ?? 'cancel failed' }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

// Validates a client-supplied Cal.com key + event type before it is saved to a
// reception config, so a typo can't ship a receptionist that silently fails to
// book. Returns the event type's title/length on success.
export async function verifyCalCredentials(apiKey: string, eventTypeId: number): Promise<{ ok: boolean; title?: string; lengthMinutes?: number; error?: string }> {
  try {
    const res = await fetch(`${CAL_BASE}/event-types/${eventTypeId}`, { headers: calHeaders('2024-06-14', apiKey) })
    const data = await res.json() as any
    if (!res.ok) return { ok: false, error: data?.error?.message ?? `Cal.com returned ${res.status}` }
    return { ok: true, title: data?.data?.title, lengthMinutes: data?.data?.lengthInMinutes ?? data?.data?.length }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

// ── Provider-neutral port ─────────────────────────────────────────────────────
// The receptionist talks to a CalendarPort; Cal.com (this file) and Google Calendar
// (google-calendar.ts) each implement it.

export interface CalendarPort {
  provider: 'cal' | 'google'
  timezone: string
  getAvailableSlots(): Promise<SlotResult>
  /** Cal.com cannot book without an attendee email; Google Calendar can (no invite is sent then). */
  requiresEmail?: boolean
  createBooking(o: { start: string; name: string; email?: string; phone?: string; notes?: string }): Promise<BookingResult>
  listUpcomingBookings(o: { attendeeEmail?: string }): Promise<{ ok: boolean; bookings: CalBooking[]; error?: string }>
  rescheduleBooking(o: { uid: string; start: string; reason?: string; rescheduledBy?: string }): Promise<BookingResult>
  cancelBooking(o: { uid: string; reason?: string }): Promise<{ ok: boolean; error?: string }>
}

export function calPort(c: CalCreds): CalendarPort {
  return {
    provider: 'cal', timezone: c.timezone, requiresEmail: true,
    getAvailableSlots: () => getAvailableSlots(c.eventTypeId, c.timezone, 5, c.apiKey),
    createBooking: o => createBooking({ ...o, email: o.email ?? '', eventTypeId: c.eventTypeId, timezone: c.timezone, apiKey: c.apiKey }),
    listUpcomingBookings: o => listUpcomingBookings({ apiKey: c.apiKey, eventTypeId: o.attendeeEmail ? undefined : c.eventTypeId, attendeeEmail: o.attendeeEmail }),
    rescheduleBooking: o => rescheduleBooking({ ...o, apiKey: c.apiKey }),
    cancelBooking: o => cancelBooking({ ...o, apiKey: c.apiKey }),
  }
}
