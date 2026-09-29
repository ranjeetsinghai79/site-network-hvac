/**
 * Provision AI Reception for a new paying client.
 * Buys a Twilio local number, builds the AI brain, wires the Twilio webhook.
 *
 * Usage:
 *   npx tsx src/scripts/provision-client.ts <website-url> [--area-code <nnn>] [--lead-id <uuid>]
 *
 * Examples:
 *   npx tsx src/scripts/provision-client.ts https://bestplumbing.com
 *   npx tsx src/scripts/provision-client.ts https://bestplumbing.com --area-code 510
 *   npx tsx src/scripts/provision-client.ts https://bestplumbing.com --area-code 510 --lead-id abc-123
 */

import { buildBrain, buildSystemPrompt } from '../reception/brain-builder.js'
import { saveReceptionConfig, updateTwilioPhone } from '../reception/db.js'

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN
const BASE_URL           = process.env.RECEPTION_BASE_URL ?? 'https://ai-reception-571925663575.us-central1.run.app'

function twilioReq(path: string, method = 'GET', body?: URLSearchParams) {
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')
  return fetch(`https://api.twilio.com${path}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    ...(body ? { body: body.toString() } : {}),
  })
}

// Adds a newly bought number to the shared WebCrew Messaging Service so it
// rides the already-approved A2P campaign — a number never wired here can't
// send/receive SMS (carriers silently drop it, Twilio error 30034).
async function attachToMessagingService(phoneNumberSid: string) {
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
  if (!messagingServiceSid) {
    console.warn('  ! TWILIO_MESSAGING_SERVICE_SID not set — number bought without A2P/SMS wiring')
    return
  }
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')
  const attachRes = await fetch(
    `https://messaging.twilio.com/v1/Services/${messagingServiceSid}/PhoneNumbers`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ PhoneNumberSid: phoneNumberSid }).toString(),
    }
  )
  if (attachRes.ok) {
    console.log(`  Attached to Messaging Service ${messagingServiceSid} (A2P-ready)`)
    return
  }
  const err = await attachRes.json().catch(() => ({})) as any
  if (err?.code === 21710 || /already exists/i.test(err?.message ?? '')) {
    console.log(`  Already on Messaging Service ${messagingServiceSid}`)
    return
  }
  console.warn(`  ! Messaging Service attach failed: ${err?.message ?? attachRes.status} — SMS will be pending`)
}

async function findAndBuyNumber(areaCode: string, webhookUrl: string, friendlyName: string, configId: string): Promise<string> {
  // Search available local numbers in the area code
  const searchRes = await twilioReq(
    `/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/AvailablePhoneNumbers/US/Local.json` +
    `?AreaCode=${areaCode}&Limit=1&VoiceEnabled=true`
  )

  if (!searchRes.ok) {
    const err = await searchRes.json() as any
    throw new Error(`Twilio number search failed: ${err.message ?? searchRes.status}`)
  }

  const searchData = await searchRes.json() as any
  const available = searchData.available_phone_numbers as any[]

  if (!available?.length) {
    // Fallback: search without area code restriction
    console.log(`  ! No numbers in ${areaCode} — searching nationally...`)
    const fallbackRes = await twilioReq(
      `/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/AvailablePhoneNumbers/US/Local.json?Limit=1&VoiceEnabled=true`
    )
    const fallbackData = await fallbackRes.json() as any
    const fallback = fallbackData.available_phone_numbers as any[]
    if (!fallback?.length) throw new Error('No US numbers available — check Twilio account balance')
    available.push(...fallback)
  }

  const phoneNumber = available[0].phone_number
  console.log(`  Found: ${phoneNumber}`)

  // Missed-call recovery (api/src/index.ts handleCallStatus) needs this fired
  // on no-answer/busy/failed — without it, calls that never reach the AI are
  // never followed up.
  const statusCallbackUrl = new URL(`${process.env.API_BASE_URL ?? 'https://api.webcrew.app'}/call-status`)
  statusCallbackUrl.searchParams.set('configId', configId)
  statusCallbackUrl.searchParams.set('biz', friendlyName)
  statusCallbackUrl.searchParams.set('flow', 'inbound')

  // Buy the number and set the voice + status-callback webhooks
  const buyRes = await twilioReq(
    `/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json`,
    'POST',
    new URLSearchParams({
      PhoneNumber:          phoneNumber,
      VoiceUrl:             webhookUrl,
      VoiceFallbackUrl:     process.env.VOICE_FALLBACK_URL ?? 'https://api.webcrew.app/voice-fallback',
      VoiceFallbackMethod:  'POST',
      VoiceMethod:          'POST',
      StatusCallback:       statusCallbackUrl.toString(),
      StatusCallbackMethod: 'POST',
      FriendlyName:         `WebCrew | ${friendlyName}`,
    })
  )

  if (!buyRes.ok) {
    const err = await buyRes.json() as any
    throw new Error(`Twilio buy failed: ${err.message ?? buyRes.status}`)
  }

  const bought = await buyRes.json() as any
  console.log(`  Bought: ${bought.phone_number} (SID: ${bought.sid})`)

  await attachToMessagingService(bought.sid)

  return bought.phone_number as string
}

