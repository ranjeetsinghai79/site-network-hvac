/**
 * Setup AI Reception for a business.
 * Usage:
 *   npx tsx src/scripts/setup-reception.ts https://business-website.com
 *   npx tsx src/scripts/setup-reception.ts https://... --lead-id <uuid>
 *   npx tsx src/scripts/setup-reception.ts --list
 */

import 'dotenv/config'
import { buildBrain, buildSystemPrompt } from '../reception/brain-builder.js'
import { saveReceptionConfig, listReceptionConfigs } from '../reception/db.js'
import { WEBCREW_SYSTEM_PROMPT } from '../reception/webcrew-prompt.js'

const WEBCREW_URL = 'https://webcrew.app'

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--list')) {
    const configs = await listReceptionConfigs()
    if (configs.length === 0) {
      console.log('No reception configs yet.')
      return
    }
    console.log(`\n${configs.length} reception config(s):\n`)
    for (const c of configs) {
      console.log(`  ${c.business_name}`)
      console.log(`    ID:      ${c.id}`)
      console.log(`    URL:     ${c.website_url}`)
      console.log(`    Phone:   ${c.twilio_phone ?? 'not assigned'}`)
      console.log(`    Active:  ${c.active}`)
      console.log(`    Webhook: ${process.env.RECEPTION_BASE_URL ?? 'http://localhost:3030'}/voice/${c.id}`)
      console.log()
    }
    return
  }

  const url = args.find(a => a.startsWith('http'))
  if (!url) {
    console.error('Usage: npx tsx src/scripts/setup-reception.ts <website-url> [--lead-id <uuid>]')
    process.exit(1)
  }

  const leadIdIdx = args.indexOf('--lead-id')
  const leadId = leadIdIdx >= 0 ? args[leadIdIdx + 1] : undefined

  console.log(`\nBuilding AI Reception brain for: ${url}\n`)

  const normalizedUrl = url.replace(/\/$/, '')
  const isWebCrew = normalizedUrl === WEBCREW_URL || normalizedUrl.startsWith(`${WEBCREW_URL}/`)
  const brain = isWebCrew
    ? { name: 'WebCrew', type: 'AI web agency', email: 'hello@webcrew.app', hours: {}, services: [], faqs: [] } as unknown as import('../reception/types.js').BusinessBrain
    : await buildBrain(url)
  const systemPrompt = isWebCrew ? WEBCREW_SYSTEM_PROMPT : buildSystemPrompt(brain)

  if (isWebCrew) console.log('[Setup] WebCrew URL detected — using hand-crafted sales prompt')

  const config = await saveReceptionConfig(url, brain.name, brain, systemPrompt, leadId)

  const baseUrl = process.env.RECEPTION_BASE_URL ?? 'http://localhost:3030'

  console.log('\n✓ Reception configured!\n')
  console.log(`  Business:    ${config.business_name}`)
  console.log(`  Config ID:   ${config.id}`)
  console.log(`  Services:    ${brain.services.length}`)
  console.log(`  FAQs:        ${brain.faqs.length}`)
  console.log(`  Booking:     ${brain.booking_url ?? 'none found — take message fallback'}`)
  console.log(`  HITL phone:  ${brain.owner_phone ?? 'none — escalation SMS skipped'}`)
  console.log()
  console.log('  Twilio webhook URL (set this in Twilio Console → phone number → Voice):')
  console.log(`  → ${baseUrl}/voice/${config.id}`)
  console.log()
  console.log('  Start the reception server:')
  console.log('    npm run reception')
  console.log()

  console.log('--- SYSTEM PROMPT PREVIEW (first 500 chars) ---')
  console.log(systemPrompt.slice(0, 500) + '...')
}

main().catch((e) => {
  console.error('Error:', e?.message ?? e)
  if (e?.stack) console.error(e.stack)
  process.exit(1)
})
