// One-off Neon cleanup (owner-authorized 2026-09-21: no real clients, lead data lives in the Google Sheet).
// Empties lead / scrape / queue / test / log data. Keeps the schema, reception_configs, TCPA consent records,
// and anything not classified below (listed, untouched).
//
//   DRY RUN (default, changes nothing):  node --env-file=.env ../node_modules/tsx/dist/cli.mjs src/scripts/neon-cleanup.ts
//   APPLY:  ... neon-cleanup.ts --apply --keep-configs <id>,<id>
//     --keep-configs: reception_configs rows to keep (default: none deleted unless listed via --delete-configs).
//
// Safety: consent_events (TCPA proof, incl. STOP/opt-out) is never emptied and is detached from leads before leads go.
// A JSON backup of the small kept tables is written to ~/neon-cleanup-backup-<date>.json before anything is deleted.
import { writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import pg from 'pg'

const apply = process.argv.includes('--apply')
const arg = (n: string) => process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : ''
const deleteConfigs = arg('--delete-configs').split(',').map(s => s.trim()).filter(Boolean)

// ── classification ───────────────────────────────────────────────────────────
const EMPTY: Record<string, string[]> = {
  'leads + scraping': ['leads', 'lead_events', 'scraped_places', 'scraped_combos', 'yelp_reviews', 'bulk_progress', 'sms_conversations', 'build_requests', 'cal_bookings', 'missed_calls', 'survey_responses', 'short_links', 'audits', 'outcome_events', 'gsc_snapshots', 'client_reviews', 'location_groups', 'crm_accounts', 'crm_sync_events'],
  'reception test data': ['call_logs', 'reception_contacts', 'reception_opportunities', 'reception_events', 'reception_follow_ups', 'reception_email_verifications', 'reception_cap_alerts', 'widget_session_usage', 'trial_start_attempts', 'public_form_submissions'],
  'test client accounts': ['client_accounts', 'client_reset_tokens', 'client_google_tokens'],
  'logs / history': ['scheduler_log', 'webhook_log', 'system_health_checks', 'ai_studio_key_usage', 'security_audit_log', 'usage_events', 'automation_runs', 'approval_events'],
  'parked-feature output': ['ad_campaign_drafts', 'ad_performance_daily', 'video_assets', 'social_assets', 'growth_agent_tasks', 'growth_plans', 'content_cadence_plans', 'memory_chunks', 'memory_documents'],
}
const KEEP_BACKED_UP = ['reception_configs', 'consent_events', 'waitlist_signups', 'affiliates', 'schema_migrations']
const DROP_SCHEMAS = ['pgboss']   // pg-boss queue (pipeline worker / scheduler) — retired; it recreates itself if ever started again

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const q = async (sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows
const mb = (b: number) => (b / 1048576).toFixed(1) + ' MB'
const ident = (t: string) => `"${t.replace(/"/g, '""')}"`

async function main() {
  await pool.query('select 1')
  const all = await q(`select n.nspname as schema, c.relname as name, pg_total_relation_size(c.oid)::bigint as bytes
                       from pg_class c join pg_namespace n on n.oid = c.relnamespace
                       where c.relkind = 'r' and n.nspname not in ('pg_catalog','information_schema') order by bytes desc`)
  const publicTables = new Set(all.filter(r => r.schema === 'public').map(r => r.name as string))
  const sizeOf = (t: string) => Number(all.find(r => r.schema === 'public' && r.name === t)?.bytes ?? 0)

  const count = async (t: string) => Number((await q(`select count(*)::bigint as n from public.${ident(t)}`))[0].n)
  console.log(`\n${apply ? 'APPLY' : 'DRY RUN'} — database size ${mb(all.reduce((a, r) => a + Number(r.bytes), 0))}\n`)

  const toEmpty: string[] = []
  for (const [group, tables] of Object.entries(EMPTY)) {
    console.log(`▸ EMPTY — ${group}`)
    for (const t of tables) {
      if (!publicTables.has(t)) { console.log(`    ${t.padEnd(32)} (table not present)`); continue }
      const n = await count(t); toEmpty.push(t)
      console.log(`    ${t.padEnd(32)} ${String(n).padStart(9)} rows  ${mb(sizeOf(t)).padStart(9)}`)
    }
  }
  const dropSchemas = []
  for (const s of DROP_SCHEMAS) {
    const sz = all.filter(r => r.schema === s).reduce((a, r) => a + Number(r.bytes), 0)
    const present = all.some(r => r.schema === s)
    console.log(`▸ DROP schema ${s.padEnd(24)} ${present ? mb(sz) : '(not present)'}`)
    if (present) dropSchemas.push(s)
  }

  console.log('\n▸ KEPT (backed up to JSON before any deletion)')
  for (const t of KEEP_BACKED_UP) console.log(`    ${t.padEnd(32)} ${publicTables.has(t) ? String(await count(t)).padStart(9) + ' rows' : '(not present)'}`)
  const configs = publicTables.has('reception_configs') ? await q(`select id, business_name, website_url, twilio_phone, active from public.reception_configs order by created_at`) : []
  console.log('\n  reception_configs:')
  for (const c of configs) console.log(`    ${deleteConfigs.includes(c.id) ? 'DELETE' : 'keep  '} ${c.id}  ${String(c.business_name).padEnd(24)} ${String(c.website_url).padEnd(34)} ${c.twilio_phone ?? '(no number)'} active=${c.active}`)

  const classified = new Set([...toEmpty, ...KEEP_BACKED_UP])
  const untouched = [...publicTables].filter(t => !classified.has(t))
  const untouchedRows: string[] = []
  for (const t of untouched) { const n = await count(t); if (n > 0) untouchedRows.push(`${t}(${n})`) }
  console.log(`\n▸ NOT CLASSIFIED, left untouched: ${untouched.length} tables, ${untouchedRows.length} non-empty${untouchedRows.length ? ': ' + untouchedRows.join(', ') : ''}`)

  // Foreign keys from tables we are NOT emptying into tables we ARE emptying — must not cascade into kept data.
  const emptySet = new Set(toEmpty)
  const fks = await q(`select conrelid::regclass::text as child, confrelid::regclass::text as parent, confdeltype as del,
                              (select string_agg(a.attname, ',') from pg_attribute a where a.attrelid = c.conrelid and a.attnum = any(c.conkey)) as cols,
                              (select bool_and(not a.attnotnull) from pg_attribute a where a.attrelid = c.conrelid and a.attnum = any(c.conkey)) as nullable
                       from pg_constraint c where c.contype = 'f'`)
  const strip = (s: string) => s.replace(/^public\./, '').replace(/"/g, '')
  const risky = fks.filter(f => emptySet.has(strip(f.parent)) && !emptySet.has(strip(f.child)))
  console.log('\n▸ Foreign keys from KEPT tables into emptied tables:')
  if (!risky.length) console.log('    none')
  // A NOT NULL FK only actually blocks a delete if some row currently references the data being removed —
  // check real data, not just the schema shape, so an empty child table (the common case) doesn't force a
  // manual override for a conflict that can't happen.
  const blocked: typeof risky = []
  for (const f of risky) {
    const desc = { a: 'no action', r: 'restrict', c: 'CASCADE', n: 'set null', d: 'set default' }[f.del as 'a']
    let note = f.nullable ? '(nullable → will be set NULL first)' : ''
    if (!f.nullable) {
      const n = Number((await q(`select count(*)::bigint as n from ${f.child}`))[0].n)
      note = n === 0 ? '(NOT NULL, but the table is empty — nothing to conflict)' : `(NOT NULL and ${n} row(s) present — BLOCKS delete)`
      if (n > 0) blocked.push(f)
    }
    console.log(`    ${strip(f.child)}.${f.cols} → ${strip(f.parent)}  on-delete=${desc}  ${note}`)
  }
  if (blocked.length) console.log('\n  ⚠ Some kept tables have rows with NOT NULL FKs into emptied tables; those need a decision before --apply.')

  if (!apply) { console.log('\nNothing changed. Re-run with --apply (and --delete-configs <ids> if wanted).'); return }
  if (blocked.length) throw new Error('blocked by NOT NULL foreign keys (see above)')

  // 1) backup
  const backup: Record<string, unknown[]> = {}
  for (const t of KEEP_BACKED_UP) if (publicTables.has(t)) backup[t] = await q(`select * from public.${ident(t)}`)
  const file = join(homedir(), `neon-cleanup-backup-${new Date().toISOString().slice(0, 10)}.json`)
  writeFileSync(file, JSON.stringify(backup, null, 2), { mode: 0o600 })
  console.log(`\nbackup written: ${file}`)

  // 2) detach kept tables from emptied ones, then delete every emptied table's rows. DELETE (not TRUNCATE) throughout:
  // TRUNCATE refuses a table if ANY other table has a live FK pointing at it, structurally, regardless of data —
  // and `leads` itself holds an FK into `audits`, so truncating audits would fail even with leads excluded and
  // empty. DELETE only cares about actual conflicting rows, which the null-out pass below already clears.
  // Order matters for DELETE too (referencing rows before referenced rows) — retry in a fixed-point loop instead
  // of hand-deriving a topological order, since NOT NULL/RESTRICT edges among the emptied tables are unknown upfront.
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const f of risky) await client.query(`update ${f.child} set ${f.cols} = null where ${f.cols} is not null`)
    let remaining = [...toEmpty]
    for (let pass = 0; remaining.length && pass < remaining.length + 1; pass++) {
      const stillBlocked: string[] = []
      for (const t of remaining) {
        try { await client.query(`SAVEPOINT sp`); await client.query(`delete from public.${ident(t)}`); await client.query(`RELEASE SAVEPOINT sp`) }
        catch { await client.query(`ROLLBACK TO SAVEPOINT sp`); stillBlocked.push(t) }
      }
      if (stillBlocked.length === remaining.length) throw new Error(`stuck — could not delete: ${stillBlocked.join(', ')} (a foreign key among them forms a cycle, or references a table outside this list)`)
      remaining = stillBlocked
    }
    for (const id of deleteConfigs) await client.query(`delete from public.reception_configs where id = $1`, [id])
    for (const s of dropSchemas) await client.query(`drop schema ${ident(s)} cascade`)
    await client.query('COMMIT')
    console.log('committed.')
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }

  const after = await q(`select pg_database_size(current_database())::bigint as b`)
  console.log(`database size now: ${mb(Number(after[0].b))}`)
}
main().then(() => pool.end()).catch(e => { console.error('FAILED:', e.message, e.detail ? `\n  detail: ${e.detail}` : '', e.table ? `\n  table: ${e.table}` : ''); process.exit(1) })
