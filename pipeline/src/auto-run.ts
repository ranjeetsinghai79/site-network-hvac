/**
 * Auto-run: rotates through metro clusters × niches, runs pipeline for each.
 * Tracks progress in DB table `pipeline_state` so it picks up where it left off.
 * Usage: npx tsx src/auto-run.ts [--count N] [--niche hvac] [--metro "Tracy-Stockton"]
 */
import 'dotenv/config'
import pg from 'pg'
import { runPipeline } from './orchestrator.js'
import { METRO_CLUSTERS, PIPELINE_NICHES } from './cities.js'
import type { PipelineConfig } from './types.js'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function ensureStateTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pipeline_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

async function getState(key: string): Promise<string | null> {
  const { rows } = await pool.query('SELECT value FROM pipeline_state WHERE key=$1', [key])
  return rows[0]?.value ?? null
}

async function setState(key: string, value: string) {
  await pool.query(
    `INSERT INTO pipeline_state(key,value,updated_at) VALUES($1,$2,NOW())
     ON CONFLICT(key) DO UPDATE SET value=$2, updated_at=NOW()`,
    [key, value]
  )
}

async function getNextTarget(forceNiche?: string, forceMetro?: string) {
  if (forceNiche && forceMetro) {
    const cluster = METRO_CLUSTERS.find(m => m.metro === forceMetro)!
    return { niche: forceNiche, cluster }
  }

  const nicheIdx  = parseInt((await getState('niche_idx'))  ?? '0')
  const metroIdx  = parseInt((await getState('metro_idx'))  ?? '0')

  // Honor --niche flag alone: use forced niche but still rotate metro
  const niche   = forceNiche ?? PIPELINE_NICHES[nicheIdx % PIPELINE_NICHES.length]
  const cluster = METRO_CLUSTERS[metroIdx % METRO_CLUSTERS.length]

  // Advance: rotate metro first, then niche
  const nextMetroIdx = (metroIdx + 1) % METRO_CLUSTERS.length
  const nextNicheIdx = nextMetroIdx === 0 ? (nicheIdx + 1) % PIPELINE_NICHES.length : nicheIdx

  await setState('metro_idx', String(nextMetroIdx))
  await setState('niche_idx', String(nextNicheIdx))

  return { niche, cluster }
}

async function main() {
  const args = process.argv.slice(2)
  const count     = parseInt(args.find(a => a.startsWith('--count='))?.split('=')[1] ?? '5')
  const forceNiche = args.find(a => a.startsWith('--niche='))?.split('=')[1]
  const forceMetro = args.find(a => a.startsWith('--metro='))?.split('=')[1]

  await ensureStateTable()
  const { niche, cluster } = await getNextTarget(forceNiche, forceMetro)

  // Pick first city in cluster as the primary location for Places search
  const city     = cluster.cities[0]
  const location = `${city}, ${cluster.state}`

  console.log(`\n═══════════════════════════════════════════`)
  console.log(`Auto-Run: ${niche.toUpperCase()} | ${cluster.metro} (${location})`)
  console.log(`Count: ${count} leads`)
  console.log(`═══════════════════════════════════════════\n`)

  const config: PipelineConfig = {
    niche: niche as PipelineConfig['niche'],
    location,
    city,
    state: cluster.state,
    count,
    templateOwner: process.env.TEMPLATE_OWNER || 'pavankumarharati',
    templateRepo:  process.env.TEMPLATE_REPO  || 'websitedeveloper',
    deployOwner:   process.env.DEPLOY_OWNER   || 'pavankumarharati',
    dryRun: process.env.DRY_RUN === 'true',
  }

  await runPipeline(config)
  await pool.end()
}

main().catch(async e => {
  console.error('Auto-run failed:', e)
  await pool.end()
  process.exit(1)
})
