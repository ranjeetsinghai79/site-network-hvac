import { Pool } from "@/lib/pool"
import {
  getConnectionToken,
  refreshGoogleAccessToken,
  normalizeGoogleCustomerId,
  normalizeMetaAdAccountId,
  googleAdsCredentials,
} from "@/lib/ad-connections"

type Platform = "google_ads" | "meta_ads" | "instagram_ads"

interface DraftRow {
  id: string
  workspace_id: string | null
  platform: Platform
  status: string
  campaign_name: string
  objective: string
  daily_budget: string | number
  geo_target: { city?: string; state?: string; radiusMiles?: number }
  audience: { description?: string; interests?: string[]; ageRange?: string; exclusions?: string[] }
  keywords: string[]
  negative_keywords: string[]
  ad_groups: Array<{ name: string; keywords: string[]; negativeKeywords?: string[]; creatives: Creative[] }>
  creatives: Creative[]
  landing_page_url: string | null
  approval_notes: string | null
  compliance_warnings: string[] | null
  external_id: string | null
  published_at: string | null
}

interface Creative {
  headlines: string[]
  descriptions: string[]
  primaryText?: string
  callToAction?: string
}

export interface PublishResult {
  ok: boolean
  mode: "dry_run" | "live"
  platform: Platform
  externalId?: string
  blockers?: string[]
  warnings?: string[]
  payload?: Record<string, unknown>
}

export async function publishApprovedAdDraft(pool: Pool, id: string, opts: { dryRun?: boolean } = {}): Promise<PublishResult> {
  const { rows } = await pool.query<DraftRow>(
    `SELECT *
     FROM ad_campaign_drafts
     WHERE id = $1`,
    [id]
  )
  const draft = rows[0]
  if (!draft) {
    return { ok: false, mode: "dry_run", platform: "google_ads", blockers: ["Ad draft not found."] }
  }

  const blockers = validateDraftForPublish(draft)
  if (blockers.length) {
    return { ok: false, mode: "dry_run", platform: draft.platform, blockers }
  }

  const dryRun = opts.dryRun === true || process.env.ADS_PUBLISH_DRY_RUN === "true" || process.env.ADS_PUBLISH_LIVE !== "true"
  const payload = exportPayload(draft)

  if (dryRun) {
    return {
      ok: true,
      mode: "dry_run",
      platform: draft.platform,
      warnings: ["Dry run only. Set ADS_PUBLISH_LIVE=true after platform credentials, spend caps, and conversion tracking are verified."],
      payload,
    }
  }

  const result = draft.platform === "google_ads"
    ? await publishGooglePausedCampaign(pool, draft)
    : await publishMetaPausedCampaign(pool, draft)

  if (!result.ok || !result.externalId) return result

  await pool.query(
    `UPDATE ad_campaign_drafts
     SET status = 'published',
         external_id = $2,
         published_at = now(),
         updated_at = now()
     WHERE id = $1`,
    [draft.id, result.externalId]
  )

  return result
}

function validateDraftForPublish(draft: DraftRow): string[] {
  const blockers: string[] = []
  if (draft.status !== "approved") blockers.push("Draft must be approved before publishing.")
  if (draft.published_at || draft.external_id) blockers.push("Draft is already linked to an external campaign.")
  if (!draft.landing_page_url) blockers.push("Landing page URL is required before publishing ads.")
  if (Number(draft.daily_budget) <= 0) blockers.push("Daily budget must be greater than zero.")
  const compliance = draft.compliance_warnings ?? []
  if (compliance.some((warning) => warning.startsWith("blocker:"))) {
    blockers.push("Compliance blockers must be resolved before publishing.")
  }
  return blockers
}

