/**
 * stock-media.ts
 * Free stock image + video fetcher with per-slot niche-specific queries.
 *
 * Each niche has 4 shot-type queries (matching hero image slots):
 *   slot 0 — wide hero / establishment shot
 *   slot 1 — work in progress / service action
 *   slot 2 — result / equipment / interior detail
 *   slot 3 — team / vehicle / exterior
 *
 * Image priority per slot: Pexels → Pixabay → Flickr → Freepik → Unsplash
 * Video priority:          Pexels → Pixabay
 *
 * Env vars:
 *   PEXELS_API_KEY      — pexels.com/api        (200 req/hr, images + videos)
 *   PIXABAY_API_KEY     — pixabay.com/api        (unlimited, images + videos)
 *   FLICKR_API_KEY      — flickr.com/services    (3600 req/hr, CC-licensed)
 *   FREEPIK_API_KEY     — freepik.com/api        (limited free tier)
 *   UNSPLASH_ACCESS_KEY — unsplash.com/developers (50 req/hr demo, images only)
 */

// ─── Shot-type keyword map (4 slots per niche) ────────────────────────────────

const NICHE_IMAGE_SHOTS: Record<string, [string, string, string, string]> = {
  hvac: [
    'hvac technician servicing rooftop air conditioning unit professional',
    'hvac technician repairing indoor furnace heating system',
    'modern air conditioning unit installed residential home exterior',
    'hvac service truck parked suburban neighborhood professional crew',
  ],
  roofing: [
    'professional roofers installing shingles residential roof aerial view',
    'roofing crew nailing shingles on house sunny day safety harness',
    'new roof installation close up shingles quality work',
    'roofing company truck parked house crew uniform professional',
  ],
  dentist: [
    'modern dental clinic reception area clean white interior natural light',
    'dentist examining patient dental chair professional clinical setting',
    'dental treatment room state of art equipment blue white tones',
    'dental office exterior professional signage welcoming entrance',
  ],
  medspa: [
    'luxury medical spa treatment room marble white amber lighting orchids',
    'esthetician performing facial treatment client relaxing professional',
    'medical spa laser treatment equipment modern clinical room',
    'luxury spa exterior glowing windows architectural landscaping evening',
  ],
  lawfirm: [
    'prestigious law firm office mahogany desk floor ceiling bookshelves',
    'attorney in suit reviewing documents law office city view',
    'law firm conference room glass walls professional team',
    'law office building exterior glass modern architecture professional',
  ],
  remodeling: [
    'stunning kitchen remodel white shaker cabinets quartz island natural light',
    'construction workers remodeling home interior professional crew',
    'luxury master bathroom renovation freestanding tub marble tiles',
    'home remodeling contractor truck tools suburban project',
  ],
  cleaning: [
    'professional cleaning team modern office gleaming surfaces uniform',
    'house cleaner mopping luxury kitchen white gloves professional service',
    'spotless bathroom after professional deep cleaning sparkling tiles',
    'cleaning company van crew uniform residential neighborhood',
  ],
  'junk-removal': [
    'junk removal crew loading truck suburban home sunny day organized',
    'two workers carrying furniture junk out of house efficient team',
    'clean empty garage after junk removal organized space',
    'branded junk removal truck residential street professional team',
  ],
  daycare: [
    'bright colorful daycare classroom children learning natural light',
    'teacher reading to small group children cozy carpet classroom',
    'children playing safely on modern daycare playground equipment',
    'daycare center exterior welcoming entrance colorful signage',
  ],
  'auto-detailing': [
    'luxury sports car being hand polished professional detailing studio dramatic lighting',
    'detailer applying ceramic coating white porsche clean workshop',
    'mirror shine paint correction luxury vehicle close up professional result',
    'auto detailing shop exterior multiple luxury cars professional branding',
  ],
  restaurant: [
    'elegant restaurant dining room warm Edison lighting intimate atmosphere evening',
    'professional chef preparing dish open kitchen dramatic lighting',
    'beautifully plated fine dining dish artful presentation shallow depth',
    'restaurant exterior dusk warm glowing windows welcoming entrance guests',
  ],
  'luxury-realestate': [
    'luxury modern apartment building glass facade golden hour aerial',
    'luxury penthouse interior floor ceiling windows city skyline marble floors',
    'rooftop infinity pool sunset glass railings city reflections',
    'luxury residential building night warm golden windows city lights',
  ],
  plumbing: [
    'professional plumber fixing pipe under sink residential home',
    'plumber installing water heater basement professional uniform',
    'plumbing repair pipe wrench tools professional service',
    'plumbing service truck parked house professional crew uniform',
  ],
  landscaping: [
    'professional landscaping crew manicured garden lawn suburban home',
    'landscaper operating riding mower large residential property',
    'beautifully designed garden landscape flowers hardscaping result',
    'landscaping company truck trailer equipment neighborhood',
  ],
  'pressure-washing': [
    'worker pressure washing concrete driveway clean transformation',
    'power washing deck patio professional equipment dramatic result',
    'before after pressure washing house exterior siding clean',
    'pressure washing service truck equipment suburban home professional',
  ],
  'epoxy-flooring': [
    'shiny epoxy garage floor metallic flake professional result',
    'worker applying epoxy coating garage floor professional installation',
    'polished epoxy floor showroom commercial space glossy',
    'residential garage epoxy floor finished result car parked',
  ],
  'basement-waterproofing': [
    'clean dry finished basement interior after waterproofing professional',
    'waterproofing contractor installing drainage system basement',
    'basement wall crack repair professional contractor sealing',
    'waterproofing company truck equipment residential home exterior',
  ],
  'foundation-repair': [
    'foundation repair contractor examining concrete crack exterior home',
    'worker injecting epoxy foundation crack repair professional',
    'house foundation concrete repair structural work professional crew',
    'foundation repair company truck equipment residential neighborhood',
  ],
  'septic-services': [
    'septic tank pumping truck residential home professional service',
    'septic technician inspecting system professional uniform outdoor',
    'septic system installation excavation residential property',
    'septic service company truck equipment suburban neighborhood',
  ],
  'tree-services': [
    'arborist climbing tall tree chainsaw professional gear safety',
    'tree removal crew cutting large tree residential yard equipment',
    'professional tree trimming pruning suburban home clean result',
    'tree service company truck chipper residential street crew uniform',
  ],
  salon: [
    'modern hair salon interior mirrors stations bright professional lighting',
    'stylist cutting coloring hair client salon professional service',
    'hair salon wash station shampoo bowl professional interior',
    'hair salon exterior signage welcoming storefront professional',
  ],
  barbershop: [
    'classic barbershop interior vintage chairs mirrors barber pole',
    'barber giving precise haircut client professional grooming',
    'barbershop straight razor shave hot towel professional close up',
    'modern barbershop exterior professional signage welcoming storefront',
  ],
}

