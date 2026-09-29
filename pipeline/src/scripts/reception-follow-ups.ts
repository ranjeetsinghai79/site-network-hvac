/**
 * reception-follow-ups.ts — sends due AI Reception follow-ups (appointment
 * reminders to callers, unreturned-lead nudges to business owners).
 *
 * Run every ~10 minutes: launchd job com.webcrew.reception-follow-ups, or POST
 * /follow-ups/run on the reception server (Bearer RECEPTION_PROVISION_SECRET).
 * Safe to run concurrently — rows are claimed with SKIP LOCKED.
 *
 *   cd pipeline && npx tsx src/scripts/reception-follow-ups.ts
 */
import 'dotenv/config'
import { pool } from '../reception/db.js'
import { runDueFollowUps } from '../reception/follow-ups.js'

runDueFollowUps()
  .then(t => console.log(`[FollowUps] ${new Date().toISOString()} sent=${t.sent} skipped=${t.skipped} deferred=${t.deferred} failed=${t.failed}`))
  .catch(e => { console.error('[FollowUps] run failed:', e.message); process.exitCode = 1 })
  .finally(() => pool.end())
