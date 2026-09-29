import type { AuditReport, Lead } from '../types.js'
import type { GrowthPlan } from '../growth/types.js'
import type { AdCampaignDraft, AdsPlatform } from './types.js'
import { checkCompliance, complianceSummary } from '../compliance/index.js'

export function createAdCampaignDrafts(params: {
  lead?: Lead
  audit?: AuditReport
  plan?: GrowthPlan
  workspaceId?: string
  platforms?: AdsPlatform[]
  dailyBudget?: number
}): AdCampaignDraft[] {
  const platforms: AdsPlatform[] = params.platforms?.length
    ? params.platforms
    : ['google_ads', 'meta_ads', 'instagram_ads']

  return platforms.map((platform) => createCampaignDraft({ ...params, platform }))
}

function createCampaignDraft(params: {
  lead?: Lead
  audit?: AuditReport
  plan?: GrowthPlan
  workspaceId?: string
  platform: AdsPlatform
  dailyBudget?: number
}): AdCampaignDraft {
  const businessName = params.audit?.business_name ?? params.lead?.name ?? params.plan?.businessName ?? 'Business'
  const niche = params.audit?.niche ?? params.lead?.niche ?? 'local service'
  const city = params.audit?.city ?? params.lead?.city ?? 'local area'
  const state = params.lead?.state
  const landingPageUrl = params.plan?.websiteUrl ?? params.audit?.website_url ?? params.lead?.cloudflare_url ?? params.lead?.website
  const dailyBudget = params.dailyBudget ?? defaultBudget(params.platform)
  const serviceLabel = nicheLabel(niche)

  const searchKeywords = [
    `${serviceLabel} near me`,
    `${serviceLabel} ${city}`,
    `best ${serviceLabel} ${city}`,
    `${serviceLabel} appointment`,
    `${serviceLabel} consultation`,
  ]

  const negativeKeywords = ['free', 'jobs', 'salary', 'course', 'training', 'diy']
  const imagePrompt = `High-converting ad image for ${businessName}, ${serviceLabel} in ${city}, premium local business, happy customer outcome, clean bright realistic style, no text, no logo`

  if (params.platform === 'google_ads') {
    const creative = searchCreative(businessName, serviceLabel, city)
    const compliance = checkCompliance({
      channel: 'ad',
      platform: params.platform,
      niche,
      text: [...creative.headlines, ...creative.descriptions].join(' '),
      dailyBudget,
      requiresApproval: true,
    })
    return {
      workspaceId: params.workspaceId,
      leadId: params.lead?.id,
      platform: params.platform,
      status: 'needs_approval',
      campaignName: `${businessName} - Local Search Leads`,
      objective: 'calls',
      dailyBudget,
      geoTarget: { city, state, radiusMiles: 15 },
      audience: {
        description: `People searching for ${serviceLabel} services near ${city}.`,
        interests: [],
        exclusions: ['job seekers', 'students'],
      },
      keywords: searchKeywords,
      negativeKeywords,
      landingPageUrl,
      adGroups: [
        {
          name: `${serviceLabel} high intent`,
          keywords: searchKeywords,
          negativeKeywords,
          creatives: [creative],
        },
      ],
      creatives: [creative],
      approvalNotes: `Draft only. Requires account connection, conversion tracking, and explicit client approval before launch.\n${complianceSummary(compliance.issues)}`,
      complianceWarnings: compliance.issues.map((issue) => `${issue.severity}:${issue.code}`),
    }
  }

  const creative = socialCreative(businessName, serviceLabel, city, imagePrompt)
  const compliance = checkCompliance({
    channel: 'ad',
    platform: params.platform,
    niche,
    text: [creative.primaryText, ...creative.headlines, ...creative.descriptions].filter(Boolean).join(' '),
    dailyBudget,
    requiresApproval: true,
  })
  return {
    workspaceId: params.workspaceId,
    leadId: params.lead?.id,
    platform: params.platform,
    status: 'needs_approval',
    campaignName: `${businessName} - ${params.platform === 'instagram_ads' ? 'Instagram' : 'Meta'} Lead Campaign`,
    objective: 'lead_generation',
    dailyBudget,
    geoTarget: { city, state, radiusMiles: 15 },
    audience: {
      description: `Local adults likely to need ${serviceLabel} services around ${city}.`,
      interests: platformInterests(niche),
      ageRange: '25-64',
      exclusions: ['existing customers if customer list is connected'],
    },
    keywords: [],
    negativeKeywords: [],
    landingPageUrl,
    adGroups: [
      {
        name: `${serviceLabel} local lead audience`,
        keywords: [],
        negativeKeywords: [],
        creatives: [creative],
      },
    ],
    creatives: [creative],
    approvalNotes: `Draft only. Requires Meta Business connection, pixel/conversion setup, and explicit client approval before launch.\n${complianceSummary(compliance.issues)}`,
    complianceWarnings: compliance.issues.map((issue) => `${issue.severity}:${issue.code}`),
  }
}

function searchCreative(businessName: string, serviceLabel: string, city: string) {
  return {
    format: 'search_text' as const,
    headlines: [
      `${serviceLabel} in ${city}`,
      `Book ${businessName} Today`,
      `Trusted Local ${serviceLabel}`,
      `Call Now For Availability`,
    ],
    descriptions: [
      `Need ${serviceLabel}? Contact ${businessName} for fast local help and easy booking.`,
      `Local ${city} team. Clear pricing, quick response, and appointment-friendly service.`,
    ],
    callToAction: 'call_now' as const,
    imagePrompts: [],
  }
}

function socialCreative(businessName: string, serviceLabel: string, city: string, imagePrompt: string) {
  return {
    format: 'single_image' as const,
    headlines: [`Book ${serviceLabel} in ${city}`, `Local appointments available`],
    descriptions: [`${businessName} helps local customers get reliable ${serviceLabel} service without the back-and-forth.`],
    primaryText: `Looking for ${serviceLabel} in ${city}? ${businessName} makes it easy to ask questions, book, and get help fast.`,
    callToAction: 'book_now' as const,
    imagePrompts: [imagePrompt],
  }
}

function defaultBudget(platform: AdsPlatform): number {
  if (platform === 'google_ads') return 15
  return 10
}

function nicheLabel(niche: string): string {
  return niche.replace(/-/g, ' ')
}

function platformInterests(niche: string): string[] {
  const map: Record<string, string[]> = {
    medspa: ['skin care', 'beauty salon', 'cosmetic dermatology', 'wellness'],
    dentist: ['dental care', 'oral health', 'family health'],
    roofing: ['home improvement', 'home repair', 'real estate'],
    hvac: ['home improvement', 'home maintenance', 'energy efficiency'],
    plumbing: ['home improvement', 'home repair', 'homeowners'],
    lawfirm: ['legal advice', 'small business', 'local services'],
    restaurant: ['restaurants', 'food delivery', 'local dining'],
  }
  return map[niche] ?? ['local services', 'small business', 'home improvement']
}
