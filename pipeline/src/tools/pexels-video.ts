interface PexelsVideo {
  videoUrl: string
  posterUrl: string
  credit: string
  duration: number
}

export interface PexelsPhoto {
  url: string       // full-size download URL
  thumb: string     // small preview
  credit: string
  alt: string
}

const NICHE_QUERIES: Record<string, string> = {
  hvac:                   'hvac technician service air conditioning professional',
  roofing:                'roofing contractor roof installation',
  dentist:                'dental clinic dentist patient',
  medspa:                 'medical spa wellness beauty treatment',
  lawfirm:                'law office attorney professional',
  remodeling:             'home renovation kitchen remodel',
  cleaning:               'professional cleaning service home',
  'junk-removal':         'junk removal truck loading',
  daycare:                'children daycare learning play',
  'auto-detailing':       'car detailing wash shine',
  restaurant:             'restaurant kitchen chef cooking',
  'luxury-realestate':    'luxury home interior modern',
  salon:                  'hair salon stylist professional',
  barbershop:             'barbershop haircut barber',
  plumbing:               'plumber pipe repair service',
  landscaping:            'landscaping garden lawn care',
  'pressure-washing':     'pressure washing driveway clean',
  'epoxy-flooring':       'epoxy floor coating garage',
  'basement-waterproofing': 'basement waterproofing foundation',
  'foundation-repair':    'foundation repair construction',
  'septic-services':      'septic tank service maintenance',
  'tree-services':        'tree trimming removal arborist',
}

