/**
 * Niche Brain — AI intelligence engine
 *
 * Understands each business deeply and generates a unique NicheProfile:
 * - 4 cinematic hero image prompts (unique per business, never duplicated)
 * - 1 cinematic video motion prompt
 * - Visual style, color palette variant, copy tone
 *
 * Uniqueness dimensions: 6 visual styles × 4 times-of-day × 4 seasons
 * × 5 palette variants × city context = 480+ combinations per niche.
 * Hash from business name + city selects combination deterministically,
 * then Gemini generates bespoke prompts using that frame + brand data.
 */

import { geminiText, GEMINI_PRO }                              from '../tools/gemini.js'
import type { Lead, BrandData, NicheProfile }                 from '../types.js'
import { getDesignProfile, generateDesignTokensCSS }          from '../lib/design-library.js'

const NICHE_BRAIN_SYSTEM = `You are a luxury creative director and AI cinematographer.
You write ultra-specific, vivid image and video prompts for commercial photography AI models.
Your prompts are photorealistic, cinematic, and unique to each business.
Return ONLY valid JSON. No markdown. No explanation.`

// ─── Variation pools ───────────────────────────────────────────────────────────

const VISUAL_STYLES = [
  'golden-editorial',    // warm amber tones, shallow DOF, lifestyle magazine
  'documentary-grit',    // natural light, candid, authentic, unposed
  'luxury-architectural',// clean lines, dramatic shadows, architectural digest
  'dramatic-cinematic',  // movie-poster contrast, moody, powerful, dark
  'fresh-vibrant',       // bright saturated colors, energy, modern, aspirational
  'dark-premium',        // low-key, mysterious, exclusive, high-end night
] as const

const TIMES_OF_DAY = [
  'golden hour, 1 hour before sunset, warm amber and orange sky',
  'blue hour, 20 minutes after sunset, deep blue gradient sky, streetlights beginning to glow',
  'midday, high-contrast harsh sunlight, deep crisp shadows',
  'overcast soft light, diffused shadows, clean professional atmosphere',
] as const

const SEASONS = [
  'summer, lush green trees, clear blue sky',
  'autumn, golden and red foliage, warm tones',
  'spring, fresh green, blooming flowers, clear air',
  'winter, bare trees, crisp cold air, clear sky',
] as const

const CAMERA_SPECS = [
  'shot on Phase One XF IQ4, 150MP, ultra-sharp detail',
  'shot on Hasselblad X2D, medium format, cinematic depth',
  'shot on Sony A1, 50mm f/1.2, shallow depth of field',
  'shot on Canon R5, 24-70mm f/2.8L, professional commercial',
  'shot on ARRI Alexa 35, anamorphic lens, cinematic 2.39:1',
] as const

const COLOR_GRADES = [
  'Kodak Portra 400 film grain, warm natural tones',
  'teal and orange Hollywood grade, cinematic color science',
  'clean editorial, neutral tones, Lightroom Classic grade',
  'moody desaturated, lifted shadows, premium matte grade',
  'vibrant saturated, punchy colors, commercial advertising grade',
] as const

// ─── Per-niche subject context ─────────────────────────────────────────────────

