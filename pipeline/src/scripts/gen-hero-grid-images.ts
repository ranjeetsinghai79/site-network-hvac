import { fal } from '@fal-ai/client'
import fs from 'fs'
import path from 'path'

const FAL_KEY = process.env.FAL_KEY!
fal.config({ credentials: FAL_KEY })

const NEG = 'cartoon, illustration, 3D render, CGI, text overlay, watermark, blurry, low quality, distorted, oversaturated, unrealistic, extra limbs, logo, icon, badge, stock photo watermark'

// hero grid images — default portrait_4_3, override per-shot with size field
const HERO_SHOTS: Record<string, { file: string; prompt: string; size?: 'portrait_4_3' | 'landscape_16_9' }[]> = {
  cleaning: [
    {
      file: 'hero-1.jpg',
      prompt: 'Professional female cleaner in teal uniform wiping gleaming white kitchen countertop, bright modern home interior, natural window light, warm welcoming atmosphere, photorealistic, 8K, no text',
    },
    {
      file: 'hero-2.jpg',
      prompt: 'Two professional cleaning staff in matching uniforms carrying supply caddy arriving at beautiful suburban home entrance, smiling confidently, sunny front porch, photorealistic, 8K, no text',
    },
    {
      file: 'hero-3.jpg',
      prompt: 'Sparkling clean modern bathroom after professional deep clean — white fluffy towels neatly folded, spotless mirror and chrome fixtures gleaming, soft natural light, photorealistic, 8K, no text',
    },
    {
      file: 'hero-4.jpg',
      prompt: 'Happy homeowner arms crossed smiling in immaculate freshly cleaned bright living room, sunlight streaming through spotless windows, warm cozy interior, satisfied expression, photorealistic, 8K, no text',
    },
  ],
  dentist: [
    {
      file: 'hero-1.jpg',
      prompt: 'Friendly female dentist in white coat smiling warmly in sleek modern dental office, professional and approachable, dental operatory background with equipment softly blurred, photorealistic, 8K, no text',
    },
    {
      file: 'hero-2.jpg',
      size: 'landscape_16_9',
      prompt: 'Gorgeous young woman with brilliant radiant confident smile, perfect white teeth fully visible, beautiful warm laugh, dental clinic softly blurred behind her, cinematic warm natural light, wide angle beauty editorial photography, photorealistic, 8K, no text, no overlay',
    },
    {
      file: 'hero-3.jpg',
      prompt: 'State-of-the-art dental operatory room — modern reclining dental chair, overhead LED examination light, digital X-ray equipment, clean white walls, professional and welcoming atmosphere, photorealistic, 8K, no text',
    },
    {
      file: 'hero-4.jpg',
      prompt: 'Male dentist and patient consultation — patient in dental chair smiling up at caring dentist who leans in attentively explaining treatment, warm clinical lighting, comfortable modern dental suite, photorealistic, 8K, no text',
    },
  ],
  medspa: [
    {
      file: 'hero-1.jpg',
      prompt: 'Elegant luxury medical spa reception lobby — white marble reception desk, warm gold pendant lighting, fresh white orchids in vase, minimalist modern aesthetic, tranquil upscale atmosphere, photorealistic, 8K, no text',
    },
    {
      file: 'hero-2.jpg',
      prompt: 'Beautiful woman in her 30s receiving luxurious facial treatment in premium medspa suite — eyes closed in relaxation, aesthetician in crisp white uniform gently applying serum, soft diffused studio lighting, photorealistic, 8K, no text',
    },
    {
      file: 'hero-3.jpg',
      prompt: 'Close-up portrait of radiant glowing flawless skin on elegant woman after luxury medspa facial, dewy complexion, natural beauty, soft creamy studio background, shallow depth of field, photorealistic, 8K, no text',
    },
    {
      file: 'hero-4.jpg',
      size: 'landscape_16_9',
      prompt: 'Beautiful elegant female aesthetician in pristine white clinical uniform smiling warmly and confidently at camera, luxury medspa treatment room with soft gold ambient lighting, blurred marble counters and premium skincare products in background, cinematic wide angle beauty photography, photorealistic, 8K, no text, no overlay',
    },
  ],
}

