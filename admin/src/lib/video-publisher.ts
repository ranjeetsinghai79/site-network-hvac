import { Pool } from "@/lib/pool"
import { getToken } from "./social-publisher"

type VideoPlatform = "instagram" | "facebook" | "tiktok" | "youtube" | "linkedin" | "x" | "website"

interface VideoAssetRow {
  id: string
  workspace_id: string | null
  platform: VideoPlatform
  status: string
  title: string
  script: string
  asset_url: string | null
  published_at: string | null
  external_video_id: string | null
}

export interface VideoPublishResult {
  ok: boolean
  mode: "dry_run" | "live" | "manual_handoff"
  platform: VideoPlatform
  externalId?: string
  blockers?: string[]
  warnings?: string[]
}

export async function publishApprovedVideoAsset(
  pool: Pool,
  id: string,
  opts: { dryRun?: boolean } = {}
): Promise<VideoPublishResult> {
  const { rows } = await pool.query<VideoAssetRow>(
    `SELECT id, workspace_id, platform, status, title, script, asset_url, published_at, external_video_id
     FROM video_assets WHERE id = $1`,
    [id]
  )
  const asset = rows[0]
  if (!asset) return { ok: false, mode: "dry_run", platform: "facebook", blockers: ["Video asset not found."] }

  const blockers: string[] = []
  if (asset.status !== "rendered" && asset.status !== "published") blockers.push("Video must be rendered before it can be published.")
  if (!asset.asset_url) blockers.push("No rendered asset_url on this video.")
  if (asset.published_at) blockers.push("Video is already published.")
  if (blockers.length) return { ok: false, mode: "dry_run", platform: asset.platform, blockers }

  const dryRun = opts.dryRun === true || process.env.VIDEO_PUBLISH_LIVE !== "true"
  if (dryRun) {
    return { ok: true, mode: "dry_run", platform: asset.platform, warnings: ["Dry run only. Set VIDEO_PUBLISH_LIVE=true after platform tokens are connected."] }
  }

  const result = await dispatch(pool, asset)
  if (result.ok && result.externalId) {
    await pool.query(
      `UPDATE video_assets SET status='published', external_video_id=$2, published_at=now(), updated_at=now() WHERE id=$1`,
      [asset.id, result.externalId]
    )
  }
  return result
}

async function dispatch(pool: Pool, asset: VideoAssetRow): Promise<VideoPublishResult> {
  if (asset.platform === "facebook") return publishFacebookReel(pool, asset)
  if (asset.platform === "linkedin") {
    // LinkedIn Video API (rest/videos, initializeUpload → PUT byte-range parts →
    // finalizeUpload) needs the real binary streamed through us in size-bounded
    // parts, unlike Facebook's file_url hosted-transfer below. Not implemented
    // yet — do it as its own pass rather than guess the part-splitting logic
    // blind. Handoff carries everything needed to post manually today.
    return manualHandoff(asset, ["LinkedIn native video publish needs binary chunked upload (initializeUpload/finalizeUpload) — not yet implemented. Use the handoff package."])
  }
  if (asset.platform === "youtube") {
    // YouTube Data API v3 videos.insert has no "fetch this URL for me" option —
    // Google requires us to stream the actual bytes via a resumable upload
    // session (POST to start, then PUT the body). Needs a nodejs-runtime route
    // (not edge) to stream asset_url's bytes through. Not implemented yet.
    return manualHandoff(asset, ["YouTube Shorts native upload needs a resumable binary upload (nodejs runtime, not edge) — not yet implemented. Use the handoff package."])
  }
  if (asset.platform === "x") {
    // X media upload v1.1 is chunked (INIT/APPEND/FINALIZE) and also requires
    // streaming the binary ourselves — same shape of work as YouTube above.
    return manualHandoff(asset, ["X native video publish needs chunked binary upload (INIT/APPEND/FINALIZE) — not yet implemented. Use the handoff package."])
  }
  // Instagram Reels + TikTok: native publish needs Meta/TikTok business app
  // review before our app can call instagram_content_publish / Content Posting
  // API at all — manual handoff by design until that clears (weeks-long external
  // approval, not something more code here can shortcut).
  return manualHandoff(asset, [`${asset.platform} needs platform app review before native publishing is possible. Use the handoff package for now.`])
}

/**
 * Facebook Reels — 3-step Resumable Upload API using the "hosted transfer"
 * (file_url) method, so no binary streaming through our server is needed:
 * Meta fetches asset_url itself. Verify this exact shape against Meta's live
 * Graph API docs before relying on it at volume — the same "verify before
 * trusting" flag as every other fresh integration in this codebase.
 */
async function publishFacebookReel(pool: Pool, asset: VideoAssetRow): Promise<VideoPublishResult> {
  const token = await getToken(pool, ["facebook_page", "meta_ads", "instagram_ads"], asset.workspace_id)
  const pageId = token.pageId || (!asset.workspace_id ? process.env.FACEBOOK_PAGE_ID : undefined)
  const accessToken = token.accessToken || (!asset.workspace_id ? process.env.FACEBOOK_PAGE_ACCESS_TOKEN : undefined)
  if (!pageId || !accessToken || !asset.asset_url) {
    return manualHandoff(asset, ["Facebook Page ID or page access token missing. Connect the Page or use the handoff package."])
  }

  const startRes = await fetch(`https://graph.facebook.com/v20.0/${pageId}/video_reels`, {
    method: "POST",
    body: new URLSearchParams({ access_token: accessToken, upload_phase: "start" }),
  })
  const startData = await startRes.json() as { video_id?: string; upload_url?: string; error?: { message?: string } }
  if (!startRes.ok || !startData.video_id || !startData.upload_url) {
    return { ok: false, mode: "live", platform: "facebook", blockers: [`Facebook Reels start failed: ${startData.error?.message ?? startRes.statusText}`] }
  }

  const transferRes = await fetch(startData.upload_url, {
    method: "POST",
    headers: { Authorization: `OAuth ${accessToken}`, file_url: asset.asset_url },
  })
  if (!transferRes.ok) {
    const text = await transferRes.text()
    return { ok: false, mode: "live", platform: "facebook", blockers: [`Facebook Reels file transfer failed: ${text || transferRes.statusText}`] }
  }

  const finishRes = await fetch(`https://graph.facebook.com/v20.0/${pageId}/video_reels`, {
    method: "POST",
    body: new URLSearchParams({
      access_token: accessToken,
      upload_phase: "finish",
      video_id: startData.video_id,
      video_state: "PUBLISHED",
      description: asset.script.slice(0, 2000),
    }),
  })
  const finishData = await finishRes.json() as { success?: boolean; error?: { message?: string } }
  if (!finishRes.ok || finishData.success !== true) {
    return { ok: false, mode: "live", platform: "facebook", blockers: [`Facebook Reels publish failed: ${finishData.error?.message ?? finishRes.statusText}`] }
  }
  return { ok: true, mode: "live", platform: "facebook", externalId: startData.video_id }
}

function manualHandoff(asset: VideoAssetRow, warnings: string[]): VideoPublishResult {
  return { ok: true, mode: "manual_handoff", platform: asset.platform, warnings: [...warnings, `Download: ${asset.asset_url}`] }
}
