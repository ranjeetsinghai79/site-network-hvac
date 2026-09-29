export type SocialAssetType = 'image_post' | 'carousel'
export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'google_business_profile'
  | 'threads'
  | 'x'
  | 'tiktok'
  | 'pinterest'
  | 'youtube'
  | 'nextdoor'

export interface SocialSlide {
  title: string
  body: string
  visualPrompt: string
}

export interface SocialAssetDraft {
  workspaceId?: string
  leadId?: string
  assetType: SocialAssetType
  platform: SocialPlatform
  title: string
  caption: string
  slides: SocialSlide[]
  imagePrompts: string[]
  hashtags: string[]
  status: 'draft' | 'needs_approval' | 'approved' | 'scheduled' | 'published'
  complianceWarnings?: string[]
}

export interface SocialPlatformConfig {
  platform: SocialPlatform
  label: string
  priority: number
  organicFit: 'high' | 'medium' | 'low'
  supportedAssets: SocialAssetType[]
  publishMode: 'api' | 'api_limited' | 'manual'
  notes: string
}
