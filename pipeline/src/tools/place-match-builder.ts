/**
 * place-match-builder.ts
 *
 * Shared by auto-build-from-sms.ts (SMS "YES" trigger) and any proactive rebuild
 * script: matches a name/phone/city to the real Google Places listing (real photos,
 * reviews, rating, hours), saves it as a Lead, and runs the full build+deploy
 * pipeline. Extracted from auto-build-from-sms.ts's local triggerPipelineBuild()
 * so both callers share one implementation instead of drifting.
 */

import { searchPlaces } from './google-places.js'
import { scrapePlaceDetails } from './maps-place-scraper.js'
import { saveLead } from '../db/supabase.js'
import { runPipelineForLead } from '../orchestrator.js'
import type { Lead } from '../types.js'

export function phoneDigits(p?: string): string {
  return (p ?? '').replace(/\D/g, '').slice(-10)
}

export interface PlaceMatchBuildRequest {
  phone?: string
  name: string
  niche: string
  city: string
  state: string
  /** tier1 = no-website build (auto-build-from-sms default); tier2 = has an old
   *  website we're proactively rebuilding — keeps runOutreachAgent's tier2 "audit +
   *  AI reception" copy branch, which is what shows the truthful before/after email. */
  tier?: 'tier1' | 'tier2'
  /** Embed and provision the browser voice/text AI salesperson in the built site. */
  talkingWebsite?: boolean
}

export interface PlaceMatchBuildResult {
  leadId: string
  deployedUrl: string
}

export async function buildLeadFromPlacesMatch(req: PlaceMatchBuildRequest): Promise<PlaceMatchBuildResult | null> {
  // 1. Find the REAL business on Google Places — real photos, reviews, rating, address, hours
  const location = req.city ? `${req.city}${req.state ? ', ' + req.state : ''}` : 'US'
  console.log(`[Build] Places lookup: "${req.name}" in ${location}`)
  const places = await searchPlaces(req.name, location, 5)

  // Match by phone first (strongest signal), then name similarity
  const reqDigits = phoneDigits(req.phone)
  const nameLower = req.name.toLowerCase()
  const place =
    places.find(p => phoneDigits(p.phone) === reqDigits) ??
    places.find(p => p.name.toLowerCase().includes(nameLower) || nameLower.includes(p.name.toLowerCase())) ??
    places[0]

  if (!place) {
    console.warn(`[Build] No Places match for "${req.name}" — cannot build with real data`)
    return null
  }
  console.log(`[Build] Matched: ${place.name} | ${place.address ?? ''} | rating ${place.rating ?? '—'} (${place.review_count ?? 0} reviews, ${place.photoCount ?? 0} photos)`)

  // 1b. Deep-scrape Maps page: more real reviews + full photo gallery (free)
  const details = await scrapePlaceDetails(place.place_id, { maxPhotos: 60 }).catch(() => null)
  const scrapedReviews = (details?.reviews ?? [])
    .filter(r => r.text.length > 20 && r.rating >= 4)
    .map(r => ({ rating: r.rating, text: r.text, authorName: r.author, relativeTime: r.date }))

  // Merge Places API reviews + scraped inline reviews, dedupe by text prefix
  const apiReviews = place.reviews?.filter((r): r is typeof r & { text: string } => !!r.text) ?? []
  const seenTexts = new Set(apiReviews.map(r => r.text.slice(0, 40)))
  const allReviews = [
    ...apiReviews,
    ...scrapedReviews.filter(r => !seenTexts.has(r.text.slice(0, 40))),
  ]
  console.log(`[Build] Reviews: ${apiReviews.length} from API + ${allReviews.length - apiReviews.length} scraped = ${allReviews.length} total`)

  // 2. Persist full lead with real Places data (same mapping as lead-hunter)
  const lead: Lead = {
    place_id:            place.place_id,
    name:                place.name,
    phone:               place.phone ?? req.phone,
    website:             place.website,
    address:             place.address,
    city:                place.addressComponents?.city  ?? req.city,
    state:               place.addressComponents?.state ?? req.state,
    zip:                 place.addressComponents?.zip,
    niche:               req.niche as Lead['niche'],
    status:              'found',
    tier:                req.tier ?? 'tier1',
    rating:              place.rating,
    review_count:        place.review_count,
    international_phone: place.internationalPhone,
    business_status:     place.businessStatus,
    primary_type:        place.primaryType,
    editorial_summary:   place.editorialSummary,
    open_now:            place.currentOpeningHours?.openNow,
    weekday_hours:       place.currentOpeningHours?.weekdayDescriptions
                         ?? place.regularOpeningHours?.weekdayDescriptions,
    photo_count:         place.photoCount,
    photo_names:         place.photoNames,
    google_reviews:      allReviews,
    price_level:         place.priceLevel,
    google_maps_uri:     place.googleMapsUri,
    latitude:            place.location?.latitude,
    longitude:           place.location?.longitude,
  }

  const saved = await saveLead(lead)
  if (!saved?.id) {
    console.warn(`[Build] saveLead failed for ${place.name}`)
    return null
  }

  // 3. Full real pipeline: brand-analyst → niche-brain → config-gen → images → build → deploy
  //    skipOutreach — caller decides when/how to send outreach with the deployed URL.
  const deployed = await runPipelineForLead(saved.id, {}, { skipOutreach: true, talkingWebsite: req.talkingWebsite })
  const deployedUrl = (deployed as any)?.cloudflare_url ?? (deployed as any)?.vercel_url ?? null
  if (!deployedUrl) return null
  return { leadId: saved.id, deployedUrl }
}