const NICHE_VIDEO_KEYWORDS: Record<string, [string, string]> = {
  hvac:                    ['air conditioning technician home service', 'hvac heating cooling professional'],
  roofing:                 ['roofing contractor shingles installation', 'roof residential construction'],
  dentist:                 ['dental clinic professional office', 'dentist patient healthcare modern'],
  medspa:                  ['luxury spa relaxation treatment', 'wellness beauty facial professional'],
  lawfirm:                 ['law office professional business', 'attorney legal city skyline'],
  remodeling:              ['home renovation kitchen modern', 'interior remodeling contractor'],
  cleaning:                ['professional house cleaning service', 'clean modern interior home'],
  'junk-removal':          ['moving truck loading service', 'clean organized home exterior'],
  daycare:                 ['children playing learning happy', 'colorful classroom preschool'],
  'auto-detailing':        ['luxury sports car polishing detail', 'car wash shine professional'],
  restaurant:              ['restaurant elegant dining atmosphere', 'chef cooking kitchen food'],
  'luxury-realestate':     ['luxury apartment building city skyline', 'modern high rise condominium'],
  plumbing:                ['plumbing repair professional service', 'pipe wrench plumber home'],
  landscaping:             ['landscaping garden lawn mowing', 'green outdoor landscape professional'],
  'pressure-washing':      ['pressure washing driveway clean', 'power washing exterior home'],
  'epoxy-flooring':        ['epoxy floor garage shiny', 'modern floor coating professional'],
  'basement-waterproofing':['basement interior dry clean', 'foundation waterproofing professional'],
  'foundation-repair':     ['foundation repair concrete professional', 'structural repair home'],
  'septic-services':       ['septic tank truck outdoor service', 'drain plumbing professional'],
  'tree-services':         ['tree removal arborist outdoor', 'tree trimming professional nature'],
  salon:                   ['hair salon stylist professional', 'beauty salon interior modern'],
  barbershop:              ['barbershop haircut barber professional', 'classic barbershop interior'],
}

function getVideoKeywords(niche: string): [string, string] {
  return NICHE_VIDEO_KEYWORDS[niche] ?? ['professional service business', 'modern home exterior']
}