// Per-slot targeted queries — 6 service-specific search terms per niche
const NICHE_SERVICE_QUERIES: Record<string, string[]> = {
  hvac: [
    'hvac technician repairing air conditioner gauges',
    'outdoor air conditioning condenser unit home',
    'furnace heating system basement installation',
    'hvac emergency service technician van truck',
    'air duct cleaning vent professional worker',
    'rooftop commercial hvac unit installation',
  ],
  roofing: [
    'roofer installing shingles roof worker',
    'storm damage roof repair crew',
    'roofing contractor inspection clipboard',
    'emergency roof tarping crew workers',
    'gutter installation worker ladder',
    'roof inspection aerial view professional',
  ],
  plumbing: [
    'plumber fixing pipe leak under sink',
    'water heater installation technician',
    'drain cleaning plumber professional',
    'emergency plumbing flooded bathroom',
    'pipe repair professional tools',
    'faucet fixture installation bathroom',
  ],
  dentist: [
    'dentist examining patient teeth chair',
    'teeth whitening dental treatment uv light',
    'dental x-ray equipment digital',
    'dental implant procedure professional',
    'orthodontics braces invisalign tray',
    'dental hygienist cleaning patient teeth',
  ],
  medspa: [
    'medical professional botox injection face',
    'laser hair removal treatment clinic',
    'hydrafacial facial treatment spa',
    'chemical peel skincare professional',
    'microneedling skin rejuvenation device',
    'body contouring treatment professional',
  ],
  lawfirm: [
    'attorney lawyer office professional',
    'personal injury court legal consultation',
    'family law mediation conference room',
    'criminal defense lawyer briefcase courthouse',
    'business law corporate meeting table',
    'estate planning documents signing notary',
  ],
  remodeling: [
    'kitchen remodel renovation modern cabinets',
    'bathroom renovation tiles worker install',
    'home addition framing construction crew',
    'hardwood flooring installation worker',
    'deck outdoor construction lumber build',
    'interior home renovation painting crew',
  ],
  cleaning: [
    'professional cleaner vacuuming home',
    'deep cleaning kitchen professional mop',
    'move out cleaning empty house service',
    'commercial office cleaning crew night',
    'post construction dust cleaning worker',
    'cleaning service team supplies uniform',
  ],
  'junk-removal': [
    'junk removal workers loading truck',
    'furniture removal team hauling sofa',
    'appliance removal heavy refrigerator',
    'estate cleanout workers sorting items',
    'construction debris removal dump truck',
    'yard debris cleanup leaf blower crew',
  ],
  daycare: [
    'children playing daycare classroom teacher',
    'toddler learning activity art table',
    'preschool kids reading books circle',
    'after school homework help teacher',
    'summer camp kids outdoor playground',
    'daycare nap time children cots',
  ],
  'auto-detailing': [
    'car detailing ceramic coating wipe application',
    'paint correction orbital polisher buffing',
    'car interior vacuum steam cleaning',
    'paint protection film ppf application',
    'window tinting car film professional',
    'car wash foam soap shine exterior',
  ],
  restaurant: [
    'chef cooking restaurant kitchen flames',
    'restaurant dining room ambiance candles',
    'gourmet food plating dish presentation',
    'restaurant bar cocktails bartender',
    'private dining event catering setup',
    'fresh ingredients market local produce',
  ],
  'luxury-realestate': [
    'luxury apartment interior modern design',
    'penthouse rooftop view city skyline',
    'villa pool outdoor luxury estate',
    'real estate agent showing modern home',
    'luxury condo building exterior architecture',
    'property investment contract signing office',
  ],
  salon: [
    'hair stylist cutting hair salon chair',
    'hair color highlights foil professional',
    'blowout styling round brush salon',
    'keratin treatment smooth hair professional',
    'salon interior modern chairs mirrors',
    'balayage color technique hair salon',
  ],
  barbershop: [
    'barber cutting hair clipper fade',
    'straight razor hot towel shave',
    'beard trim shape lineup professional',
    'barbershop interior vintage chairs poles',
    'taper fade haircut technique barber',
    'barber consultation client style',
  ],
  landscaping: [
    'landscaper mowing lawn riding mower',
    'garden planting flowers mulch bed',
    'tree trimming arborist pole saw',
    'sprinkler irrigation head installation',
    'patio stone hardscape installation crew',
    'lawn care fertilizer spreader worker',
  ],
  'pressure-washing': [
    'pressure washing concrete driveway clean',
    'power washing house siding exterior',
    'deck cleaning pressure washer wood',
    'commercial pressure washing parking lot',
    'roof soft wash cleaning moss removal',
    'fence cleaning power wash before after',
  ],
  'epoxy-flooring': [
    'epoxy floor coating application roller garage',
    'metallic epoxy floor pour swirl design',
    'commercial epoxy flooring warehouse grey',
    'floor grinder diamond prep concrete',
    'epoxy floor glossy shine finished garage',
    'industrial epoxy flooring professional crew',
  ],
  'basement-waterproofing': [
    'basement waterproofing interior drain tile',
    'sump pump installation pit basement',
    'basement wall crack repair injection',
    'exterior waterproofing membrane excavation',
    'dehumidifier basement dry moisture',
    'encapsulation vapor barrier crawl space',
  ],
  'foundation-repair': [
    'foundation pier bracket installation crew',
    'concrete crack repair epoxy injection',
    'foundation wall steel beam stabilization',
    'helical pier auger foundation drilling',
    'basement wall bowing carbon fiber strap',
    'foundation inspector measuring crack',
  ],
  'septic-services': [
    'septic tank pump truck hose vacuum',
    'septic inspection probe camera',
    'drain field leach pipe installation',
    'septic system cover lid open',
    'grease trap restaurant cleaning service',
    'sewer line camera inspection worker',
  ],
  'tree-services': [
    'arborist chainsaw tree trimming branch',
    'tree removal crane rigging professional',
    'stump grinder removal machine worker',
    'emergency fallen tree storm removal crew',
    'tree health inspection arborist climbing',
    'wood chipper crew chipping branches',
  ],
}

// Deterministic hash: same business = same page offset = same images. Different business = different.
function nameHash(name: string): number {
  let h = 5381
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) >>> 0
  return h
}

