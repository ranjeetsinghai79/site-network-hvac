/**
 * Video Agent — Remotion-powered outreach video generator.
 * Produces a 15-second MP4 showing: business name → new website screenshot → CTA.
 * Attach video link to outreach email for higher conversion vs. static link.
 *
 * Requires: npm install @remotion/bundler @remotion/renderer remotion (in pipeline)
 * Video compositions live in: pipeline/src/video/
 */

import type { Lead, AgentResult } from '../types.js'
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface VideoResult {
  outputPath: string
  durationSec: number
  url?: string
}

export async function runVideoAgent(lead: Lead): Promise<AgentResult<VideoResult>> {
  if (!lead.vercel_url) {
    return { success: false, error: 'No deployed URL — run deployer first' }
  }
  if (!lead.brand_data) {
    return { success: false, error: 'No brand data — run brand-analyst first' }
  }

  console.log(`[VideoAgent] Generating outreach video for ${lead.name}`)

  const outputDir = path.join(__dirname, '../../output/videos')
  const outputPath = path.join(outputDir, `${lead.place_id}.mp4`)

  try {
    // Dynamic import — Remotion is optional dep, skip if not installed
    let bundle: any, renderMedia: any, getCompositions: any
    try {
      const bundler = await import('@remotion/bundler' as any)
      const renderer = await import('@remotion/renderer' as any)
      bundle = bundler.bundle
      renderMedia = renderer.renderMedia
      getCompositions = renderer.getCompositions
    } catch {
      console.warn('[VideoAgent] Remotion not installed. Run: npm install @remotion/bundler @remotion/renderer remotion')
      return { success: false, error: 'Remotion not installed' }
    }

    const { mkdirSync } = await import('fs')
    mkdirSync(outputDir, { recursive: true })

    const compositionPath = path.join(__dirname, '../video/index.tsx')
    if (!existsSync(compositionPath)) {
      return { success: false, error: `Video composition not found at ${compositionPath}` }
    }

    // Bundle the Remotion composition
    const bundled = await bundle(compositionPath)

    // Get available compositions
    const compositions = await getCompositions(bundled, {
      inputProps: buildInputProps(lead),
    })

    const composition = compositions.find((c: any) => c.id === 'OutreachVideo')
    if (!composition) {
      return { success: false, error: 'OutreachVideo composition not found in bundle' }
    }

    // Render video
    await renderMedia({
      composition,
      serveUrl: bundled,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: buildInputProps(lead),
    })

    console.log(`[VideoAgent] Video rendered → ${outputPath}`)

    // Optionally upload to Cloudinary / R2 / S3 if configured
    let videoUrl: string | undefined
    if (process.env.CLOUDINARY_URL) {
      videoUrl = await uploadToCloudinary(outputPath, lead.place_id)
    }

    return {
      success: true,
      data: { outputPath, durationSec: 15, url: videoUrl },
    }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

function buildInputProps(lead: Lead) {
  return {
    businessName: lead.name,
    businessNiche: lead.niche,
    websiteUrl: lead.vercel_url!,
    phone: lead.brand_data?.phone || '',
    city: lead.city,
    tagline: lead.brand_data?.tagline || `Professional ${lead.niche} services`,
    googleRating: lead.brand_data?.google_rating || '4.9',
  }
}

async function uploadToCloudinary(filePath: string, publicId: string): Promise<string | undefined> {
  try {
    const cloudinary = await import('cloudinary' as any)
    cloudinary.v2.config({ cloud_url: process.env.CLOUDINARY_URL })
    const result = await cloudinary.v2.uploader.upload(filePath, {
      resource_type: 'video',
      public_id: `outreach/${publicId}`,
      overwrite: true,
    })
    return result.secure_url
  } catch {
    return undefined
  }
}
