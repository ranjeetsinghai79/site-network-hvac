import { config } from 'dotenv'
config()
import pg from 'pg'

async function main() {
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  // Update leads that are under pavankumarharati to use the forked ranjeetsinghai79 repos
  const res = await db.query(`
    UPDATE leads
    SET github_repo = REPLACE(github_repo, 'github.com/pavankumarharati/', 'github.com/ranjeetsinghai79/')
    WHERE github_repo LIKE '%pavankumarharati%' AND status = 'built'
    RETURNING name, github_repo
  `)
  res.rows.forEach((r: any) => console.log('Updated:', r.name, '→', r.github_repo))
  console.log('Done. Updated', res.rowCount, 'rows.')
  await db.end()
}
main()
