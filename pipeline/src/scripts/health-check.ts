/**
 * health-check.ts — full system health check + self-heal, twice-daily via launchd.
 *
 * Checks the Worker, DB, every com.webcrew.* launchd job, stuck build_requests,
 * AI Studio quota, migration drift (the exact class of bug found 2026-08-23),
 * and webcrew.app's SPF/DMARC/MX records (duplicate/missing records — the
 * class of thing public domain-reputation checkers like usercheck.com flag).
 * Auto-heals what's safely recoverable: reloads an unloaded launchd job,
 * unsticks a build_requests row that crashed mid-build (no exception ever
 * thrown, so auto-build-from-sms.ts's own retry logic never saw it). Records
 * every run to system_health_checks (migration-v32) so there's an actual
 * trend to look at, not just a point-in-time email. Emails a status report
 * either way — silence is not a health signal for a background job.
 *
 * Usage: cd pipeline && npx tsx src/scripts/health-check.ts
 * Scheduled: com.webcrew.health-check launchd job, ~7:30am + ~6:30pm daily.
 */

import 'dotenv/config'
import { execSync } from 'child_process'
import { readdirSync } from 'fs'
import { resolveTxt, resolveMx } from 'dns/promises'
import pg from 'pg'
import { listSites } from '../tools/google-search-console.js'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

type CheckResult = { name: string; ok: boolean; detail: string; healed?: string }
const results: CheckResult[] = []

function check(name: string, ok: boolean, detail: string, healed?: string) {
  results.push({ name, ok, detail, healed })
  console.log(`${ok ? '✅' : '❌'} ${name}: ${detail}${healed ? ` (healed: ${healed})` : ''}`)
}

// ── 1. Worker reachability ──────────────────────────────────────────────────
async function checkWorker() {
  try {
    const start = Date.now()
    const res = await fetch('https://api.webcrew.app/health', { signal: AbortSignal.timeout(10000) })
    const ms = Date.now() - start
    check('Worker /health', res.ok, res.ok ? `200 OK in ${ms}ms` : `HTTP ${res.status}`)
  } catch (e: any) {
    check('Worker /health', false, `unreachable: ${e.message}`)
  }
}

// ── 1b. Reception server can really answer a call (touches the database) ──────
// /health is DB-free and stayed green through the 2026-09-21 outage while every call hung; /ready is the real test.
async function checkReceptionReady() {
  const url = process.env.RECEPTION_BASE_URL ?? 'https://ai-reception-459352382653.us-central1.run.app'
  try {
    const start = Date.now()
    const res = await fetch(`${url}/ready`, { signal: AbortSignal.timeout(15000) })
    const ms = Date.now() - start
    check('Reception /ready (DB-backed)', res.ok, res.ok ? `200 OK in ${ms}ms` : `HTTP ${res.status} — calls cannot be answered`)
  } catch (e: any) {
    check('Reception /ready (DB-backed)', false, `unreachable: ${e.message}`)
  }
}

// ── 2. DB reachability ───────────────────────────────────────────────────────
async function checkDb() {
  try {
    await pool.query('SELECT 1')
    check('Neon DB', true, 'reachable')
  } catch (e: any) {
    check('Neon DB', false, `unreachable: ${e.message}`)
  }
}

// ── 3. launchd jobs — present + last exit code, reload if missing ───────────
// 2026-09-21: every other job (scraping, outreach, workers, drip, review-requests, follow-up drain) was retired —
// the product is the four pillars only, and follow-ups now run from Cloud Scheduler. Plists live in
// ~/Library/LaunchAgents/disabled-2026-09-21/. Do NOT re-add a job here without also re-enabling its plist.
const EXPECTED_JOBS = [
  'com.webcrew.health-check',
  'com.webcrew.seo-weekly-check',
]

function checkLaunchdJobs() {
  let listing = ''
  try {
    listing = execSync('launchctl list', { encoding: 'utf8' })
  } catch (e: any) {
    check('launchd jobs', false, `launchctl list failed: ${e.message}`)
    return
  }
  for (const job of EXPECTED_JOBS) {
    const line = listing.split('\n').find(l => l.includes(job))
    if (!line) {
      // Not loaded at all — try to reload it from its plist (safe: identical
      // to what a `launchctl bootstrap` at setup time already did once).
      const plist = `${process.env.HOME}/Library/LaunchAgents/${job}.plist`
      try {
        execSync(`launchctl bootstrap gui/$(id -u) "${plist}"`, { encoding: 'utf8' })
        check(job, false, 'was not loaded', 're-bootstrapped from plist')
      } catch (e: any) {
        check(job, false, `not loaded, reload failed: ${e.message.slice(0, 150)}`)
      }
      continue
    }
    const exitCode = line.trim().split(/\s+/)[1]
    if (exitCode && exitCode !== '0' && exitCode !== '-') {
      check(job, false, `last exit code ${exitCode} — needs manual look, not auto-healable blind`)
    } else {
      check(job, true, 'loaded, last exit 0')
    }
  }
}

