/**
 * outreach-lead.ts
 * Send outreach (SMS and/or email) for a single lead by ID.
 *
 * Env: LEAD_ID=<uuid>, OUTREACH_TYPE=sms|email|both (default: both)
 */

import 'dotenv/config'
import pg from 'pg'
import { runSMSOutreachAgent } from '../agents/sms-outreach.js'
import { runOutreachAgent } from '../agents/outreach.js'
import type { Lead } from '../types.js'

const LEAD_ID = process.env.LEAD_ID
const TYPE    = process.env.OUTREACH_TYPE ?? 'both'

if (!LEAD_ID) {
  console.error('LEAD_ID env var required')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const { rows } = await pool.query<Lead>(
    `SELECT * FROM leads WHERE id = $1 LIMIT 1`,
    [LEAD_ID]
  )
  const lead = rows[0]
  if (!lead) {
    console.error(`Lead ${LEAD_ID} not found`)
    process.exit(1)
  }

  console.log(`[outreach-lead] ${lead.name} | type=${TYPE}`)

  if (TYPE === 'sms' || TYPE === 'both') {
    if (!lead.phone) {
      console.log('  No phone — skipping SMS')
    } else {
      const res = await runSMSOutreachAgent(lead)
      console.log(`  SMS: ${res.success ? 'sent' : `failed: ${res.error}`}`)
      if (res.success) {
        await pool.query(`UPDATE leads SET sms_sent=true, status='sms_sent' WHERE id=$1`, [LEAD_ID])
      }
    }
  }

  if (TYPE === 'email' || TYPE === 'both') {
    if (!lead.email) {
      console.log('  No email — skipping email')
    } else {
      const res = await runOutreachAgent(lead)
      console.log(`  Email: ${res.success ? 'sent' : `failed: ${res.error}`}`)
      if (res.success) {
        await pool.query(`UPDATE leads SET outreach_sent=true, status='outreach_sent' WHERE id=$1`, [LEAD_ID])
      }
    }
  }

  await pool.end()
}

main().catch(e => { console.error(e.message); process.exit(1) })