async function publishGooglePausedCampaign(pool: Pool, draft: DraftRow): Promise<PublishResult> {
  const { developerToken, clientId, clientSecret } = googleAdsCredentials()
  const token = await getConnectionToken(pool, "google_ads", draft.workspace_id)
  const customerId = normalizeGoogleCustomerId(token.customerId || (!draft.workspace_id ? process.env.GOOGLE_ADS_CUSTOMER_ID : undefined))
  const loginCustomerId = normalizeGoogleCustomerId(token.loginCustomerId || (!draft.workspace_id ? process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID : undefined))
  const refreshToken = token.refreshToken || (!draft.workspace_id ? process.env.GOOGLE_ADS_REFRESH_TOKEN : undefined)

  const blockers = [
    !developerToken && "GOOGLE_ADS_DEVELOPER_TOKEN or GOOGLE_ADS_DEV_TOKEN is required.",
    !customerId && "GOOGLE_ADS_CUSTOMER_ID is required.",
    !clientId && "Google OAuth client ID is required.",
    !clientSecret && "Google OAuth client secret is required.",
    !refreshToken && "Google Ads refresh token is required. Reconnect Google Ads after adding the secret.",
  ].filter(Boolean) as string[]
  if (blockers.length) return { ok: false, mode: "live", platform: draft.platform, blockers }

  const accessToken = await refreshGoogleAccessToken(clientId!, clientSecret!, refreshToken!)
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken!,
    "Content-Type": "application/json",
  }
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId

  const budget = await googleMutate<{ results: Array<{ resourceName: string }> }>(
    customerId!,
    "campaignBudgets",
    headers,
    {
      operations: [{
        create: {
          name: `${draft.campaign_name} Budget ${Date.now()}`,
          amountMicros: Math.round(Number(draft.daily_budget) * 1_000_000),
          deliveryMethod: "STANDARD",
        },
      }],
    }
  )
  const budgetName = budget.results?.[0]?.resourceName
  if (!budgetName) return { ok: false, mode: "live", platform: draft.platform, blockers: ["Google Ads did not return a campaign budget resource."] }

  const campaign = await googleMutate<{ results: Array<{ resourceName: string }> }>(
    customerId!,
    "campaigns",
    headers,
    {
      operations: [{
        create: {
          name: `${draft.campaign_name} ${Date.now()}`,
          advertisingChannelType: "SEARCH",
          status: "PAUSED",
          manualCpc: {},
          campaignBudget: budgetName,
          networkSettings: {
            targetGoogleSearch: true,
            targetSearchNetwork: true,
            targetContentNetwork: false,
            targetPartnerSearchNetwork: false,
          },
        },
      }],
    }
  )
  const campaignName = campaign.results?.[0]?.resourceName
  if (!campaignName) return { ok: false, mode: "live", platform: draft.platform, blockers: ["Google Ads did not return a campaign resource."] }

  const firstGroup = draft.ad_groups[0]
  if (firstGroup) {
    const adGroup = await googleMutate<{ results: Array<{ resourceName: string }> }>(
      customerId!,
      "adGroups",
      headers,
      {
        operations: [{
          create: {
            name: firstGroup.name,
            campaign: campaignName,
            status: "PAUSED",
            type: "SEARCH_STANDARD",
            cpcBidMicros: 2_000_000,
          },
        }],
      }
    )
    const adGroupName = adGroup.results?.[0]?.resourceName
    if (adGroupName) {
      const keywordOperations = (firstGroup.keywords ?? draft.keywords).slice(0, 20).map((keyword) => ({
        create: {
          adGroup: adGroupName,
          status: "PAUSED",
          keyword: { text: keyword, matchType: "PHRASE" },
        },
      }))
      if (keywordOperations.length) await googleMutate(customerId!, "adGroupCriteria", headers, { operations: keywordOperations })

      const creative = firstGroup.creatives?.[0] ?? draft.creatives[0]
      if (creative) {
        await googleMutate(customerId!, "adGroupAds", headers, {
          operations: [{
            create: {
              adGroup: adGroupName,
              status: "PAUSED",
              ad: {
                finalUrls: [draft.landing_page_url],
                responsiveSearchAd: {
                  headlines: creative.headlines.slice(0, 15).map((text) => ({ text })),
                  descriptions: creative.descriptions.slice(0, 4).map((text) => ({ text })),
                },
              },
            },
          }],
        })
      }
    }
  }

  return { ok: true, mode: "live", platform: draft.platform, externalId: campaignName }
}

const META_API_VERSION = "v20.0"