async function main() {
  const args = process.argv.slice(2)

  const url = args.find(a => a.startsWith('http'))
  if (!url) {
    console.error('Usage: npx tsx src/scripts/provision-client.ts <website-url> [--area-code <nnn>] [--lead-id <uuid>]')
    process.exit(1)
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set')
    process.exit(1)
  }

  const areaCodeIdx = args.indexOf('--area-code')
  const areaCode    = areaCodeIdx >= 0 ? args[areaCodeIdx + 1] : '415'

  const leadIdIdx = args.indexOf('--lead-id')
  const leadId    = leadIdIdx >= 0 ? args[leadIdIdx + 1] : undefined

  console.log(`\n🚀 Provisioning AI Reception for: ${url}\n`)

  // ── Step 1: Build brain ──────────────────────────────────────────────────
  console.log('[1/3] Building business brain...')
  const brain        = await buildBrain(url)
  const systemPrompt = buildSystemPrompt(brain)
  console.log(`      ✓ ${brain.name} | ${brain.services.length} services | ${brain.faqs.length} FAQs`)

  // ── Step 2: Save config (need ID before buying number) ──────────────────
  console.log('[2/3] Saving reception config...')
  const config     = await saveReceptionConfig(url, brain.name, brain, systemPrompt, leadId)
  const webhookUrl = `${BASE_URL}/voice/${config.id}`
  console.log(`      ✓ Config ID: ${config.id}`)

  // ── Step 3: Buy Twilio number + wire webhook ─────────────────────────────
  console.log(`[3/3] Buying Twilio number (area code ${areaCode})...`)
  const phone = await findAndBuyNumber(areaCode, webhookUrl, brain.name, config.id)
  await updateTwilioPhone(config.id, phone)

  // ── Done ─────────────────────────────────────────────────────────────────
  console.log('\n✅ AI Reception fully provisioned!\n')
  console.log(`  Business:    ${brain.name}`)
  console.log(`  Phone:       ${phone}`)
  console.log(`  Config ID:   ${config.id}`)
  console.log(`  Webhook:     ${webhookUrl}`)
  console.log(`  Services:    ${brain.services.length}`)
  console.log(`  FAQs:        ${brain.faqs.length}`)
  if (brain.booking_url) console.log(`  Booking:     ${brain.booking_url}`)
  if (brain.owner_phone) console.log(`  HITL SMS:    ${brain.owner_phone}`)
  console.log()
  console.log('  ─── Give the client ────────────────────────────────────')
  console.log(`  Phone number: ${phone}`)
  console.log(`  Client login: https://admin.webcrew.app/client/login`)
  console.log('  ─────────────────────────────────────────────────────────')
  console.log()
}

main().catch(e => {
  console.error('\nError:', e.message)
  process.exit(1)
})
