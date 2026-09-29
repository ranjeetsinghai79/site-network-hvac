import 'dotenv/config'
import pg from 'pg'
import { WEBCREW_SYSTEM_PROMPT } from '../reception/webcrew-prompt.js'

const WEBCREW_CONFIG_ID = '2eb501f4-8af2-4b2c-b60f-5e5dfeec8c8e'
const TWILIO_PHONE      = process.env.TWILIO_FROM_NUMBER ?? '+19182555151'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  console.log('[WebCrew Reception] Updating system prompt + Twilio phone...')

  const { rows } = await pool.query(
    `UPDATE reception_configs
     SET system_prompt = $1,
         twilio_phone  = $2,
         updated_at    = NOW()
     WHERE id = $3
     RETURNING id, business_name, website_url, twilio_phone`,
    [WEBCREW_SYSTEM_PROMPT, TWILIO_PHONE, WEBCREW_CONFIG_ID]
  )

  if (!rows[0]) {
    console.error('[WebCrew Reception] Config not found — check the ID')
    process.exit(1)
  }

  const config = rows[0]
  console.log('\n✓ Updated successfully:')
  console.log(`  ID:           ${config.id}`)
  console.log(`  Business:     ${config.business_name}`)
  console.log(`  Website:      ${config.website_url}`)
  console.log(`  Twilio phone: ${config.twilio_phone}`)
  console.log(`\n  Prompt length: ${WEBCREW_SYSTEM_PROMPT.length} chars`)
  console.log(`\n  Webhook URL (set on Twilio number ${TWILIO_PHONE}):`)
  const baseUrl = process.env.RECEPTION_BASE_URL ?? 'https://ai-reception-571925663575.us-central1.run.app'
  console.log(`  POST ${baseUrl}/voice/${WEBCREW_CONFIG_ID}`)
  console.log('\n  → Go to Twilio Console → Phone Numbers → Manage → Active Numbers')
  console.log(`  → Select ${TWILIO_PHONE} → Voice → Webhook → paste the URL above`)

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