const META_CTA_MAP: Record<string, string> = {
  "call now": "CALL_NOW",
  "call": "CALL_NOW",
  "get quote": "GET_QUOTE",
  "request quote": "GET_QUOTE",
  "sign up": "SIGN_UP",
  "contact us": "CONTACT_US",
  "book now": "BOOK_TRAVEL",
  "get directions": "GET_DIRECTIONS",
  "message": "MESSAGE_PAGE",
  "learn more": "LEARN_MORE",
}

function metaCallToAction(label?: string): string {
  if (!label) return "LEARN_MORE"
  return META_CTA_MAP[label.trim().toLowerCase()] ?? "LEARN_MORE"
}

async function metaCall<T = Record<string, unknown>>(
  path: string,
  accessToken: string,
  params: Record<string, string>
): Promise<T> {
  const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${path}`, {
    method: "POST",
    body: new URLSearchParams({ access_token: accessToken, ...params }),
  })
  const data = await res.json() as T & { error?: { message?: string } }
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Meta ${path} failed`)
  }
  return data
}

async function publishMetaPausedCampaign(pool: Pool, draft: DraftRow): Promise<PublishResult> {
  const provider = draft.platform === "instagram_ads" ? "instagram_ads" : "meta_ads"
  const token = await getConnectionToken(pool, provider, draft.workspace_id)
  const accessToken = token.accessToken || (!draft.workspace_id ? process.env.META_ACCESS_TOKEN : undefined)
  const adAccountId = normalizeMetaAdAccountId(token.adAccountId || (!draft.workspace_id ? process.env.META_AD_ACCOUNT_ID : undefined))
  const pageId = token.pageId || (!draft.workspace_id ? process.env.META_PAGE_ID : undefined)
  const pixelId = token.pixelId || (!draft.workspace_id ? process.env.META_PIXEL_ID : undefined)
  const blockers = [
    !accessToken && "Meta access token is required. Connect Meta Ads or set META_ACCESS_TOKEN.",
    !adAccountId && "META_AD_ACCOUNT_ID is required.",
    !pageId && "META_PAGE_ID is required — every Meta ad creative must attach to a Facebook Page.",
  ].filter(Boolean) as string[]
  if (blockers.length) return { ok: false, mode: "live", platform: draft.platform, blockers }

  const warnings: string[] = []

  let campaignId: string
  try {
    const campaign = await metaCall<{ id: string }>(`${adAccountId}/campaigns`, accessToken!, {
      name: `${draft.campaign_name} ${Date.now()}`,
      objective: "OUTCOME_LEADS",
      status: "PAUSED",
      special_ad_categories: "[]",
    })
    campaignId = campaign.id
  } catch (err) {
    return { ok: false, mode: "live", platform: draft.platform, blockers: [`Meta campaign creation failed: ${(err as Error).message}`] }
  }

  // Ad set — budget lives here (account-based budgeting, not campaign-level CBO).
  const geo = draft.geo_target || {}
  const ageMatch = /(\d{2}).{0,3}(\d{2})/.exec(draft.audience?.ageRange ?? "")
  const optimizationGoal = pixelId ? "OFFSITE_CONVERSIONS" : "LINK_CLICKS"
  if (!pixelId) warnings.push("No META_PIXEL_ID configured — ad set optimizes for link clicks, not leads. Add a Meta Pixel for conversion-optimized delivery.")

  let adSetId: string
  try {
    const adSetParams: Record<string, string> = {
      name: `${draft.campaign_name} — Ad Set`,
      campaign_id: campaignId,
      status: "PAUSED",
      daily_budget: String(Math.round(Number(draft.daily_budget) * 100)), // Meta budgets are in account-currency cents
      billing_event: "IMPRESSIONS",
      optimization_goal: optimizationGoal,
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: JSON.stringify({
        geo_locations: geo.city
          ? { cities: [{ name: geo.city, region: geo.state, radius: geo.radiusMiles ?? 20, distance_unit: "mile" }], location_types: ["home", "recent"] }
          : { countries: ["US"] },
        age_min: ageMatch ? Number(ageMatch[1]) : 25,
        age_max: ageMatch ? Number(ageMatch[2]) : 65,
      }),
    }
    if (pixelId) adSetParams.promoted_object = JSON.stringify({ pixel_id: pixelId, custom_event_type: "LEAD" })
    if (geo.city && !geo.state) warnings.push("Geo targeting used city name without a resolved location key — Meta may reject an ambiguous city; verify in Ads Manager before activating.")

    const adSet = await metaCall<{ id: string }>(`${adAccountId}/adsets`, accessToken!, adSetParams)
    adSetId = adSet.id
  } catch (err) {
    return {
      ok: false, mode: "live", platform: draft.platform,
      blockers: [`Meta ad set creation failed: ${(err as Error).message}`],
      warnings: [`Campaign ${campaignId} was created (paused) but has no ad set — remove it manually or retry.`],
    }
  }

  // Creative + ad — first creative only, matches the Google Ads path's "first ad group" behavior above.
  const creative = draft.creatives[0] ?? draft.ad_groups[0]?.creatives?.[0]
  if (!creative) {
    return {
      ok: true, mode: "live", platform: draft.platform, externalId: campaignId,
      warnings: [...warnings, `Campaign ${campaignId} and ad set ${adSetId} created (paused), but the draft has no creative — add one and create the ad manually in Ads Manager.`],
    }
  }

  try {
    const objectStorySpec = JSON.stringify({
      page_id: pageId,
      link_data: {
        message: creative.primaryText ?? creative.descriptions?.[0] ?? "",
        link: draft.landing_page_url,
        name: creative.headlines?.[0] ?? draft.campaign_name,
        description: creative.descriptions?.[0] ?? "",
        call_to_action: { type: metaCallToAction(creative.callToAction), value: { link: draft.landing_page_url } },
      },
    })
    const adCreative = await metaCall<{ id: string }>(`${adAccountId}/adcreatives`, accessToken!, {
      name: `${draft.campaign_name} — Creative`,
      object_story_spec: objectStorySpec,
    })

    await metaCall(`${adAccountId}/ads`, accessToken!, {
      name: `${draft.campaign_name} — Ad`,
      adset_id: adSetId,
      status: "PAUSED",
      creative: JSON.stringify({ creative_id: adCreative.id }),
    })
  } catch (err) {
    return {
      ok: true, mode: "live", platform: draft.platform, externalId: campaignId,
      warnings: [...warnings, `Campaign and ad set created (paused), but creative/ad creation failed: ${(err as Error).message} — finish the ad manually in Ads Manager.`],
    }
  }

  return {
    ok: true,
    mode: "live",
    platform: draft.platform,
    externalId: campaignId,
    warnings: [...warnings, "Created a full paused Meta campaign (campaign, ad set, creative, ad). Review targeting and budget in Ads Manager before activating."],
  }
}

