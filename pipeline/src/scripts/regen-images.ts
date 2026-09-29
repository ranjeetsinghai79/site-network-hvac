/**
 * regen-images.ts — regenerate hero images for a specific lead and push to GitHub
 *
 * Usage:
 *   npx tsx src/scripts/regen-images.ts <name-fragment> [shot-index]
 *
 * Examples:
 *   npx tsx src/scripts/regen-images.ts "ocd cleaners"      # regenerate all 4
 *   npx tsx src/scripts/regen-images.ts "delta sierra"      # regenerate all 4
 *   npx tsx src/scripts/regen-images.ts "jazz heating" 0    # just hero-1
 */
import 'dotenv/config'
import { fal } from '@fal-ai/client'
import pg from 'pg'
import { uploadBinaryFile } from '../tools/github.js'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const NEG = 'text, watermark, logo, blurry, deformed, oversaturated, low quality, cartoon, illustration, painting, CGI, rendering, artificial, fake, ugly, poorly lit'

// Niche-specific prompts — all residential/interior-focused, no commercial/industrial
const PROMPTS: Record<string, (city: string) => [string,string,string,string]> = {
  cleaning: (city) => [
    `Happy professional house cleaner in uniform wiping kitchen counters, bright modern home interior, gleaming surfaces, natural window light, ${city}, photorealistic, 8K`,
    `Spotless luxury master bathroom after residential deep clean, sparkling white tiles, fresh fluffy towels, ${city}, photorealistic`,
    `Professional cleaning team dusting living room of beautiful home, vacuum cleaner, tidy organized space, ${city}, photorealistic`,
    `Gleaming hardwood floors after professional home cleaning, sunlight streaming through windows, elegant residential interior, ${city}, photorealistic, 8K`,
  ],
  hvac: (city) => [
    `Professional HVAC technician servicing residential air conditioning unit outside suburban home, golden hour light, uniform with company logo, ${city}, photorealistic, 8K`,
    `HVAC technician inspecting furnace in clean modern home utility room, professional equipment, organized workspace, ${city}, photorealistic`,
    `Clean modern home living room with HVAC vent, bright interior design, comfortable furniture, natural light, ${city}, photorealistic`,
    `HVAC service van parked outside suburban home, branded vehicle, tree-lined street, golden hour light, ${city}, photorealistic, no text`,
  ],
  roofing: (city) => [
    `Professional roofing crew installing new shingles on suburban home, clear blue sky, safety harnesses, ${city}, photorealistic, 8K`,
    `Aerial view of residential roof replacement in progress, skilled crew, bright day, ${city}, photorealistic`,
    `Close-up quality roof shingles installation, expert worker hands, dramatic angle, ${city}, photorealistic, 8K`,
    `Roofing company truck parked outside suburban home, professional crew, sunny neighborhood, ${city}, photorealistic`,
  ],
  dentist: (city) => [
    `Modern dental office reception area with plants, natural light, clean white interior, welcoming, ${city}, photorealistic`,
    `Bright dental treatment room, state of art equipment, calming blue and white tones, ${city}, photorealistic, 8K`,
    `Smiling patient in dental chair, gentle dentist, warm clinic lighting, professional, ${city}, photorealistic`,
    `Exterior of modern dental clinic building, professional signage, inviting entrance, ${city}, photorealistic`,
  ],
  medspa: (city) => [
    `Luxury medical spa treatment room, warm amber lighting, white marble surfaces, orchids, minimal modern design, ${city}, photorealistic, 8K`,
    `Beautiful spa reception area with water feature, soft lighting, premium aesthetic, ${city}, photorealistic`,
    `Facial treatment in progress, calm professional therapist, serene environment, ${city}, photorealistic`,
    `Luxury spa exterior at dusk, warm glowing windows, architectural landscaping, ${city}, photorealistic`,
  ],
}

function getPrompts(niche: string, city: string): [string,string,string,string] {
  const fn = PROMPTS[niche]
  if (fn) return fn(city)
  return [
    `Professional service crew at residential property, golden hour, ${city}, photorealistic, 8K`,
    `Two professionals working, suburban neighborhood, sunny day, ${city}, photorealistic`,
    `Modern home interior, bright clean living space, ${city}, photorealistic`,
    `Professional service van parked outside home, sunny day, ${city}, photorealistic`,
  ]
}

async function generateImage(prompt: string, seed: number): Promise<Buffer | null> {
  try {
    console.log(`  Generating: "${prompt.slice(0, 80)}..."`)
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
    if (!url) return null
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch (e: any) {
    console.error(`  fal.ai error: ${e.message}`)
    return null
  }
}

function repoNameFromUrl(githubUrl: string): string {
  return githubUrl.split('/').pop() ?? ''
}

const [,, nameFragment, shotArg] = process.argv
const shotIndex = shotArg !== undefined ? parseInt(shotArg) : null

if (!nameFragment) {
  console.error('Usage: npx tsx src/scripts/regen-images.ts <name-fragment> [shot-index 0-3]')
  process.exit(1)
}

void (async () => {
  const { rows } = await pool.query(
    `SELECT id, name, github_repo, cloudflare_url, niche, city FROM leads WHERE name ILIKE $1 LIMIT 1`,
    [`%${nameFragment}%`]
  )

  if (!rows[0]) {
    console.error(`No lead found matching "${nameFragment}"`)
    await pool.end()
    process.exit(1)
  }

  const lead = rows[0]
  console.log(`\n🎨 Regenerating images for: ${lead.name}`)
  console.log(`   Niche: ${lead.niche}  City: ${lead.city}`)
  console.log(`   Repo: ${lead.github_repo}`)

  if (!lead.github_repo) {
    console.error('No github_repo — build site first')
    await pool.end()
    process.exit(1)
  }

  const repoName = repoNameFromUrl(lead.github_repo)
  const repoOwner = lead.github_repo.split('/')[3] ?? 'ranjeetsinghai79'
  const city = lead.city ?? 'San Antonio'

  // Detect template dir (niche → templates/<niche>)
  const templateDir = `templates/${lead.niche}`

  const prompts = getPrompts(lead.niche, city)
  const keys = ['hero-1', 'hero-2', 'hero-3', 'hero-4'] as const
  const shots = shotIndex !== null ? [shotIndex] : [0, 1, 2, 3]

  console.log(`\n  Generating ${shots.length} image(s) via fal.ai Flux Pro 1.1...\n`)

  let ok = 0
  for (const i of shots) {
    const seed = Math.abs(lead.name.split('').reduce((h: number, c: string) => (h * 31 + c.charCodeAt(0)) | 0, 0x811c9dc5)) + i * 1000
    const buf = await generateImage(prompts[i], seed)
    if (!buf) { console.warn(`  ⚠️  shot ${i+1} failed`); continue }

    const path = `${templateDir}/public/${keys[i]}.jpg`
    const pushed = await uploadBinaryFile({
      owner: repoOwner,
      repo: repoName,
      path,
      buffer: buf,
      message: `fix: regen ${keys[i]} with correct ${lead.niche} imagery`,
    })

    if (pushed) {
      console.log(`  ✅ ${keys[i]}.jpg pushed (${Math.round(buf.length/1024)}KB)`)
      ok++
    } else {
      console.warn(`  ⚠️  ${keys[i]}.jpg push failed`)
    }
  }

  console.log(`\n✅ Done — ${ok}/${shots.length} images regenerated`)
  if (lead.cloudflare_url) {
    console.log(`   CF Pages rebuild triggered automatically via GitHub Action`)
    console.log(`   Live in ~3-4 min: ${lead.cloudflare_url}`)
  }

  await pool.end()
})()
