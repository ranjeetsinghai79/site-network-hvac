import { config } from 'dotenv'
config()
import pg from 'pg'

async function main() {
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const { rows } = await db.query(
    "SELECT id, name, config_ts FROM leads WHERE name ILIKE '%delta sierra%'"
  )
  for (const r of rows) {
    console.log('ID:', r.id)
    console.log('Name:', r.name)
    console.log('config_ts length:', r.config_ts?.length)
    console.log('config_ts:\n', r.config_ts?.slice(0, 500))
  }
  await db.end()
}
main()
