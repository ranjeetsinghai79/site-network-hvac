export type AdsPlatform = 'google_ads' | 'meta_ads' | 'instagram_ads'

export type AdsObjective =
  | 'lead_generation'
  | 'calls'
  | 'appointments'
  | 'website_conversions'
  | 'local_awareness'

export interface GeoTarget {
  city?: string
  state?: string
  radiusMiles?: number
}

export interface AudienceSpec {
  description: string
  interests: string[]
  ageRange?: string
  exclusions: string[]
}

export interface AdCreativeDraft {
  format: 'search_text' | 'single_image' | 'carousel'
  headlines: string[]
  descriptions: string[]
  primaryText?: string
  callToAction: 'call_now' | 'book_now' | 'learn_more' | 'send_message'
  imagePrompts: string[]
}

export interface AdGroupDraft {
  name: string
  keywords: string[]
  negativeKeywords: string[]
  creatives: AdCreativeDraft[]
}

export interface AdCampaignDraft {
  workspaceId?: string
  leadId?: string
  platform: AdsPlatform
  status: 'draft' | 'needs_approval' | 'approved' | 'published' | 'paused' | 'rejected'
  campaignName: string
  objective: AdsObjective
  dailyBudget: number
  geoTarget: GeoTarget
  audience: AudienceSpec
  keywords: string[]
  negativeKeywords: string[]
  adGroups: AdGroupDraft[]
  creatives: AdCreativeDraft[]
  landingPageUrl?: string
  approvalNotes?: string
  complianceWarnings?: string[]
}
