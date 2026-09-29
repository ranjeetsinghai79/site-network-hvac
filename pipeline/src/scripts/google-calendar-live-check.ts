// The REAL end-to-end calendar check, run AFTER a person has clicked "Connect Google Calendar" in the client portal.
// Uses the stored (encrypted) refresh token exactly as a live call would: token exchange → free/busy → book WITH a
// real attendee invite → find → reschedule → cancel. Everything it creates is cancelled at the end.
// The attendee is the connected Google account itself, so you receive the invite/cancellation emails (expected).
//
//   CALENDAR_TOKEN_KEY=$(gcloud secrets versions access latest --secret=calendar-token-key --project=webcrew-501006) \
//   GOOGLE_CALENDAR_CLIENT_ID=… GOOGLE_CALENDAR_CLIENT_SECRET=… \
//   node --env-file=.env ../node_modules/tsx/dist/cli.mjs src/scripts/google-calendar-live-check.ts [configId]
import pg from 'pg'
import { getReceptionConfigById } from '../reception/db.js'
import { googlePort } from '../reception/google-calendar.js'

let passed = 0, failed = 0
const check = (name: string, ok: boolean, detail = '') => { ok ? passed++ : failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }

async function main() {
  const configId = process.argv[2] ?? 'b1d47991-e700-4837-aac4-c48786d86bc2'
  const cfg = await getReceptionConfigById(configId)
  if (!cfg) throw new Error(`config ${configId} not found`)
  check('a Google account is connected to this line', cfg.calendar_provider === 'google' && !!cfg.google_refresh_token_enc, `provider=${cfg.calendar_provider} account=${cfg.google_account_email ?? '—'} tz=${cfg.timezone ?? '—'}`)
  if (!cfg.google_refresh_token_enc) throw new Error('nothing connected yet — click "Connect Google Calendar" in the client portal first')

  let authFailures = 0
  const port = googlePort(cfg, async () => { authFailures++ })
  const slots = await port.getAvailableSlots()
  check('real token exchange works and Google returns open slots', !slots.error && slots.slots.length > 0, `${slots.slots.length} slots, first ${slots.slots[0]?.label ?? '—'} · error=${slots.error ?? 'none'}`)
  if (!slots.slots.length) throw new Error('cannot continue without slots')

  const invitee = cfg.google_account_email ?? undefined
  const booked = await port.createBooking({ start: slots.slots[0].time, name: 'ZZ Live Check', email: invitee, phone: '+15550100999', notes: 'automated live check, safe to ignore' })
  check('books a real appointment WITH an attendee invite', booked.ok && !!booked.uid, `uid=${booked.uid ?? '—'} invited=${invitee ?? 'nobody'} error=${booked.error ?? 'none'}`)
  const uid = booked.uid
  try {
    const list = await port.listUpcomingBookings({})
    const mine = list.bookings.find(b => b.uid === uid)
    check('finds the booking, attendee email and caller phone stored', !!mine && mine.phone === '+15550100999' && (!invitee || (mine.attendeeEmail ?? '').toLowerCase() === invitee.toLowerCase()), `attendee=${mine?.attendeeEmail ?? '—'} phone=${mine?.phone ?? '—'}`)
    const byEmail = invitee ? await port.listUpcomingBookings({ attendeeEmail: invitee }) : list
    check('can look the booking up by the caller\'s email (used when a caller wants to change it)', byEmail.bookings.some(b => b.uid === uid))
    const moved = await port.rescheduleBooking({ uid: uid!, start: slots.slots[1].time })
    check('reschedules it', moved.ok, moved.error ?? '')
  } finally {
    if (uid) { const c = await port.cancelBooking({ uid }); check('cancels it (guests are told)', c.ok, c.error ?? '') }
  }
  check('no "reconnect your calendar" alarms were raised', authFailures === 0, `auth failures: ${authFailures}`)
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}
main().catch(e => { console.error('LIVE CHECK STOPPED:', e.message); process.exit(2) })
