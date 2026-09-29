import type { AuditReport, Lead } from '../types.js'
import type { GrowthPlan } from '../growth/types.js'
import { checkCompliance } from '../compliance/index.js'
import type { VideoAssetDraft, VideoPlatform } from './types.js'

const DEFAULT_PLATFORMS: VideoPlatform[] = ['instagram', 'facebook', 'tiktok', 'youtube', 'website']

export function createVideoAssetDrafts(params: {
  lead?: Lead
  audit?: AuditReport
  plan?: GrowthPlan
  workspaceId?: string
  platforms?: VideoPlatform[]
  /** 'reel' = cadence-driven social reel (needs a real source image, gets native audio, fal_kling provider).
   *  'ad' (default) = original phase-two ad-video draft, unchanged behavior. */
  mode?: 'ad' | 'reel'
  sourceImageUrl?: string
}): VideoAssetDraft[] {
  const platforms = params.platforms?.length ? params.platforms : DEFAULT_PLATFORMS
  return platforms.map((platform) => createShortVideoDraft({ ...params, platform }))
}

function createShortVideoDraft(params: {
  lead?: Lead
  audit?: AuditReport
  plan?: GrowthPlan
  workspaceId?: string
  platform: VideoPlatform
  mode?: 'ad' | 'reel'
  sourceImageUrl?: string
}): VideoAssetDraft {
  const isReel = params.mode === 'reel'
  const businessName = params.audit?.business_name ?? params.lead?.name ?? params.plan?.businessName ?? 'the business'
  const niche = params.audit?.niche ?? params.lead?.niche ?? 'local service'
  const city = params.audit?.city ?? params.lead?.city ?? 'your area'
  const service = niche.replace(/-/g, ' ')
  const aspectRatio = params.platform === 'youtube' || params.platform === 'website' ? '16:9' : '9:16'
  const durationSec = isReel ? 10 : params.platform === 'website' ? 8 : 15

  const scenes = [
    {
      title: 'Problem',
      narration: `Local customers in ${city} need fast answers before they choose a ${service} provider.`,
      visualPrompt: `Cinematic local ${service} customer moment in ${city}, realistic, clean, professional, no text, no logos`,
      durationSec: Math.round(durationSec * 0.3),
    },
    {
      title: 'Proof',
      narration: `${businessName} makes it easier to ask questions, compare services, and book.`,
      visualPrompt: `Professional branded ${service} business scene for ${businessName}, bright trustworthy local business, no text`,
      durationSec: Math.round(durationSec * 0.4),
    },
    {
      title: 'CTA',
      narration: `Contact ${businessName} today for local help in ${city}.`,
      visualPrompt: `Happy customer outcome for ${service} in ${city}, warm realistic social ad style, no text, no logo`,
      durationSec: durationSec - Math.round(durationSec * 0.7),
    },
  ]

  const script = scenes.map((scene) => scene.narration).join(' ')
  const prompt = [
    `Create a ${durationSec}-second ${aspectRatio} local business video for ${businessName}.`,
    `Industry: ${service}. City: ${city}.`,
    'Style: realistic, premium, clean, trust-building, ad-ready, no text overlays, no logos, no exaggerated claims.',
    `Scenes: ${scenes.map((scene) => `${scene.title}: ${scene.visualPrompt}`).join(' | ')}`,
  ].join(' ')

  const compliance = checkCompliance({
    channel: 'social',
    platform: params.platform === 'facebook' ? 'facebook' : params.platform === 'instagram' ? 'instagram' : params.platform === 'linkedin' ? 'linkedin' : undefined,
    niche,
    text: `${script} ${prompt}`,
    requiresApproval: true,
  })

  // fal_kling is image-to-video — no source image means no automatic render path yet,
  // stay on 'manual' so the admin video-generator doesn't try (and fail) a live render.
  const provider = isReel && params.sourceImageUrl ? 'fal_kling' : 'manual'

  return {
    workspaceId: params.workspaceId,
    leadId: params.lead?.id,
    assetType: isReel ? 'reel' : params.platform === 'website' ? 'hero_loop' : 'short_ad',
    platform: params.platform,
    provider,
    status: 'needs_approval',
    title: `${businessName} ${params.platform} ${isReel ? 'reel' : 'video'} draft`,
    script,
    scenes,
    prompt,
    durationSec,
    aspectRatio,
    sourceImageUrl: params.sourceImageUrl,
    hasNativeAudio: isReel,
    complianceWarnings: compliance.issues.map((issue) => `${issue.severity}:${issue.code}:${issue.fix}`),
  }
}