const NICHE_SUBJECT: Record<string, {
  subjects: string[]
  environment: string[]
  mood: string
  avoid: string
}> = {
  hvac: {
    subjects: [
      'HVAC technician in clean navy uniform servicing rooftop AC unit',
      'two technicians installing new HVAC system on residential home exterior',
      'modern home interior with visible HVAC vents, fresh clean air',
      'branded service van parked on tree-lined residential street',
    ],
    environment: ['suburban residential neighborhood', 'modern home exterior', 'clean home interior'],
    mood: 'professional, trustworthy, clean, reliable',
    avoid: 'cartoon, dirty, messy, unprofessional, text on clothing',
  },
  roofing: {
    subjects: [
      'roofing crew installing premium architectural shingles on suburban home',
      'aerial view of residential neighborhood with fresh new roofs',
      'close-up of expert hands laying precision roofing tiles',
      'branded roofing truck with crew in matching safety vests',
    ],
    environment: ['residential neighborhood', 'suburban home exterior', 'aerial residential view'],
    mood: 'strong, expert, reliable, storm-ready, protective',
    avoid: 'unsafe practices, no hard hats, messy work site, text',
  },
  dentist: {
    subjects: [
      'bright modern dental office reception with natural light and plants',
      'state-of-art dental treatment room, calming blue and white, pristine equipment',
      'friendly dentist and relaxed patient, warm clinic lighting',
      'modern dental clinic exterior with professional signage and welcoming entrance',
    ],
    environment: ['modern dental clinic interior', 'professional medical office', 'welcoming reception'],
    mood: 'clean, calming, professional, welcoming, trustworthy',
    avoid: 'fear, pain, anxiety, dated equipment, harsh lighting',
  },
  medspa: {
    subjects: [
      'luxury medical spa treatment room, warm amber lighting, white marble, orchids',
      'serene spa reception area with water feature and soft diffused lighting',
      'professional aesthetician performing facial treatment, calm serene environment',
      'luxury spa exterior at dusk, warm glowing windows, architectural landscaping',
    ],
    environment: ['luxury medical spa interior', 'premium wellness center', 'upscale reception'],
    mood: 'luxury, serene, exclusive, premium, transformative',
    avoid: 'clinical hospital feel, harsh lighting, dated decor',
  },
  lawfirm: {
    subjects: [
      'prestigious law office interior, floor-to-ceiling bookshelves, mahogany desk, confident attorney',
      'modern law firm conference room, glass walls, city skyline view',
      'law firm reception with marble floors, recessed lighting, premium design',
      'professional attorney in power suit, glass office building lobby',
    ],
    environment: ['prestigious law office', 'downtown high-rise', 'professional legal setting'],
    mood: 'powerful, prestigious, trustworthy, successful, commanding',
    avoid: 'casual dress, messy desk, dated furniture, low-end office',
  },
  remodeling: {
    subjects: [
      'stunning kitchen remodel reveal, white shaker cabinets, quartz waterfall island',
      'luxury master bathroom renovation, freestanding soaking tub, marble tiles',
      'open concept living room addition, vaulted ceilings, exposed beams, hardwood floors',
      'professional remodeling crew in matching uniforms, quality tools, bright renovation site',
    ],
    environment: ['luxury renovated home interior', 'high-end residential remodel', 'premium home reveal'],
    mood: 'transformative, aspirational, quality, expert craftsmanship',
    avoid: 'messy demolition, dust, incomplete work, dated finishes',
  },
  cleaning: {
    subjects: [
      'professional cleaning team transforming modern office, gleaming surfaces, immaculate result',
      'spotless luxury kitchen after deep clean, marble counters, stainless appliances',
      'professional cleaners in matching uniforms working efficiently in elegant home',
      'pristine luxury bathroom after professional deep clean, sparkling tiles, fresh white towels',
    ],
    environment: ['luxury residential interior', 'modern home', 'spotless clean space'],
    mood: 'fresh, pristine, professional, transformative, satisfying',
    avoid: 'dirty before-state, harsh chemicals visible, dated home',
  },
  'junk-removal': {
    subjects: [
      'professional junk removal crew efficiently loading clean branded truck, organized team',
      'clean organized garage transformation, satisfied homeowner, open spacious result',
      'branded junk removal truck on residential street, professional uniformed crew',
      'estate cleanout completion, empty clean space, organized professional team',
    ],
    environment: ['suburban home exterior', 'clean organized garage', 'residential neighborhood'],
    mood: 'efficient, reliable, transformative, satisfaction, clean result',
    avoid: 'overwhelming mess, landfill imagery, unprofessional appearance',
  },
  daycare: {
    subjects: [
      'bright cheerful daycare classroom, colorful learning zones, happy children playing, warm light',
      'safe modern outdoor playground, green grass, children laughing, sunny day',
      'caring teacher reading to small group of children, cozy reading corner, warm soft light',
      'clean welcoming daycare reception, organized check-in, smiling staff',
    ],
    environment: ['bright daycare interior', 'safe outdoor play area', 'warm nurturing classroom'],
    mood: 'nurturing, safe, joyful, bright, trustworthy, warm',
    avoid: 'sad children, unsafe equipment, dark lighting, cluttered mess',
  },
  'auto-detailing': {
    subjects: [
      'luxury sports car being hand-polished in dramatic studio lighting, mirror paint finish',
      'ceramic coating application on white Porsche, professional detailer, immaculate workshop',
      'before-after paint correction on black Mercedes, mirror-like finish achieved',
      'high-end auto detailing studio exterior, multiple luxury vehicles, premium branding',
    ],
    environment: ['luxury auto detailing studio', 'dramatic workshop lighting', 'premium car care'],
    mood: 'premium, precision, perfection, luxury, dramatic, exclusive',
    avoid: 'dirty cars, amateur setup, harsh fluorescent lighting, low-end vehicles',
  },
  restaurant: {
    subjects: [
      'elegant restaurant dining room at golden hour, warm Edison bulbs, intimate atmosphere',
      'executive chef plating signature dish in open professional kitchen, dramatic lighting',
      'close-up beautifully plated fine dining dish, artful presentation, shallow depth of field',
      'restaurant exterior at dusk, warm glowing windows, guests arriving, welcoming atmosphere',
    ],
    environment: ['elegant restaurant interior', 'professional open kitchen', 'inviting dining room'],
    mood: 'inviting, elegant, culinary excellence, warm, premium experience',
    avoid: 'empty restaurant, messy kitchen, bad food presentation, dated decor',
  },
  'luxury-realestate': {
    subjects: [
      'aerial view of ultra-luxury residential tower, glass and steel facade, infinity pool, golden skyline',
      'luxury penthouse interior, floor-to-ceiling windows, panoramic city view, designer Italian furniture',
      'rooftop infinity pool at sunset, turquoise water, glass railings, golden reflections',
      'luxury tower at night, warm golden windows lit from inside, dramatic cloudless sky',
    ],
    environment: ['ultra-luxury tower', 'Dubai skyline', 'premium residential development'],
    mood: 'ultra-luxury, exclusive, aspirational, architectural excellence, prestigious',
    avoid: 'people, text, cars, average buildings, daytime flat light',
  },
  default: {
    subjects: [
      'professional service team working at residential property, golden hour',
      'two professionals in matching uniforms, suburban neighborhood, sunny day',
      'clean modern home interior with professional service in progress',
      'branded service vehicle parked outside well-kept suburban home',
    ],
    environment: ['suburban residential', 'modern home exterior', 'professional service'],
    mood: 'professional, trustworthy, reliable, quality service',
    avoid: 'unprofessional appearance, messy sites, text, watermarks',
  },
}

