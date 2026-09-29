/**
 * auto-build-from-sms.ts
 *
 * Polls build_requests table for pending YES responses.
 * For each: runs brand scrape → config gen → CF Pages deploy → SMS lead the live URL.
 * Runs as daemon or single-pass (DAEMON=true for loop, default single-pass).
 *
 * Usage:
 *   cd pipeline && npx tsx src/scripts/auto-build-from-sms.ts
 *   cd pipeline && DAEMON=true npx tsx src/scripts/auto-build-from-sms.ts
 */

import 'dotenv/config'
import pg from 'pg'
import { buildLeadFromPlacesMatch } from '../tools/place-match-builder.js'
import { canTextNow } from '../tools/sms-consent.js'

const DATABASE_URL = process.env.DATABASE_URL!
const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_AUTH  = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_FROM  = process.env.TWILIO_FROM_NUMBER!
const DAEMON       = process.env.DAEMON === 'true'
const POLL_MS      = parseInt(process.env.POLL_MS ?? '30000', 10)

const pool = new pg.Pool({ connectionString: DATABASE_URL })

async function sendSms(to: string, body: string): Promise<void> {
  const digits = to.replace(/\D/g, '')
  const e164   = digits.startsWith('1') ? `+${digits}` : `+1${digits}`
  const res    = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: e164, From: TWILIO_FROM, Body: body }).toString(),
    }
  )
  if (!res.ok) {
    const d: any = await res.json()
    console.warn(`[SMS] Failed to ${e164}: ${d?.message}`)
  }
}

// Normalize phone to last-10-digits for matching
function phoneDigits(p?: string): string {
  return (p ?? '').replace(/\D/g, '').slice(-10)
}

async function triggerPipelineBuild(req: {
  id: string; phone: string; name: string; niche: string; city: string; state: string
}): Promise<string | null> {
  // Sofia (CF Worker) owns this conversation; we SMS the link ourselves below,
  // so the shared builder's own skipOutreach is what we want here too.
  const result = await buildLeadFromPlacesMatch({ ...req, tier: 'tier1' })
  return result?.deployedUrl ?? null
}

async function processPendingRequests(): Promise<void> {
  const { rows } = await pool.query<{
    id: string; phone: string; name: string; niche: string; city: string; state: string
  }>(`
    SELECT id, phone, name, niche, city, state
    FROM build_requests
    WHERE status IN ('pending','retrying')
    ORDER BY created_at ASC
    LIMIT 3
  `)

  if (!rows.length) {
    if (DAEMON) process.stdout.write('.')
    return
  }

  console.log(`\n[AutoBuild] ${rows.length} pending request(s)`)

  for (const req of rows) {
    console.log(`\n[AutoBuild] Building for ${req.name} | ${req.niche} | ${req.city} | ${req.phone}`)

    // Mark as building
    await pool.query(
      `UPDATE build_requests SET status='building', updated_at=NOW() WHERE id=$1`,
      [req.id]
    )
    await pool.query(
      `INSERT INTO sms_conversations (phone,stage) VALUES ($1,'building')
       ON CONFLICT(phone) DO UPDATE SET stage='building', updated_at=NOW()`,
      [req.phone]
    )

    try {
      const deployedUrl = await triggerPipelineBuild(req)

      if (deployedUrl) {
        console.log(`[AutoBuild] ✅ Deployed: ${deployedUrl}`)

        // Builds take minutes — a STOP can arrive after the request was queued
        // but before this send. Re-check consent right here, not just at
        // poll-loop entry, or an opted-out lead still gets texted the link.
        if (!(await canTextNow(req.phone))) {
          console.log(`[AutoBuild] ${req.phone} opted out during build — skipping send`)
          await pool.query(
            `UPDATE build_requests SET status='opted_out_before_send', demo_url=$2, updated_at=NOW() WHERE id=$1`,
            [req.id, deployedUrl]
          )
          continue
        }

        // SMS lead the link — Sofia voice
        const msg = `It's ready! Here's ${req.name}'s new website: ${deployedUrl}\n\nTake a look and tell me what you think!\n\n— Sofia, WebCrew`
        await sendSms(req.phone, msg)

        // Update state
        await pool.query(
          `UPDATE build_requests SET status='demo_sent', demo_url=$2, updated_at=NOW() WHERE id=$1`,
          [req.id, deployedUrl]
        )
        await pool.query(
          `INSERT INTO sms_conversations (phone,stage,demo_url) VALUES ($1,'demo_sent',$2)
           ON CONFLICT(phone) DO UPDATE SET stage='demo_sent', demo_url=$2, updated_at=NOW()`,
          [req.phone, deployedUrl]
        )
        await pool.query(
          `UPDATE leads SET cloudflare_url=$2, status='deployed', updated_at=NOW() WHERE phone=$1`,
          [req.phone, deployedUrl]
        )
      } else {
        // No Places match or deploy returned no URL — needs a human, stop retrying
        console.warn(`[AutoBuild] No URL for ${req.name} — marked manual_needed`)
        await pool.query(
          `UPDATE build_requests SET status='manual_needed', updated_at=NOW() WHERE id=$1`,
          [req.id]
        )
      }
    } catch (e: any) {
      console.error(`[AutoBuild] Error building ${req.name}: ${e.message}`)
      // One retry max: pending → retrying → error (stops infinite loop)
      await pool.query(
        `UPDATE build_requests
         SET status = CASE WHEN status='retrying' THEN 'error' ELSE 'retrying' END,
             updated_at=NOW() WHERE id=$1`,
        [req.id]
      )
    }
  }
}

async function main() {
  if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1) }

  console.log(`[AutoBuild] Starting${DAEMON ? ' (daemon mode)' : ' (single-pass)'}`)

  if (DAEMON) {
    while (true) {
      await processPendingRequests().catch(e => console.error('[AutoBuild] Poll error:', e.message))
      await new Promise(r => setTimeout(r, POLL_MS))
    }
  } else {
    await processPendingRequests()
    await pool.end()
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
