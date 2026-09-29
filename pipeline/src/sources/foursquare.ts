/**
 * Foursquare Places API — lead discovery
 * Free: 1,000 calls/day. No scraping. High quality with phones.
 *
 * Setup: developer.foursquare.com → create app → copy API Key
 * Set: FOURSQUARE_API_KEY in pipeline/.env
 *
 * Docs: https://docs.foursquare.com/developer/reference/place-search
 */
import type { SourceLead } from './types.js'

const BASE = 'https://api.foursquare.com/v3/places/search'

const CATEGORY_MAP: Record<string, string> = {
  hvac:         '11131',   // HVAC & Air Conditioning
  roofing:      '11159',   // Contractors (general)
  plumbing:     '11137',   // Plumbing
  cleaning:     '11124',   // Cleaning Services
  landscaping:  '11133',   // Landscaping
  remodeling:   '11159',   // Contractors
  autodetail:   '63027',   // Auto Detailing
  restaurant:   '13000',   // Food & Dining (top-level)
  dentist:      '15014',   // Dentist & Orthodontist
  medspa:       '15053',   // Spa & Beauty
  skinclinic:   '15053',
  ivtherapy:    '15060',   // Medical
  nailstudio:   '15029',   // Nail Salon
  salon:        '11121',   // Beauty Salon
  barbershop:   '11113',   // Barber
  lawfirm:      '12058',   // Legal Services
  realestate:   '12059',   // Real Estate
  financial:    '12055',   // Financial Services
}

interface FSQPlace {
  fsq_id:     string
  name:       string
  tel?:       string
  email?:     string
  website?:   string
  rating?:    number
  stats?:     { total_ratings?: number }
  location:   { formatted_address?: string; address?: string; locality?: string; region?: string }
  categories: Array<{ name: string }>
}

async function fetchPage(
  term: string,
  city: string,
  state: string,
  categoryId: string | null,
  cursor: string | null,
  apiKey: string
): Promise<{ places: FSQPlace[]; nextCursor: string | null }> {
  const params = new URLSearchParams({
    query:  term,
    near:   `${city}, ${state}`,
    limit:  '50',
    fields: 'fsq_id,name,tel,email,website,rating,stats,location,categories',
  })
  if (categoryId) params.set('categories', categoryId)
  if (cursor)     params.set('cursor', cursor)

  const res = await fetch(`${BASE}?${params}`, {
    headers: {
      'Authorization': apiKey,
      'Accept':        'application/json',
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.status.toString())
    throw new Error(`Foursquare ${res.status}: ${err.slice(0,100)}`)
  }

  const data = await res.json() as { results: FSQPlace[]; context?: { geo_bounds?: any }; link?: string }
  const nextCursor = res.headers.get('Link')?.match(/cursor=([^&>]+)/)?.[1] ?? null

  return { places: data.results ?? [], nextCursor }
}

export async function scrapeFoursquare(opts: {
  term:      string
  city:      string
  state:     string
  niche:     string
  maxPages?: number
}): Promise<SourceLead[]> {
  const apiKey = process.env.FOURSQUARE_API_KEY
  if (!apiKey) throw new Error('FOURSQUARE_API_KEY not set — get free key at developer.foursquare.com')

  const { term, city, state, niche, maxPages = 3 } = opts
  const categoryId = CATEGORY_MAP[niche] ?? null
  const leads: SourceLead[] = []
  let cursor: string | null = null

  for (let p = 0; p < maxPages; p++) {
    const { places, nextCursor } = await fetchPage(term, city, state, categoryId, cursor, apiKey)
    if (!places.length) break

    for (const pl of places) {
      leads.push({
        name:        pl.name,
        phone:       pl.tel?.replace(/[^\d+]/g, '').slice(0, 15) || undefined,
        email:       pl.email || undefined,
        website:     pl.website || undefined,
        address:     pl.location.formatted_address || pl.location.address || undefined,
        city:        pl.location.locality || city,
        state:       pl.location.region   || state,
        niche,
        rating:      pl.rating,
        reviewCount: pl.stats?.total_ratings,
        hasWebsite:  !!pl.website,
        source:      'foursquare',
        sourceUrl:   `https://foursquare.com/v/${pl.fsq_id}`,
      })
    }

    cursor = nextCursor
    if (!cursor) break
    await new Promise(r => setTimeout(r, 300))
  }

  return leads
}

/** Phone lookup for a specific business via Foursquare */
export async function foursquarePhoneLookup(name: string, city: string, state: string): Promise<string | null> {
  const apiKey = process.env.FOURSQUARE_API_KEY
  if (!apiKey) return null
  try {
    const { places } = await fetchPage(name, city, state, null, null, apiKey)
    if (!places.length) return null
    const match = places.find(p =>
      p.name.toLowerCase().includes(name.toLowerCase().slice(0, 12))
    ) ?? places[0]
    return match.tel?.replace(/[^\d+]/g, '').slice(0, 15) || null
  } catch {
    return null
  }
}
