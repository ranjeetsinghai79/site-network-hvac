// Labels historical call_logs rows with a trust bucket (see reception/call-screen.ts).
// Dry-run by default:  npx tsx src/scripts/backfill-call-trust.ts [--apply]
// Old rows have no STIR data; a null caller is treated as a website-widget session.
import pg from 'pg'
import { classifyTrust, ownerPhones } from '../reception/call-screen.js'

const apply = process.argv.includes('--apply')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const cfgs = (await pool.query(`SELECT id, twilio_phone, brain_json->>'phone' AS brain_phone FROM reception_configs`)).rows
  const selfFor = new Map<string, string[]>(cfgs.map(c => [c.id, [c.twilio_phone, c.brain_phone].filter(Boolean)]))
  const { rows } = await pool.query(`SELECT id, reception_config_id, caller_number, transcript, stir_verstat FROM call_logs WHERE trust IS NULL`)

  const counts: Record<string, number> = {}
  const updates: Array<[string, string]> = []
  for (const r of rows) {
    const trust = classifyTrust({
      caller: r.caller_number || null,
      channel: r.caller_number ? 'phone' : 'widget',
      ownerPhones: ownerPhones(),
      selfNumbers: selfFor.get(r.reception_config_id) ?? [],
      transcript: r.transcript ?? '',
      stir: r.stir_verstat,
    })
    counts[trust] = (counts[trust] ?? 0) + 1
    updates.push([r.id, trust])
  }
  console.log(`${apply ? 'APPLYING' : 'DRY RUN'} — ${rows.length} unlabeled calls`)
  console.table(counts)
  if (apply) {
    for (const [id, trust] of updates) await pool.query(`UPDATE call_logs SET trust = $2 WHERE id = $1`, [id, trust])
    console.log(`labeled ${updates.length} calls`)
  }
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
