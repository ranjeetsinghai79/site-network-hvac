import { Pool } from "@/lib/pool"

type VideoProvider = "fal_kling" | "runpod" | "gcp_veo" | "hyperframes" | "manual"

interface VideoAssetRow {
  id: string
  platform: string
  provider: VideoProvider
  status: string
  title: string
  script: string
  scenes: Array<{ title: string; narration: string; visualPrompt: string; durationSec: number }>
  prompt: string
  duration_sec: number
  aspect_ratio: "9:16" | "1:1" | "16:9"
  source_image_url: string | null
  has_native_audio: boolean
  compliance_warnings: string[] | null
  asset_url: string | null
  external_job_id: string | null
}

export interface VideoGenerateResult {
  ok: boolean
  mode: "dry_run" | "live" | "manual_handoff"
  provider: VideoProvider
  externalJobId?: string
  assetUrl?: string
  blockers?: string[]
  warnings?: string[]
  payload?: Record<string, unknown>
}

export async function generateApprovedVideoAsset(
  pool: Pool,
  id: string,
  opts: { provider?: VideoProvider; dryRun?: boolean } = {}
): Promise<VideoGenerateResult> {
  const { rows } = await pool.query<VideoAssetRow>(
    `SELECT id, platform, provider, status, title, script, scenes, prompt,
            duration_sec, aspect_ratio, source_image_url, has_native_audio,
            compliance_warnings, asset_url, external_job_id
     FROM video_assets
     WHERE id = $1`,
    [id]
  )
  const asset = rows[0]
  if (!asset) return { ok: false, mode: "dry_run", provider: "manual", blockers: ["Video asset not found."] }

  const provider = opts.provider ?? preferredProvider()
  const blockers = validateVideoAsset(asset)
  if (blockers.length) return { ok: false, mode: "dry_run", provider, blockers }

  const payload = buildPayload(asset, provider)
  const dryRun = opts.dryRun === true || process.env.VIDEO_GENERATION_DRY_RUN === "true" || process.env.VIDEO_GENERATION_LIVE !== "true"
  if (dryRun) {
    return {
      ok: true,
      mode: "dry_run",
      provider,
      payload,
      warnings: ["Dry run only. Set VIDEO_GENERATION_LIVE=true after provider credentials, budget caps, and client approval are verified."],
    }
  }

  const result =
    provider === "fal_kling" ? await submitFalKling(asset, payload)
    : provider === "runpod" ? await submitRunPod(asset, payload)
    : provider === "gcp_veo" ? await submitGcpVeo(asset, payload)
    : provider === "hyperframes" ? await createHyperframesHandoff(asset, payload)
    : await createManualHandoff(asset, payload)

  if (result.ok) {
    await pool.query(
      `UPDATE video_assets
       SET provider = $2,
           status = $3,
           external_job_id = COALESCE($4, external_job_id),
           asset_url = COALESCE($5, asset_url),
           render_payload = $6,
           render_error = NULL,
           rendered_at = CASE WHEN $5::text IS NULL THEN rendered_at ELSE now() END,
           updated_at = now()
       WHERE id = $1`,
      [
        asset.id,
        provider,
        result.assetUrl ? "rendered" : result.mode === "manual_handoff" ? "approved" : "rendering",
        result.externalJobId ?? null,
        result.assetUrl ?? null,
        JSON.stringify(payload),
      ]
    )
  } else if (result.blockers?.length) {
    await pool.query(
      `UPDATE video_assets
       SET render_error = $2,
           status = 'failed',
           updated_at = now()
       WHERE id = $1`,
      [asset.id, result.blockers.join(" ")]
    )
  }

  return result
}

function preferredProvider(): VideoProvider {
  if (process.env.FAL_KEY) return "fal_kling"
  if (process.env.RUNPOD_API_KEY && process.env.RUNPOD_VIDEO_ENDPOINT_ID) return "runpod"
  if (process.env.GCP_VEO_ENDPOINT || process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT) return "gcp_veo"
  return "manual"
}

function validateVideoAsset(asset: VideoAssetRow): string[] {
  const blockers: string[] = []
  if (asset.status !== "approved") blockers.push("Video asset must be approved before generation.")
  if ((asset.compliance_warnings ?? []).some((warning) => warning.startsWith("blocker:"))) {
    blockers.push("Compliance blockers must be resolved before generation.")
  }
  if (!asset.prompt.trim()) blockers.push("Video prompt is required.")
  if (asset.duration_sec > Number(process.env.MAX_VIDEO_DURATION_SEC ?? 20)) {
    blockers.push("Video duration exceeds the configured max duration.")
  }
  return blockers
}

/**
 * fal.ai queue REST API — no SDK dependency (this route runs on the Edge runtime,
 * where the @fal-ai/client SDK's Buffer/Blob usage isn't safe to assume). Async
 * queue job: this only submits, video-render-poll.ts (pipeline, Node) polls
 * queue.fal.run for completion and fills in asset_url + logs cost.
 * Model slug/param names are Kling 2.6 Pro's documented fal.ai contract as of
 * 2026-09 — verify against fal.ai's live model page before relying on this at
 * volume, the same way every other "verify before trusting" integration in this
 * codebase is flagged.
 */