async function googleMutate<T = Record<string, unknown>>(
  customerId: string,
  resource: string,
  headers: Record<string, string>,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`https://googleads.googleapis.com/v20/customers/${customerId}/${resource}:mutate`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  const data = await res.json() as T & { error?: { message?: string; details?: unknown[] } }
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Google Ads ${resource}:mutate failed`)
  }
  return data
}

function exportPayload(draft: DraftRow): Record<string, unknown> {
  if (draft.platform === "google_ads") {
    return {
      campaign: {
        name: draft.campaign_name,
        advertisingChannelType: "SEARCH",
        status: "PAUSED",
        budget: { amountMicros: Math.round(Number(draft.daily_budget) * 1_000_000) },
        geoTarget: draft.geo_target,
      },
      adGroups: draft.ad_groups.map((group) => ({
        name: group.name,
        keywords: group.keywords,
        ads: group.creatives.map((creative) => ({
          headlines: creative.headlines,
          descriptions: creative.descriptions,
          finalUrl: draft.landing_page_url,
        })),
      })),
    }
  }

  return {
    campaign: {
      name: draft.campaign_name,
      objective: draft.objective,
      status: "PAUSED",
      dailyBudget: Number(draft.daily_budget),
      geoTarget: draft.geo_target,
      audience: draft.audience,
    },
    creatives: draft.creatives.map((creative) => ({
      primaryText: creative.primaryText,
      headlines: creative.headlines,
      descriptions: creative.descriptions,
      callToAction: creative.callToAction,
      destinationUrl: draft.landing_page_url,
    })),
  }
}
