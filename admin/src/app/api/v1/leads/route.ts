export const runtime = 'edge'
/**
 * GET /api/v1/leads
 * Customer-facing REST API — Scale plan only.
 *
 * Auth: Bearer <api_key> in Authorization header
 *
 * Returns all pipeline data for the authenticated client's account.
 * Useful for CRM sync, BI tools, custom dashboards.
 */

import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { sha256Hex } from "@/lib/edge-crypto"

async function hashKey(key: string): Promise<string> {
  return sha256Hex(key)
}

function extractBearer(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? ""
  if (!auth.startsWith("Bearer ")) return null
  return auth.slice(7).trim()
}

async function resolveApiKey(key: string) {
  const db = await getDb()
  const hash = await hashKey(key)
  const { rows } = await db.query(
    `SELECT ak.lead_id, ak.id as key_id, l.client_plan, l.name as business_name
     FROM api_keys ak
     JOIN leads l ON l.id = ak.lead_id
     WHERE ak.key_hash = $1 AND NOT ak.revoked
     LIMIT 1`,
    [hash]
  )
  if (!rows.length) return null

  // Update last_used_at
  await db.query(`UPDATE api_keys SET last_used_at = now() WHERE id = $1`, [rows[0].key_id])
  return rows[0]
}

export async function GET(req: NextRequest) {
  const key = extractBearer(req)
  if (!key) {
    return NextResponse.json({ error: "Missing API key. Use: Authorization: Bearer <key>" }, { status: 401 })
  }

  const apiKey = await resolveApiKey(key)
  if (!apiKey) {
    return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 403 })
  }

  if (apiKey.client_plan !== "scale") {
    return NextResponse.json(
      { error: "API access requires Scale plan", upgrade: "https://webcrew.app/#pricing" },
      { status: 403 }
    )
  }

  const db = await getDb()
  const { rows } = await db.query(
    `SELECT
       id, name, niche, city, state, address, phone, email, website,
       cloudflare_url, vercel_url, custom_domain,
       status, client_plan, site_score,
       outreach_sent_at, sms_sent_at, meeting_scheduled_at, paid_at,
       stripe_payment_url, stripe_session_id, paid,
       rating, review_count, gbp_claimed,
       location_group_id, created_at, updated_at
     FROM leads
     WHERE id = $1 OR location_group_id = (
       SELECT location_group_id FROM leads WHERE id = $1 AND location_group_id IS NOT NULL
     )
     ORDER BY created_at ASC`,
    [apiKey.lead_id]
  )

  return NextResponse.json({
    ok:           true,
    business:     apiKey.business_name,
    plan:         apiKey.client_plan,
    retrieved_at: new Date().toISOString(),
    locations:    rows,
  })
}