function getShotQueries(niche: string): [string, string, string, string] {
  return NICHE_IMAGE_SHOTS[niche] ?? [
    'professional contractor residential home exterior',
    'service technician working tools professional uniform',
    'clean modern home interior professional result',
    'service company truck crew suburban neighborhood',
  ]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Rotate array start point by seed so different leads land on different (still-matching) results. */
function rotate(arr: any[], seed: number): any[] {
  if (arr.length === 0) return arr
  const offset = ((seed % arr.length) + arr.length) % arr.length
  return [...arr.slice(offset), ...arr.slice(0, offset)]
}

async function downloadBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

// ─── Per-provider single-image fetchers ──────────────────────────────────────
// Each returns 1 image buffer or null (for a specific query / slot)

async function pexelsFetchOne(query: string, apiKey: string, seed = 0): Promise<Buffer | null> {
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape`,
      { headers: { Authorization: apiKey }, signal: AbortSignal.timeout(15_000) }
    )
    if (!res.ok) return null
    const data = await res.json() as any
    const photos: any[] = rotate(data.photos ?? [], seed)
    for (const p of photos) {
      const buf = await downloadBuffer(p.src.large2x ?? p.src.large)
      if (buf) return buf
    }
    return null
  } catch { return null }
}

async function pixabayFetchOne(query: string, apiKey: string, seed = 0): Promise<Buffer | null> {
  try {
    const res = await fetch(
      `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=8&safesearch=true&editors_choice=false`,
      { signal: AbortSignal.timeout(15_000) }
    )
    if (!res.ok) return null
    const data = await res.json() as any
    for (const h of rotate(data.hits ?? [], seed)) {
      const buf = await downloadBuffer(h.largeImageURL ?? h.webformatURL)
      if (buf) return buf
    }
    return null
  } catch { return null }
}

async function flickrFetchOne(query: string, apiKey: string, seed = 0): Promise<Buffer | null> {
  try {
    const params = new URLSearchParams({
      method: 'flickr.photos.search',
      api_key: apiKey,
      text: query,
      license: '4,5,6,9,10',  // CC BY / CC0 / PDM — commercial-safe
      content_type: '1',
      media: 'photos',
      sort: 'relevance',
      per_page: '8',
      extras: 'url_l,url_o',
      format: 'json',
      nojsoncallback: '1',
    })
    const res = await fetch(`https://api.flickr.com/services/rest/?${params}`, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return null
    const data = await res.json() as any
    for (const p of rotate(data.photos?.photo ?? [], seed)) {
      const url = p.url_l ?? p.url_o
      if (!url) continue
      const buf = await downloadBuffer(url)
      if (buf) return buf
    }
    return null
  } catch { return null }
}

