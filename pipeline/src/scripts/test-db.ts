/**
 * Run: cd pipeline && npx tsx src/scripts/test-db.ts
 */
import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg
const url = process.env.DATABASE_URL

if (!url) {
  console.error('❌ DATABASE_URL not set in pipeline/.env')
  process.exit(1)
}

const pool = new Pool({ connectionString: url })

async function main() {
  console.log('Testing PostgreSQL connection...')

  // Connection test
  const { rows: ver } = await pool.query('SELECT version()')
  console.log('✅ Connected:', ver[0].version.split(' ').slice(0, 2).join(' '))

  // Table exists?
  const { rows: tables } = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='leads'`
  )
  if (!tables.length) {
    console.error('❌ leads table not found — run schema.sql first')
    process.exit(1)
  }
  console.log('✅ leads table exists')

  // Write + delete test
  await pool.query(
    `INSERT INTO leads (place_id, name, address, city, state, niche, status)
     VALUES ('__test__','Test Biz','123 St','Tracy','CA','hvac','found')
     ON CONFLICT (place_id) DO NOTHING`
  )
  await pool.query(`DELETE FROM leads WHERE place_id='__test__'`)
  console.log('✅ Read/write working')

  const { rows: count } = await pool.query('SELECT count(*) FROM leads')
  console.log(`✅ Total leads in DB: ${count[0].count}`)
  console.log('\n🟢 Database ready. Run: DRY_RUN=true npm start')

  await pool.end()
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