// ── 4. Stuck build_requests — crashed mid-build with no thrown exception,
// so auto-build-from-sms.ts's own retry-then-error logic never saw it ───────
async function checkStuckBuilds() {
  const STUCK_MINUTES = 20
  const { rows } = await pool.query(
    `SELECT id, name, phone, status, updated_at FROM build_requests
     WHERE status = 'building' AND updated_at < NOW() - INTERVAL '${STUCK_MINUTES} minutes'`
  )
  if (rows.length === 0) {
    check('Stuck builds', true, 'none stuck in building')
    return
  }
  for (const row of rows) {
    await pool.query(`UPDATE build_requests SET status='retrying', updated_at=NOW() WHERE id=$1`, [row.id])
  }
  check('Stuck builds', false, `${rows.length} stuck >${STUCK_MINUTES}min in 'building' (${rows.map(r => r.name).join(', ')})`, `reset to 'retrying' — poller will retry once, then auto-build-from-sms.ts's own cap marks 'error' if it fails again`)
}

// ── 5. AI Studio free-tier quota usage today ─────────────────────────────────
// ── Follow-up runner (Cloud Scheduler → ai-reception /follow-ups/run) ────────
// Reminders/nudges are drained every 5 min in the cloud. If that stops, due rows pile up here first.
async function checkFollowUpRunner() {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS overdue, COALESCE(MAX(EXTRACT(EPOCH FROM (NOW() - due_at)) / 60), 0)::int AS max_min
       FROM reception_follow_ups WHERE status = 'pending' AND due_at < NOW() - INTERVAL '30 minutes'`)
    const { overdue, max_min } = rows[0]
    check('Follow-up runner', overdue === 0, overdue === 0 ? 'no overdue reminders/nudges' : `${overdue} follow-up(s) overdue, oldest ${max_min} min — is Cloud Scheduler job "reception-follow-ups" (us-central1) running?`)
  } catch (e: any) {
    check('Follow-up runner', false, `query failed: ${e.message}`)
  }
}

// ── SMS actually delivered? (Twilio accepts a message, then the carrier can still block it) ─────────
// A2P 10DLC: a Sole Proprietor campaign registers ONE number; any other number sending from it gets error 30034 and
// the message is dropped even though our own logs say "sent". Found 2026-09-19 on the first client number.
async function checkSmsDelivery() {
  const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !tok) { check('SMS delivery (Twilio)', true, 'skipped — Twilio creds not set'); return }
  try {
    const since = new Date(Date.now() - 24 * 3_600_000)
    const day = since.toISOString().slice(0, 10)
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json?DateSent%3E=${day}&PageSize=200`, {
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${tok}`).toString('base64')}` }, signal: AbortSignal.timeout(15000) })
    const msgs = ((await res.json()) as any).messages ?? []
    const recent = msgs.filter((m: any) => m.direction?.startsWith('outbound') && new Date(m.date_created).getTime() >= since.getTime())
    const a2p = recent.filter((m: any) => m.error_code === 30034)
    const other = recent.filter((m: any) => ['failed', 'undelivered'].includes(m.status) && m.error_code !== 30034)
    const senders = [...new Set(a2p.map((m: any) => m.from))].join(', ')
    check('SMS delivery (Twilio)', a2p.length === 0,
      a2p.length ? `${a2p.length} message(s) BLOCKED by A2P 10DLC (30034) from ${senders} — number not registered on the campaign (Sole Proprietor = 1 number). Client texts will not arrive.`
        : `${recent.length} outbound in 24h, none blocked by A2P${other.length ? `; ${other.length} other failures (e.g. invalid destination)` : ''}`)
  } catch (e: any) {
    check('SMS delivery (Twilio)', false, `check failed: ${e.message}`)
  }
}

async function checkAiStudioQuota() {
  const { rows } = await pool.query(
    `SELECT key_name, call_count FROM ai_studio_key_usage WHERE usage_date = CURRENT_DATE`
  )
  const smsWorker = rows.find(r => r.key_name === 'sms-worker')
  const used = smsWorker?.call_count ?? 0
  check('AI Studio quota (sms-worker)', used < 20, `${used}/20 used today (placeholder cap — verify real limit on the AI Studio dashboard)`)
}