async function freepikFetchOne(query: string, apiKey: string, seed = 0): Promise<Buffer | null> {
  try {
    const params = new URLSearchParams({
      locale: 'en-US',
      page: '1',
      limit: '8',
      term: query,
      'filters[content_type][photo]': '1',
    })
    const res = await fetch(`https://api.freepik.com/v1/resources?${params}`, {
      headers: { 'X-Freepik-API-Key': apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    const data = await res.json() as any
    for (const item of rotate(data.data ?? [], seed)) {
      const url = item.image?.source?.url
      if (!url) continue
      const buf = await downloadBuffer(url)
      if (buf) return buf
    }
    return null
  } catch { return null }
}

async function unsplashFetchOne(query: string, accessKey: string, seed = 0): Promise<Buffer | null> {
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${accessKey}` }, signal: AbortSignal.timeout(15_000) }
    )
    if (!res.ok) return null
    const data = await res.json() as any
    for (const r of rotate(data.results ?? [], seed)) {
      const buf = await downloadBuffer(r.urls.regular)
      if (buf) return buf
    }
    return null
  } catch { return null }
}

// Tries all enabled providers for a single query, returns first hit
async function fetchOneImage(query: string, seed = 0): Promise<Buffer | null> {
  const providers: Array<() => Promise<Buffer | null>> = []

  const pexelsKey   = process.env.PEXELS_API_KEY
  const pixabayKey  = process.env.PIXABAY_API_KEY
  const flickrKey   = process.env.FLICKR_API_KEY
  const freepikKey  = process.env.FREEPIK_API_KEY
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY

  if (pexelsKey)   providers.push(() => pexelsFetchOne(query, pexelsKey, seed))
  if (pixabayKey)  providers.push(() => pixabayFetchOne(query, pixabayKey, seed))
  if (flickrKey)   providers.push(() => flickrFetchOne(query, flickrKey, seed))
  if (freepikKey)  providers.push(() => freepikFetchOne(query, freepikKey, seed))
  if (unsplashKey) providers.push(() => unsplashFetchOne(query, unsplashKey, seed))

  for (const fn of providers) {
    const buf = await fn()
    if (buf) return buf
  }
  return null
}

// ─── Video fetchers ───────────────────────────────────────────────────────────

async function pexelsSearchVideo(query: string, apiKey: string, seed = 0): Promise<Buffer | null> {
  try {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape&size=medium`,
      { headers: { Authorization: apiKey }, signal: AbortSignal.timeout(15_000) }
    )
    if (!res.ok) return null
    const data = await res.json() as any
    for (const vid of rotate(data.videos ?? [], seed)) {
      const files: any[] = vid.video_files ?? []
      const file = files.find((f: any) => f.quality === 'hd') ?? files.find((f: any) => f.quality === 'sd')
      if (!file?.link) continue
      try {
        const vidRes = await fetch(file.link, { signal: AbortSignal.timeout(120_000) })
        if (vidRes.ok) return Buffer.from(await vidRes.arrayBuffer())
      } catch { continue }
    }
    return null
  } catch { return null }
}

async function pixabaySearchVideo(query: string, apiKey: string, seed = 0): Promise<Buffer | null> {
  try {
    const res = await fetch(
      `https://pixabay.com/api/videos/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=8&safesearch=true`,
      { signal: AbortSignal.timeout(15_000) }
    )
    if (!res.ok) return null
    const data = await res.json() as any
    for (const vid of rotate(data.hits ?? [], seed)) {
      const vidUrl = vid.videos?.large?.url ?? vid.videos?.medium?.url ?? vid.videos?.small?.url
      if (!vidUrl) continue
      try {
        const vidRes = await fetch(vidUrl, { signal: AbortSignal.timeout(120_000) })
        if (vidRes.ok) return Buffer.from(await vidRes.arrayBuffer())
      } catch { continue }
    }
    return null
  } catch { return null }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch 4 stock images for a niche — one per shot slot with dedicated queries.
 * slot 0: wide hero/establishment, 1: work in progress, 2: result/detail, 3: team/vehicle
 * Each slot tries all 5 providers independently → max relevance per slot.
 */
export async function fetchStockImages(niche: string, count: number, seed = 0): Promise<Buffer[]> {
  const shots = getShotQueries(niche)
  const slotCount = Math.min(count, shots.length)

  console.log(`[StockMedia] Fetching ${slotCount} slot-specific images for "${niche}" (seed ${seed})`)

  const results = await Promise.allSettled(
    shots.slice(0, slotCount).map((query, i) => {
      console.log(`  slot ${i}: "${query.slice(0, 60)}..."`)
      return fetchOneImage(query, seed + i)
    })
  )

  const images: Buffer[] = []
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled' && r.value) {
      images.push(r.value)
      console.log(`  [StockMedia] slot ${i}: ✓ (${Math.round(r.value.length / 1024)}KB)`)
    } else {
      console.log(`  [StockMedia] slot ${i}: ✗ no result from any provider`)
    }
  }

  return images
}

/**
 * Fetch one stock video for a niche.
 * Priority: Pexels → Pixabay
 */
export async function fetchStockVideo(niche: string, seed = 0): Promise<Buffer | null> {
  const pexelsKey  = process.env.PEXELS_API_KEY
  const pixabayKey = process.env.PIXABAY_API_KEY

  const [primary, fallback] = getVideoKeywords(niche)

  if (pexelsKey) {
    const vid = await pexelsSearchVideo(primary, pexelsKey, seed)
      ?? await pexelsSearchVideo(fallback, pexelsKey, seed)
    if (vid) {
      console.log(`[StockMedia] Pexels video: ${Math.round(vid.length / 1024 / 1024 * 10) / 10}MB for "${niche}" ✓ (seed ${seed})`)
      return vid
    }
  }

  if (pixabayKey) {
    const vid = await pixabaySearchVideo(primary, pixabayKey, seed)
      ?? await pixabaySearchVideo(fallback, pixabayKey, seed)
    if (vid) {
      console.log(`[StockMedia] Pixabay video: ${Math.round(vid.length / 1024 / 1024 * 10) / 10}MB for "${niche}" ✓ (seed ${seed})`)
      return vid
    }
  }

  return null
}
