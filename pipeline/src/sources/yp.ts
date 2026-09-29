/**
 * Yellow Pages — lead discovery via their internal search API
 * No API key. Uses their JSON search endpoint (same data powering the site).
 * YP.com blocks Playwright (Cloudflare). Their internal fetch endpoint works.
 */
import type { SourceLead } from './types.js'

const YP_SEARCH = 'https://www.yellowpages.com/search/ajaxsearch'

interface YPResult {
  name:          string
  phone:         string
  street:        string
  city:          string
  state:         string
  zip:           string
  website:       string
  listing_id:    string
  url_path:      string
  rating_value:  number
  review_count:  number
  category_list: string[]
}

async function fetchPage(term: string, city: string, state: string, page: number): Promise<YPResult[]> {
  const loc = `${city}, ${state}`
  const url = `${YP_SEARCH}?search_terms=${encodeURIComponent(term)}&geo_location_terms=${encodeURIComponent(loc)}&page=${page}&s=relevance`

  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://www.yellowpages.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) return []

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) {
    // Cloudflare block or HTML response
    return []
  }

  const data = await res.json() as any
  // YP returns results in different shapes; try common paths
  return data?.searchResults?.businessResults
      ?? data?.businessResults
      ?? data?.data?.listings
      ?? []
}

export async function scrapeYP(opts: {
  term:      string
  city:      string
  state:     string
  niche:     string
  maxPages?: number
}): Promise<SourceLead[]> {
  const { term, city, state, niche, maxPages = 5 } = opts
  const leads: SourceLead[] = []

  for (let p = 1; p <= maxPages; p++) {
    let batch: YPResult[]
    try {
      batch = await fetchPage(term, city, state, p)
    } catch {
      break
    }
    if (!batch.length) break

    for (const b of batch) {
      leads.push({
        name:        b.name,
        phone:       b.phone?.replace(/[^\d+]/g,'') || undefined,
        website:     b.website || undefined,
        address:     [b.street, b.city, b.state].filter(Boolean).join(', ') || undefined,
        city:        b.city || city,
        state:       b.state || state,
        niche,
        rating:      b.rating_value,
        reviewCount: b.review_count,
        hasWebsite:  !!b.website,
        source:      'yellowpages',
        sourceUrl:   b.url_path ? `https://www.yellowpages.com${b.url_path}` : undefined,
      })
    }

    await new Promise(r => setTimeout(r, 400))
  }

  return leads
}

/** Phone lookup for a specific business via YP API */
export async function ypPhoneLookup(name: string, city: string, state: string): Promise<string | null> {
  try {
    const results = await fetchPage(name, city, state, 1)
    if (!results.length) return null
    const match = results.find(r =>
      r.name.toLowerCase().includes(name.toLowerCase().slice(0,12))
    ) ?? results[0]
    return match.phone?.replace(/[^\d+]/g,'') || null
  } catch {
    return null
  }
}