// Husky Air (HVAC, San Gabriel Valley CA) — dark navy + amber (#F97316) cinematic brand.
// hero-1.jpg = hero bg, service-1..6.jpg = service card bg images.
const HUSKY_AIR_SHOTS: { file: string; prompt: string; size: 'portrait_4_3' | 'landscape_16_9' }[] = [
  {
    file: 'hero-1.jpg',
    size: 'landscape_16_9',
    prompt: 'Cinematic wide photograph: an HVAC technician in dark navy workwear kneeling beside an outdoor air conditioning condenser unit at a Southern California residential home at dusk, warm amber rim light from a work lamp mixing with cool blue ambient twilight, shallow depth of field, moody desaturated color grade with orange accent highlights, photorealistic, 35mm lens, high detail, no text',
  },
  {
    file: 'service-1.jpg',
    size: 'portrait_4_3',
    prompt: 'Cinematic close-up photograph: gloved hands holding a digital refrigerant gauge manifold against an outdoor AC condenser coil, diagnostic technical detail, warm amber work-light glow against cool dark blue shadows, shallow depth of field, moody professional HVAC photography, photorealistic, no text',
  },
  {
    file: 'service-2.jpg',
    size: 'portrait_4_3',
    prompt: 'Cinematic photograph: an HVAC technician crouched beside an indoor residential furnace unit in a garage, inspecting it with a flashlight, warm amber lamp light cutting through cool dark blue shadow, moody atmospheric professional photography, photorealistic, no text, no visible face close-up',
  },
  {
    file: 'service-3.jpg',
    size: 'portrait_4_3',
    prompt: 'Cinematic photograph: a modern ductless mini-split air conditioning unit mounted high on an interior wall of a clean California home, soft directional afternoon light, dark moody interior with warm amber and cool blue tones, architectural detail photography, photorealistic, no text',
  },
  {
    file: 'service-4.jpg',
    size: 'portrait_4_3',
    prompt: 'Cinematic macro photograph: a technician\'s gloved hand holding a small round electrical AC run capacitor next to an open condenser electrical panel, dramatic close focus, warm amber spot light against deep blue-black shadow, moody technical detail shot, photorealistic, no text',
  },
  {
    file: 'service-5.jpg',
    size: 'portrait_4_3',
    prompt: 'Cinematic photograph: an HVAC technician holding a digital tablet while inspecting an outdoor AC unit, focused and professional, warm amber golden-hour side light against a cool dark blue background, moody atmospheric photography, photorealistic, no text, no visible face close-up',
  },
  {
    file: 'service-6.jpg',
    size: 'portrait_4_3',
    prompt: 'Cinematic photograph: a close view of a modern ceiling air vent register with faint visible airflow, soft warm amber ambient light against cool dark blue ceiling shadow, minimal architectural interior detail, moody professional photography, photorealistic, no text',
  },
]

// landscape_16_9 — remodeling project gallery images
const REMODELING_PROJECTS: { file: string; prompt: string }[] = [
  {
    file: 'project-1.jpg',
    prompt: 'Stunning fully remodeled modern kitchen — custom white shaker cabinetry, quartz waterfall island with bar seating, stainless steel appliances, under-cabinet lighting, wide angle interior photography, photorealistic, 8K, no text',
  },
  {
    file: 'project-2.jpg',
    prompt: 'Luxurious newly remodeled master bathroom — frameless glass walk-in shower with marble tile, freestanding soaking tub, dual floating vanity with vessel sinks, warm modern lighting, wide angle interior photography, photorealistic, 8K, no text',
  },
  {
    file: 'project-3.jpg',
    prompt: 'Bright open-plan home room addition with vaulted ceiling and skylights, hardwood floors, large windows overlooking garden, seamlessly integrated with existing home, wide angle interior photography, photorealistic, 8K, no text',
  },
]

