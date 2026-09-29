import { fal } from '@fal-ai/client'
import fs from 'fs'
import path from 'path'

const FAL_KEY = process.env.FAL_KEY!
const OUT_DIR = path.resolve('../templates/hvac/public')

const NEG = 'cartoon, illustration, 3D render, CGI, text overlay, watermark, blurry, low quality, faces close-up, distorted, oversaturated, unrealistic, extra limbs'

const SHOTS = [
  {
    file: 'service-1.jpg',
    prompt: 'HVAC technician in navy uniform repairing rooftop air conditioner unit, golden hour sunlight, residential suburb, professional equipment, photorealistic, 8K, no text, cinematic',
  },
  {
    file: 'service-2.jpg',
    prompt: 'Modern gas furnace and heating system in clean utility room, stainless steel components, professional installation, warm lighting, photorealistic, 8K, no text',
  },
  {
    file: 'service-3.jpg',
    prompt: 'Plumber working on copper pipes under kitchen sink, professional tools, bright bathroom tile, residential home, photorealistic, 8K, no text',
  },
  {
    file: 'service-4.jpg',
    prompt: 'HVAC service van arriving at residential home at night, emergency repair, porch light on, neighborhood street, dramatic lighting, photorealistic, 8K, no text',
  },
  {
    file: 'service-5.jpg',
    prompt: 'HVAC technician performing annual maintenance inspection on indoor air handler unit, clipboard checklist, professional uniform, clean utility room, photorealistic, 8K, no text',
  },
  {
    file: 'service-6.jpg',
    prompt: 'Large commercial HVAC rooftop unit installation on office building, city skyline background, industrial equipment, professional crew, aerial perspective, photorealistic, 8K, no text',
  },
]

async function generate(prompt: string, seed: number): Promise<Buffer | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await fal.subscribe('fal-ai/flux-pro/v1.1', {
        input: {
          prompt,
          negative_prompt: NEG,
          image_size: 'landscape_16_9',
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
          seed,
          safety_tolerance: '5',
        } as any,
      }) as any
      const url: string = result?.data?.images?.[0]?.url
      if (!url) continue
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
      if (!res.ok) continue
      return Buffer.from(await res.arrayBuffer())
    } catch (e) {
      console.error(`  attempt ${attempt + 1} failed:`, e)
      if (attempt === 1) return null
    }
  }
  return null
}

async function main() {
  if (!FAL_KEY) { console.error('FAL_KEY not set'); process.exit(1) }
  fal.config({ credentials: FAL_KEY })

  for (let i = 0; i < SHOTS.length; i++) {
    const shot = SHOTS[i]
    const outPath = path.join(OUT_DIR, shot.file)

    if (fs.existsSync(outPath)) {
      console.log(`  [${i+1}/6] ${shot.file} — already exists, skipping`)
      continue
    }

    console.log(`  [${i+1}/6] Generating ${shot.file}...`)
    const buf = await generate(shot.prompt, 42000 + i)
    if (buf) {
      fs.writeFileSync(outPath, buf)
      console.log(`  [${i+1}/6] ${shot.file} saved (${Math.round(buf.length/1024)}KB) ✓`)
    } else {
      console.error(`  [${i+1}/6] ${shot.file} FAILED`)
    }
  }

  console.log('\nDone. Update config.ts image paths to service-1.jpg .. service-6.jpg')
}

main()
