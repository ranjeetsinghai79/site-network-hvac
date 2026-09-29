import type { AdCampaignDraft } from './types.js'

export function exportAdDraftForPlatform(draft: AdCampaignDraft): Record<string, unknown> {
  if (draft.platform === 'google_ads') {
    return {
      campaign: {
        name: draft.campaignName,
        advertisingChannelType: 'SEARCH',
        status: 'PAUSED',
        budget: { amountMicros: Math.round(draft.dailyBudget * 1_000_000) },
        geoTarget: draft.geoTarget,
      },
      adGroups: draft.adGroups.map((group) => ({
        name: group.name,
        keywords: group.keywords,
        negativeKeywords: group.negativeKeywords,
        ads: group.creatives.map((creative) => ({
          headlines: creative.headlines,
          descriptions: creative.descriptions,
          finalUrl: draft.landingPageUrl,
          callToAction: creative.callToAction,
        })),
      })),
    }
  }

  return {
    campaign: {
      name: draft.campaignName,
      objective: draft.objective,
      status: 'PAUSED',
      dailyBudget: draft.dailyBudget,
      platform: draft.platform,
      geoTarget: draft.geoTarget,
      audience: draft.audience,
    },
    creatives: draft.creatives.map((creative) => ({
      format: creative.format,
      primaryText: creative.primaryText,
      headlines: creative.headlines,
      descriptions: creative.descriptions,
      callToAction: creative.callToAction,
      imagePrompts: creative.imagePrompts,
      destinationUrl: draft.landingPageUrl,
    })),
  }
}
