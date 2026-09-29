/**
 * apply-migration.ts — run a migration file and record it in schema_migrations.
 *
 * Usage:
 *   npx tsx src/scripts/apply-migration.ts src/db/migration-vNN-name.sql
 *
 * Replaces bare `psql $DATABASE_URL -f <file>` for anything going forward —
 * that pattern is how 6 tables ended up silently never migrated in (found
 * 2026-08-23: nothing recorded which files had actually been run). Safe to
 * re-run: skips files already recorded, and every migration file itself is
 * idempotent (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
 */
import 'dotenv/config'
import pg from 'pg'
import { readFileSync } from 'fs'
import { basename } from 'path'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const [, , filePath] = process.argv
if (!filePath) {
  console.error('Usage: npx tsx src/scripts/apply-migration.ts <path-to-migration.sql>')
  process.exit(1)
}

void (async () => {
  const version = basename(filePath)
  const { rows } = await pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version])
  if (rows.length > 0) {
    console.log(`⏭  ${version} already applied — skipping`)
    await pool.end()
    return
  }

  const sql = readFileSync(filePath, 'utf8')
  console.log(`▶ Applying ${version}...`)
  await pool.query(sql)
  await pool.query(
    `INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING`,
    [version]
  )
  console.log(`✅ ${version} applied and recorded`)
  await pool.end()
})().catch(e => {
  console.error('❌ Migration failed:', e.message)
  process.exit(1)
})
