// Drives the REAL googlePort (slots, book, double-book guard, list, reschedule, cancel, revoked-token handling)
// against Google's real Calendar API, using a service account's own empty calendar — never a client's calendar.
// Cannot cover: the interactive Google consent, refresh-token exchange, or inviting attendees (a service account
// cannot invite people without domain-wide delegation), so the with-email booking is expected to be refused here.
//   node --env-file=.env ../node_modules/tsx/dist/cli.mjs src/scripts/google-calendar-selftest.ts
import { createSign } from 'crypto'
import { readFileSync } from 'fs'
import { googlePort, primeAccessTokenForTest } from '../reception/google-calendar.js'
import type { ReceptionConfig } from '../reception/types.js'

const sa = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS ?? './webcrew-vertex-sa.json', 'utf8'))
let passed = 0, failed = 0
const check = (name: string, ok: boolean, detail = '') => { ok ? passed++ : failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }

async function saToken(): Promise<string> {
  const b = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${b({ alg: 'RS256', typ: 'JWT' })}.${b({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/calendar', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url')
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }) })
  const d: any = await r.json(); if (!d.access_token) throw new Error('service-account token failed: ' + JSON.stringify(d)); return d.access_token
}

async function main() {
  const token = await saToken()
  const cfg = { id: 'selftest-config', timezone: 'America/Los_Angeles', google_refresh_token_enc: 'unused', calendar_settings: null } as unknown as ReceptionConfig
  primeAccessTokenForTest(cfg.id, token)
  let authFailures = 0
  const port = googlePort(cfg, async () => { authFailures++ })
  let uid: string | undefined

  try {
    const s1 = await port.getAvailableSlots()
    check('offers real open slots from Google (business hours, next 9 days)', !s1.error && s1.slots.length >= 4, `${s1.slots.length} slots, first: ${s1.slots[0]?.label ?? '—'} · error=${s1.error ?? 'none'}`)
    if (!s1.slots.length) throw new Error('no slots — cannot continue')
    const [a, b] = [s1.slots[0], s1.slots[1]]

    const booked = await port.createBooking({ start: a.time, name: 'ZZ Selftest Caller', phone: '+15550100123', notes: 'automated self-test, safe to ignore' })
    uid = booked.uid
    check('books an appointment with NO email (email is optional)', booked.ok && !!booked.uid, `uid=${booked.uid ?? '—'} error=${booked.error ?? 'none'}`)

    const s2 = await port.getAvailableSlots()
    check('a booked time disappears from the offered slots', !s2.slots.some(x => x.time === a.time), `first now: ${s2.slots[0]?.label}`)

    const dup = await port.createBooking({ start: a.time, name: 'ZZ Second Caller' })
    check('refuses to double-book the same time', !dup.ok && /just taken/i.test(dup.error ?? ''), dup.error ?? 'booked (BAD)')
    if (dup.ok && dup.uid) await port.cancelBooking({ uid: dup.uid })

    const list = await port.listUpcomingBookings({})
    const mine = list.bookings.find(x => x.uid === uid)
    check('finds its own booking, with caller phone stored for later matching', !!mine && mine.phone === '+15550100123', `phone=${mine?.phone ?? '—'} status=${mine?.status}`)
    const durMin = mine?.start && mine?.end ? Math.round((Date.parse(mine.end) - Date.parse(mine.start)) / 60000) : NaN

    const moved = await port.rescheduleBooking({ uid: uid!, start: b.time })
    const list2 = await port.listUpcomingBookings({})
    const m2 = list2.bookings.find(x => x.uid === (moved.uid ?? uid))
    const dur2 = m2?.start && m2?.end ? Math.round((Date.parse(m2.end) - Date.parse(m2.start)) / 60000) : NaN
    check('reschedules to a new time and keeps the visit length', moved.ok && !!m2 && Date.parse(m2.start) === Date.parse(b.time) && dur2 === durMin, `length ${durMin}→${dur2} min`)
    uid = moved.uid ?? uid

    const withEmail = await port.createBooking({ start: s2.slots[2]?.time ?? b.time, name: 'ZZ Invite Test', email: 'nobody@example.com' })
    check('(expected refusal) inviting an attendee needs a real user identity, not a service account', !withEmail.ok, `${withEmail.ok ? 'BOOKED — unexpected' : 'refused: ' + (withEmail.error ?? '').slice(0, 90)}`)
    if (withEmail.ok && withEmail.uid) await port.cancelBooking({ uid: withEmail.uid })

    const cancelled = await port.cancelBooking({ uid: uid! })
    const list3 = await port.listUpcomingBookings({})
    check('cancels the booking and it no longer lists', cancelled.ok && !list3.bookings.some(x => x.uid === uid), '')
    uid = undefined

    // Revoked / expired connection: the AI must fall back cleanly and the owner must be told to reconnect.
    primeAccessTokenForTest(cfg.id, 'ya29.revoked-or-invalid-token')
    const dead = await port.getAvailableSlots()
    check('a revoked Google connection is detected, owner is notified, AI gets a clean error', dead.error === 'calendar_disconnected' && authFailures === 1, `error=${dead.error} notifications=${authFailures}`)
  } finally {
    if (uid) { primeAccessTokenForTest(cfg.id, token); await port.cancelBooking({ uid }).catch(() => {}) }
  }
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}
main().catch(e => { console.error('SELFTEST ERROR:', e.message); process.exit(2) })
