import type { SocialAssetType, SocialPlatform, SocialPlatformConfig } from './types.js'

export const TOP_LOCAL_SOCIAL_PLATFORMS: SocialPlatformConfig[] = [
  {
    platform: 'google_business_profile',
    label: 'Google Business Profile',
    priority: 1,
    organicFit: 'high',
    supportedAssets: ['image_post'],
    publishMode: 'api',
    notes: 'Highest local intent. Use weekly updates, offers, service posts, review/reputation prompts, and photos.',
  },
  {
    platform: 'facebook',
    label: 'Facebook Page',
    priority: 2,
    organicFit: 'high',
    supportedAssets: ['image_post', 'carousel'],
    publishMode: 'api',
    notes: 'Strong local trust channel. Publish page posts, offers, proof, seasonal reminders, and before/after-safe visuals.',
  },
  {
    platform: 'instagram',
    label: 'Instagram',
    priority: 3,
    organicFit: 'high',
    supportedAssets: ['image_post', 'carousel'],
    publishMode: 'api',
    notes: 'Best for visual proof, carousel education, offers, and brand consistency.',
  },
  {
    platform: 'threads',
    label: 'Threads',
    priority: 4,
    organicFit: 'medium',
    supportedAssets: ['image_post', 'carousel'],
    publishMode: 'api',
    notes: 'Useful for repurposed local tips and lightweight thought-leadership posts through Meta.',
  },
  {
    platform: 'linkedin',
    label: 'LinkedIn',
    priority: 5,
    organicFit: 'medium',
    supportedAssets: ['image_post', 'carousel'],
    publishMode: 'api',
    notes: 'Useful for professional niches: attorneys, realtors, dentists, B2B services, financial advisors.',
  },
  {
    platform: 'tiktok',
    label: 'TikTok',
    priority: 6,
    organicFit: 'medium',
    supportedAssets: ['image_post', 'carousel'],
    publishMode: 'api_limited',
    notes: 'Photo posts are possible, but account authorization, domain verification, and creator UX rules apply.',
  },
  {
    platform: 'pinterest',
    label: 'Pinterest',
    priority: 7,
    organicFit: 'medium',
    supportedAssets: ['image_post'],
    publishMode: 'api',
    notes: 'Good for medspa, salon, remodeling, roofing, landscaping, restaurants, real estate, and visual services.',
  },
  {
    platform: 'x',
    label: 'X',
    priority: 8,
    organicFit: 'low',
    supportedAssets: ['image_post'],
    publishMode: 'api_limited',
    notes: 'Useful mostly for authority and announcements; API access is paid/usage-sensitive.',
  },
  {
    platform: 'youtube',
    label: 'YouTube',
    priority: 9,
    organicFit: 'medium',
    supportedAssets: ['image_post'],
    publishMode: 'api_limited',
    notes: 'Best as a video/Shorts channel. For image-only launch, keep as repurposing/manual or phase-two video.',
  },
  {
    platform: 'nextdoor',
    label: 'Nextdoor',
    priority: 10,
    organicFit: 'high',
    supportedAssets: ['image_post'],
    publishMode: 'manual',
    notes: 'Excellent local audience, but broad public posting APIs are not a reliable launch dependency.',
  },
]

export function defaultSocialPlatforms(): SocialPlatform[] {
  return TOP_LOCAL_SOCIAL_PLATFORMS.map((item) => item.platform)
}

export function platformConfig(platform: SocialPlatform): SocialPlatformConfig {
  return TOP_LOCAL_SOCIAL_PLATFORMS.find((item) => item.platform === platform) ?? {
    platform,
    label: platform,
    priority: 99,
    organicFit: 'low',
    supportedAssets: ['image_post'],
    publishMode: 'manual',
    notes: 'Unknown platform; keep manual until an adapter is added.',
  }
}

export function supportsAsset(platform: SocialPlatform, assetType: SocialAssetType): boolean {
  return platformConfig(platform).supportedAssets.includes(assetType)
}
