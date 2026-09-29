import pg from 'pg'
import type { VideoAssetDraft } from './types.js'

const { Pool } = pg

export async function saveVideoAssetDrafts(drafts: VideoAssetDraft[]): Promise<string[]> {
  if (!drafts.length) return []

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const ids: string[] = []
    for (const draft of drafts) {
      const { rows } = await pool.query(
        `INSERT INTO video_assets (
           workspace_id, lead_id, asset_type, platform, provider, status, title,
           script, scenes, prompt, duration_sec, aspect_ratio, source_image_url,
           has_native_audio, compliance_warnings
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING id`,
        [
          draft.workspaceId ?? null,
          draft.leadId ?? null,
          draft.assetType,
          draft.platform,
          draft.provider,
          draft.status,
          draft.title,
          draft.script,
          JSON.stringify(draft.scenes),
          draft.prompt,
          draft.durationSec,
          draft.aspectRatio,
          draft.sourceImageUrl ?? null,
          draft.hasNativeAudio ?? false,
          JSON.stringify(draft.complianceWarnings ?? []),
        ]
      )
      ids.push(rows[0].id as string)
    }
    return ids
  } finally {
    await pool.end()
  }
}
