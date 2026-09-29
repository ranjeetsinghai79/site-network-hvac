export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import { Pool } from "@/lib/pool"
import { encryptSecretJson } from "@/lib/secret-box"

let _pool: InstanceType<typeof Pool> | null = null
function pool(): InstanceType<typeof Pool> {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return _pool
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  const url = new URL(req.url)
  const state = url.searchParams.get("state")
  const code = url.searchParams.get("code")
  const error = url.searchParams.get("error")

  if (error) return NextResponse.redirect(new URL(`/integrations?error=${encodeURIComponent(error)}`, req.url))
  if (!state || !code) return NextResponse.json({ error: "Missing state or code" }, { status: 400 })

  const { rows } = await pool().query(
    `DELETE FROM oauth_states
     WHERE provider=$1 AND state=$2 AND expires_at > NOW()
     RETURNING redirect_to, agency_id, workspace_id`,
    [provider, state]
  )
  if (!rows[0]) return NextResponse.json({ error: "Invalid or expired OAuth state" }, { status: 400 })

  const baseUrl = process.env.ADMIN_BASE_URL || new URL(req.url).origin
  const token = await exchangeCodeForToken(provider, code, `${baseUrl}/api/integrations/${provider}/callback`)
  const encrypted = await encryptSecretJson(token)

  let connectionId: string | null = null
  if (!rows[0].workspace_id) {
    const { rows: connectionRows } = await pool().query(
    `INSERT INTO integration_connections (provider, status, account_label, scopes, metadata, connected_at)
     VALUES ($1,'connected',$2,'{}',$3,NOW())
     ON CONFLICT (provider) DO UPDATE SET
       status='connected',
       account_label=EXCLUDED.account_label,
       metadata=EXCLUDED.metadata,
       connected_at=NOW(),
       updated_at=NOW()
     RETURNING id`,
    [
      provider,
      `${provider} connected`,
      JSON.stringify({
        tokenEncrypted: encrypted,
        hasToken: true,
        tokenType: token.tokenType ?? null,
        expiresAt: token.expiresAt ?? null,
        refreshTokenStored: Boolean(token.refreshToken),
        connectedAt: new Date().toISOString(),
      }),
    ]
    )
    connectionId = connectionRows[0].id
  }

  if (rows[0].agency_id && rows[0].workspace_id) {
    await pool().query(`
      INSERT INTO workspace_integrations (agency_id,workspace_id,provider,status,integration_connection_id,account_label,last_checked_at,credentials_metadata)
      VALUES ($1,$2,$3,'connected',$4,$5,now(),$6)
      ON CONFLICT (workspace_id,provider) DO UPDATE SET status='connected',integration_connection_id=EXCLUDED.integration_connection_id,
        account_label=EXCLUDED.account_label,last_checked_at=now(),credentials_metadata=EXCLUDED.credentials_metadata,error=NULL,updated_at=now()
    `, [rows[0].agency_id, rows[0].workspace_id, provider, connectionId, `${provider} connected`, JSON.stringify({ tokenEncrypted: encrypted, hasToken: true, tokenType: token.tokenType ?? null, expiresAt: token.expiresAt ?? null, refreshTokenStored: Boolean(token.refreshToken), connectedAt: new Date().toISOString() })])
  }

  return NextResponse.redirect(new URL(rows[0].redirect_to || "/integrations", req.url))
}

async function exchangeCodeForToken(provider: string, code: string, redirectUri: string) {
  if (provider === "google_ads") {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID2
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET2
    if (!clientId || !clientSecret) throw new Error("Google Ads OAuth client ID and secret are required.")

    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    })
    const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body })
    const data = await res.json() as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
      token_type?: string
      error_description?: string
      error?: string
    }
    if (!res.ok || !data.access_token) {
      throw new Error(data.error_description ?? data.error ?? "Google token exchange failed.")
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : undefined,
      tokenType: data.token_type,
    }
  }

  if (["meta_ads", "instagram_ads", "facebook_page", "instagram"].includes(provider)) {
    const clientId = process.env.META_APP_ID
    const clientSecret = process.env.META_APP_SECRET
    if (!clientId || !clientSecret) throw new Error("META_APP_ID and META_APP_SECRET are required.")

    const url = new URL("https://graph.facebook.com/v20.0/oauth/access_token")
    url.searchParams.set("client_id", clientId)
    url.searchParams.set("client_secret", clientSecret)
    url.searchParams.set("redirect_uri", redirectUri)
    url.searchParams.set("code", code)
    const res = await fetch(url)
    const data = await res.json() as {
      access_token?: string
      token_type?: string
      expires_in?: number
      error?: { message?: string }
    }
    if (!res.ok || !data.access_token) {
      throw new Error(data.error?.message ?? "Meta token exchange failed.")
    }
    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : undefined,
      tokenType: data.token_type,
    }
  }

  if (provider === "threads") {
    const clientId = process.env.THREADS_APP_ID
    const clientSecret = process.env.THREADS_APP_SECRET
    if (!clientId || !clientSecret) throw new Error("THREADS_APP_ID and THREADS_APP_SECRET are required.")

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    })
    const res = await fetch("https://graph.threads.net/oauth/access_token", { method: "POST", body })
    const data = await res.json() as {
      access_token?: string
      expires_in?: number
      error_message?: string
      error?: { message?: string }
    }
    if (!res.ok || !data.access_token) {
      throw new Error(data.error_message ?? data.error?.message ?? "Threads token exchange failed.")
    }
    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : undefined,
      tokenType: "bearer",
    }
  }

  throw new Error("Unknown provider.")
}
