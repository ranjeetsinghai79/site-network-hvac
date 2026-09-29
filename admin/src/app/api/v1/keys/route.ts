export const runtime = 'edge'
/**
 * POST /api/v1/keys — provision a new API key for a Scale client (admin only)
 * DELETE /api/v1/keys — revoke a key
 *
 * Admin auth: X-Admin-Token header must match ADMIN_API_TOKEN env var.
 */

import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { sha256Hex, randomHex } from "@/lib/edge-crypto"

async function hashKey(key: string): Promise<string> {
  return sha256Hex(key)
}

function requireAdmin(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token") ?? ""
  return token === (process.env.ADMIN_API_TOKEN ?? "")
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { lead_id } = await req.json()
  if (!lead_id) {
    return NextResponse.json({ error: "lead_id required" }, { status: 400 })
  }

  // Verify it's a Scale client
  const db = await getDb()
  const { rows: leads } = await db.query(
    `SELECT id, name, client_plan FROM leads WHERE id = $1`,
    [lead_id]
  )
  if (!leads.length) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  if (leads[0].client_plan !== "scale") {
    return NextResponse.json({ error: "API keys require Scale plan" }, { status: 403 })
  }

  // Generate key: wc_live_<32 random bytes hex>
  const rawKey   = `wc_live_${randomHex(24)}`
  const keyHash  = await hashKey(rawKey)
  const keyPrefix = rawKey.slice(0, 14) + "..."

  await db.query(
    `INSERT INTO api_keys (lead_id, key_hash, key_prefix) VALUES ($1, $2, $3)`,
    [lead_id, keyHash, keyPrefix]
  )

  return NextResponse.json({
    ok:      true,
    key:     rawKey,          // shown ONCE — store it now
    prefix:  keyPrefix,
    lead_id,
    business: leads[0].name,
    note:    "Store this key securely. It won't be shown again.",
  })
}

export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { key_prefix, lead_id } = await req.json()
  if (!key_prefix && !lead_id) {
    return NextResponse.json({ error: "key_prefix or lead_id required" }, { status: 400 })
  }

  const db = await getDb()
  const { rowCount } = await db.query(
    `UPDATE api_keys SET revoked = true
     WHERE (key_prefix = $1 OR lead_id = $2::uuid)`,
    [key_prefix ?? null, lead_id ?? null]
  )

  return NextResponse.json({ ok: true, revoked: rowCount })
}
