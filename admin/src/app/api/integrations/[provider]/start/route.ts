export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import { randomHex } from "@/lib/edge-crypto"
import { Pool } from "@/lib/pool"
import { defaultAgencyId } from "@/lib/platform-control"

let _pool: InstanceType<typeof Pool> | null = null
function pool(): InstanceType<typeof Pool> {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return _pool
}

const CONFIG: Record<string, { authUrl: string; clientIdEnv: string; scopes: string[] }> = {
  google_ads: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    clientIdEnv: "GOOGLE_ADS_CLIENT_ID",
    scopes: ["https://www.googleapis.com/auth/adwords"],
  },
  meta_ads: {
    authUrl: "https://www.facebook.com/v20.0/dialog/oauth",
    clientIdEnv: "META_APP_ID",
    scopes: ["ads_management", "ads_read", "business_management", "pages_read_engagement"],
  },
  instagram_ads: {
    authUrl: "https://www.facebook.com/v20.0/dialog/oauth",
    clientIdEnv: "META_APP_ID",
    scopes: ["ads_management", "ads_read", "instagram_basic"],
  },
  facebook_page: {
    authUrl: "https://www.facebook.com/v20.0/dialog/oauth",
    clientIdEnv: "META_APP_ID",
    scopes: ["pages_manage_posts", "pages_read_engagement", "pages_show_list"],
  },
  instagram: {
    authUrl: "https://www.facebook.com/v20.0/dialog/oauth",
    clientIdEnv: "META_APP_ID",
    scopes: ["instagram_basic", "instagram_content_publish", "pages_read_engagement", "pages_show_list"],
  },
  threads: {
    authUrl: "https://threads.net/oauth/authorize",
    clientIdEnv: "THREADS_APP_ID",
    scopes: ["threads_basic", "threads_content_publish"],
  },
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  const config = CONFIG[provider]
  if (!config) return NextResponse.json({ error: "Unknown provider" }, { status: 404 })

  const clientId = process.env[config.clientIdEnv]
  const baseUrl = process.env.ADMIN_BASE_URL || new URL(req.url).origin
  const workspaceId = req.nextUrl.searchParams.get("workspaceId")
  const agencyId = await defaultAgencyId()
  if (workspaceId) {
    const { rows } = await pool().query("SELECT 1 FROM growth_workspaces WHERE id=$1 AND agency_id=$2", [workspaceId, agencyId])
    if (!rows[0]) return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
  }
  if (!clientId) {
    return NextResponse.json({ error: `${config.clientIdEnv} is not configured` }, { status: 400 })
  }

  const state = randomHex(24)
  await pool().query(
    `INSERT INTO oauth_states (provider, state, redirect_to, agency_id, workspace_id) VALUES ($1,$2,$3,$4,$5)`,
    [provider, state, workspaceId ? "/platform/control" : "/integrations", agencyId, workspaceId]
  )

  const url = new URL(config.authUrl)
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", `${baseUrl}/api/integrations/${provider}/callback`)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("state", state)
  url.searchParams.set("scope", config.scopes.join(provider === "google_ads" ? " " : ","))
  if (provider === "google_ads") {
    url.searchParams.set("access_type", "offline")
    url.searchParams.set("prompt", "consent")
  }

  return NextResponse.redirect(url)
}