// ─── Deterministic variation selector ─────────────────────────────────────────

function hashBusiness(name: string, city: string): number {
  const str = `${name}::${city}`.toLowerCase()
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function pickVariation(name: string, city: string) {
  // Use unsigned right shift (>>>) to ensure positive before modulo
  // JS % preserves sign — negative hash → negative index → undefined
  const h = hashBusiness(name, city) >>> 0  // force unsigned 32-bit
  return {
    visualStyle:  VISUAL_STYLES[h % VISUAL_STYLES.length],
    timeOfDay:    TIMES_OF_DAY[(h >>> 4) % TIMES_OF_DAY.length],
    season:       SEASONS[(h >>> 8) % SEASONS.length],
    cameraSpec:   CAMERA_SPECS[(h >>> 12) % CAMERA_SPECS.length],
    colorGrade:   COLOR_GRADES[(h >>> 16) % COLOR_GRADES.length],
  }
}

// ─── Gemini-powered prompt generation ─────────────────────────────────────────

async function generatePromptsWithGemini(
  lead: Lead,
  variation: ReturnType<typeof pickVariation>,
  nicheSubject: typeof NICHE_SUBJECT['default'],
  designBrief?: string
): Promise<{ imagePrompts: [string, string, string, string]; videoPrompt: string } | null> {
  const city = lead.city || lead.state || ''
  const bd = lead.brand_data

  // All arrays guarded with ?.join — optional chain stops at ?.slice returning undefined,
  // then plain .join would throw. Add second ?. to handle null arrays from Gemini.
  const brandContext = bd ? `
Business: ${bd.name ?? lead.name}
Location: ${city}
Services: ${(Array.isArray(bd.services) ? bd.services.slice(0, 4) : []).join(', ') || ''}
Brand tone: ${bd.tone || 'professional'}
Unique selling points: ${(Array.isArray(bd.unique_selling_points) ? bd.unique_selling_points.slice(0, 3) : []).join(', ') || ''}
Brand colors: ${JSON.stringify(bd.colors || {})}
` : `Business: ${lead.name}\nLocation: ${city}`

  const prompt = `Generate 4 unique cinematic hero images + 1 video motion prompt for this local business website.

${designBrief ? `## Design Identity (match image mood to this):\n${designBrief}\n` : ''}
${brandContext}

Visual style: ${variation.visualStyle}
Time of day: ${variation.timeOfDay}
Season: ${variation.season}
Camera: ${variation.cameraSpec}
Color grade: ${variation.colorGrade}

Niche subjects to use (use each for one shot):
${nicheSubject.subjects.map((s, i) => `Shot ${i + 1}: ${s}`).join('\n')}

Environment context: ${nicheSubject.environment.join(', ')}
Brand mood: ${nicheSubject.mood}
Avoid: ${nicheSubject.avoid}, watermarks, text overlays, blurry, low quality, distorted faces

RULES:
- Each prompt must be 1 sentence, 40-80 words
- Include: subject + action, environment, lighting (time of day), camera spec, quality tags
- Append ", ${city}" to each image prompt for location context
- Video prompt: slow cinematic camera motion (push-in/pan/orbit/drone) matching the visual style, 5 seconds, loopable, no people moving, subtle atmospheric motion only
- Make each shot visually distinct (different angle, distance, focal point)

Return ONLY this JSON:
{
  "imagePrompts": ["prompt1", "prompt2", "prompt3", "prompt4"],
  "videoPrompt": "slow cinematic..."
}`

  try {
    const raw = await geminiText(prompt, { model: GEMINI_PRO, maxTokens: 4096, temperature: 0.8, systemInstruction: NICHE_BRAIN_SYSTEM })
    const text = raw.trim()
    // Strip markdown fences if present
    const json = text.replace(/^```json\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(json)
    if (
      Array.isArray(parsed.imagePrompts) &&
      parsed.imagePrompts.length === 4 &&
      typeof parsed.videoPrompt === 'string'
    ) {
      return {
        imagePrompts: parsed.imagePrompts as [string, string, string, string],
        videoPrompt: parsed.videoPrompt,
      }
    }
    return null
  } catch {
    return null
  }
}