// portrait_4_3 — lawfirm lead attorney professional headshot
const ATTORNEY_SHOT: { file: string; prompt: string } = {
  file: 'attorney.jpg',
  prompt: 'Professional headshot of confident male attorney in his 50s wearing dark navy suit and tie, silver hair, strong trustworthy face, bookshelf law library background slightly blurred, corporate professional photography, warm directional studio light, photorealistic, 8K, no text',
}

const HF_TOKEN = process.env.HUGGING_FACE_API_KEY || process.env.HUGGINGFACE_TOKEN

const DIMS: Record<'portrait_4_3' | 'landscape_16_9', { w: number; h: number }> = {
  portrait_4_3: { w: 1024, h: 1344 },
  landscape_16_9: { w: 1344, h: 768 },
}

// ─── HuggingFace Z-Image Turbo (free fallback — no billing required) ─────────
async function generateZImageTurbo(prompt: string, seed: number, token: string, w: number, h: number): Promise<Buffer | null> {
  try {
    const submitRes = await fetch(
      'https://mrfakename-z-image-turbo.hf.space/gradio_api/call/generate_image',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: [prompt, w, h, 4, seed, false] }),
        signal: AbortSignal.timeout(30_000),
      }
    )
    if (!submitRes.ok) return null
    const { event_id } = await submitRes.json() as any
    if (!event_id) return null
    const pollRes = await fetch(
      `https://mrfakename-z-image-turbo.hf.space/gradio_api/call/generate_image/${event_id}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(120_000) }
    )
    if (!pollRes.ok || !pollRes.body) return null
    const text = await pollRes.text()
    const dataLine = text.split('\n').find(l => l.startsWith('data:'))
    if (!dataLine) return null
    const payload = JSON.parse(dataLine.slice(5))
    const imgUrl: string = payload[0]?.url
    if (!imgUrl) return null
    const imgRes = await fetch(imgUrl, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) })
    if (!imgRes.ok) return null
    return Buffer.from(await imgRes.arrayBuffer())
  } catch {
    return null
  }
}

// ─── HuggingFace FLUX.1-schnell (free fallback — no billing required) ────────
async function generateFlux(prompt: string, seed: number, token: string, w: number, h: number): Promise<Buffer | null> {
  try {
    const res = await fetch(
      'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: prompt, parameters: { seed, num_inference_steps: 4, width: w, height: h } }),
        signal: AbortSignal.timeout(90_000),
      }
    )
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

async function generate(prompt: string, seed: number, size: 'portrait_4_3' | 'landscape_16_9'): Promise<Buffer | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await fal.subscribe('fal-ai/flux-pro/v1.1', {
        input: {
          prompt,
          negative_prompt: NEG,
          image_size: size,
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
    } catch (e: any) {
      console.error(`fal attempt ${attempt + 1} failed:`, e?.body?.detail ?? e?.message ?? e)
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  // Free fallback — no billing required
  if (HF_TOKEN) {
    const { w, h } = DIMS[size]
    console.log('  falling back to free HuggingFace models (Z-Image Turbo → FLUX.1-schnell)...')
    const buf = await generateZImageTurbo(prompt, seed, HF_TOKEN, w, h)
      ?? await generateFlux(prompt, seed, HF_TOKEN, w, h)
    if (buf) return buf
    console.error('  HuggingFace fallback also failed')
  }
  return null
}

// __dirname = pipeline/src/scripts → ../../.. = WebsiteDeveloper root
const ROOT = path.resolve(__dirname, '../../..')

async function main() {
  const nicheArg = process.argv[2]
  const fileArg  = process.argv[3] // optional: only generate this filename

  // --- hero grid images ---
  const heroNiches = nicheArg
    ? (HERO_SHOTS[nicheArg] ? [nicheArg] : [])
    : Object.keys(HERO_SHOTS)

  for (const niche of heroNiches) {
    const allShots = HERO_SHOTS[niche]
    const shots = fileArg ? allShots.filter(s => s.file === fileArg) : allShots
    if (!shots.length) continue
    const outDir = path.join(ROOT, 'templates', niche, 'public')
    fs.mkdirSync(outDir, { recursive: true })

    console.log(`\n=== ${niche} hero grid (${shots.length} images) ===`)
    for (const shot of shots) {
      const outPath = path.join(outDir, shot.file)
      console.log(`  generating ${shot.file} [${shot.size ?? 'portrait_4_3'}]...`)
      const buf = await generate(shot.prompt, Math.floor(Math.random() * 9999999), shot.size ?? 'portrait_4_3')
      if (buf) {
        fs.writeFileSync(outPath, buf)
        console.log(`  ✓ saved ${shot.file} (${(buf.length / 1024).toFixed(0)} KB) → ${outPath}`)
      } else {
        console.log(`  ✗ FAILED ${shot.file}`)
      }
    }
  }

  // --- remodeling project images ---
  if (!nicheArg || nicheArg === 'remodeling') {
    const outDir = path.join(ROOT, 'templates', 'remodeling', 'public')
    fs.mkdirSync(outDir, { recursive: true })
    console.log(`\n=== remodeling project images (${REMODELING_PROJECTS.length} images) ===`)
    for (const shot of REMODELING_PROJECTS) {
      const outPath = path.join(outDir, shot.file)
      console.log(`  generating ${shot.file}...`)
      const buf = await generate(shot.prompt, Math.floor(Math.random() * 9999999), 'landscape_16_9')
      if (buf) {
        fs.writeFileSync(outPath, buf)
        console.log(`  ✓ saved ${shot.file} (${(buf.length / 1024).toFixed(0)} KB) → ${outPath}`)
      } else {
        console.log(`  ✗ FAILED ${shot.file}`)
      }
    }
  }

  // --- lawfirm attorney headshot ---
  if (!nicheArg || nicheArg === 'lawfirm') {
    const outDir = path.join(ROOT, 'templates', 'lawfirm', 'public')
    fs.mkdirSync(outDir, { recursive: true })
    console.log(`\n=== lawfirm attorney headshot ===`)
    const outPath = path.join(outDir, ATTORNEY_SHOT.file)
    console.log(`  generating ${ATTORNEY_SHOT.file}...`)
    const buf = await generate(ATTORNEY_SHOT.prompt, Math.floor(Math.random() * 9999999), 'portrait_4_3')
    if (buf) {
      fs.writeFileSync(outPath, buf)
      console.log(`  ✓ saved ${ATTORNEY_SHOT.file} (${(buf.length / 1024).toFixed(0)} KB) → ${outPath}`)
    } else {
      console.log(`  ✗ FAILED ${ATTORNEY_SHOT.file}`)
    }
  }

  // --- Husky Air hero + service images ---
  if (!nicheArg || nicheArg === 'husky-air') {
    const outDir = path.join(ROOT, 'templates', 'husky-air', 'public')
    fs.mkdirSync(outDir, { recursive: true })
    const shots = fileArg ? HUSKY_AIR_SHOTS.filter(s => s.file === fileArg) : HUSKY_AIR_SHOTS
    console.log(`\n=== husky-air images (${shots.length} images) ===`)
    for (const shot of shots) {
      const outPath = path.join(outDir, shot.file)
      console.log(`  generating ${shot.file} [${shot.size}]...`)
      const buf = await generate(shot.prompt, Math.floor(Math.random() * 9999999), shot.size)
      if (buf) {
        fs.writeFileSync(outPath, buf)
        console.log(`  ✓ saved ${shot.file} (${(buf.length / 1024).toFixed(0)} KB) → ${outPath}`)
      } else {
        console.log(`  ✗ FAILED ${shot.file}`)
      }
    }
  }

  console.log('\nDone.')
}

main().catch(console.error)
