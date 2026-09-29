/**
 * send-review-requests.ts
 *
 * 4-step hourly cron — attendance-confirmed review request flow:
 *
 *   Step 1: SMS business owner "Did [Customer] show up? Reply YES or NO"
 *           (bookings with owner phone, ended 30+ min ago, not yet asked)
 *   Step 2: SMS customer review link (owner confirmed YES)
 *   Step 3: Auto-assume YES after 2h silence, SMS customer review link
 *   Step 4: Direct review send for bookings without owner phone (clock-based, 60 min)
 *
 *   cd pipeline && npx tsx src/scripts/send-review-requests.ts
 *
 * Requires: DATABASE_URL, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 */

import 'dotenv/config'
import pg from 'pg'
import Twilio from 'twilio'

const pool   = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const client = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
const FROM   = process.env.TWILIO_FROM_NUMBER ?? ''
const DRY    = process.env.DRY_RUN === 'true'

function reviewSMS(attendeeName: string, businessName: string, reviewUrl: string): string {
  const first = (attendeeName || 'there').split(' ')[0]
  return `Hi ${first}! Thanks for your appointment with ${businessName}. Mind leaving a quick review? Takes 30 sec and helps a lot: ${reviewUrl}`
}

async function resolveReviewUrl(leadId: string | null): Promise<string> {
  if (!leadId) return 'https://webcrew.app/review'
  const { rows } = await pool.query(
    `SELECT gbp_location_id, custom_domain, cloudflare_url FROM leads WHERE id = $1`,
    [leadId]
  )
  const lead = rows[0]
  if (lead?.gbp_location_id) {
    return `https://search.google.com/local/writereview?placeid=${lead.gbp_location_id}`
  }
  if (lead?.custom_domain) return `https://${lead.custom_domain}/review`
  if (lead?.cloudflare_url) return `${lead.cloudflare_url}/review`
  return 'https://webcrew.app/review'
}

async function sendReviewSMS(bookingId: string, attendeeName: string, attendeePhone: string,
                              businessName: string, reviewUrl: string): Promise<void> {
  const sms = reviewSMS(attendeeName, businessName, reviewUrl)
  if (DRY) {
    console.log(`  [DRY] → ${attendeeName} (${attendeePhone}): ${sms.slice(0, 100)}…`)
    return
  }
  await client.messages.create({ to: attendeePhone, from: FROM, body: sms })
  await pool.query(
    `UPDATE cal_bookings SET review_request_sent_at = NOW(), review_link = $1 WHERE id = $2`,
    [reviewUrl, bookingId]
  )
  await new Promise(r => setTimeout(r, 250))
}