// ── 6. Migration drift — the exact bug class found 2026-08-23 ───────────────
async function checkMigrationDrift() {
  const dbDir = new URL('../db', import.meta.url).pathname
  // Only the numbered migration-vNN-*.sql files are tracked in schema_migrations
  // (apply-migration.ts's convention, started at v30). schema.sql and a couple
  // of pre-tracking migration-*.sql files were applied once at project init,
  // outside that system — including them here would be a permanent false positive.
  const files = readdirSync(dbDir).filter(f => /^migration-v\d+/.test(f))
  const { rows } = await pool.query('SELECT version FROM schema_migrations')
  const applied = new Set(rows.map((r: any) => r.version))
  const missing = files.filter(f => !applied.has(f))
  if (missing.length === 0) {
    check('Migration drift', true, `all ${files.length} migration files applied`)
  } else {
    // Don't auto-apply blind — a migration could be destructive or order-
    // dependent. Flag loudly instead; this is exactly the silent-drift
    // failure mode from 2026-08-23, so surfacing it fast is the win.
    check('Migration drift', false, `${missing.length} migration file(s) never applied: ${missing.join(', ')} — run: npx tsx src/scripts/apply-migration.ts src/db/<file>`)
  }
}

// ── 7. Lead-identity resolution health — diagnostic, not auto-healable ──────
async function checkLeadIdentityResolution() {
  const { rows } = await pool.query(`
    SELECT COUNT(*) AS n FROM sms_conversations
    WHERE lead_id IS NULL AND jsonb_array_length(COALESCE(messages,'[]'::jsonb)) >= 2
      AND updated_at > NOW() - INTERVAL '7 days'
  `)
  const n = parseInt(rows[0]?.n ?? '0', 10)
  check('Lead identity resolution', n === 0, n === 0 ? 'all recent conversations resolved a lead' : `${n} recent conversation(s) with 2+ messages never resolved a lead_id — phone number likely not in leads table`)
}

// ── 8. TCPA gate activity (informational — confirms the gate is firing) ────
async function checkTcpaGateActivity() {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS n FROM build_requests WHERE status='opted_out_before_send' AND updated_at > NOW() - INTERVAL '24 hours'`
  )
  check('TCPA gate (24h)', true, `${rows[0]?.n ?? 0} send(s) correctly blocked by opt-out in last 24h`)
}

// ── 9. Search Console — API reachability + new-client auto-verify funnel ────
// Confirms the automatic GSC onboarding built 2026-09-04 (gsc-agent.ts +
// gsc-verify-worker.ts) is actually working for new client sites, not just
// that the code exists. Two parts: can we still reach the API at all
// (catches the service account losing access / API getting disabled again,
// the exact failure mode that blocked this for weeks), and is the funnel
// clean (no leads stuck in an error state).
async function checkGscHealth() {
  try {
    const sites = await listSites()
    check('GSC API reachability', true, `${sites.length} site(s) visible to the service account`)
  } catch (e: any) {
    check('GSC API reachability', false, `unreachable: ${e.message.slice(0, 200)}`)
  }

  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE gsc_verify_requested = TRUE) AS pending,
      COUNT(*) FILTER (WHERE gsc_verified = TRUE) AS verified_total,
      COUNT(*) FILTER (WHERE gsc_verify_error IS NOT NULL) AS errored_total
    FROM leads
    WHERE gsc_verify_requested = TRUE OR gsc_verified = TRUE OR gsc_verify_error IS NOT NULL
  `)
  const pending = parseInt(rows[0]?.pending ?? '0', 10)
  const verified = parseInt(rows[0]?.verified_total ?? '0', 10)
  const errored = parseInt(rows[0]?.errored_total ?? '0', 10)
  if (errored > 0) {
    check('GSC new-client verification funnel', false, `${errored} lead(s) with a verify error, ${verified} verified total, ${pending} pending`)
  } else {
    check('GSC new-client verification funnel', true, `${verified} verified total, ${pending} pending, 0 errors (0 total is expected until the first real client build runs through it)`)
  }
}

