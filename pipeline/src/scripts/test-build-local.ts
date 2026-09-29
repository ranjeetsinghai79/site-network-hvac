/**
 * Quick test: takes an existing config_generated lead and runs ONLY the
 * build-local + CF deploy step. No brand analysis, no image gen.
 *
 * Usage: npx tsx src/scripts/test-build-local.ts <leadId>
 */
import pg from 'pg'
import { buildAndDeployLocal } from '../tools/build-local.js'
import type { Lead } from '../types.js'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const leadId = process.argv[2]
  if (!leadId) {
    console.error('Usage: npx tsx src/scripts/test-build-local.ts <leadId>')
    process.exit(1)
  }

  const { rows } = await pool.query('SELECT * FROM leads WHERE id=$1', [leadId])
  if (!rows.length) { console.error('Lead not found'); process.exit(1) }

  const lead: Lead = rows[0]
  if (!lead.config_ts) { console.error('Lead has no config_ts'); process.exit(1) }

  const niche = (lead.niche ?? 'hvac') as string
  const slug  = lead.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)
  const projectName = `site-${slug}`.slice(0, 63)

  console.log(`\n[test-build-local] Lead: ${lead.name}`)
  console.log(`[test-build-local] Niche: ${niche} | Project: ${projectName}`)
  console.log(`[test-build-local] Config: ${lead.config_ts.length} chars\n`)

  const result = await buildAndDeployLocal({
    niche,
    city:        lead.city ?? undefined,
    configTs:    lead.config_ts,
    heroImages:  null,
    projectName,
    envVars: {
      BUSINESS_NAME:  lead.name,
      BUSINESS_NICHE: niche,
      PIPELINE_API_URL: process.env.PIPELINE_API_URL || 'https://api.webcrew.app',
    },
  })

  if (result) {
    console.log(`\n✓ DEPLOYED: ${result.url}`)
  } else {
    console.error('\n✗ Build/deploy failed — see errors above')
    process.exit(1)
  }

  await pool.end()
}

main().catch(e => {
  console.error('[test-build-local] Fatal:', e?.message ?? e)
  if (e?.stack) console.error(e.stack)
  process.exit(1)
})