async function main() {
  console.log(`\n=== Review Request Sender${DRY ? ' (DRY RUN)' : ''} ===`)
  console.log(new Date().toISOString())

  if (!FROM && !DRY) {
    console.error('TWILIO_FROM_NUMBER not set')
    process.exit(1)
  }

  let step1 = 0, step2 = 0, step3 = 0, step4 = 0, errors = 0

  // ── Step 1: SMS business owner "Did [Customer] show up?" ─────────────────────
  // Only bookings where we have the owner's phone and haven't asked yet
  {
    const { rows } = await pool.query<{
      id: string; attendee_name: string; business_name: string;
      business_owner_phone: string; end_time: string
    }>(
      `SELECT id, attendee_name, business_name, business_owner_phone, end_time
       FROM cal_bookings
       WHERE business_owner_phone IS NOT NULL
         AND host_confirm_sent_at IS NULL
         AND status = 'confirmed'
         AND end_time < NOW() - INTERVAL '30 minutes'
         AND end_time > NOW() - INTERVAL '7 days'
       ORDER BY end_time ASC
       LIMIT 50`
    )

    console.log(`\nStep 1 — Owner confirm requests: ${rows.length} bookings`)

    for (const row of rows) {
      const first = (row.attendee_name || 'your customer').split(' ')[0]
      const sms = `Did ${first} show up for their appointment at ${row.business_name}? Reply YES or NO`

      if (DRY) {
        console.log(`  [DRY] → Owner (${row.business_owner_phone}): ${sms}`)
        step1++
        continue
      }
      try {
        await client.messages.create({ to: row.business_owner_phone, from: FROM, body: sms })
        await pool.query(
          `UPDATE cal_bookings SET host_confirm_sent_at = NOW() WHERE id = $1`, [row.id]
        )
        console.log(`  Sent confirm request → ${row.business_owner_phone} for ${row.attendee_name}`)
        step1++
        await new Promise(r => setTimeout(r, 250))
      } catch (e: any) {
        console.error(`  [!] Step1 failed for ${row.id}: ${e.message}`)
        errors++
      }
    }
  }

  // ── Step 2: Send review to confirmed attendees ────────────────────────────────
  // Owner replied YES via /sms/reply webhook
  {
    const { rows } = await pool.query<{
      id: string; attendee_name: string; attendee_phone: string;
      business_name: string; lead_id: string | null; review_link: string | null
    }>(
      `SELECT id, attendee_name, attendee_phone, business_name, lead_id, review_link
       FROM cal_bookings
       WHERE host_confirmed = TRUE
         AND review_request_sent_at IS NULL
         AND attendee_phone IS NOT NULL AND attendee_phone != ''
         AND end_time > NOW() - INTERVAL '7 days'
       ORDER BY host_confirmed_at ASC
       LIMIT 100`
    )

    console.log(`\nStep 2 — Confirmed attendee reviews: ${rows.length} bookings`)

    for (const row of rows) {
      try {
        const reviewUrl = row.review_link || await resolveReviewUrl(row.lead_id)
        await sendReviewSMS(row.id, row.attendee_name, row.attendee_phone, row.business_name, reviewUrl)
        console.log(`  Sent review → ${row.attendee_name} (${row.attendee_phone})`)
        step2++
      } catch (e: any) {
        console.error(`  [!] Step2 failed for ${row.id}: ${e.message}`)
        errors++
      }
    }
  }

  // ── Step 3: Auto-assume YES after 2h owner silence ───────────────────────────
  // Owner was messaged but never replied — assume they showed up
  {
    const { rows } = await pool.query<{
      id: string; attendee_name: string; attendee_phone: string;
      business_name: string; lead_id: string | null
    }>(
      `SELECT id, attendee_name, attendee_phone, business_name, lead_id
       FROM cal_bookings
       WHERE host_confirm_sent_at IS NOT NULL
         AND host_confirm_sent_at < NOW() - INTERVAL '2 hours'
         AND host_confirmed IS NULL
         AND review_request_sent_at IS NULL
         AND attendee_phone IS NOT NULL AND attendee_phone != ''
         AND end_time > NOW() - INTERVAL '7 days'
       ORDER BY end_time ASC
       LIMIT 100`
    )

    console.log(`\nStep 3 — Auto-assume YES (2h timeout): ${rows.length} bookings`)

    for (const row of rows) {
      try {
        await pool.query(
          `UPDATE cal_bookings SET host_confirmed = TRUE, host_confirmed_at = NOW()
           WHERE id = $1`, [row.id]
        )
        const reviewUrl = await resolveReviewUrl(row.lead_id)
        await sendReviewSMS(row.id, row.attendee_name, row.attendee_phone, row.business_name, reviewUrl)
        console.log(`  Auto-YES → ${row.attendee_name} (${row.attendee_phone})`)
        step3++
      } catch (e: any) {
        console.error(`  [!] Step3 failed for ${row.id}: ${e.message}`)
        errors++
      }
    }
  }

  // ── Step 4: Direct review for bookings without owner phone ───────────────────
  // Old behavior: 60 min after end time, no owner confirmation needed
  {
    const { rows } = await pool.query<{
      id: string; attendee_name: string; attendee_phone: string;
      business_name: string; lead_id: string | null
    }>(
      `SELECT id, attendee_name, attendee_phone, business_name, lead_id
       FROM cal_bookings
       WHERE business_owner_phone IS NULL
         AND review_request_sent_at IS NULL
         AND status = 'confirmed'
         AND attendee_phone IS NOT NULL AND attendee_phone != ''
         AND end_time < NOW() - INTERVAL '60 minutes'
         AND end_time > NOW() - INTERVAL '7 days'
       ORDER BY end_time ASC
       LIMIT 100`
    )

    console.log(`\nStep 4 — Direct review (no owner phone): ${rows.length} bookings`)

    for (const row of rows) {
      try {
        const reviewUrl = await resolveReviewUrl(row.lead_id)
        await sendReviewSMS(row.id, row.attendee_name, row.attendee_phone, row.business_name, reviewUrl)
        console.log(`  Direct review → ${row.attendee_name} (${row.attendee_phone})`)
        step4++
      } catch (e: any) {
        console.error(`  [!] Step4 failed for ${row.id}: ${e.message}`)
        errors++
      }
    }
  }

  console.log(`\n=== Done ===`)
  console.log(`Step 1 (owner confirm): ${step1}`)
  console.log(`Step 2 (confirmed YES):  ${step2}`)
  console.log(`Step 3 (auto-assume):    ${step3}`)
  console.log(`Step 4 (no owner phone): ${step4}`)
  console.log(`Errors: ${errors}`)

  await pool.end()
}

main().catch(e => {
  console.error('[ReviewRequests] Fatal:', e.message)
  process.exit(1)
})
