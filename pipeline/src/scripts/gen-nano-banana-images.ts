import { GoogleGenAI } from '@google/genai'
import fs from 'fs'
import path from 'path'

const MODEL = 'gemini-2.5-flash-image'

// Vertex (primary — has real billing/quota, per pipeline/src/tools/gemini.ts)
const VERTEX_PROJECT = process.env.VERTEX_PROJECT_ID ?? 'gen-lang-client-0362421597'
const LOCATION = process.env.GCP_REGION ?? 'us-central1'
if (process.env.VERTEX_SA_FILE) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.VERTEX_SA_FILE
}
const vertex = new GoogleGenAI({ vertexai: true, project: VERTEX_PROJECT, location: LOCATION })

// AI Studio (fallback — free tier, usually 0 quota for image models)
const AI_STUDIO_KEY = process.env.GOOGLE_AI_API_KEY
const studio = AI_STUDIO_KEY?.startsWith('AIza') ? new GoogleGenAI({ apiKey: AI_STUDIO_KEY }) : null

type AspectRatio = '16:9' | '4:3' | '1:1' | '9:16'

type Shot = { file: string; prompt: string; aspectRatio?: AspectRatio }

// Husky Air (HVAC, San Gabriel Valley CA) — dark navy + amber (#F97316) cinematic brand
const HUSKY_AIR_SHOTS: Shot[] = [
  {
    file: 'hero-1.jpg',
    aspectRatio: '16:9',
    prompt: 'Cinematic wide photograph: an HVAC technician in dark navy workwear kneeling beside an outdoor air conditioning condenser unit at a Southern California residential home at dusk, warm amber rim light from a work lamp mixing with cool blue ambient twilight, shallow depth of field, moody desaturated color grade with orange accent highlights, photorealistic, 35mm lens, high detail, no text, no watermark, no logo, no visible faces close-up',
  },
  {
    file: 'service-1.jpg',
    aspectRatio: '4:3',
    prompt: 'Cinematic close-up photograph: gloved hands holding a digital refrigerant gauge manifold against an outdoor AC condenser coil, diagnostic technical detail, warm amber work-light glow against cool dark blue shadows, shallow depth of field, moody professional HVAC photography, photorealistic, no text, no watermark, no logo',
  },
  {
    file: 'service-2.jpg',
    aspectRatio: '4:3',
    prompt: 'Cinematic photograph: an HVAC technician crouched beside an indoor residential furnace unit in a garage, inspecting it with a flashlight, warm amber lamp light cutting through cool dark blue shadow, moody atmospheric professional photography, photorealistic, no text, no watermark, no logo, no visible face close-up',
  },
  {
    file: 'service-3.jpg',
    aspectRatio: '4:3',
    prompt: 'Cinematic photograph: a modern ductless mini-split air conditioning unit mounted high on an interior wall of a clean California home, soft directional afternoon light, dark moody interior with warm amber and cool blue tones, architectural detail photography, photorealistic, no text, no watermark, no logo',
  },
  {
    file: 'service-4.jpg',
    aspectRatio: '4:3',
    prompt: 'Cinematic macro photograph: a technician\'s gloved hand holding a small round electrical AC run capacitor next to an open condenser electrical panel, dramatic close focus, warm amber spot light against deep blue-black shadow, moody technical detail shot, photorealistic, no text, no watermark, no logo',
  },
  {
    file: 'service-5.jpg',
    aspectRatio: '4:3',
    prompt: 'Cinematic photograph: an HVAC technician holding a digital tablet while inspecting an outdoor AC unit, focused and professional, warm amber golden-hour side light against a cool dark blue background, moody atmospheric photography, photorealistic, no text, no watermark, no logo, no visible face close-up',
  },
  {
    file: 'service-6.jpg',
    aspectRatio: '4:3',
    prompt: 'Cinematic photograph: a close view of a modern ceiling air vent register with faint visible airflow, soft warm amber ambient light against cool dark blue ceiling shadow, minimal architectural interior detail, moody professional photography, photorealistic, no text, no watermark, no logo',
  },
]

const NICHES: Record<string, Shot[]> = {
  'husky-air': HUSKY_AIR_SHOTS,
}

async function callModel(client: GoogleGenAI, prompt: string, aspectRatio: AspectRatio): Promise<Buffer | null> {
  const result: any = await client.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { imageConfig: { aspectRatio } },
  } as any)
  const parts = result?.candidates?.[0]?.content?.parts ?? []
  const imgPart = parts.find((p: any) => p.inlineData)
  return imgPart?.inlineData?.data ? Buffer.from(imgPart.inlineData.data, 'base64') : null
}

async function generate(prompt: string, aspectRatio: AspectRatio = '4:3'): Promise<Buffer | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const buf = await callModel(vertex, prompt, aspectRatio)
      if (buf) return buf
      console.error('  vertex: no image part in response, retrying...')
    } catch (e) {
      console.error(`  vertex attempt ${attempt + 1} failed:`, (e as Error).message?.slice(0, 200))
      await new Promise(r => setTimeout(r, 2000))
    }
  }
  if (studio) {
    try {
      const buf = await callModel(studio, prompt, aspectRatio)
      if (buf) return buf
      console.error('  studio fallback: no image part in response')
    } catch (e) {
      console.error('  studio fallback failed:', (e as Error).message?.slice(0, 200))
    }
  }
  return null
}

// __dirname = pipeline/src/scripts → ../../.. = WebsiteDeveloper root
const ROOT = path.resolve(__dirname, '../../..')

async function main() {
  const nicheArg = process.argv[2]
  const fileArg = process.argv[3]

  const niches = nicheArg ? (NICHES[nicheArg] ? [nicheArg] : []) : Object.keys(NICHES)
  if (!niches.length) {
    console.error(`Unknown niche "${nicheArg}". Available: ${Object.keys(NICHES).join(', ')}`)
    process.exit(1)
  }

  for (const niche of niches) {
    const allShots = NICHES[niche]
    const shots = fileArg ? allShots.filter(s => s.file === fileArg) : allShots
    if (!shots.length) continue
    const outDir = path.join(ROOT, 'templates', niche, 'public')
    fs.mkdirSync(outDir, { recursive: true })

    console.log(`\n=== ${niche} (${shots.length} images via ${MODEL}) ===`)
    for (const shot of shots) {
      const outPath = path.join(outDir, shot.file)
      console.log(`  generating ${shot.file} [${shot.aspectRatio ?? '4:3'}]...`)
      const buf = await generate(shot.prompt, shot.aspectRatio)
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
