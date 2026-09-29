export type VideoProvider = 'fal_kling' | 'runpod' | 'gcp_veo' | 'hyperframes' | 'manual'

export interface VideoProviderConfig {
  provider: VideoProvider
  label: string
  mode: 'ready' | 'manual' | 'blocked'
  useCase: string
  requirement: string
}

export function getVideoProviderReadiness(env: NodeJS.ProcessEnv = process.env): VideoProviderConfig[] {
  return [
    {
      provider: 'fal_kling',
      label: 'fal.ai / Kling 2.6 Pro',
      mode: env.FAL_KEY ? 'ready' : 'manual',
      useCase: 'Default reel provider — image-to-video with native audio in one call. ~$0.14/sec (~$1.40 for a 10s reel).',
      requirement: 'FAL_KEY set and a source image URL on the draft (Kling is image-to-video, not text-to-video).',
    },
    {
      provider: 'runpod',
      label: 'RunPod Serverless',
      mode: env.RUNPOD_API_KEY && env.RUNPOD_VIDEO_ENDPOINT_ID ? 'ready' : 'manual',
      useCase: 'Custom/open-source model rendering for phase-two video ads, reels, and product/service clips.',
      requirement: 'RUNPOD_API_KEY and RUNPOD_VIDEO_ENDPOINT_ID set after deploying the video worker image.',
    },
    {
      provider: 'gcp_veo',
      label: 'Google Veo / Vertex AI',
      mode: env.GOOGLE_CLOUD_PROJECT || env.VERTEX_PROJECT_ID ? 'manual' : 'blocked',
      useCase: 'Managed high-quality generation when brand safety, reliability, and Google ecosystem fit matter more than lowest GPU cost.',
      requirement: 'Google Cloud project, Vertex/Gemini video access, billing, and content policy review.',
    },
    {
      provider: 'hyperframes',
      label: 'Hyperframes',
      mode: 'manual',
      useCase: 'HTML-to-video explainers, motion templates, captions, and branded social clips.',
      requirement: 'Use after image/carousel engine is stable; requires template library and render worker.',
    },
    {
      provider: 'manual',
      label: 'Manual Handoff',
      mode: 'ready',
      useCase: 'Client-ready scripts, storyboards, shot lists, and image assets for manual publishing or editing.',
      requirement: 'Always available as a fallback.',
    },
  ]
}