// ── 10. Domain email-auth / trust signals (SPF, DMARC, MX) ───────────────────
// Same class of thing third-party domain-reputation checkers (usercheck.com
// etc.) flag — catches it here first instead of finding out from a public
// lookup. Not a DNS-record backup/audit — only checks the specific shape
// that breaks deliverability/trust: missing or duplicate SPF/DMARC, no MX.
async function checkDomainAuth() {
  const domain = 'webcrew.app'
  try {
    const txt = (await resolveTxt(domain)).map(parts => parts.join(''))
    const spf = txt.filter(t => t.startsWith('v=spf1'))
    if (spf.length === 0) check('Domain SPF', false, `no SPF record on ${domain}`)
    else if (spf.length > 1) check('Domain SPF', false, `${spf.length} SPF records on ${domain} — must be exactly one (RFC 7208), extra records break SPF evaluation`)
    else check('Domain SPF', true, spf[0])

    const dmarcTxt = (await resolveTxt(`_dmarc.${domain}`).catch(() => [])).map(parts => parts.join(''))
    const dmarc = dmarcTxt.filter(t => t.startsWith('v=DMARC1'))
    if (dmarc.length === 0) check('Domain DMARC', false, `no DMARC record at _dmarc.${domain}`)
    else if (dmarc.length > 1) check('Domain DMARC', false, `${dmarc.length} DMARC records at _dmarc.${domain} — must be exactly one (RFC 7489), duplicates make DMARC invalid to receivers/checkers. Delete the extra in Cloudflare DNS (dash.cloudflare.com → webcrew.app → DNS → Records, name "_dmarc") — API tokens on this box lack DNS:Edit scope so this can't self-heal.`)
    else check('Domain DMARC', true, dmarc[0])

    const mx = await resolveMx(domain).catch(() => [])
    check('Domain MX', mx.length > 0, mx.length > 0 ? `${mx.length} MX record(s)` : `no MX records on ${domain}`)
  } catch (e: any) {
    check('Domain auth (SPF/DMARC/MX)', false, `DNS lookup failed: ${e.message}`)
  }
}

// ── Email the report ─────────────────────────────────────────────────────────
async function sendReport() {
  const failed = results.filter(r => !r.ok)
  const healed = results.filter(r => r.healed)
  const overallOk = failed.length === 0

  await pool.query(
    `INSERT INTO system_health_checks (overall_ok, issues_found, auto_healed, checks) VALUES ($1,$2,$3,$4::jsonb)`,
    [overallOk, failed.length, healed.length, JSON.stringify(results)]
  )

  const rows = results.map(r => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${r.ok ? '✅' : '❌'}</td>
      <td style="padding:8px;border-bottom:1px solid #eee"><b>${r.name}</b></td>
      <td style="padding:8px;border-bottom:1px solid #eee">${r.detail}${r.healed ? `<br><span style="color:#16a34a">↳ auto-healed: ${r.healed}</span>` : ''}</td>
    </tr>`).join('')

  const subject = overallOk
    ? `✅ WebCrew health check — all clear`
    : `⚠️ WebCrew health check — ${failed.length} issue(s)${healed.length ? `, ${healed.length} auto-healed` : ''}`

  const html = `<div style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:24px">
    <h2 style="color:${overallOk ? '#16a34a' : '#dc2626'}">${overallOk ? '✅ All systems healthy' : '⚠️ Issues found'}</h2>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">${rows}</table>
    <p style="color:#999;font-size:0.8rem">Run at ${new Date().toISOString()}. Trend: <code>SELECT * FROM system_health_checks ORDER BY run_at DESC LIMIT 20</code></p>
  </div>`

  if (process.env.RESEND_API_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.OUTREACH_FROM_EMAIL || 'hello@webcrew.app',
        to: process.env.BUSINESS_OWNER_EMAIL || 'pavan.harati@gmail.com',
        subject, html,
      }),
    }).catch(e => console.error('[HealthCheck] Email send failed:', e.message))
  } else {
    console.warn('[HealthCheck] RESEND_API_KEY not set — report logged only, not emailed')
  }

  console.log(`\n${overallOk ? '✅ ALL CLEAR' : `⚠️  ${failed.length} ISSUE(S)`} — ${healed.length} auto-healed`)
}

async function main() {
  await checkWorker()
  await checkReceptionReady()
  await checkDb()
  checkLaunchdJobs()
  await checkStuckBuilds()
  await checkFollowUpRunner()
  await checkSmsDelivery()
  await checkAiStudioQuota()
  await checkMigrationDrift()
  await checkLeadIdentityResolution()
  await checkTcpaGateActivity()
  await checkGscHealth()
  await checkDomainAuth()
  await sendReport()
  await pool.end()
}

main().catch(e => { console.error('[HealthCheck] Fatal:', e.message); process.exit(1) })
