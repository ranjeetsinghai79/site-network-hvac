import { Pool } from "@/lib/pool"
import { decryptSecretJson } from "@/lib/secret-box"

type SocialPlatform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "google_business_profile"
  | "threads"
  | "x"
  | "tiktok"
  | "pinterest"
  | "youtube"
  | "nextdoor"

interface SocialAssetRow {
  id: string
  workspace_id: string | null
  platform: SocialPlatform
  status: string
  title: string
  caption: string
  asset_type: "image_post" | "carousel"
  slides: Array<{ title: string; body: string; visualPrompt: string }>
  image_prompts: string[]
  hashtags: string[]
  approval_notes: string | null
  compliance_warnings: string[] | null
  scheduled_for: string | null
  published_at: string | null
  external_id: string | null
  asset_url: string | null
  publish_payload: Record<string, unknown> | null
}

export interface TokenPayload {
  accessToken?: string
  refreshToken?: string
  pageId?: string
  authorUrn?: string
}

export interface SocialPublishResult {
  ok: boolean
  mode: "dry_run" | "live" | "manual_handoff"
  platform: SocialPlatform
  externalId?: string
  blockers?: string[]
  warnings?: string[]
  payload?: Record<string, unknown>
}

export async function publishApprovedSocialAsset(
  pool: Pool,
  id: string,
  opts: { dryRun?: boolean } = {}
): Promise<SocialPublishResult> {
  const { rows } = await pool.query<SocialAssetRow>(
    `SELECT id, workspace_id, platform, status, title, caption, asset_type, slides, image_prompts,
            hashtags, approval_notes, compliance_warnings, scheduled_for, published_at,
            external_id, asset_url, publish_payload
     FROM social_assets
     WHERE id = $1`,
    [id]
  )
  const asset = rows[0]
  if (!asset) return { ok: false, mode: "dry_run", platform: "facebook", blockers: ["Social asset not found."] }

  const blockers = validateSocialAsset(asset)
  if (blockers.length) return { ok: false, mode: "dry_run", platform: asset.platform, blockers }

  const payload = exportSocialPayload(asset)
  const dryRun = opts.dryRun === true || process.env.SOCIAL_PUBLISH_DRY_RUN === "true" || process.env.SOCIAL_PUBLISH_LIVE !== "true"
  if (dryRun) {
    return {
      ok: true,
      mode: "dry_run",
      platform: asset.platform,
      warnings: ["Dry run only. Set SOCIAL_PUBLISH_LIVE=true after platform OAuth, page/account IDs, assets, and client approval are verified."],
      payload,
    }
  }

  const result = await publishOrHandoff(pool, asset, payload)
  if (result.ok && result.externalId) {
    await pool.query(
      `UPDATE social_assets
       SET status = 'published',
           external_id = $2,
           publish_payload = $3,
           publish_error = NULL,
           published_at = now(),
           updated_at = now()
       WHERE id = $1`,
      [asset.id, result.externalId, JSON.stringify(payload)]
    )
  } else if (result.mode === "manual_handoff") {
    await pool.query(
      `UPDATE social_assets
       SET publish_payload = $2,
           publish_error = NULL,
           updated_at = now()
       WHERE id = $1`,
      [asset.id, JSON.stringify(payload)]
    )
  } else if (result.blockers?.length) {
    await pool.query(
      `UPDATE social_assets
       SET publish_error = $2,
           updated_at = now()
       WHERE id = $1`,
      [asset.id, result.blockers.join(" ")]
    )
  }
  return result
}

function validateSocialAsset(asset: SocialAssetRow): string[] {
  const blockers: string[] = []
  if (asset.status !== "approved") blockers.push("Social asset must be approved before publishing.")
  if (asset.published_at || asset.external_id) blockers.push("Social asset is already linked to an external post.")
  if ((asset.compliance_warnings ?? []).some((warning) => warning.startsWith("blocker:"))) {
    blockers.push("Compliance blockers must be resolved before publishing.")
  }
  if (!asset.caption.trim()) blockers.push("Caption is required.")
  return blockers
}

async function publishOrHandoff(
  pool: Pool,
  asset: SocialAssetRow,
  payload: Record<string, unknown>
): Promise<SocialPublishResult> {
  if (asset.platform === "facebook") return publishFacebookPage(pool, asset, payload)
  if (asset.platform === "linkedin") return publishLinkedIn(pool, asset, payload)
  if (asset.platform === "x") return publishX(asset, payload)

  const needsRenderedAsset = ["instagram", "threads", "pinterest", "tiktok"].includes(asset.platform)
  if (needsRenderedAsset && !asset.asset_url) {
    return {
      ok: true,
      mode: "manual_handoff",
      platform: asset.platform,
      payload,
      warnings: [`${asset.platform} is ready as a handoff package. Add rendered image/carousel URLs before API publishing.`],
    }
  }

  return {
    ok: true,
    mode: "manual_handoff",
    platform: asset.platform,
    payload,
    warnings: [`${asset.platform} is queued as manual/limited publishing for launch.`],
  }
}

