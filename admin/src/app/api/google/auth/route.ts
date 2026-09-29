export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { hmacSha256Hex } from '@/lib/edge-crypto'

const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/business.manage',     // GBP posts + review replies
  'https://www.googleapis.com/auth/webmasters.readonly', // GSC traffic data
].join(' ')

// Generate a signed state param to prevent CSRF
async function buildState(leadId: string): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.HITL_SECRET ?? 'webcrew-oauth-secret'
  const payload = `${leadId}:${Date.now()}`
  const sig = await hmacSha256Hex(secret, payload)
  return Buffer.from(JSON.stringify({ leadId, payload, sig })).toString('base64url')
}

export async function GET(req: NextRequest) {
  const clientId    = process.env.GOOGLE_OAUTH_CLIENT_ID
  const adminUrl    = process.env.ADMIN_URL ?? 'https://admin.webcrew.app'
  const redirectUri = `${adminUrl}/api/google/callback`

  if (!clientId) {
    return NextResponse.json(
      { error: 'GOOGLE_OAUTH_CLIENT_ID not set — add it to admin env vars' },
      { status: 500 }
    )
  }

  const leadId = req.nextUrl.searchParams.get('leadId') ?? ''
  if (!leadId) {
    return NextResponse.json({ error: 'leadId required' }, { status: 400 })
  }

  const state = await buildState(leadId)

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'offline',  // get refresh_token
    prompt:        'consent',  // always show consent to ensure refresh_token
    state,
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  )
}
