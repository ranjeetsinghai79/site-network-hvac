import fs                                from 'fs'
import { fal }                           from '@fal-ai/client'
import type { Lead, AgentResult, NicheProfile } from '../types.js'
import { logCost }                        from '../tools/cost-tracker.js'
import { fetchStockImages }               from '../tools/stock-media.js'
import { getVertexToken }                 from '../tools/gcp-auth.js'
import { getHeroGridImages }              from '../tools/niche-image-library.js'

// Deterministic seed: same business always gets same image for same shot
export function seedFromName(name: string, shotIndex: number): number {
  const str = `${name}::shot${shotIndex}`
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) % 2147483647
}

export interface HeroImages {
  'hero-1': Buffer | null
  'hero-2': Buffer | null
  'hero-3': Buffer | null
  'hero-4': Buffer | null
}

const NEG = 'cartoon, illustration, 3D render, CGI, text overlay, watermark, blurry, low quality, people faces close up, distorted, oversaturated, unrealistic'

// ─── Real Google Business Photo fetch ─────────────────────────────────────────
// Uses Places Photo API — same API key as Places search, no extra cost tier.
// photoName format: "places/{place_id}/photos/{photo_reference}"

async function fetchGoogleBusinessPhoto(photoName: string, apiKey: string): Promise<Buffer | null> {
  try {
    const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1600&key=${apiKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

// ─── Real business logo fetch ─────────────────────────────────────────────
// Firecrawl (brand-analyst.ts) already extracts a logo_url from the client's
// existing site into BrandData — this was being thrown away (never uploaded,
// never referenced in config.ts). Downloads it so builder.ts can upload it as
// a same-origin /logo.png instead of hotlinking the client's (possibly soon
// decommissioned) old site. Returns null on any failure — never fabricates one.

export async function fetchBusinessLogo(lead: Lead): Promise<Buffer | null> {
  const url = lead.brand_data?.logo_url
  if (!url) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType && !/^image\//.test(contentType)) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return buf.length > 0 ? buf : null
  } catch {
    return null
  }
}

export async function runImageGeneratorAgent(
  lead: Lead,
  nicheProfile?: NicheProfile
): Promise<AgentResult<{ images: HeroImages }>> {
  const emptyImages: HeroImages = { 'hero-1': null, 'hero-2': null, 'hero-3': null, 'hero-4': null }

  const falKey      = process.env.FAL_KEY
  const hfToken     = process.env.HUGGING_FACE_API_KEY || process.env.HUGGINGFACE_TOKEN
  const placesKey   = process.env.GOOGLE_PLACES_API_KEY
  const photoNames  = lead.photo_names ?? []

  // ── Priority 1: Real Google business photos (free, most authentic) ──────────
  if (placesKey && photoNames.length > 0) {
    const keys = ['hero-1', 'hero-2', 'hero-3', 'hero-4'] as const
    const realPhotos = await Promise.all(
      photoNames.slice(0, 4).map(name => fetchGoogleBusinessPhoto(name, placesKey))
    )
    const fetched = realPhotos.filter(Boolean).length

    if (fetched === 4) {
      console.log(`[ImageGen] ${lead.name} — using 4 real Google photos (authentic) ✓`)
      return {
        success: true,
        data: {
          images: {
            'hero-1': realPhotos[0]!,
            'hero-2': realPhotos[1]!,
            'hero-3': realPhotos[2]!,
            'hero-4': realPhotos[3]!,
          },
        },
      }
    }

    if (fetched > 0) {
      // Partial real photos — use what we have, AI-gen the rest below
      console.log(`[ImageGen] ${lead.name} — ${fetched} real Google photos, AI-gen remaining ${4 - fetched}`)
      const images: HeroImages = { 'hero-1': null, 'hero-2': null, 'hero-3': null, 'hero-4': null }
      for (let i = 0; i < 4; i++) {
        if (realPhotos[i]) images[keys[i]] = realPhotos[i]
      }
      // Fill missing slots with AI gen below — but we need the slots list
      const missingSlots = keys.filter((_, i) => !realPhotos[i])
      if (!falKey && !hfToken) {
        return { success: true, data: { images } }
      }
      // Fall through to AI gen for missing slots only
      const shots: [string, string, string, string] = nicheProfile?.heroImagePrompts ?? getFallbackPrompts(lead)
      if (falKey) {
        fal.config({ credentials: falKey })
        for (const key of missingSlots) {
          const idx = keys.indexOf(key)
          const buf = await generateFalFluxPro(shots[idx], seedFromName(lead.name, idx))
          if (buf) images[key] = buf
        }
      } else if (hfToken) {
        for (const key of missingSlots) {
          const idx = keys.indexOf(key)
          const buf = await generateZImageTurbo(shots[idx], seedFromName(lead.name, idx), hfToken)
            ?? await generateFlux(shots[idx], seedFromName(lead.name, idx), hfToken)
          if (buf) images[key] = buf
        }
      }
      const aiCount = missingSlots.filter(k => images[k]).length
      if (aiCount > 0 && falKey) await logCost({ service: 'fal_images', units: aiCount, leadId: lead.id, leadName: lead.name })
      return { success: true, data: { images } }
    }
  }

  // ── Priority 1.5: Local niche image library (free, curated, no regeneration) ─
  // Reused, pre-approved photos in pipeline/assets/<niche>/ — same trust tier as
  // AI-generated fallback imagery (generic, not-of-this-business), but $0 and
  // no per-lead wait. Only reached when Priority 1 found no real business photos.
  {
    const keys = ['hero-1', 'hero-2', 'hero-3', 'hero-4'] as const
    const libImages = getHeroGridImages(lead.niche, 4)

    if (libImages.length > 0) {
      const images: HeroImages = { 'hero-1': null, 'hero-2': null, 'hero-3': null, 'hero-4': null }
      libImages.forEach((img, i) => { images[keys[i]] = fs.readFileSync(img.localPath) })

      if (libImages.length === 4) {
        console.log(`[ImageGen] ${lead.name} — 4 library images (free, reused) ✓`)
        return { success: true, data: { images } }
      }

      console.log(`[ImageGen] ${lead.name} — ${libImages.length} library images, stock/AI-gen remaining ${4 - libImages.length}`)
      const missingSlots = keys.slice(libImages.length)
      const stockImages = await fetchStockImages(lead.niche, missingSlots.length, seedFromName(lead.name, 0))
      stockImages.forEach((buf, i) => { images[missingSlots[i]] = buf })
      const stillMissing = missingSlots.slice(stockImages.length)

      if (stillMissing.length > 0 && (falKey || hfToken)) {
        const shots: [string, string, string, string] = nicheProfile?.heroImagePrompts ?? getFallbackPrompts(lead)
        if (falKey) {
          fal.config({ credentials: falKey })
          for (const key of stillMissing) {
            const idx = keys.indexOf(key)
            const buf = await generateFalFluxPro(shots[idx], seedFromName(lead.name, idx))
            if (buf) images[key] = buf
          }
        } else if (hfToken) {
          for (const key of stillMissing) {
            const idx = keys.indexOf(key)
            const buf = await generateZImageTurbo(shots[idx], seedFromName(lead.name, idx), hfToken)
              ?? await generateFlux(shots[idx], seedFromName(lead.name, idx), hfToken)
            if (buf) images[key] = buf
          }
        }
        const aiCount = stillMissing.filter(k => images[k]).length
        if (aiCount > 0 && falKey) await logCost({ service: 'fal_images', units: aiCount, leadId: lead.id, leadName: lead.name })
      }
      return { success: true, data: { images } }
    }
  }

  // ── Priority 2: Free stock images (Pexels / Pixabay / Unsplash) ─────────────
  {
    const stockImages = await fetchStockImages(lead.niche, 4, seedFromName(lead.name, 0))
    if (stockImages.length === 4) {
      console.log(`[ImageGen] ${lead.name} — 4 stock images (free) ✓`)
      return {
        success: true,
        data: {
          images: {
            'hero-1': stockImages[0],
            'hero-2': stockImages[1],
            'hero-3': stockImages[2],
            'hero-4': stockImages[3],
          },
        },
      }
    }
    if (stockImages.length > 0) {
      console.log(`[ImageGen] ${lead.name} — ${stockImages.length} stock images, AI-gen remaining ${4 - stockImages.length}`)
      // partial fill — continue to AI gen for missing slots
      const keys = ['hero-1', 'hero-2', 'hero-3', 'hero-4'] as const
      const images: HeroImages = { 'hero-1': null, 'hero-2': null, 'hero-3': null, 'hero-4': null }
      stockImages.forEach((buf, i) => { images[keys[i]] = buf })
      const missingSlots = keys.slice(stockImages.length)
      if (!falKey && !hfToken) return { success: true, data: { images } }
      const shots: [string, string, string, string] = nicheProfile?.heroImagePrompts ?? getFallbackPrompts(lead)
      if (falKey) {
        fal.config({ credentials: falKey })
        for (const key of missingSlots) {
          const idx = keys.indexOf(key)
          const buf = await generateFalFluxPro(shots[idx], seedFromName(lead.name, idx))
          if (buf) images[key] = buf
        }
      } else if (hfToken) {
        for (const key of missingSlots) {
          const idx = keys.indexOf(key)
          const buf = await generateZImageTurbo(shots[idx], seedFromName(lead.name, idx), hfToken)
            ?? await generateFlux(shots[idx], seedFromName(lead.name, idx), hfToken)
          if (buf) images[key] = buf
        }
      }
      const aiCount = missingSlots.filter(k => images[k]).length
      if (aiCount > 0 && falKey) await logCost({ service: 'fal_images', units: aiCount, leadId: lead.id, leadName: lead.name })
      return { success: true, data: { images } }
    }
  }

  // Use brain-generated prompts if available, else fallback static
  const shots: [string, string, string, string] = nicheProfile?.heroImagePrompts ?? getFallbackPrompts(lead)
  const keys = ['hero-1', 'hero-2', 'hero-3', 'hero-4'] as const

  if (nicheProfile) {
    console.log(`  Style: ${nicheProfile.visualStyle} | ${nicheProfile.timeOfDay?.split(',')[0] ?? nicheProfile.timeOfDay}`)
  }

  const images: HeroImages = { 'hero-1': null, 'hero-2': null, 'hero-3': null, 'hero-4': null }

  // ── Priority 3: Vertex AI Imagen 3 (uses GCP credits) ──────────────────────
  {
    console.log(`[ImageGen] Generating 4 images for ${lead.name} (Vertex Imagen 3)`)
    const results = await Promise.allSettled(shots.map(shot => generateNanoBanana(shot)))
    let imagenCount = 0
    for (let i = 0; i < 4; i++) {
      const r = results[i]
      if (r.status === 'fulfilled' && r.value) {
        images[keys[i]] = r.value
        imagenCount++
        console.log(`  [ImageGen] shot ${i + 1}: ${Math.round(r.value.length / 1024)}KB ✓ (Imagen 3)`)
      } else {
        console.log(`  [ImageGen] shot ${i + 1}: Imagen 3 failed — ${r.status === 'rejected' ? (r as any).reason : 'null'}`)
      }
    }
    if (imagenCount === 4) {
      await logCost({ service: 'vertex_images', units: 4, leadId: lead.id, leadName: lead.name })
      return { success: true, data: { images } }
    }
    if (imagenCount > 0) {
      await logCost({ service: 'vertex_images', units: imagenCount, leadId: lead.id, leadName: lead.name })
    }
  }

  // ── Priority 4: fal.ai Flux Pro (paid fallback for any Imagen 3 gaps) ──────
  const missingKeys = keys.filter(k => !images[k])
  if (missingKeys.length > 0 && (falKey || hfToken)) {
    console.log(`[ImageGen] ${lead.name} — Imagen 3 filled ${4 - missingKeys.length}/4, filling ${missingKeys.length} gaps`)

    if (falKey) {
      fal.config({ credentials: falKey })
      const results = await Promise.allSettled(
        missingKeys.map((k) => generateFalFluxPro(shots[keys.indexOf(k)], seedFromName(lead.name, keys.indexOf(k))))
      )
      let falCount = 0
      for (let i = 0; i < missingKeys.length; i++) {
        const r = results[i]
        if (r.status === 'fulfilled' && r.value) {
          images[missingKeys[i]] = r.value
          falCount++
          console.log(`  [ImageGen] gap ${missingKeys[i]}: ${Math.round(r.value.length / 1024)}KB ✓ (fal.ai)`)
        }
      }
      if (falCount > 0) await logCost({ service: 'fal_images', units: falCount, leadId: lead.id, leadName: lead.name })
    } else if (hfToken) {
      for (const k of missingKeys) {
        const idx = keys.indexOf(k)
        let buf = await generateZImageTurbo(shots[idx], seedFromName(lead.name, idx), hfToken)
        if (!buf) buf = await generateFlux(shots[idx], seedFromName(lead.name, idx), hfToken)
        if (buf) { images[k] = buf; console.log(`  [ImageGen] gap ${k}: HF fallback ✓`) }
      }
    }
  }

  if (!falKey && !hfToken && !images['hero-1']) {
    console.log('[ImageGen] No Vertex SA, FAL_KEY, or HUGGING_FACE_API_KEY — skipping')
  }

  return { success: true, data: { images } }
}

// ─── Fallback static prompts (used when niche brain unavailable) ────────────

function getFallbackPrompts(lead: Lead): [string, string, string, string] {
  const city = lead.city || lead.state || ''
  const SHOT_PROMPTS: Record<string, [string, string, string, string]> = {
    hvac: [
      `HVAC technician servicing rooftop AC unit at golden hour, professional navy uniform, residential neighborhood, ${city}, cinematic lighting, photorealistic, 8K, no text`,
      `Two HVAC technicians installing modern AC system, suburban home exterior, sunny day, ${city}, photorealistic, 8K, no text`,
      `Clean modern home living room with HVAC vent, bright interior design, natural light, ${city}, photorealistic`,
      `HVAC service van parked outside suburban home, branded vehicle, tree-lined street, golden hour, ${city}, photorealistic, no text`,
    ],
    roofing: [
      `Professional roofing crew installing new shingles on suburban home, clear blue sky, safety harnesses, ${city}, photorealistic, 8K`,
      `Aerial view of residential roof replacement in progress, skilled crew, bright day, ${city}, photorealistic`,
      `Close-up quality roof shingles installation, expert worker hands, dramatic angle, ${city}, photorealistic, 8K`,
      `Roofing company truck parked outside suburban home, professional crew, sunny neighborhood, ${city}, photorealistic`,
    ],
    dentist: [
      `Modern dental office reception area with plants, natural light, clean white interior, welcoming, ${city}, photorealistic`,
      `Bright dental treatment room, state of art equipment, calming blue and white tones, ${city}, photorealistic, 8K`,
      `Smiling patient in dental chair, gentle dentist, warm clinic lighting, professional, ${city}, photorealistic`,
      `Exterior of modern dental clinic building, professional signage, inviting entrance, ${city}, photorealistic`,
    ],
    medspa: [
      `Luxury medical spa treatment room, warm amber lighting, white marble surfaces, orchids, minimal modern design, ${city}, photorealistic, 8K`,
      `Beautiful spa reception area with water feature, soft lighting, premium aesthetic, ${city}, photorealistic`,
      `Facial treatment in progress, calm professional therapist, serene environment, ${city}, photorealistic`,
      `Luxury spa exterior at dusk, warm glowing windows, architectural landscaping, ${city}, photorealistic`,
    ],
    lawfirm: [
      `Prestigious law office interior, floor to ceiling bookshelves, mahogany desk, confident attorney, golden hour light through blinds, ${city}, photorealistic, 8K`,
      `Modern law firm conference room, glass walls, city skyline view, professional team meeting, ${city}, photorealistic`,
      `Law firm reception area with marble floors, recessed lighting, premium modern design, ${city}, photorealistic`,
      `Professional attorney walking through glass office building lobby, power suit, ${city}, photorealistic`,
    ],
    remodeling: [
      `Stunning kitchen remodel reveal, white shaker cabinets, quartz countertops, waterfall island, natural light, ${city}, photorealistic, 8K`,
      `Luxury master bathroom renovation, freestanding soaking tub, marble tiles, rainshower, ${city}, photorealistic`,
      `Open concept living room addition, vaulted ceilings, exposed beams, hardwood floors, ${city}, photorealistic`,
      `Professional remodeling crew at work, safety gear, quality tools, bright renovation site, ${city}, photorealistic`,
    ],
    cleaning: [
      `Professional cleaning team in modern office, bright and fresh result, gleaming surfaces, ${city}, photorealistic, 8K`,
      `Spotless luxury kitchen after deep clean, marble counters, stainless appliances, ${city}, photorealistic`,
      `Professional cleaners in uniform working efficiently in elegant home, ${city}, photorealistic`,
      `Before-after style clean modern bathroom, sparkling tiles, fresh towels, ${city}, photorealistic`,
    ],
    'junk-removal': [
      `Professional junk removal crew loading clean truck, suburban home, organized efficient team, sunny day, ${city}, photorealistic, no text`,
      `Clean empty garage after junk removal, organized space, satisfied homeowner, ${city}, photorealistic`,
      `Branded junk removal truck on residential street, professional crew, ready to work, ${city}, photorealistic`,
      `Estate cleanout in progress, organized professional team, residential setting, ${city}, photorealistic`,
    ],
    daycare: [
      `Bright cheerful daycare classroom, colorful learning zones, warm natural light, happy children playing, ${city}, photorealistic, 8K`,
      `Modern daycare outdoor playground, safe equipment, green grass, sunny day, ${city}, photorealistic`,
      `Caring teacher reading to small group of children, cozy reading corner, warm lighting, ${city}, photorealistic`,
      `Clean modern daycare reception, welcoming decor, organized check-in area, ${city}, photorealistic`,
    ],
    'auto-detailing': [
      `Luxury car detailing studio, gleaming black sports car being hand-polished, dramatic studio lighting, ${city}, photorealistic, 8K`,
      `Ceramic coating application on white Porsche, professional detailer, clean workshop, ${city}, photorealistic`,
      `Before-after paint correction on luxury vehicle, mirror finish, professional result, ${city}, photorealistic`,
      `High-end auto detailing shop exterior, multiple luxury cars, professional branding, ${city}, photorealistic`,
    ],
    restaurant: [
      `Elegant restaurant dining room, warm Edison lighting, white tablecloths, intimate atmosphere, ${city}, photorealistic, 8K`,
      `Chef preparing signature dish in open professional kitchen, dramatic lighting, ${city}, photorealistic`,
      `Beautiful plated fine dining dish, artful presentation, shallow depth of field, ${city}, photorealistic`,
      `Restaurant exterior at dusk, warm glowing windows, welcoming entrance, guests arriving, ${city}, photorealistic`,
    ],
    'luxury-realestate': [
      `Aerial view of ultra-luxury residential tower at golden hour, glass and steel facade, infinity pool on roof, warm amber city skyline, ${city}, architectural photography, Phase One camera, 8K, photorealistic, no people, no text`,
      `Interior of luxury penthouse, floor-to-ceiling panoramic windows overlooking city skyline, white marble floors, designer Italian furniture, warm ambient lighting, ${city}, architectural photography, 8K, photorealistic`,
      `Rooftop infinity pool at sunset, turquoise water, cabanas, glass railings, golden city reflections, ${city}, photorealistic, 8K`,
      `Luxury residential tower at night, warm golden windows lit from inside, city lights reflection, dramatic cloudless sky, ${city}, long exposure photography, photorealistic, 8K`,
    ],
  }

  return (SHOT_PROMPTS[lead.niche] ?? [
    `Professional service crew working on residential property, golden hour, ${city}, photorealistic, 8K`,
    `Two professionals working, suburban neighborhood, sunny day, ${city}, photorealistic`,
    `Inside modern home, bright clean interior, ${city}, photorealistic`,
    `Professional service van parked outside home, sunny day, ${city}, photorealistic`,
  ]) as [string, string, string, string]
}

// ─── Vertex AI Nano Banana (gemini-2.5-flash-image) ────────────────────────
// Imagen 3 (imagen-3.0-generate-002, the previous model here) was shut down
// by Google on August 17, 2026 — this replaces it with Google's own
// migration target ("Nano Banana"). Different API shape: Gemini image models
// go through generateContent (contents/parts in, inlineData part out), not
// Imagen's predict/instances/parameters shape.

const VERTEX_PROJECT     = process.env.GCP_PROJECT_ID ?? 'gen-lang-client-0844283339'
const VERTEX_LOCATION    = process.env.GCP_REGION    ?? 'us-central1'
const NANO_BANANA_MODEL  = 'gemini-2.5-flash-image'

async function generateNanoBanana(prompt: string): Promise<Buffer | null> {
  const token = await getVertexToken()
  if (!token) return null

  try {
    const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${NANO_BANANA_MODEL}:generateContent`
    const res = await fetch(url, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${prompt}. 16:9 landscape aspect ratio, photorealistic.` }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) {
      console.warn(`[NanoBanana] ${res.status} ${await res.text().catch(() => '')}`)
      return null
    }
    const data = await res.json() as any
    const parts = data.candidates?.[0]?.content?.parts ?? []
    const b64 = parts.find((p: any) => p.inlineData?.data)?.inlineData?.data
    if (!b64) return null
    return Buffer.from(b64, 'base64')
  } catch (e: any) {
    console.warn('[NanoBanana] error:', e.message)
    return null
  }
}

// ─── fal.ai Flux Pro 1.1 ───────────────────────────────────────────────────

async function generateFalFluxPro(prompt: string, seed: number): Promise<Buffer | null> {
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
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
      if (!res.ok) continue
      return Buffer.from(await res.arrayBuffer())
    } catch {
      if (attempt === 1) return null
    }
  }
  return null
}

// ─── HuggingFace Z-Image Turbo (free fallback) ────────────────────────────

async function generateZImageTurbo(prompt: string, seed: number, token: string): Promise<Buffer | null> {
  try {
    const submitRes = await fetch(
      'https://mrfakename-z-image-turbo.hf.space/gradio_api/call/generate_image',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: [prompt, 768, 1344, 4, seed, false] }),
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

// ─── HuggingFace FLUX.1-schnell (free fallback) ───────────────────────────

async function generateFlux(prompt: string, seed: number, token: string): Promise<Buffer | null> {
  try {
    const res = await fetch(
      'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: prompt, parameters: { seed, num_inference_steps: 4, width: 1344, height: 768 } }),
        signal: AbortSignal.timeout(90_000),
      }
    )
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}
