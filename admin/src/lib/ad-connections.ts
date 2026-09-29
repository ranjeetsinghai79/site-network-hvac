import { Pool } from "@/lib/pool"
import { decryptSecretJson } from "@/lib/secret-box"

export interface TokenPayload {
  accessToken?: string
  refreshToken?: string
  expiresAt?: string
  tokenType?: string
  customerId?: string
  loginCustomerId?: string
  adAccountId?: string
  pageId?: string
  pixelId?: string
}

interface ConnectionRow {
  provider: string
  status: string
  metadata: Record<string, unknown>
}

export async function getConnectionToken(pool: Pool, provider: string, workspaceId: string | null): Promise<TokenPayload> {
  if (workspaceId) {
    const scoped = await pool.query<{ credentials_metadata: Record<string, unknown>; metadata: Record<string, unknown> }>(
      `SELECT credentials_metadata,metadata FROM workspace_integrations WHERE workspace_id=$1 AND provider=$2 AND status='connected' LIMIT 1`,
      [workspaceId, provider]
    )
    const encrypted = scoped.rows[0]?.credentials_metadata?.tokenEncrypted
    if (typeof encrypted !== "string") return {}
    return { ...await decryptSecretJson<TokenPayload>(encrypted), ...(scoped.rows[0].metadata as TokenPayload) }
  }
  const { rows } = await pool.query<ConnectionRow>(
    `SELECT provider, status, metadata
     FROM integration_connections
     WHERE provider = $1
     LIMIT 1`,
    [provider]
  )
  const metadata = rows[0]?.metadata ?? {}
  if (typeof metadata.tokenEncrypted !== "string") return {}
  return decryptSecretJson<TokenPayload>(metadata.tokenEncrypted)
}

export async function refreshGoogleAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  })
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body })
  const data = await res.json() as { access_token?: string; error_description?: string; error?: string }
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? "Failed to refresh Google access token")
  }
  return data.access_token
}

export function normalizeGoogleCustomerId(value?: string): string | undefined {
  return value?.replace(/\D/g, "") || undefined
}

export function normalizeMetaAdAccountId(value?: string): string | undefined {
  if (!value) return undefined
  return value.startsWith("act_") ? value : `act_${value.replace(/\D/g, "")}`
}

export function googleAdsCredentials(env: NodeJS.ProcessEnv = process.env) {
  return {
    developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN || env.GOOGLE_ADS_DEV_TOKEN,
    clientId: env.GOOGLE_ADS_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID2,
    clientSecret: env.GOOGLE_ADS_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET2,
  }
}
