import { fal } from '@fal-ai/client'
import fs from 'fs'
import path from 'path'

const FAL_KEY = process.env.FAL_KEY!
const NICHES = ['cleaning', 'remodeling', 'auto-detailing'] as const
type Niche = typeof NICHES[number]

const NEG = 'cartoon, illustration, 3D render, CGI, text overlay, watermark, blurry, low quality, distorted, oversaturated, unrealistic, extra limbs, logo'

const SHOTS: Record<Niche, { file: string; prompt: string }[]> = {
  cleaning: [
    // 4 hero images for HeroPhotoGrid
    { file: 'hero-1.jpg', prompt: 'Professional house cleaner in branded uniform wiping gleaming kitchen countertop, eco-friendly spray bottle, natural window light, modern residential home, photorealistic, 8K, no text' },
    { file: 'hero-2.jpg', prompt: 'Spotless white bathroom after professional deep clean, gleaming porcelain fixtures, fresh folded towels, natural light, no people, photorealistic, 8K, no text' },
    { file: 'hero-3.jpg', prompt: 'Bright pristine living room with immaculate hardwood floors, sunlight streaming through clean windows, no people, freshly vacuumed rug, photorealistic, 8K, no text' },
    { file: 'hero-4.jpg', prompt: 'Professional cleaning team of two in matching uniforms arriving at modern suburban home with supplies, friendly smiles, sunny day, photorealistic, 8K, no text' },
    // 6 service images
    { file: 'service-1.jpg', prompt: 'Deep cleaning professional scrubbing modern kitchen, eco cleaning products, bright light, microfiber cloth on stainless appliances, photorealistic, 8K, no text' },
    { file: 'service-2.jpg', prompt: 'Recurring home cleaning service, cleaner organizing and tidying bright bedroom, fresh linens, professional uniform, photorealistic, 8K, no text' },
    { file: 'service-3.jpg', prompt: 'Move-out deep clean, empty apartment with gleaming floors and spotless kitchen, professional crew with industrial equipment, photorealistic, 8K, no text' },
    { file: 'service-4.jpg', prompt: 'Commercial office cleaning crew, team vacuuming modern open-plan workspace at night, professional equipment, photorealistic, 8K, no text' },
    { file: 'service-5.jpg', prompt: 'Post-construction cleaning, worker with HEPA vacuum removing dust from new home interior, bright bare space, photorealistic, 8K, no text' },
    { file: 'service-6.jpg', prompt: 'Airbnb turnover staging clean, fresh white linen being placed on bed, cozy bright guest bedroom, professional service, photorealistic, 8K, no text' },
  ],
  remodeling: [
    { file: 'service-1.jpg', prompt: 'Kitchen remodel in progress, custom white shaker cabinets being installed, contractor reviewing plans, quartz countertop, modern home, photorealistic, 8K, no text' },
    { file: 'service-2.jpg', prompt: 'Luxury bathroom renovation completed, large format marble tile walk-in shower, frameless glass enclosure, double vanity, bright natural light, photorealistic, 8K, no text' },
    { file: 'service-3.jpg', prompt: 'Residential room addition under construction, wood framing, blue sky, suburban California home, workers on site, photorealistic, 8K, no text' },
    { file: 'service-4.jpg', prompt: 'Hardwood flooring installation in bright living room, worker laying oak planks, professional tools, natural light, modern interior, photorealistic, 8K, no text' },
    { file: 'service-5.jpg', prompt: 'Custom cedar deck construction in suburban backyard, worker drilling boards, clear sky, partially finished deck, professional build, photorealistic, 8K, no text' },
    { file: 'service-6.jpg', prompt: 'Full home renovation complete transformation, open concept modern living room and kitchen, bright white walls, new flooring, professional finish, photorealistic, 8K, no text' },
  ],
  'auto-detailing': [
    { file: 'service-1.jpg', prompt: 'Detailer applying ceramic nano coating to glossy black luxury car, professional garage, dramatic studio spotlighting, photorealistic, 8K, no text' },
    { file: 'service-2.jpg', prompt: 'Machine polishing paint correction on deep red sports car, swirl marks being removed, professional garage, dramatic side lighting, photorealistic, 8K, no text' },
    { file: 'service-3.jpg', prompt: 'Full interior detail, professional cleaning leather seats of premium luxury vehicle, bright workshop, detail products, photorealistic, 8K, no text' },
    { file: 'service-4.jpg', prompt: 'PPF paint protection film being carefully applied to white SUV hood by professional installer, clean workshop, photorealistic, 8K, no text' },
    { file: 'service-5.jpg', prompt: 'Ceramic window tinting installation, dark film being applied to car window in professional auto shop, precision tools, photorealistic, 8K, no text' },
    { file: 'service-6.jpg', prompt: 'Perfectly detailed white BMW M3 parked outdoors, mirror-like paint reflection, clean professional result, golden hour light, photorealistic, 8K, no text' },
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
  const nichesArg = process.argv.slice(2)
  const targetNiches = nichesArg.length > 0
    ? nichesArg.filter(n => NICHES.includes(n as Niche)) as Niche[]
    : [...NICHES]

  if (!FAL_KEY) { console.error('FAL_KEY not set'); process.exit(1) }
  fal.config({ credentials: FAL_KEY })

  for (const niche of targetNiches) {
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
      const seed = 52000 + NICHES.indexOf(niche) * 100 + i
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
