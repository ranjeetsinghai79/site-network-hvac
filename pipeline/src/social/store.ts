import pg from 'pg'
import type { SocialAssetDraft } from './types.js'

const { Pool } = pg

export async function saveSocialAssetDrafts(drafts: SocialAssetDraft[]): Promise<string[]> {
  if (!drafts.length) return []

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const ids: string[] = []
    for (const draft of drafts) {
      const { rows } = await pool.query(
        `INSERT INTO social_assets (
           workspace_id, lead_id, asset_type, platform, status, title,
           caption, slides, image_prompts, hashtags, compliance_warnings
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id`,
        [
          draft.workspaceId ?? null,
          draft.leadId ?? null,
          draft.assetType,
          draft.platform,
          draft.status,
          draft.title,
          draft.caption,
          JSON.stringify(draft.slides),
          JSON.stringify(draft.imagePrompts),
          draft.hashtags,
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