// ─── Deterministic fallback (no Gemini needed) ────────────────────────────────

function buildFallbackPrompts(
  lead: Lead,
  variation: ReturnType<typeof pickVariation>,
  nicheSubject: typeof NICHE_SUBJECT['default']
): { imagePrompts: [string, string, string, string]; videoPrompt: string } {
  const city = lead.city || lead.state || ''
  const suffix = `${variation.timeOfDay}, ${variation.season}, ${variation.cameraSpec}, ${variation.colorGrade}, photorealistic, 8K, no text, no watermark`

  const imagePrompts = nicheSubject.subjects.map(
    (subject) => `${subject}, ${city}, ${nicheSubject.environment[0]}, ${suffix}`
  ) as [string, string, string, string]

  const motionMap: Record<string, string> = {
    'golden-editorial':     'Slow cinematic push-in toward subject, shallow depth of field, warm amber bokeh swirling',
    'documentary-grit':     'Slow handheld-style push with subtle drift, natural atmosphere, authentic feel',
    'luxury-architectural': 'Ultra-slow precision dolly forward, perfectly level, architectural reveal',
    'dramatic-cinematic':   'Slow dramatic tilt-up reveal, moody atmosphere, subtle lens flare',
    'fresh-vibrant':        'Smooth slow-motion pan across scene, bright natural colors, fresh energy',
    'dark-premium':         'Slow orbital move around subject, dramatic rim lighting, premium night atmosphere',
  }

  const videoPrompt = `${motionMap[variation.visualStyle] || motionMap['luxury-architectural']}, ${city}, ${variation.timeOfDay}, perfectly smooth motion, no camera shake, no people moving, 5-second seamless loop`

  return { imagePrompts, videoPrompt }
}

// ─── Main export ───────────────────────────────────────────────────────────────

export async function runNicheBrain(lead: Lead): Promise<NicheProfile> {
  const niche = lead.niche
  const nicheSubject = NICHE_SUBJECT[niche] ?? NICHE_SUBJECT.default
  const variation = pickVariation(lead.name, lead.city || '')

  // Design profile — deterministic unique combo per business
  const designProfile = getDesignProfile(lead.name, niche)
  const cssTokenBlock = generateDesignTokensCSS(designProfile)

  // Attempt Gemini-powered unique prompts (inject design brief for cohesion)
  let prompts = await generatePromptsWithGemini(lead, variation, nicheSubject, designProfile.geminiBrief)

  // Fallback: deterministic template-based prompts (still unique per business)
  if (!prompts) {
    console.log(`  [Brain] Gemini unavailable — using deterministic fallback`)
    prompts = buildFallbackPrompts(lead, variation, nicheSubject)
  }

  const signature = `${lead.niche}::${lead.name}::${lead.city}::${variation.visualStyle}::${designProfile.personality.id}`

  const profile: NicheProfile = {
    visualStyle:      variation.visualStyle,
    timeOfDay:        variation.timeOfDay,
    season:           variation.season,
    cameraSpec:       variation.cameraSpec,
    colorGrade:       variation.colorGrade,
    heroImagePrompts: prompts.imagePrompts,
    heroVideoPrompt:  prompts.videoPrompt,
    copyTone:         nicheSubject.mood,
    signature,
    design: {
      personalityId:    designProfile.personality.id,
      personalityName:  designProfile.personality.name,
      fontPairingName:  designProfile.fonts.name,
      displayFont:      designProfile.fonts.displayFont,
      bodyFont:         designProfile.fonts.bodyFont,
      displayStack:     designProfile.fonts.displayStack,
      bodyStack:        designProfile.fonts.bodyStack,
      googleFontsImport: designProfile.fonts.googleImport,
      heroLayoutId:     designProfile.hero.id,
      sectionOrderId:   designProfile.sectionOrder.id,
      colorPaletteName: designProfile.colors.name,
      colorTokens:      designProfile.colors.tokens,
      geminiBrief:      designProfile.geminiBrief,
      cssTokenBlock,
    },
  }

  console.log(`  [Brain] ${niche} | style: ${variation.visualStyle} | personality: ${designProfile.personality.name} | fonts: ${designProfile.fonts.name}`)
  return profile
}
