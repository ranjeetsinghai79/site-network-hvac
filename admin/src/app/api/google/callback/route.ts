export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { hmacSha256Hex } from '@/lib/edge-crypto'
import { getDb } from '@/lib/db'

async function verifyState(state: string): Promise<string | null> {
  try {
    const secret  = process.env.NEXTAUTH_SECRET ?? process.env.HITL_SECRET ?? 'webcrew-oauth-secret'
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
    const { leadId, payload, sig } = decoded
    const expected = await hmacSha256Hex(secret, payload)
    if (expected !== sig) return null
    // Reject state older than 15 min
    const ts = parseInt(payload.split(':')[1] ?? '0', 10)
    if (Date.now() - ts > 15 * 60 * 1000) return null
    return leadId as string
  } catch {
    return null
  }
}

async function exchangeCode(code: string, redirectUri: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
  email?: string
} | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }).toString(),
  })
  if (!res.ok) return null
  const data = await res.json() as any

  // Decode id_token to get email
  let email: string | undefined
  if (data.id_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(data.id_token.split('.')[1], 'base64url').toString()
      )
      email = payload.email
    } catch {}
  }

  return { ...data, email }
}

async function discoverGbpLocation(accessToken: string): Promise<{
  accountId: string | null
  locationId: string | null
}> {
  try {
    const res = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const data = await res.json() as any
    const accountName = data.accounts?.[0]?.name  // e.g. "accounts/123456"
    if (!accountName) return { accountId: null, locationId: null }

    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const locData = await locRes.json() as any
    const locationName = locData.locations?.[0]?.name  // e.g. "accounts/123/locations/456"
    return {
      accountId:  accountName   ?? null,
      locationId: locationName  ?? null,
    }
  } catch {
    return { accountId: null, locationId: null }
  }
}

async function discoverGscSite(accessToken: string, domain: string): Promise<string | null> {
  try {
    const res = await fetch(
      'https://www.googleapis.com/webmasters/v3/sites',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const data = await res.json() as any
    const sites: { siteUrl: string }[] = data.siteEntry ?? []
    // Prefer exact domain match, fall back to first site
    const match = sites.find(s => s.siteUrl.includes(domain)) ?? sites[0]
    return match?.siteUrl ?? null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const adminUrl    = process.env.ADMIN_URL ?? 'https://admin.webcrew.app'
  const redirectUri = `${adminUrl}/api/google/callback`
  const code  = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const error = req.nextUrl.searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(`${adminUrl}/connect?error=denied`)
  }

  const leadId = await verifyState(state)
  if (!leadId) {
    return NextResponse.redirect(`${adminUrl}/connect?error=invalid_state`)
  }

  const tokens = await exchangeCode(code, redirectUri)
  if (!tokens?.refresh_token) {
    return NextResponse.redirect(`${adminUrl}/connect?error=no_refresh_token&leadId=${leadId}`)
  }

  const db   = await getDb()
  const lead = (await db.query('SELECT * FROM leads WHERE id = $1', [leadId])).rows[0]

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  // Auto-discover GBP location and GSC site
  const { accountId, locationId } = await discoverGbpLocation(tokens.access_token)
  const domain   = lead?.vercel_url ?? lead?.cloudflare_url ?? ''
  const gscSite  = await discoverGscSite(tokens.access_token, domain)

  // Upsert tokens
  await db.query(
    `INSERT INTO client_google_tokens
       (lead_id, email, access_token, refresh_token, expires_at, scopes,
        gbp_account_id, gbp_location_id, gsc_site_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (lead_id) DO UPDATE SET
       email          = EXCLUDED.email,
       access_token   = EXCLUDED.access_token,
       refresh_token  = EXCLUDED.refresh_token,
       expires_at     = EXCLUDED.expires_at,
       scopes         = EXCLUDED.scopes,
       gbp_account_id  = COALESCE(EXCLUDED.gbp_account_id,  client_google_tokens.gbp_account_id),
       gbp_location_id = COALESCE(EXCLUDED.gbp_location_id, client_google_tokens.gbp_location_id),
       gsc_site_url    = COALESCE(EXCLUDED.gsc_site_url,    client_google_tokens.gsc_site_url),
       updated_at     = NOW()`,
    [
      leadId,
      tokens.email ?? '',
      tokens.access_token,
      tokens.refresh_token,
      expiresAt,
      ['business.manage', 'webmasters.readonly'],
      accountId,
      locationId,
      gscSite,
    ]
  )

  // Mark lead as google-connected
  await db.query(
    `UPDATE leads SET google_connected = TRUE, google_connected_at = NOW(),
     gbp_account_id = COALESCE($1, gbp_account_id),
     gbp_location_id = COALESCE($2, gbp_location_id)
     WHERE id = $3`,
    [accountId, locationId, leadId]
  )

  return NextResponse.redirect(`${adminUrl}/connect?success=1&leadId=${leadId}`)
}
