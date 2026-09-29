const NICHE_QUERIES: Record<string, string[]> = {
  hvac: ['HVAC contractor', 'air conditioning repair', 'heating repair'],
  plumbing: ['plumber', 'plumbing repair', 'drain cleaning'],
  restaurant: ['Indian restaurant', 'restaurant', 'diner'],
  medspa: ['med spa', 'medical spa', 'laser hair removal', 'botox clinic'],
  roofing: ['roofing contractor', 'roof repair', 'roofer'],
  dentist: ['dentist', 'dental clinic', 'dental office'],
  lawfirm: ['law firm', 'attorney', 'lawyer'],
  remodeling: ['home remodeling', 'kitchen remodeling', 'bathroom remodeling'],
  cleaning: ['house cleaning', 'cleaning service', 'maid service'],
  'junk-removal': ['junk removal', 'junk hauling', 'debris removal'],
  daycare: ['daycare', 'child care', 'preschool'],
  'auto-detailing': ['auto detailing', 'car detailing', 'mobile detailing'],
  'luxury-realestate': ['luxury real estate', 'luxury homes', 'luxury realtor'],
}

// ─── Structured address components ──────────────────────────────────────────
export interface AddressComponents {
  streetNumber?: string
  route?: string            // street name
  city?: string             // locality
  county?: string           // administrative_area_level_2
  state?: string            // administrative_area_level_1 (short, e.g. "CA")
  stateFull?: string        // long form, e.g. "California"
  zip?: string              // postal_code
  country?: string          // short, e.g. "US"
}

// ─── Opening hours ───────────────────────────────────────────────────────────
export interface OpeningHours {
  openNow?: boolean
  weekdayDescriptions?: string[]   // e.g. "Monday: 8:00 AM – 6:00 PM"
  periods?: Array<{
    open?:  { day: number; hour: number; minute: number }
    close?: { day: number; hour: number; minute: number }
  }>
}

// ─── Full PlaceLead — every field Places API v1 returns ─────────────────────
export interface PlaceLead {
  // Core identity
  place_id: string
  name: string
  address: string                   // formattedAddress
  shortAddress?: string             // shortFormattedAddress
  addressComponents?: AddressComponents

  // Contact
  phone?: string                    // nationalPhoneNumber
  internationalPhone?: string       // E.164, e.g. "+14155552671" — for Twilio
  website?: string

  // Reputation
  rating?: number
  review_count?: number
  photoCount?: number               // # of photos on the listing (proxy for how established)
  photoNames?: string[]             // photo name refs e.g. "places/{id}/photos/{ref}" — fetch via Places Photo API
  reviews?: Array<{
    rating: number
    text?: string
    authorName?: string
    relativeTime?: string
  }>

  // Business status
  businessStatus?: string           // OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY
  primaryType?: string              // e.g. "hvac_contractor", "dentist"
  primaryTypeDisplayName?: string   // human-readable, e.g. "HVAC Contractor"
  types?: string[]                  // full type array

  // Description
  editorialSummary?: string         // Google's AI-generated summary

  // Hours
  currentOpeningHours?: OpeningHours
  regularOpeningHours?: OpeningHours

  // Attributes
  priceLevel?: string               // PRICE_LEVEL_INEXPENSIVE etc.
  paymentOptions?: {
    acceptsCreditCards?: boolean
    acceptsDebitCards?: boolean
    acceptsCashOnly?: boolean
    acceptsNfc?: boolean
  }
  accessibilityOptions?: {
    wheelchairAccessibleEntrance?: boolean
    wheelchairAccessibleParking?: boolean
  }

  // Location
  location?: { latitude: number; longitude: number }
  googleMapsUri?: string
  plusCode?: { globalCode: string; compoundCode?: string }
}

