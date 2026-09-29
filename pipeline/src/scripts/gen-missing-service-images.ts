import { fal } from '@fal-ai/client'
import fs from 'fs'
import path from 'path'

const FAL_KEY = process.env.FAL_KEY!
fal.config({ credentials: FAL_KEY })

const NEG = 'cartoon, illustration, 3D render, CGI, text overlay, watermark, blurry, low quality, distorted, oversaturated, unrealistic, extra limbs, logo, icon, badge'

const SHOTS: Record<string, { file: string; prompt: string }[]> = {
  dentist: [
    { file: 'service-1.jpg', prompt: 'Professional dentist performing routine checkup on adult patient in modern dental chair, bright clinical lighting, dental tools, clean white operatory, photorealistic, 8K, no text' },
    { file: 'service-2.jpg', prompt: 'Teeth whitening treatment in progress, patient in dental chair with whitening trays and UV light, modern dental clinic, bright smile result, photorealistic, 8K, no text' },
    { file: 'service-3.jpg', prompt: 'Dentist reviewing clear aligner Invisalign trays with patient in modern dental office, digital smile preview on screen, professional consultation, photorealistic, 8K, no text' },
    { file: 'service-4.jpg', prompt: 'Dental implant procedure in progress, close-up of implant being placed in modern surgical dental suite, professional equipment, clinical lighting, photorealistic, 8K, no text' },
    { file: 'service-5.jpg', prompt: 'Emergency dental patient being seen immediately in dental chair, caring dentist examining tooth, compassionate environment, modern clinic, photorealistic, 8K, no text' },
    { file: 'service-6.jpg', prompt: 'Cosmetic dental veneers transformation, beautiful natural smile result, patient admiring teeth in dental office mirror, warm professional lighting, photorealistic, 8K, no text' },
  ],
  medspa: [
    { file: 'service-1.jpg', prompt: 'Medical professional administering Botox injection to female patient forehead in modern luxury medspa treatment room, precise technique, clinical yet elegant setting, photorealistic, 8K, no text' },
    { file: 'service-2.jpg', prompt: 'Aesthetic practitioner injecting hyaluronic acid dermal filler to lip area, luxury medspa suite, soft clinical lighting, professional gloves, photorealistic, 8K, no text' },
    { file: 'service-3.jpg', prompt: 'Laser skin resurfacing treatment on female patient face, advanced laser device, protective goggles, luxury medspa room with soft ambient lighting, photorealistic, 8K, no text' },
    { file: 'service-4.jpg', prompt: 'Body contouring CoolSculpting treatment, applicator on patient abdomen, luxury treatment room, professional technician in scrubs, modern equipment, photorealistic, 8K, no text' },
    { file: 'service-5.jpg', prompt: 'Luxury IV therapy drip lounge, patient relaxing in premium recliner chair with IV infusion, elegant medspa setting, calming ambient light, photorealistic, 8K, no text' },
    { file: 'service-6.jpg', prompt: 'Microneedling skin rejuvenation treatment on female patient cheek, professional device, serene luxury medspa room, before and after glow effect visible, photorealistic, 8K, no text' },
  ],
  lawfirm: [
    { file: 'service-1.jpg', prompt: 'Professional attorney in sharp suit consulting with injured client in modern law office, serious and compassionate expression, legal documents on desk, photorealistic, 8K, no text' },
    { file: 'service-2.jpg', prompt: 'Car accident scene with attorney reviewing crash site evidence, professional in suit with clipboard, wrecked vehicles in background, natural daylight, photorealistic, 8K, no text' },
    { file: 'service-3.jpg', prompt: 'Workers compensation attorney meeting with injured construction worker client in law office, safety gear on table, legal documents, professional setting, photorealistic, 8K, no text' },
    { file: 'service-4.jpg', prompt: 'Family law attorney in mediation session, professional attorney at table with clients, calm modern conference room, natural light, respectful atmosphere, photorealistic, 8K, no text' },
    { file: 'service-5.jpg', prompt: 'Criminal defense attorney reviewing case files in law library, serious focused expression, law books on shelves, dramatic side lighting, professional setting, photorealistic, 8K, no text' },
    { file: 'service-6.jpg', prompt: 'Business attorneys reviewing contract documents at modern conference table, professional handshake across table, executive law office, city view window, photorealistic, 8K, no text' },
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
      const res = await fetch(url)
      if (!res.ok) continue
      return Buffer.from(await res.arrayBuffer())
    } catch (e) {
      console.error(`Attempt ${attempt + 1} failed:`, e)
      await new Promise(r => setTimeout(r, 2000))
    }
  }
  return null
}

async function main() {
  const nicheArg = process.argv[2]
  const niches = nicheArg ? [nicheArg] : Object.keys(SHOTS)

  for (const niche of niches) {
    const shots = SHOTS[niche]
    if (!shots) { console.log(`Unknown niche: ${niche}`); continue }

    const outDir = path.resolve(__dirname, `../../../../templates/${niche}/public`)
    fs.mkdirSync(outDir, { recursive: true })

    console.log(`\n=== ${niche} (${shots.length} images) ===`)
    for (const shot of shots) {
      const outPath = path.join(outDir, shot.file)
      if (fs.existsSync(outPath)) {
        console.log(`  skip ${shot.file} (exists)`)
        continue
      }
      console.log(`  generating ${shot.file}...`)
      const buf = await generate(shot.prompt, Math.floor(Math.random() * 9999999))
      if (buf) {
        fs.writeFileSync(outPath, buf)
        console.log(`  ✓ saved ${shot.file} (${(buf.length / 1024).toFixed(0)} KB)`)
      } else {
        console.log(`  ✗ FAILED ${shot.file}`)
      }
    }
  }
  console.log('\nDone.')
}

main().catch(console.error)
