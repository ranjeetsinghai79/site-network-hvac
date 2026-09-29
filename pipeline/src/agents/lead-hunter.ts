import { searchPlaces } from '../tools/google-places.js'
import type { Lead, PipelineConfig, AgentResult } from '../types.js'
import { logCost } from '../tools/cost-tracker.js'

// ─── Lead qualification ────────────────────────────────────────────────────
//
// Target ALL businesses — with or without existing websites.
// tier1 = no website (fresh build, $299 pitch)
// tier2 = has website (upgrade pitch, $599)
//
// Missing contact info handling:
//   phone only   → SMS outreach
//   email only   → email outreach
//   both         → email + SMS
//   neither      → skip (can't reach them)

export async function runLeadHunterAgent(
  config: PipelineConfig
): Promise<AgentResult<Lead[]>> {
  console.log(`[LeadHunter] Searching: ${config.niche} in ${config.location}`)

  try {
    const places = await searchPlaces(config.niche, config.location, config.count * 2) // fetch 2x — scorer will thin

    // Places API (New) Text Search = $0.05/request (Advanced Data fields)
    // searchPlaces makes up to 3 queries (one per niche query string)
    const queryCount = Math.min(3, Math.ceil(config.count * 2 / 20))
    await logCost({ service: 'places_api', units: queryCount, note: `${config.niche} in ${config.location}` })

    const leads: Lead[] = []
    const seen = new Set<string>()

    for (const p of places) {
      if (seen.has(p.place_id)) continue
      seen.add(p.place_id)

      const hasPhone   = !!p.phone
      const hasWebsite = !!p.website

      // Hard skip: no phone — can't reach them
      if (!hasPhone) {
        console.log(`  [skip] ${p.name} — no phone`)
        continue
      }

      // Tier assignment: tier1 = no website (fresh build), tier2 = has website (upgrade)
      const tier: 'tier1' | 'tier2' = hasWebsite ? 'tier2' : 'tier1'

      // Quality gate for tier1: must have real Google data to build a personalized site.
      // A site with only a business name converts < 2%. Skip low-data leads.
      if (tier === 'tier1') {
        const hasRating  = (p.rating ?? 0) >= 3.5
        const hasReviews = (p.review_count ?? 0) >= 5
        const hasReviewText = (p.reviews?.filter(r => (r.text?.length ?? 0) > 10).length ?? 0) >= 1
        if (!hasRating || !hasReviews || !hasReviewText) {
          console.log(`  [skip] ${p.name} — insufficient Google data (rating:${p.rating}, reviews:${p.review_count})`)
          continue
        }
      }

      // Prefer city/state from Places addressComponents over pipeline config
      // (Places returns actual business location; config.city is the search city)
      const addrCity  = p.addressComponents?.city  ?? config.city
      const addrState = p.addressComponents?.state ?? config.state
      const addrZip   = p.addressComponents?.zip

      leads.push({
        place_id:           p.place_id,
        name:               p.name,
        phone:              p.phone,
        email:              undefined,     // enriched later via brand-analyst scrape
        website:            p.website,
        address:            p.address,
        city:               addrCity,
        state:              addrState,
        zip:                addrZip,
        niche:              config.niche,
        status:             'found',
        tier,
        // ── Expanded Places fields ─────────────────────────────────────────
        rating:             p.rating,
        review_count:       p.review_count,
        international_phone: p.internationalPhone,
        business_status:    p.businessStatus,
        primary_type:       p.primaryType,
        editorial_summary:  p.editorialSummary,
        open_now:           p.currentOpeningHours?.openNow,
        weekday_hours:      p.currentOpeningHours?.weekdayDescriptions
                            ?? p.regularOpeningHours?.weekdayDescriptions,
        photo_count:        p.photoCount,
        photo_names:        p.photoNames,
        google_reviews:     p.reviews?.filter((r): r is typeof r & { text: string } => !!r.text),
        price_level:        p.priceLevel,
        google_maps_uri:    p.googleMapsUri,
        latitude:           p.location?.latitude,
        longitude:          p.location?.longitude,
      })
    }

    const t1 = leads.filter(l => l.tier === 'tier1').length
    const t2 = leads.filter(l => l.tier === 'tier2').length
    console.log(`[LeadHunter] ${leads.length} leads found (tier1 no-website: ${t1}, tier2 has-website: ${t2})`)

    return { success: true, data: leads.slice(0, config.count) }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
