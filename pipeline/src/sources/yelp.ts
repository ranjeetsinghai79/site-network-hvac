/**
 * Yelp Fusion API — lead discovery + phone numbers
 * Free: 500 API calls/day
 * Signup: https://www.yelp.com/developers/v3/manage_app
 * Env: YELP_API_KEY
 *
 * Returns businesses with phone, address, rating, website flag.
 * Yelp often has phone numbers Google Maps doesn't.
 */
import type { SourceLead } from './types.js'

const BASE = 'https://api.yelp.com/v3'

interface YelpBusiness {
  id: string
  name: string
  phone: string
  display_phone: string
  location: { address1: string; city: string; state: string; zip_code: string }
  coordinates: { latitude: number; longitude: number }
  rating: number
  review_count: number
  url: string
  categories: Array<{ alias: string; title: string }>
  is_claimed: boolean
  // not in search, only in details
  website?: string
}

interface YelpSearchResponse {
  businesses: YelpBusiness[]
  total: number
}

async function yelpSearch(term: string, location: string, limit = 50, offset = 0): Promise<YelpBusiness[]> {
  const key = process.env.YELP_API_KEY
  if (!key) throw new Error('YELP_API_KEY not set — get free key at yelp.com/developers')

  const url = `${BASE}/businesses/search?term=${encodeURIComponent(term)}&location=${encodeURIComponent(location)}&limit=${limit}&offset=${offset}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Yelp API ${res.status}: ${err.slice(0,200)}`)
  }
  const data = await res.json() as YelpSearchResponse
  return data.businesses ?? []
}

async function yelpDetails(id: string): Promise<{ website?: string; hours?: string }> {
  const key = process.env.YELP_API_KEY!
  const res = await fetch(`${BASE}/businesses/${id}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return {}
  const d = await res.json() as any
  return { website: d.url, hours: d.hours?.[0]?.open ? 'has_hours' : undefined }
}

/** Scrape up to maxResults leads for a niche+city from Yelp */
export async function scrapeYelp(opts: {
  term:       string   // e.g. "medical spas"
  city:       string
  state:      string
  niche:      string
  maxResults?: number  // default 200 (4 pages × 50)
  fetchDetails?: boolean  // get website per biz (costs extra API calls)
}): Promise<SourceLead[]> {
  const { term, city, state, niche, maxResults = 200, fetchDetails = false } = opts
  const location = `${city}, ${state}`
  const leads: SourceLead[] = []

  let offset = 0
  while (leads.length < maxResults) {
    const batch = await yelpSearch(term, location, 50, offset)
    if (!batch.length) break

    for (const b of batch) {
      let website: string | undefined
      if (fetchDetails && b.id) {
        await new Promise(r => setTimeout(r, 300)) // rate limit
        const det = await yelpDetails(b.id).catch((): { website?: string; hours?: string } => ({}))
        website = det.website
      }

      leads.push({
        name:        b.name,
        phone:       b.phone?.replace(/\D/g, '') ? b.display_phone : undefined,
        website,
        address:     [b.location.address1, b.location.city, b.location.state].filter(Boolean).join(', '),
        city:        b.location.city || city,
        state:       b.location.state || state,
        niche,
        rating:      b.rating,
        reviewCount: b.review_count,
        hasWebsite:  !!website,
        source:      'yelp',
        sourceUrl:   b.url,
      })
    }

    offset += 50
    if (batch.length < 50) break
    await new Promise(r => setTimeout(r, 200))
  }

  return leads.slice(0, maxResults)
}

/** Yelp phone lookup for a specific business by name + city (enrichment) */
export async function yelpPhoneLookup(name: string, city: string, state: string): Promise<string | null> {
  try {
    const businesses = await yelpSearch(name, `${city}, ${state}`, 3)
    if (!businesses.length) return null
    // Match by name similarity
    const match = businesses.find(b =>
      b.name.toLowerCase().includes(name.toLowerCase().slice(0,15)) ||
      name.toLowerCase().includes(b.name.toLowerCase().slice(0,15))
    ) ?? businesses[0]
    return match.phone || null
  } catch {
    return null
  }
}