async function submitFalKling(asset: VideoAssetRow, payload: Record<string, unknown>): Promise<VideoGenerateResult> {
  const falKey = process.env.FAL_KEY
  if (!falKey) {
    return createManualHandoff(asset, payload, ["FAL_KEY missing. Set it to enable automatic reel rendering with native audio."])
  }
  if (!asset.source_image_url) {
    return createManualHandoff(asset, payload, ["No source image on this draft. Kling 2.6 Pro is image-to-video — attach a source image URL before rendering."])
  }

  const res = await fetch("https://queue.fal.run/fal-ai/kling-video/v2.6/pro/image-to-video", {
    method: "POST",
    headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: asset.prompt,
      image_url: asset.source_image_url,
      duration: String(asset.duration_sec),
      generate_audio: asset.has_native_audio !== false,
      cfg_scale: 0.5,
      negative_prompt: "shaky camera, blurry, text overlays, watermark, distorted faces",
    }),
  })
  const data = await res.json() as { request_id?: string; detail?: string }
  if (!res.ok || !data.request_id) {
    return { ok: false, mode: "live", provider: "fal_kling", blockers: [`fal.ai submit failed: ${data.detail ?? res.statusText}`], payload }
  }
  return { ok: true, mode: "live", provider: "fal_kling", externalJobId: data.request_id, payload }
}

async function submitRunPod(asset: VideoAssetRow, payload: Record<string, unknown>): Promise<VideoGenerateResult> {
  const apiKey = process.env.RUNPOD_API_KEY
  const endpointId = process.env.RUNPOD_VIDEO_ENDPOINT_ID
  if (!apiKey || !endpointId) {
    return createManualHandoff(asset, payload, ["RunPod credentials missing. Add RUNPOD_API_KEY and RUNPOD_VIDEO_ENDPOINT_ID."])
  }

  const res = await fetch(`https://api.runpod.ai/v2/${endpointId}/run`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: payload }),
  })
  const data = await res.json() as { id?: string; error?: string }
  if (!res.ok || !data.id) {
    return { ok: false, mode: "live", provider: "runpod", blockers: [`RunPod submit failed: ${data.error ?? res.statusText}`], payload }
  }
  return { ok: true, mode: "live", provider: "runpod", externalJobId: data.id, payload }
}

async function submitGcpVeo(asset: VideoAssetRow, payload: Record<string, unknown>): Promise<VideoGenerateResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_AI_STUDIO_API_KEY
  const endpoint = process.env.GCP_VEO_ENDPOINT
  if (!apiKey && !endpoint) {
    return createManualHandoff(asset, payload, ["GCP/Veo credentials missing. Add a managed Veo endpoint or Google AI key after access is approved."])
  }
  if (!endpoint) {
    return createManualHandoff(asset, payload, ["GCP/Veo access is not finalized. Handoff package is ready while endpoint approval is pending."])
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(apiKey ? { "x-goog-api-key": apiKey } : {}) },
    body: JSON.stringify(payload),
  })
  const data = await res.json() as { name?: string; id?: string; error?: { message?: string } }
  if (!res.ok) {
    return { ok: false, mode: "live", provider: "gcp_veo", blockers: [`GCP/Veo submit failed: ${data.error?.message ?? res.statusText}`], payload }
  }
  return { ok: true, mode: "live", provider: "gcp_veo", externalJobId: data.name ?? data.id ?? `gcp-veo:${asset.id}`, payload }
}

async function createHyperframesHandoff(asset: VideoAssetRow, payload: Record<string, unknown>): Promise<VideoGenerateResult> {
  return createManualHandoff(asset, payload, ["Hyperframes handoff ready: use script, scenes, and aspect ratio to render a branded HTML video template."])
}

async function createManualHandoff(
  asset: VideoAssetRow,
  payload: Record<string, unknown>,
  warnings: string[] = ["Manual video handoff package ready."]
): Promise<VideoGenerateResult> {
  return { ok: true, mode: "manual_handoff", provider: "manual", payload, warnings }
}

function buildPayload(asset: VideoAssetRow, provider: VideoProvider): Record<string, unknown> {
  return {
    provider,
    title: asset.title,
    prompt: asset.prompt,
    script: asset.script,
    scenes: asset.scenes,
    durationSec: asset.duration_sec,
    aspectRatio: asset.aspect_ratio,
    sourceImageUrl: asset.source_image_url,
    hasNativeAudio: asset.has_native_audio,
    negativePrompt: "text overlays, logos, watermark, medical claims, guaranteed results, distorted faces, blurry, shaky camera",
    output: {
      format: "mp4",
      quality: provider === "gcp_veo" ? "premium" : "standard",
    },
  }
}
