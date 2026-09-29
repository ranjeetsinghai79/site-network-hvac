/**
 * Hero Video Generator — stock video (free) → Kling 1.6 Pro (paid fallback)
 * Output: 5-second MP4 loop used as hero background video.
 *
 * Cost: $0.00 if stock video found, $0.098 if Kling fires
 * Requires: FAL_KEY for Kling fallback; PEXELS_API_KEY / PIXABAY_API_KEY for free stock
 */
import { fal } from '@fal-ai/client'
import type { Lead, AgentResult, NicheProfile } from '../types.js'
import { logCost } from '../tools/cost-tracker.js'
import { fetchStockVideo } from '../tools/stock-media.js'
import { seedFromName } from './image-generator.js'

export interface HeroVideoResult {
  buffer: Buffer
  url: string
}

// Per-niche motion prompts — subtle, loopable, cinematic
const VIDEO_PROMPTS: Record<string, string> = {
  hvac:             'Slow cinematic push-in toward suburban home on a sunny golden hour day, gentle breeze in trees, no camera shake',
  roofing:          'Slow aerial tilt-down over residential neighborhood rooftops, golden hour sunlight, subtle cloud movement',
  dentist:          'Slow gentle pan through bright modern dental office, soft bokeh, morning light through windows',
  medspa:           'Slow cinematic reveal of luxury spa interior, candlelight flicker, soft ambient light, tranquil atmosphere',
  lawfirm:          'Slow parallax push through prestigious law office with city view, golden hour light through blinds',
  remodeling:       'Slow cinematic pan across stunning newly remodeled kitchen, warm light, elegant surfaces',
  cleaning:         'Slow reveal of sparkling clean luxury interior, warm light gleaming on surfaces, fresh atmosphere',
  'junk-removal':   'Slow gentle pan over clean organized garage and home exterior, bright sunny day, satisfaction',
  daycare:          'Soft slow pan through warm colorful daycare classroom, sunlight streaming through windows, peaceful',
  'auto-detailing': 'Slow cinematic orbit around gleaming luxury sports car in studio, dramatic rim lighting, mirror-finish paint',
  restaurant:       'Slow cinematic pan through elegant restaurant at golden hour, warm candle light, soft bokeh on tables',
  'luxury-realestate': 'Ultra-slow cinematic drone fly-forward toward luxury Dubai glass tower at golden hour, city skyline below, warm amber sky, perfectly smooth motion, no shake',
  default:          'Slow cinematic push-in on professional property exterior, golden hour light, no camera shake',
}

export async function runHeroVideoAgent(
  lead: Lead,
  heroImageUrl: string,
  nicheProfile?: NicheProfile
): Promise<AgentResult<HeroVideoResult>> {
  const falKey = process.env.FAL_KEY
  if (!falKey) {
    return { success: false, error: 'FAL_KEY not set — skipping video generation' }
  }
  if (!heroImageUrl) {
    return { success: false, error: 'No hero image URL — run image generator first' }
  }

  // ── Priority 1: Free stock video (Pexels / Pixabay) ────────────────────────
  const stockVideo = await fetchStockVideo(lead.niche, seedFromName(lead.name, 99))
  if (stockVideo) {
    return { success: true, data: { buffer: stockVideo, url: 'stock' } }
  }

  // ── Priority 2: Kling 1.6 Pro via fal.ai (paid fallback) ───────────────────
  console.log(`[VideoGen] No stock video found — generating via Kling 1.6 Pro for ${lead.name}`)

  try {
    fal.config({ credentials: falKey })

    // Brain-generated prompt > static niche map > default
    const prompt = nicheProfile?.heroVideoPrompt
      ?? VIDEO_PROMPTS[lead.niche]
      ?? VIDEO_PROMPTS.default

    let lastError = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await fal.subscribe('fal-ai/kling-video/v1.6/pro/image-to-video', {
          input: {
            prompt,
            image_url: heroImageUrl,
            duration: '5',
            cfg_scale: 0.5,
            negative_prompt: 'shaky camera, blurry, fast motion, people, cars, text, watermark',
          } as any,
          logs: false,
          onQueueUpdate: (update) => {
            if (update.status === 'IN_PROGRESS') {
              console.log(`  [VideoGen] Kling processing...`)
            }
          },
        }) as any

        const videoUrl: string = result?.data?.video?.url
        if (!videoUrl) { lastError = 'Kling returned no video URL'; continue }

        console.log(`  [VideoGen] Downloading video from ${videoUrl}`)
        const res = await fetch(videoUrl, { signal: AbortSignal.timeout(120_000) })
        if (!res.ok) { lastError = `Video download failed: ${res.status}`; continue }

        const buffer = Buffer.from(await res.arrayBuffer())
        console.log(`  [VideoGen] Video ready: ${Math.round(buffer.length / 1024 / 1024 * 10) / 10}MB ✓`)

        await logCost({ service: 'kling_video', units: 1, leadId: lead.id, leadName: lead.name })

        return { success: true, data: { buffer, url: videoUrl } }
      } catch (e: any) {
        lastError = e.message
        if (attempt === 0) console.log(`  [VideoGen] Attempt 1 failed, retrying...`)
      }
    }
    return { success: false, error: lastError }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

/**
 * Upload hero-1 to fal.ai storage so Kling can access it via URL.
 * Returns the public CDN URL, or null on failure.
 */
export async function uploadImageToFal(imageBuffer: Buffer): Promise<string | null> {
  try {
    const blob = new Blob([imageBuffer.buffer as ArrayBuffer], { type: 'image/jpeg' })
    const file = new File([blob], 'hero-1.jpg', { type: 'image/jpeg' })
    const url = await fal.storage.upload(file)
    return url
  } catch {
    return null
  }
}
