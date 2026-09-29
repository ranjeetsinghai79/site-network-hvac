/**
 * backfill-call-status-webhook.ts
 *
 * One-time backfill: sets StatusCallback on every already-provisioned
 * client Twilio number so missed-call recovery (api/src/index.ts
 * handleCallStatus) actually fires. New provisions get this automatically
 * (reception/server.ts buyLocalTwilioNumber, scripts/provision-client.ts
 * findAndBuyNumber) — this only fixes numbers bought before that wiring
 * existed.
 *
 * Usage:
 *   cd pipeline && npx tsx src/scripts/backfill-call-status-webhook.ts
 *   DRY_RUN=true npx tsx src/scripts/backfill-call-status-webhook.ts
 */

import 'dotenv/config'
import { listReceptionConfigs } from '../reception/db.js'

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN
const API_BASE_URL       = process.env.API_BASE_URL ?? 'https://api.webcrew.app'
const DRY_RUN             = process.env.DRY_RUN === 'true'

function twilioAuthHeader(): string {
  return `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`
}

async function findPhoneSid(phoneNumber: string): Promise<string | null> {
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber)}&PageSize=1`,
    { headers: { Authorization: twilioAuthHeader() } }
  )
  const data = await res.json() as any
  return data?.incoming_phone_numbers?.[0]?.sid ?? null
}

async function setStatusCallback(phoneSid: string, statusCallback: string): Promise<boolean> {
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers/${phoneSid}.json`,
    {
      method:  'POST',
      headers: {
        Authorization:  twilioAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        StatusCallback:       statusCallback,
        StatusCallbackMethod: 'POST',
      }).toString(),
    }
  )
  return res.ok
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set')
    process.exit(1)
  }

  console.log(`\n=== Backfill call-status webhook${DRY_RUN ? ' (DRY RUN)' : ''} ===\n`)

  const configs = (await listReceptionConfigs()).filter(c => c.twilio_phone)
  console.log(`${configs.length} provisioned numbers to check\n`)

  let updated = 0, skipped = 0, failed = 0

  for (const config of configs) {
    const phone = config.twilio_phone!
    const statusCallbackUrl = new URL(`${API_BASE_URL}/call-status`)
    statusCallbackUrl.searchParams.set('configId', config.id)
    statusCallbackUrl.searchParams.set('biz', config.business_name)
    statusCallbackUrl.searchParams.set('flow', 'inbound')

    if (DRY_RUN) {
      console.log(`[DRY] ${phone} (${config.business_name}) → ${statusCallbackUrl.toString()}`)
      continue
    }

    try {
      const sid = await findPhoneSid(phone)
      if (!sid) { console.warn(`  [!] No Twilio number found for ${phone} — skipping`); skipped++; continue }

      const ok = await setStatusCallback(sid, statusCallbackUrl.toString())
      if (ok) {
        console.log(`  ✓ ${phone} (${config.business_name})`)
        updated++
      } else {
        console.error(`  [!] Failed to update ${phone}`)
        failed++
      }
    } catch (e: any) {
      console.error(`  [!] ${phone}: ${e.message}`)
      failed++
    }
  }

  console.log(`\nDone — updated: ${updated} | skipped: ${skipped} | failed: ${failed}`)
}

main().catch(e => {
  console.error('[Backfill] Fatal:', e.message)
  process.exit(1)
})
