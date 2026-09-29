/**
 * Generate 4 hero images for a template and save to public/
 * Usage: npx tsx src/scripts/gen-hero-images.ts hvac "Tracy, CA"
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import * as dotenv from 'dotenv'
dotenv.config()

const NICHE = process.argv[2] ?? 'hvac'
const LOCATION = process.argv[3] ?? 'Tracy, CA'
const OUT_DIR = join(process.cwd(), '..', 'templates', NICHE, 'public')

const SHOT_PROMPTS: Record<string, string[]> = {
  hvac: [
    `HVAC technician servicing rooftop AC unit, residential neighborhood ${LOCATION}, golden hour sunlight, cinematic, photorealistic, no text, no watermark`,
    `two HVAC technicians installing new air conditioning system, suburban home exterior ${LOCATION}, sunny day, cinematic, photorealistic, no text`,
    `clean modern home interior with HVAC vent, comfortable bright living room, warm light, photorealistic, no text`,
    `HVAC service van parked outside suburban home, branded vehicle, sunny neighborhood, cinematic, photorealistic, no text`,
  ],
  roofing: [
    `roofing crew installing new shingles on suburban home, blue sky, cinematic, photorealistic, no text`,
    `aerial view of residential roof replacement in progress, professional crew, cinematic, photorealistic`,
    `close-up quality roof shingles being installed, skilled worker, cinematic, photorealistic`,
    `roofing company truck parked outside home, professional crew, sunny day, cinematic, photorealistic`,
  ],
  default: [
    `professional service crew working on residential property, golden hour, cinematic, photorealistic, no text`,
    `two professionals working, suburban neighborhood, sunny day, cinematic, photorealistic, no text`,
    `inside modern home, bright clean interior, cinematic, photorealistic, no text`,
    `professional service van parked outside home, sunny day, cinematic, photorealistic, no text`,
  ],
}

function seedFromString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) % 2147483647
}

async function generateFlux(prompt: string, seed: number, token: string): Promise<Buffer | null> {
  console.log(`  → FLUX.1-schnell: "${prompt.slice(0, 60)}…"`)
  try {
    const res = await fetch(
      'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { seed, num_inference_steps: 4, width: 1344, height: 768 },
        }),
        signal: AbortSignal.timeout(120_000),
      }
    )
    if (!res.ok) {
      console.log(`  ✗ FLUX error: ${res.status} ${await res.text().catch(() => '')}`)
      return null
    }
    const buf = Buffer.from(await res.arrayBuffer())
    console.log(`  ✓ ${Math.round(buf.length / 1024)}KB`)
    return buf
  } catch (e: any) {
    console.log(`  ✗ FLUX exception: ${e.message}`)
    return null
  }
}

async function main() {
  const token = process.env.HUGGING_FACE_API_KEY
  if (!token) { console.error('HUGGING_FACE_API_KEY not set in pipeline/.env'); process.exit(1) }

  mkdirSync(OUT_DIR, { recursive: true })
  console.log(`Generating 4 hero images for ${NICHE} (${LOCATION})`)
  console.log(`Output: ${OUT_DIR}\n`)

  const shots = SHOT_PROMPTS[NICHE] ?? SHOT_PROMPTS.default

  for (let i = 0; i < 4; i++) {
    const key = `hero-${i + 1}`
    console.log(`[${i + 1}/4] ${key}`)
    const seed = seedFromString(`${NICHE}-${LOCATION}-${i}`)
    const buf = await generateFlux(shots[i], seed, token)

    if (buf) {
      const outPath = join(OUT_DIR, `${key}.jpg`)
      writeFileSync(outPath, buf)
      console.log(`  Saved → ${outPath}\n`)
    } else {
      console.log(`  Skipped — both models failed\n`)
    }
  }

  console.log('Done.')
}

main().catch(console.error)
