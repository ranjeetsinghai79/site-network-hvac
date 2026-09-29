import { config } from 'dotenv'
config()
import pg from 'pg'

async function main() {
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const r = await db.query("SELECT id, name, github_repo, brand_data FROM leads WHERE status = 'built' ORDER BY created_at DESC")
  r.rows.forEach((row: any) => console.log(row.id, '|', row.name, '|', row.github_repo, '|', row.brand_data?._templateDir))
  await db.end()
}
main()
