import { fal } from '@fal-ai/client'
import fs from 'fs'
import path from 'path'

const FAL_KEY = process.env.FAL_KEY!
const NICHES = ['salon', 'barbershop'] as const
type Niche = typeof NICHES[number]

const NEG = 'cartoon, illustration, 3D render, CGI, text overlay, watermark, blurry, low quality, distorted, oversaturated, unrealistic, extra limbs, logo, car, vehicle, automobile'

const SHOTS: Record<Niche, { file: string; prompt: string }[]> = {
  salon: [
    // Hero — modern upscale salon interior
    { file: 'hero-1.jpg', prompt: 'Upscale modern hair salon interior, bright white styling stations with large mirrors, warm LED lighting, fresh flowers, clean minimalist decor, no people, photorealistic, 8K, no text' },
    // 6 service images
    { file: 'service-1.jpg', prompt: 'Professional hairstylist giving precise haircut to woman with dark hair, modern salon mirror, soft studio lighting, clean and elegant, photorealistic, 8K, no text' },
    { file: 'service-2.jpg', prompt: 'Hair colorist painting balayage highlights on long brown hair with foil, professional salon setting, warm light, close-up artistic shot, photorealistic, 8K, no text' },
    { file: 'service-3.jpg', prompt: 'Professional salon blowout, stylist finishing beautiful shiny hair on woman, round brush, warm lighting, glamorous result, modern salon, photorealistic, 8K, no text' },
    { file: 'service-4.jpg', prompt: 'Keratin smoothing treatment being applied to woman\'s hair in upscale salon, stylist working with flat iron, before-after transformation feel, photorealistic, 8K, no text' },
    { file: 'service-5.jpg', prompt: 'Hair extension application process, stylist carefully attaching tape-in extensions to natural hair, close detail shot, salon setting, photorealistic, 8K, no text' },
    { file: 'service-6.jpg', prompt: 'Deep conditioning treatment, Olaplex bond treatment in bowl being applied to woman\'s hair, luxurious salon experience, warm tones, photorealistic, 8K, no text' },
  ],
  barbershop: [
    // Hero — classic modern barbershop interior
    { file: 'hero-1.jpg', prompt: 'Modern classic barbershop interior, vintage leather barber chairs, exposed brick wall, sharp clean aesthetic, warm Edison bulb lighting, no people, photorealistic, 8K, no text' },
    // 6 service images
    { file: 'service-1.jpg', prompt: 'Barber giving precise skin fade haircut to young man, professional clippers, clean barbershop setting, dramatic side lighting, photorealistic, 8K, no text' },
    { file: 'service-2.jpg', prompt: 'Barber shaping and trimming man\'s beard with straight razor, precise beard lineup, barbershop setting, professional close-up, photorealistic, 8K, no text' },
    { file: 'service-3.jpg', prompt: 'Man with fresh haircut and perfectly shaped beard sitting in barbershop chair looking confident, sharp clean result, photorealistic, 8K, no text' },
    { file: 'service-4.jpg', prompt: 'Barber patiently cutting young boy\'s hair, child smiling in barber chair, warm welcoming barbershop, family-friendly atmosphere, photorealistic, 8K, no text' },
    { file: 'service-5.jpg', prompt: 'Classic hot towel straight razor shave, barber applying hot towel to client\'s face, vintage barbershop experience, luxury grooming ritual, photorealistic, 8K, no text' },
    { file: 'service-6.jpg', prompt: 'Barber applying hair color to cover gray, precise application on male client, modern barbershop, natural-looking result process, photorealistic, 8K, no text' },
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
      if (fs.existsSync(outPath) && shot.file !== 'hero-1.jpg') {
        console.log(`  [${i+1}/${shots.length}] ${shot.file} — exists, skip`)
        continue
      }
      console.log(`  [${i+1}/${shots.length}] ${shot.file}...`)
      const seed = 63000 + NICHES.indexOf(niche) * 100 + i
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
