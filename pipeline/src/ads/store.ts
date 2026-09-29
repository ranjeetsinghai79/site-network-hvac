import pg from 'pg'
import type { AdCampaignDraft } from './types.js'

const { Pool } = pg

export async function saveAdCampaignDrafts(drafts: AdCampaignDraft[]): Promise<string[]> {
  if (!drafts.length) return []

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const ids: string[] = []
    for (const draft of drafts) {
      const { rows } = await pool.query(
        `INSERT INTO ad_campaign_drafts (
           workspace_id, lead_id, platform, status, campaign_name, objective,
           daily_budget, geo_target, audience, keywords, negative_keywords,
          ad_groups, creatives, landing_page_url, approval_notes, compliance_warnings
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING id`,
        [
          draft.workspaceId ?? null,
          draft.leadId ?? null,
          draft.platform,
          draft.status,
          draft.campaignName,
          draft.objective,
          draft.dailyBudget,
          JSON.stringify(draft.geoTarget),
          JSON.stringify(draft.audience),
          draft.keywords,
          draft.negativeKeywords,
          JSON.stringify(draft.adGroups),
          JSON.stringify(draft.creatives),
          draft.landingPageUrl ?? null,
          draft.approvalNotes ?? null,
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