// ─── Field mask — every billable field we want ───────────────────────────────
// Places API (New) bills per field category; requesting all is fine.
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.addressComponents',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'places.googleMapsUri',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.types',
  'places.editorialSummary',
  'places.currentOpeningHours',
  'places.regularOpeningHours',
  'places.photos',
  'places.reviews',
  'places.location',
  'places.priceLevel',
  'places.paymentOptions',
  'places.accessibilityOptions',
  'places.plusCode',
].join(',')

// ─── Parse addressComponents array → flat object ────────────────────────────
function parseAddressComponents(raw: any[]): AddressComponents {
  const find = (type: string, field: 'longText' | 'shortText' = 'longText') =>
    raw.find((c: any) => c.types?.includes(type))?.[field]

  return {
    streetNumber: find('street_number'),
    route:        find('route'),
    city:         find('locality') ?? find('sublocality') ?? find('sublocality_level_1'),
    county:       find('administrative_area_level_2'),
    state:        find('administrative_area_level_1', 'shortText'),
    stateFull:    find('administrative_area_level_1', 'longText'),
    zip:          find('postal_code'),
    country:      find('country', 'shortText'),
  }
}

// ─── Parse opening hours object ──────────────────────────────────────────────
function parseHours(raw: any): OpeningHours | undefined {
  if (!raw) return undefined
  return {
    openNow:             raw.openNow,
    weekdayDescriptions: raw.weekdayDescriptions,
    periods:             raw.periods,
  }
}

export async function searchPlaces(
  niche: string,
  location: string,
  maxResults = 20
): Promise<PlaceLead[]> {
  const queries = NICHE_QUERIES[niche] || [niche]
  const results: PlaceLead[] = []
  const seen = new Set<string>()

  for (const query of queries) {
    if (results.length >= maxResults) break

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: `${query} in ${location}`,
        maxResultCount: Math.min(20, maxResults - results.length),
      }),
    })

    const data = await res.json() as any

    if (data.error) {
      throw new Error(`Places API error: ${data.error.message}`)
    }

    for (const place of data.places || []) {
      if (seen.has(place.id)) continue

      // Skip permanently closed businesses — no point building a site
      if (place.businessStatus === 'CLOSED_PERMANENTLY') {
        console.log(`  [skip-closed] ${place.displayName?.text}`)
        continue
      }

      seen.add(place.id)

      const addrComponents = place.addressComponents
        ? parseAddressComponents(place.addressComponents)
        : undefined

      results.push({
        place_id:               place.id,
        name:                   place.displayName?.text ?? '',
        address:                place.formattedAddress ?? '',
        shortAddress:           place.shortFormattedAddress,
        addressComponents:      addrComponents,
        phone:                  place.nationalPhoneNumber,
        internationalPhone:     place.internationalPhoneNumber,
        website:                place.websiteUri,
        rating:                 place.rating,
        review_count:           place.userRatingCount,
        photoCount:             place.photos?.length ?? 0,
        photoNames:             place.photos?.map((p: any) => p.name).filter(Boolean) ?? [],
        reviews:                place.reviews
          ?.map((r: any) => ({
            rating:       r.rating as number,
            text:         r.text?.text as string | undefined,
            authorName:   r.authorAttribution?.displayName as string | undefined,
            relativeTime: r.relativePublishTimeDescription as string | undefined,
          }))
          ?.filter((r: any) => r.text && r.text.length > 20) ?? [],
        businessStatus:         place.businessStatus,
        primaryType:            place.primaryType,
        primaryTypeDisplayName: place.primaryTypeDisplayName?.text,
        types:                  place.types,
        editorialSummary:       place.editorialSummary?.text,
        currentOpeningHours:    parseHours(place.currentOpeningHours),
        regularOpeningHours:    parseHours(place.regularOpeningHours),
        priceLevel:             place.priceLevel,
        paymentOptions:         place.paymentOptions,
        accessibilityOptions:   place.accessibilityOptions,
        location:               place.location,
        googleMapsUri:          place.googleMapsUri,
        plusCode:               place.plusCode,
      })

      if (results.length >= maxResults) break
    }
  }

  return results
}
