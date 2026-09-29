import { fal } from '@fal-ai/client'
import fs from 'fs'
import path from 'path'

const FAL_KEY = process.env.FAL_KEY!
const NICHES = ['roofing', 'junk-removal', 'daycare'] as const
type Niche = typeof NICHES[number]

const NEG = 'cartoon, illustration, 3D render, CGI, text overlay, watermark, blurry, low quality, distorted, oversaturated, unrealistic, extra limbs, logo'

const SHOTS: Record<Niche, { file: string; prompt: string }[]> = {
  roofing: [
    { file: 'service-1.jpg', prompt: 'Roofing crew installing architectural shingles on residential home roof, sunny California day, suburban neighborhood, professional equipment, photorealistic, 8K, no text' },
    { file: 'service-2.jpg', prompt: 'Storm damage repair — contractor inspecting hail-damaged roof with clipboard, residential home, assessment in progress, photorealistic, 8K, no text' },
    { file: 'service-3.jpg', prompt: 'Roofing contractor and insurance adjuster reviewing storm damage documentation on tablet, standing on roof, professional, photorealistic, 8K, no text' },
    { file: 'service-4.jpg', prompt: 'Emergency blue tarp being secured over damaged residential roof, worker with safety harness, protecting home from rain, photorealistic, 8K, no text' },
    { file: 'service-5.jpg', prompt: 'Seamless aluminum gutter installation on suburban home, professional crew working, ladder, bright exterior, photorealistic, 8K, no text' },
    { file: 'service-6.jpg', prompt: 'Contractor operating drone for roof inspection over residential home, tablet showing thermal imagery, professional assessment, photorealistic, 8K, no text' },
  ],
  'junk-removal': [
    { file: 'service-1.jpg', prompt: 'Two-person junk removal crew loading old sofa and furniture onto branded green truck in suburban driveway, professional uniforms, photorealistic, 8K, no text' },
    { file: 'service-2.jpg', prompt: 'Workers removing old refrigerator appliance from kitchen using hand truck, professional junk removal service, residential home, photorealistic, 8K, no text' },
    { file: 'service-3.jpg', prompt: 'Compassionate estate cleanout — crew carefully clearing home interior, furniture stacked neatly outside, respectful and efficient, photorealistic, 8K, no text' },
    { file: 'service-4.jpg', prompt: 'Construction debris cleanup — workers loading drywall scraps and lumber into junk removal truck on job site, hard hats, photorealistic, 8K, no text' },
    { file: 'service-5.jpg', prompt: 'Yard debris removal — crew clearing tree trimmings and brush piles into truck, backyard cleanup, sunny California day, photorealistic, 8K, no text' },
    { file: 'service-6.jpg', prompt: 'Junk removal van arriving at residential home, two-person crew ready with equipment, same-day service, suburban neighborhood, photorealistic, 8K, no text' },
  ],
  daycare: [
    { file: 'service-1.jpg', prompt: 'Bright daycare infant room, soft colorful toys, safe padded floor, warm natural light, crib area, no children, welcoming and clean environment, photorealistic, 8K, no text' },
    { file: 'service-2.jpg', prompt: 'Colorful toddler classroom, tiny chairs and low tables, learning materials, alphabet wall, cheerful educational daycare environment, photorealistic, 8K, no text' },
    { file: 'service-3.jpg', prompt: 'Pre-K classroom with reading corner, children\'s artwork on walls, bright natural light, organized learning stations, welcoming daycare, photorealistic, 8K, no text' },
    { file: 'service-4.jpg', prompt: 'After-school care room, homework tables with chairs, backpack cubbies, organized and welcoming, warm afternoon light, photorealistic, 8K, no text' },
    { file: 'service-5.jpg', prompt: 'Daycare summer camp outdoor play area, colorful safe playground equipment, California sunshine, clean and inviting, photorealistic, 8K, no text' },
    { file: 'service-6.jpg', prompt: 'Daycare drop-in care reception area, cheerful colorful decor, welcoming entrance desk, safe and clean, toys visible through glass, photorealistic, 8K, no text' },
  ],
}

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

  for (const niche of NICHES) {
    const outDir = path.resolve(`../templates/${niche}/public`)
    const shots = SHOTS[niche]
    console.log(`\n=== ${niche} (${shots.length} images) ===`)

    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i]
      const outPath = path.join(outDir, shot.file)
      if (fs.existsSync(outPath)) {
        console.log(`  [${i+1}/${shots.length}] ${shot.file} — exists, skip`)
        continue
      }
      console.log(`  [${i+1}/${shots.length}] ${shot.file}...`)
      const seed = 74000 + NICHES.indexOf(niche) * 100 + i
      const buf = await generate(shot.prompt, seed)
      if (buf) {
        fs.writeFileSync(outPath, buf)
        console.log(`  [${i+1}/${shots.length}] ${shot.file} saved (${Math.round(buf.length/1024)}KB) ✓`)
      } else {
        console.error(`  [${i+1}/${shots.length}] ${shot.file} FAILED`)
      }
    }
  }
  console.log('\nDone.')
}

main()