async function publishFacebookPage(
  pool: Pool,
  asset: SocialAssetRow,
  payload: Record<string, unknown>
): Promise<SocialPublishResult> {
  const token = await getToken(pool, ["facebook_page", "meta_ads", "instagram_ads"], asset.workspace_id)
  const pageId = token.pageId || (!asset.workspace_id ? process.env.FACEBOOK_PAGE_ID || process.env.META_PAGE_ID : undefined)
  const accessToken = token.accessToken || (!asset.workspace_id ? process.env.FACEBOOK_PAGE_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN : undefined)
  if (!pageId || !accessToken) {
    return { ok: true, mode: "manual_handoff", platform: asset.platform, payload, warnings: ["Facebook Page ID or page access token missing. Use the handoff package or connect the Page."] }
  }

  const body = new URLSearchParams({
    access_token: accessToken,
    message: withHashtags(asset),
  })
  const res = await fetch(`https://graph.facebook.com/v20.0/${pageId}/feed`, { method: "POST", body })
  const data = await res.json() as { id?: string; error?: { message?: string } }
  if (!res.ok || !data.id) {
    return { ok: false, mode: "live", platform: asset.platform, blockers: [`Facebook publish failed: ${data.error?.message ?? res.statusText}`], payload }
  }
  return { ok: true, mode: "live", platform: asset.platform, externalId: data.id, payload }
}

async function publishLinkedIn(
  pool: Pool,
  asset: SocialAssetRow,
  payload: Record<string, unknown>
): Promise<SocialPublishResult> {
  const token = await getToken(pool, ["linkedin"], asset.workspace_id)
  const accessToken = token.accessToken || (!asset.workspace_id ? process.env.LINKEDIN_ACCESS_TOKEN : undefined)
  const author = token.authorUrn || (!asset.workspace_id ? process.env.LINKEDIN_AUTHOR_URN || process.env.LINKEDIN_ORGANIZATION_URN : undefined)
  if (!accessToken || !author) {
    return { ok: true, mode: "manual_handoff", platform: asset.platform, payload, warnings: ["LinkedIn token or author URN missing. Use the handoff package or connect LinkedIn."] }
  }

  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": process.env.LINKEDIN_API_VERSION || "202606",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author,
      commentary: withHashtags(asset),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  })
  const text = await res.text()
  if (!res.ok) {
    return { ok: false, mode: "live", platform: asset.platform, blockers: [`LinkedIn publish failed: ${text || res.statusText}`], payload }
  }
  return { ok: true, mode: "live", platform: asset.platform, externalId: res.headers.get("x-restli-id") ?? `linkedin:${asset.id}`, payload }
}

async function publishX(asset: SocialAssetRow, payload: Record<string, unknown>): Promise<SocialPublishResult> {
  const accessToken = asset.workspace_id ? undefined : process.env.X_ACCESS_TOKEN || process.env.TWITTER_ACCESS_TOKEN
  if (!accessToken) {
    return { ok: true, mode: "manual_handoff", platform: asset.platform, payload, warnings: ["X user access token missing. Use the handoff package or connect X."] }
  }
  const res = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: withHashtags(asset).slice(0, 280) }),
  })
  const data = await res.json() as { data?: { id?: string }; detail?: string; title?: string }
  if (!res.ok || !data.data?.id) {
    return { ok: false, mode: "live", platform: asset.platform, blockers: [`X publish failed: ${data.detail ?? data.title ?? res.statusText}`], payload }
  }
  return { ok: true, mode: "live", platform: asset.platform, externalId: data.data.id, payload }
}

export async function getToken(pool: Pool, providers: string[], workspaceId: string | null): Promise<TokenPayload> {
  if (workspaceId) {
    const scoped = await pool.query<{ credentials_metadata: Record<string, unknown>; metadata: Record<string, unknown> }>(
      `SELECT credentials_metadata,metadata FROM workspace_integrations
       WHERE workspace_id=$1 AND provider=ANY($2::text[]) AND status='connected'
       ORDER BY updated_at DESC LIMIT 1`,
      [workspaceId, providers]
    )
    const encrypted = scoped.rows[0]?.credentials_metadata?.tokenEncrypted
    if (typeof encrypted !== "string") return {}
    return { ...await decryptSecretJson<TokenPayload>(encrypted), ...(scoped.rows[0].metadata as TokenPayload) }
  }
  const { rows } = await pool.query<{ metadata: Record<string, unknown> }>(
    `SELECT metadata
     FROM integration_connections
     WHERE provider = ANY($1::text[]) AND status = 'connected'
     ORDER BY connected_at DESC NULLS LAST
     LIMIT 1`,
    [providers]
  )
  const encrypted = rows[0]?.metadata?.tokenEncrypted
  if (typeof encrypted !== "string") return {}
  return decryptSecretJson<TokenPayload>(encrypted)
}

function exportSocialPayload(asset: SocialAssetRow): Record<string, unknown> {
  return {
    platform: asset.platform,
    assetType: asset.asset_type,
    title: asset.title,
    caption: asset.caption,
    hashtags: asset.hashtags ?? [],
    slides: asset.slides ?? [],
    imagePrompts: asset.image_prompts ?? [],
    assetUrl: asset.asset_url,
    scheduledFor: asset.scheduled_for,
  }
}

function withHashtags(asset: SocialAssetRow): string {
  const hashtags = (asset.hashtags ?? []).join(" ")
  return [asset.caption, hashtags].filter(Boolean).join("\n\n").trim()
}
