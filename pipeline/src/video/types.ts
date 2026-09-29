export type VideoAssetType = 'short_ad' | 'reel' | 'storyboard' | 'hero_loop'
export type VideoPlatform = 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'linkedin' | 'x' | 'website'
export type VideoProvider = 'fal_kling' | 'runpod' | 'gcp_veo' | 'hyperframes' | 'manual'

export interface VideoScene {
  title: string
  narration: string
  visualPrompt: string
  durationSec: number
}

export interface VideoAssetDraft {
  workspaceId?: string
  leadId?: string
  assetType: VideoAssetType
  platform: VideoPlatform
  provider: VideoProvider
  status: 'draft' | 'needs_approval' | 'approved' | 'rendering' | 'rendered' | 'published' | 'failed' | 'rejected'
  title: string
  script: string
  scenes: VideoScene[]
  prompt: string
  durationSec: number
  aspectRatio: '9:16' | '1:1' | '16:9'
  sourceImageUrl?: string
  hasNativeAudio?: boolean
  complianceWarnings?: string[]
}