export async function fetchServicePhotos(niche: string, businessName?: string): Promise<(PexelsPhoto | null)[]> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) {
    console.warn('[pexels-photos] PEXELS_API_KEY not set — skipping service photos')
    return Array(6).fill(null)
  }

  const queries = NICHE_SERVICE_QUERIES[niche] ?? Array(6).fill(NICHE_QUERIES[niche] ?? `${niche} service professional`)
  // Per-slot page offset from business name hash → different business = different photos
  const baseOffset = businessName ? (nameHash(businessName) % 8) : 0

  const results = await Promise.all(
    queries.map(async (query, slotIndex): Promise<PexelsPhoto | null> => {
      // Each slot shifts page by its own index so all 6 slots differ even within same business
      const page = ((baseOffset + slotIndex) % 8) + 1
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&per_page=5&page=${page}&size=large`
      try {
        const res = await fetch(url, { headers: { Authorization: apiKey } })
        if (!res.ok) return null
        const data = await res.json() as any
        const photos: any[] = data.photos ?? []
        // Pick photo at slot-specific index within the page for further variety
        const pick = photos[(slotIndex * 3) % photos.length]
        if (!pick?.src) return null
        return {
          url:    pick.src.large2x ?? pick.src.large,
          thumb:  pick.src.medium ?? pick.src.small,
          credit: pick.photographer ? `Photo by ${pick.photographer} on Pexels` : 'Pexels',
          alt:    pick.alt ?? query,
        }
      } catch {
        return null
      }
    })
  )

  const found = results.filter(Boolean).length
  console.log(`[pexels-photos] Service-specific photos: ${found}/6 found for "${niche}" (page offset: ${baseOffset})`)
  return results
}

export async function fetchNicheVideo(
  niche: string,
  city?: string
): Promise<PexelsVideo | null> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) {
    console.warn('[pexels-video] PEXELS_API_KEY not set — skipping stock video')
    return null
  }

  const query = NICHE_QUERIES[niche] ?? `${niche} service professional`
  const url   = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=landscape&min_duration=12&per_page=15`

  try {
    const res = await fetch(url, { headers: { Authorization: apiKey } })
    if (!res.ok) {
      console.warn('[pexels-video] API error:', res.status, await res.text())
      return null
    }

    const data = await res.json() as any
    const videos: any[] = data.videos ?? []

    // Collect all viable candidates, pick best (longest cinematic duration, highest res)
    type Candidate = { videoUrl: string; posterUrl: string; credit: string; duration: number; score: number }
    const candidates: Candidate[] = []

    for (const video of videos) {
      const hdFile = (video.video_files as any[])
        .filter(f => f.quality === 'hd' && f.width >= 1280)
        .sort((a, b) => b.width - a.width)[0]
      if (!hdFile?.link) continue

      const duration = video.duration ?? 10
      // Score: prefer 15-60s clips, prefer higher res
      const durationScore = duration >= 15 ? 2 : 1
      const resScore = hdFile.width >= 1920 ? 2 : 1
      candidates.push({
        videoUrl:  hdFile.link,
        posterUrl: video.image ?? '',
        credit:    video.user?.name ? `Video by ${video.user.name} on Pexels` : 'Pexels',
        duration,
        score: durationScore + resScore,
      })
    }

    if (!candidates.length) {
      console.warn(`[pexels-video] No suitable video found for niche "${niche}"`)
      return null
    }

    candidates.sort((a, b) => b.score - a.score)
    const best = candidates[0]
    console.log(`[pexels-video] Found video for "${niche}": ${best.videoUrl.split('?')[0]} (${best.duration}s)`)
    return { videoUrl: best.videoUrl, posterUrl: best.posterUrl, credit: best.credit, duration: best.duration }

  } catch (e: any) {
    console.error('[pexels-video] fetch failed:', e.message)
    return null
  }
}

export async function fetchNichePhotos(
  niche: string,
  count = 6
): Promise<PexelsPhoto[]> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) {
    console.warn('[pexels-photos] PEXELS_API_KEY not set — skipping stock photos')
    return []
  }

  const query = NICHE_QUERIES[niche] ?? `${niche} service professional`
  const url   = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&per_page=${count * 2}&size=large`

  try {
    const res = await fetch(url, { headers: { Authorization: apiKey } })
    if (!res.ok) {
      console.warn('[pexels-photos] API error:', res.status)
      return []
    }

    const data = await res.json() as any
    const photos: any[] = data.photos ?? []

    const results: PexelsPhoto[] = photos
      .filter(p => p.src?.large2x || p.src?.large)
      .slice(0, count)
      .map(p => ({
        url:    p.src.large2x ?? p.src.large,
        thumb:  p.src.medium ?? p.src.small,
        credit: p.photographer ? `Photo by ${p.photographer} on Pexels` : 'Pexels',
        alt:    p.alt ?? query,
      }))

    console.log(`[pexels-photos] Found ${results.length} photos for "${niche}"`)
    return results

  } catch (e: any) {
    console.error('[pexels-photos] fetch failed:', e.message)
    return []
  }
}
