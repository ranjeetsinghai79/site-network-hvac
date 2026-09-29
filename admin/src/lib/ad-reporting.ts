import { Pool } from "@/lib/pool"
import {
  getConnectionToken,
  refreshGoogleAccessToken,
  normalizeGoogleCustomerId,
  normalizeMetaAdAccountId,
  googleAdsCredentials,
} from "@/lib/ad-connections"

type Platform = "google_ads" | "meta_ads" | "instagram_ads"

interface PublishedDraft {
  id: string
  workspace_id: string | null
  platform: Platform
  external_id: string
}

interface DailyMetric {
  date: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
  raw?: Record<string, unknown>
}

export interface SyncResult {
  draftId: string
  platform: Platform
  ok: boolean
  daysSynced: number
  error?: string
}

const LEAD_ACTION_TYPES = new Set([
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.messaging_conversation_started_7d",
])

export async function syncAdPerformance(pool: Pool, opts: { draftId?: string } = {}): Promise<SyncResult[]> {
  const params: unknown[] = []
  let where = `status = 'published' AND external_id IS NOT NULL`
  if (opts.draftId) {
    params.push(opts.draftId)
    where += ` AND id = $${params.length}`
  }
  const { rows } = await pool.query<PublishedDraft>(
    `SELECT id, workspace_id, platform, external_id FROM ad_campaign_drafts WHERE ${where}`,
    params
  )

  const results: SyncResult[] = []
  for (const draft of rows) {
    try {
      const days = draft.platform === "google_ads"
        ? await fetchGoogleAdsDaily(pool, draft)
        : await fetchMetaAdsDaily(pool, draft)
      await upsertDailyMetrics(pool, draft.id, draft.platform, days)
      results.push({ draftId: draft.id, platform: draft.platform, ok: true, daysSynced: days.length })
    } catch (error) {
      results.push({
        draftId: draft.id,
        platform: draft.platform,
        ok: false,
        daysSynced: 0,
        error: error instanceof Error ? error.message : "Sync failed",
      })
    }
  }
  return results
}

async function fetchGoogleAdsDaily(pool: Pool, draft: PublishedDraft): Promise<DailyMetric[]> {
  const { developerToken, clientId, clientSecret } = googleAdsCredentials()
  const token = await getConnectionToken(pool, "google_ads", draft.workspace_id)
  const customerId = normalizeGoogleCustomerId(token.customerId || (!draft.workspace_id ? process.env.GOOGLE_ADS_CUSTOMER_ID : undefined))
  const loginCustomerId = normalizeGoogleCustomerId(token.loginCustomerId || (!draft.workspace_id ? process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID : undefined))
  const refreshToken = token.refreshToken || (!draft.workspace_id ? process.env.GOOGLE_ADS_REFRESH_TOKEN : undefined)

  if (!developerToken || !customerId || !clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Ads credentials incomplete — cannot sync performance.")
  }

  const campaignId = draft.external_id.split("/").pop()
  if (!campaignId) throw new Error("Could not parse Google Ads campaign ID from external_id.")

  const accessToken = await refreshGoogleAccessToken(clientId, clientSecret, refreshToken)
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  }
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId

  const query = `
    SELECT segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
    FROM campaign
    WHERE campaign.id = ${campaignId} AND segments.date DURING LAST_30_DAYS
    ORDER BY segments.date
  `.trim()

  const res = await fetch(`https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  })
  const data = await res.json() as {
    results?: Array<{
      segments: { date: string }
      metrics: { impressions?: string; clicks?: string; costMicros?: string; conversions?: number }
    }>
    error?: { message?: string }
  }
  if (!res.ok) throw new Error(data.error?.message ?? "Google Ads reporting query failed")

  return (data.results ?? []).map((row) => ({
    date: row.segments.date,
    impressions: Number(row.metrics.impressions ?? 0),
    clicks: Number(row.metrics.clicks ?? 0),
    spend: Number(row.metrics.costMicros ?? 0) / 1_000_000,
    conversions: Number(row.metrics.conversions ?? 0),
    raw: row,
  }))
}

async function fetchMetaAdsDaily(pool: Pool, draft: PublishedDraft): Promise<DailyMetric[]> {
  const provider = draft.platform === "instagram_ads" ? "instagram_ads" : "meta_ads"
  const token = await getConnectionToken(pool, provider, draft.workspace_id)
  const accessToken = token.accessToken || (!draft.workspace_id ? process.env.META_ACCESS_TOKEN : undefined)
  if (!accessToken) throw new Error("Meta access token is required to sync performance.")

  const fields = "impressions,clicks,spend,actions,date_start,date_stop"
  const url = `https://graph.facebook.com/v20.0/${draft.external_id}/insights?fields=${fields}&time_increment=1&date_preset=last_30d&level=campaign&access_token=${accessToken}`
  const res = await fetch(url)
  const data = await res.json() as {
    data?: Array<{
      impressions?: string
      clicks?: string
      spend?: string
      date_start: string
      actions?: Array<{ action_type: string; value: string }>
    }>
    error?: { message?: string }
  }
  if (!res.ok) throw new Error(data.error?.message ?? "Meta insights query failed")

  return (data.data ?? []).map((row) => {
    const conversions = (row.actions ?? [])
      .filter((action) => LEAD_ACTION_TYPES.has(action.action_type))
      .reduce((sum, action) => sum + Number(action.value ?? 0), 0)
    return {
      date: row.date_start,
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      spend: Number(row.spend ?? 0),
      conversions,
      raw: row,
    }
  })
}

async function upsertDailyMetrics(pool: Pool, draftId: string, platform: Platform, days: DailyMetric[]): Promise<void> {
  for (const day of days) {
    await pool.query(
      `INSERT INTO ad_performance_daily (draft_id, platform, date, impressions, clicks, spend, conversions, raw, fetched_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (draft_id, date) DO UPDATE SET
         impressions = EXCLUDED.impressions,
         clicks = EXCLUDED.clicks,
         spend = EXCLUDED.spend,
         conversions = EXCLUDED.conversions,
         raw = EXCLUDED.raw,
         fetched_at = now()`,
      [draftId, platform, day.date, day.impressions, day.clicks, day.spend, day.conversions, JSON.stringify(day.raw ?? {})]
    )
  }
}
