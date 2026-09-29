import { Pool } from 'pg'

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const { rows } = await pool.query(`
    SELECT id, name, status, cloudflare_url, created_at::date as date
    FROM leads
    ORDER BY name, created_at
  `)
  const nameCounts: Record<string, number> = {}
  for (const r of rows) {
    nameCounts[r.name] = (nameCounts[r.name] || 0) + 1
  }
  console.log("\n=== ALL LEADS ===")
  for (const r of rows) {
    const dup = nameCounts[r.name] > 1 ? " [DUP]" : ""
    const noUrl = !r.cloudflare_url ? " [NO URL]" : ""
    console.log(`${r.id.slice(0,8)} | ${r.date} | ${String(r.status).padEnd(22)} | ${r.name}${dup}${noUrl}`)
  }
  console.log(`\nTotal: ${rows.length}`)
  const dups = Object.entries(nameCounts).filter(([,c]) => c > 1)
  if (dups.length) {
    console.log("\n=== DUPLICATES ===")
    for (const [name, count] of dups) console.log(`  ${count}x  ${name}`)
  }
  await pool.end()
}

main().catch(console.error)
