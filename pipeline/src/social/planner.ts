import type { AuditReport, Lead } from '../types.js'
import type { GrowthPlan } from '../growth/types.js'
import type { SocialAssetDraft, SocialPlatform } from './types.js'
import { defaultSocialPlatforms, platformConfig, supportsAsset } from './platforms.js'
import { checkCompliance, complianceSummary } from '../compliance/index.js'

export function createSocialAssetDrafts(params: {
  lead?: Lead
  audit?: AuditReport
  plan?: GrowthPlan
  workspaceId?: string
  platforms?: SocialPlatform[]
}): SocialAssetDraft[] {
  const platforms: SocialPlatform[] = params.platforms?.length ? params.platforms : defaultSocialPlatforms()
  return platforms.flatMap((platform) => {
    const drafts = [createImagePost({ ...params, platform })]
    if (supportsAsset(platform, 'carousel')) drafts.push(createCarousel({ ...params, platform }))
    return drafts
  })
}

function createImagePost(params: {
  lead?: Lead
  audit?: AuditReport
  plan?: GrowthPlan
  workspaceId?: string
  platform: SocialPlatform
}): SocialAssetDraft {
  const businessName = params.audit?.business_name ?? params.lead?.name ?? params.plan?.businessName ?? 'the business'
  const niche = params.audit?.niche ?? params.lead?.niche ?? 'local service'
  const city = params.audit?.city ?? params.lead?.city ?? 'your area'
  const score = params.audit?.overall_score

  const title = score ? `${businessName} growth score: ${score}/100` : `${businessName} local growth update`
  const baseCaption = score
    ? `${businessName} has a clear opportunity to turn more local searchers into booked appointments. The fastest wins are clearer calls to action, stronger local SEO, and a simpler booking path.`
    : `${businessName} is building a stronger local growth engine with a better website, faster follow-up, and clearer customer experience.`
  const caption = platformCaption(params.platform, baseCaption, { businessName, niche, city })

  const compliance = checkCompliance({
    channel: 'social',
    platform: params.platform,
    niche,
    text: caption,
    requiresApproval: true,
  })

  return {
    workspaceId: params.workspaceId,
    leadId: params.lead?.id,
    assetType: 'image_post',
    platform: params.platform,
    title: platformTitle(params.platform, title, businessName),
    caption,
    slides: [],
    imagePrompts: [
      `Professional branded social media image for ${businessName}, ${niche} in ${city}, clean premium local business aesthetic, no text, no logos, photorealistic`,
    ],
    hashtags: buildHashtags(niche, city, params.platform),
    status: 'needs_approval',
    complianceWarnings: compliance.issues.map((issue) => `${issue.severity}:${issue.code}:${issue.fix}`),
  }
}

function createCarousel(params: {
  lead?: Lead
  audit?: AuditReport
  plan?: GrowthPlan
  workspaceId?: string
  platform: SocialPlatform
}): SocialAssetDraft {
  const businessName = params.audit?.business_name ?? params.lead?.name ?? params.plan?.businessName ?? 'the business'
  const niche = params.audit?.niche ?? params.lead?.niche ?? 'local service'
  const city = params.audit?.city ?? params.lead?.city ?? 'your area'
  const recommendations = params.audit?.recommendations?.slice(0, 3) ?? []

  const slides = [
    {
      title: `${businessName}: 3 growth opportunities`,
      body: `Local customers are already searching for ${niche} services in ${city}. The next step is turning that demand into booked leads.`,
      visualPrompt: `Hero carousel cover for ${businessName}, ${niche}, premium local business design, no text`,
    },
    ...recommendations.map((rec) => ({
      title: rec.title,
      body: rec.description,
      visualPrompt: `Clean educational carousel slide visual for ${niche}: ${rec.title}, premium brand style, no text`,
    })),
    {
      title: 'Next step',
      body: 'Improve the website, answer every call, and keep publishing useful local content every month.',
      visualPrompt: `Optimistic local business growth visual for ${niche} in ${city}, clean professional style, no text`,
    },
  ]

  const baseCaption = `${businessName} can win more local customers by fixing the highest-impact parts of its growth system first: website conversion, follow-up, and local authority.`
  const caption = platformCaption(params.platform, baseCaption, { businessName, niche, city })
  const compliance = checkCompliance({
    channel: 'social',
    platform: params.platform,
    niche,
    text: [caption, ...slides.map((slide) => `${slide.title} ${slide.body}`)].join(' '),
    requiresApproval: true,
  })

  return {
    workspaceId: params.workspaceId,
    leadId: params.lead?.id,
    assetType: 'carousel',
    platform: params.platform,
    title: platformTitle(params.platform, `${businessName} growth carousel`, businessName),
    caption,
    slides,
    imagePrompts: slides.map((slide) => slide.visualPrompt),
    hashtags: buildHashtags(niche, city, params.platform),
    status: 'needs_approval',
    complianceWarnings: compliance.issues.map((issue) => `${issue.severity}:${issue.code}:${issue.fix}`),
  }
}

function platformTitle(platform: SocialPlatform, fallback: string, businessName: string): string {
  const label = platformConfig(platform).label
  if (platform === 'google_business_profile') return `${businessName} Google update`
  if (platform === 'pinterest') return `${businessName} service inspiration`
  if (platform === 'x') return `${businessName} local update`
  return `${fallback} - ${label}`
}

function platformCaption(
  platform: SocialPlatform,
  base: string,
  context: { businessName: string; niche: string; city: string }
): string {
  const { businessName, niche, city } = context
  const service = niche.replace(/-/g, ' ')
  if (platform === 'google_business_profile') {
    return `${businessName} is making it easier for local customers in ${city} to learn about services, ask questions, and book. ${base}`
  }
  if (platform === 'linkedin') {
    return `${businessName} is improving its local growth system: better search visibility, faster response, stronger follow-up, and clearer customer experience. ${base}`
  }
  if (platform === 'x') {
    return `${businessName} update: stronger local search, faster follow-up, and easier booking for ${service} customers in ${city}.`
  }
  if (platform === 'pinterest') {
    return `${businessName} local ${service} inspiration in ${city}: clear services, helpful answers, and a smoother path to book.`
  }
  if (platform === 'threads') {
    return `${businessName} is tightening the basics that help local customers choose faster: clearer services, quicker responses, and easier booking.`
  }
  if (platform === 'nextdoor') {
    return `${businessName} is making it easier for neighbors in ${city} to ask questions, compare services, and book local help.`
  }
  if (platform === 'tiktok' || platform === 'youtube') {
    return `${businessName} quick local update: better answers, easier booking, and a smoother customer experience for ${service} in ${city}.`
  }
  return base
}

function buildHashtags(niche: string, city: string, platform: SocialPlatform): string[] {
  if (platform === 'google_business_profile' || platform === 'nextdoor') return []
  if (platform === 'linkedin') return ['#LocalBusiness', '#SmallBusinessGrowth']
  if (platform === 'x') return []
  const cityTag = city.replace(/[^a-zA-Z0-9]/g, '')
  const nicheTag = niche.replace(/[^a-zA-Z0-9]/g, '')
  const tags = [`#${cityTag}`, `#${nicheTag}`, '#LocalBusiness', '#SmallBusinessGrowth', '#BookMoreClients']
  if (platform === 'pinterest') return tags.slice(0, 3)
  return tags
}
