import { geminiText, GEMINI_PRO } from '../tools/gemini.js'
import type { Lead, AgentResult } from '../types.js'

const CONFIG_SYSTEM = `You are a local business website configurator. Apply these design principles:
TAGLINES: Short, punchy, present tense, max 6 words. Never start with "Welcome to". Never end with "?".
TRUST BADGES: Be specific — "NATE Certified" beats "Certified", "GAF Master Elite" beats "Licensed".
TESTIMONIALS: Real customer voice, specific detail (time/price/outcome), min 35 words, emotional hook.
Return ONLY valid TypeScript code. No markdown fences. No explanation.`

const FALLBACK_SERVICES: Record<string, string[]> = {
  hvac:             ['AC Repair', 'Heating', 'Plumbing', 'Emergency Service', 'Maintenance', 'Installation'],
  roofing:          ['Roof Replacement', 'Storm Damage Repair', 'Insurance Claims', 'Emergency Tarping', 'Gutter Installation', 'Free Inspections'],
  dentist:          ['Teeth Whitening', 'Preventive Cleanings', 'Dental Implants', 'Invisalign', 'Emergency Dental', 'Cosmetic Dentistry'],
  medspa:           ['Botox & Fillers', 'Laser Hair Removal', 'HydraFacial', 'Chemical Peels', 'Microneedling', 'Body Contouring'],
  lawfirm:          ['Personal Injury', 'Family Law', 'Criminal Defense', 'Business Law', 'Estate Planning', 'Immigration Law'],
  remodeling:       ['Kitchen Remodel', 'Bathroom Renovation', 'Room Additions', 'Flooring', 'Deck & Outdoor', 'Full Home Renovation'],
  cleaning:         ['Deep Cleaning', 'Weekly / Bi-Weekly', 'Move In / Move Out', 'Commercial Cleaning', 'Post-Construction', 'Airbnb Turnover'],
  'junk-removal':   ['Furniture Removal', 'Appliance Removal', 'Estate Cleanouts', 'Construction Debris', 'Yard Debris', 'Same-Day Service'],
  daycare:          ['Infant Care', 'Toddler Program', 'Pre-K Curriculum', 'After-School Care', 'Summer Camp', 'Drop-In Care'],
  'auto-detailing': ['Ceramic Coating', 'Paint Correction', 'Full Detail Package', 'Interior Detail', 'PPF', 'Window Tinting'],
  restaurant:          ['Dine In', 'Takeout', 'Catering', 'Private Events', 'Delivery', 'Bar & Drinks'],
  plumbing:            ['Drain Cleaning', 'Water Heater', 'Leak Repair', 'Emergency Service', 'Pipe Repair', 'Fixture Install'],
  'luxury-realestate': ['Luxury Apartments', 'Penthouses', 'Villas', 'Commercial Properties', 'Off-Plan Investments', 'Property Management'],
  'skin-clinic':       ['Chemical Peels', 'Laser Resurfacing', 'Acne Treatments', 'Anti-Aging Facials', 'Dermaplaning', 'Microneedling'],
  'iv-therapy':        ['Myers Cocktail', 'NAD+ Anti-Aging', 'Hydration Drip', 'Immunity Boost', 'Beauty Drip', 'Recovery IV'],
  'nail-studio':       ['Gel Manicure', 'Acrylic Full Set', 'Nail Art Design', 'Gel Pedicure', 'Dip Powder', 'Express Manicure'],
  'cosmetic-surgeon':  ['Rhinoplasty', 'Breast Augmentation', 'Liposuction', 'Facelift', 'Eyelid Surgery', 'Tummy Tuck'],
  'epoxy-flooring':    ['Garage Floor Coating', 'Commercial Flooring', 'Metallic Epoxy Floors', 'Industrial Floor Coatings', 'Concrete Grinding & Prep', 'Concrete Sealing & Staining'],
  // Used for any business type without a curated niche entry above (see
  // builder.ts's generic-business fallback template) — kept deliberately
  // generic since the real per-business detail comes from the lead's own
  // notes/description via Gemini, this is only the last-resort floor.
  default:             ['General Inquiry', 'Request a Quote', 'Schedule Service', 'Consultation'],
}

// Deterministic theme assignment from business name (avoids all sites looking the same)
function pickTheme(name: string): string {
  const themes = ['navy', 'ember', 'ocean', 'forest', 'slate', 'noir']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff
  return themes[Math.abs(hash) % themes.length]
}

// Per-niche theme defaults (overrides random hash for niches with clear aesthetic identity)
const NICHE_FIXED_THEME: Record<string, string> = {
  // Premium / specialty — keep dark cinematic feel
  'luxury-realestate':     'dubai',
  medspa:                  'slate',
  lawfirm:                 'noir',
  dentist:                 'ocean',
  daycare:                 'forest',
  restaurant:              'ember',
  // Service businesses — bright white + brand accent
  hvac:                    'clean',
  plumbing:                'clean',
  roofing:                 'clean',
  cleaning:                'clean',
  'junk-removal':          'clean',
  landscaping:             'clean',
  'pressure-washing':      'clean',
  'epoxy-flooring':        'clean',
  'basement-waterproofing': 'clean',
  'foundation-repair':     'clean',
  'septic-services':       'clean',
  'tree-services':         'clean',
  remodeling:              'clean',
  salon:                   'clean',
  barbershop:              'clean',
  'auto-detailing':        'clean',
  'skin-clinic':           'slate',
  'iv-therapy':            'ocean',
  'nail-studio':           'clean',
  'cosmetic-surgeon':      'slate',
}

// CTA text per niche (overrides generic "Get a Free Quote")
const NICHE_CTA_TEXT: Record<string, string> = {
  medspa:           'Schedule Free Consultation',
  lawfirm:          'Get Free Case Evaluation',
  dentist:          'Book Appointment Online',
  daycare:          'Schedule a Tour',
  restaurant:       'Make a Reservation',
  cleaning:         'Get Instant Quote',
  'junk-removal':   'Book Same-Day Pickup',
  'auto-detailing': 'Book Your Detail',
  remodeling:       'Get Free Estimate',
  roofing:          'Get Free Inspection',
  hvac:             'Schedule Service',
  'skin-clinic':    'Book Free Skin Consultation',
  'iv-therapy':     'Book Your Drip Session',
  'nail-studio':       'Book Your Appointment',
  'cosmetic-surgeon':  'Schedule Free Consultation',
}

// Niche-specific reasons guidance (prevents HVAC copy bleeding into medspa/lawfirm etc.)
const NICHE_REASONS_GUIDANCE: Record<string, string> = {
  medspa:           'Board-Certified Injectors, FDA-Approved Treatments, Free Consultations, Financing Available, Medical-Grade Products, Personalized Treatment Plans',
  lawfirm:          'No Fee Unless We Win, Free Case Evaluation, Decades of Trial Experience, Available 24/7, Bilingual Staff, Proven Track Record',
  dentist:          'Gentle & Painless Techniques, Same-Day Emergency Appointments, Children Welcome, Financing Available, Digital X-Rays, Sedation Dentistry',
  cleaning:         'Eco-Friendly Products, Background-Checked Cleaners, Satisfaction Guarantee, Flexible Scheduling, Bonded & Insured, Online Booking',
  daycare:          'CPR-Certified Staff, Secure Digital Check-In/Out, Daily Activity Reports, Nutritious Meals Included, Low Teacher-to-Child Ratio, Licensed & Inspected',
  remodeling:       'Licensed General Contractor, Free Design Consultation, On-Time & On-Budget, Premium Materials, 5-Year Workmanship Warranty, Local References',
  roofing:          'GAF-Certified Installer, Free Storm Inspection, Insurance Claim Assistance, Lifetime Workmanship Warranty, Same-Day Emergency Tarping, Local Roofers',
  restaurant:       'Fresh Locally Sourced Ingredients, Chef-Crafted Daily Specials, Private Dining Available, Online Reservations, Full Bar Service, Family Friendly',
  'junk-removal':   'Same-Day Availability, Upfront Flat-Rate Pricing, Eco-Conscious Disposal, No Heavy Lifting for You, Fully Insured Crew, Donates Usable Items',
  'auto-detailing': 'Certified Detailing Technicians, Ceramic Coating Specialists, Mobile Service Available, Guaranteed Showroom Finish, Premium Products Only, Before & After Photos',
  hvac:             'NATE-Certified Technicians, Same-Day Emergency Service, Upfront Flat-Rate Pricing, All Brands Serviced, 10-Year Parts Warranty, Financing Available',
  'skin-clinic':    'Licensed Skin Specialists, Medical-Grade Products Only, FDA-Cleared Devices, Free Consultations, Financing Available, Personalized Treatment Plans',
  'iv-therapy':     'Physician-Formulated Drips, Registered Nurses Only, 100% Bioavailable, Mobile Service Available, Same-Day Appointments, Custom Add-On Formulations',
  'nail-studio':       'State-Licensed Technicians, Premium OPI/Gelish Products, Hospital-Grade Sanitation, Walk-Ins Welcome, Open 7 Days, Expert Nail Art Specialists',
  'cosmetic-surgeon':  'Board-Certified Plastic Surgeon, Hospital-Grade Safety Protocols, Natural-Looking Results, Financing Available, Before & After Portfolio, Free Consultations',
}

const CONFIG_SCHEMA = `Generate a TypeScript config file. Output this exact structure:

import type { SiteConfig } from "@core/web/types"

export const config: SiteConfig = {
  business: {
    name: "...",
    tagline: "...",
    phone: "...",
    phoneHref: "tel:+1...",
    email: "...",
    address: "...",
    city: "...",
    serviceAreas: ["city1", "city2"],
    license: "...",
    since: "...",
    google_rating: "4.9",
    review_count: "200",
    emergency: true,
    theme: "navy",
    niche: "hvac",
  },

  services: [
    { icon: "thermometer", title: "...", desc: "One sentence.", urgent: false }
  ],

  testimonials: [
    { name: "...", location: "...", stars: 5, text: "..." }
  ],

  trustBadges: [
    "Licensed & Insured", "Same-Day Service", "5-Star Rated", "24/7 Emergency"
  ],

  stats: [
    { value: 4.9, label: "Google Rating", suffix: "★", decimals: 1 },
    { value: 1000, label: "Jobs Done", suffix: "+", decimals: 0 },
    { value: 15, label: "Yrs Experience", suffix: "+", decimals: 0 }
  ],

  reasons: [
    { icon: "clock",       title: "Fast Response",          desc: "..." },
    { icon: "dollar-sign", title: "Upfront Pricing",        desc: "..." },
    { icon: "award",       title: "Certified Pros",         desc: "..." },
    { icon: "thumbs-up",   title: "Satisfaction Guarantee", desc: "..." },
    { icon: "phone",       title: "Real Humans Answer",     desc: "..." },
    { icon: "truck",       title: "Fully Equipped",         desc: "..." }
  ],

  formServiceOptions: ["..."]
}

// Backward-compat re-exports
export const BUSINESS = config.business
export const SERVICES = config.services!
export const TESTIMONIALS = config.testimonials!
export const TRUST_BADGES = config.trustBadges!

Rules:
- icon: one of thermometer | flame | droplets | zap | shield-check | wrench | star | heart | scissors | sparkles | clock | hammer | truck | home | briefcase | phone | award | dollar-sign | thumbs-up
- phone: (XXX) XXX-XXXX format
- phoneHref: tel:+1XXXXXXXXXX digits only
- theme: MUST be exactly the value provided below — do not change it
- niche: MUST be exactly the value provided below
- city: first part of address before comma
- EXACTLY 6 services (never fewer), 3 testimonials, 4–6 trust badges, 3 stats, 6 reasons
- formServiceOptions: array of service titles
- testimonials use "stars" not "rating"
- since: string year
- TESTIMONIALS RULE: if _real_reviews=true in the business data, copy the testimonials VERBATIM — do not alter, paraphrase, or improve the text. Only fix obvious encoding issues.`

export async function runConfigGeneratorAgent(lead: Lead): Promise<AgentResult<Lead>> {
  console.log(`[ConfigGenerator] Generating config for ${lead.name}`)

  const bd = lead.brand_data!
  const services = bd.services?.length ? bd.services : FALLBACK_SERVICES[lead.niche] || FALLBACK_SERVICES.default

  try {
    const theme = NICHE_FIXED_THEME[lead.niche] ?? pickTheme(lead.name)

    // ── Assemble all real data from Places API for the prompt ───────────────
    // This prevents Gemini from inventing placeholder values like "123 Main St"
    const realData: Record<string, any> = {
      // Merged: BrandData (from Firecrawl scrape) wins over Places for contact fields
      name:         lead.name,
      phone:        bd.phone        ?? lead.phone,
      email:        bd.email        ?? lead.email,
      website:      lead.website,
      address:      bd.address      ?? lead.address,
      city:         lead.city,
      state:        lead.state,
      zip:          lead.zip,
      niche:        lead.niche,
      google_rating:  bd.google_rating  ?? lead.rating?.toString(),
      review_count:   bd.review_count   ?? lead.review_count?.toString(),
      tagline:        bd.tagline,
      license:        bd.license,               // real license from scrape
      years_in_business: bd.years_in_business,
      since:         bd.years_in_business
                       ? String(new Date().getFullYear() - bd.years_in_business)
                       : undefined,
      tone:          bd.tone,
      unique_selling_points: bd.unique_selling_points,
      service_areas: bd.service_areas?.length
                       ? bd.service_areas
                       : [lead.city],
      testimonials:  bd.testimonials,
      colors:        bd.colors,
    }

    // Places-only fields (only add if not empty)
    if (lead.editorial_summary)
      realData.editorial_summary = lead.editorial_summary

    if (lead.weekday_hours?.length)
      realData.opening_hours = lead.weekday_hours

    if (lead.primary_type)
      realData.primary_type = lead.primary_type

    if (lead.photo_count)
      realData.photo_count = lead.photo_count

    if (lead.business_status && lead.business_status !== 'OPERATIONAL')
      realData.business_status = lead.business_status

    // ── Real Google reviews → use verbatim as testimonials ──────────────────
    // Priority: (1) Places reviews, (2) Firecrawl-scraped, (3) Gemini-fabricated
    // Sort by rating then substance — pool may hold 10+ (Places API + Maps scrape)
    const placesReviews = lead.google_reviews
      ?.filter(r => r.text?.length > 20 && r.rating >= 4)
      ?.sort((a, b) => (b.rating - a.rating) || (b.text.length - a.text.length))
      ?.slice(0, 6)

    if (placesReviews?.length) {
      realData.testimonials = placesReviews.map(r => ({
        name:   r.authorName ?? 'Verified Customer',
        text:   r.text,
        rating: r.rating,
      }))
      realData._real_reviews = true
    } else if (bd.testimonials?.length) {
      realData.testimonials = bd.testimonials
      realData._real_reviews = true
    }

    const cleanData = Object.fromEntries(Object.entries(realData).filter(([, v]) => v != null))

    const nicheCta      = NICHE_CTA_TEXT[lead.niche]
    const nicheReasons  = NICHE_REASONS_GUIDANCE[lead.niche]
    const designBrief   = lead.niche_profile?.design?.geminiBrief

    const configContent = await geminiText(
      `${CONFIG_SCHEMA}

Business data (USE ONLY these values — do NOT invent placeholder addresses, licenses, or phone numbers):
${JSON.stringify(cleanData, null, 2)}

Services: ${services.join(', ')}
Niche: ${lead.niche}
Theme to use: "${theme}" (set this exact value for the theme field)
${nicheCta ? `Hero CTA button text: "${nicheCta}"` : ''}
${nicheReasons ? `Reasons (use these as starting point, tailor to this specific business): ${nicheReasons}` : ''}
${designBrief ? `\n## DESIGN IDENTITY (use this to inform copy tone, tagline style, trust badge phrasing):\n${designBrief}` : ''}

CRITICAL RULES:
- address: use EXACTLY the address from business data above — never invent "123 Main St"
- phone: use EXACTLY the phone from business data — never invent a fake number
- license: ONLY include if license is present in business data above — if missing, use "Licensed & Insured" in trustBadges instead
- since: derive from years_in_business if present; otherwise omit or estimate from city + niche context
- google_rating / review_count: use EXACTLY the values from business data
- service_areas: use the serviceAreas array from business data
- opening_hours provided → use them in a trustBadge like "Mon–Fri 8AM–6PM"
- editorial_summary provided → use it to inform tagline and service descriptions
- reasons: MUST reflect the niche provided above — no HVAC/trade language in medspa, lawfirm, or other non-trade niches
- testimonials: if _real_reviews=true in business data, copy testimonial text VERBATIM — do not alter`,
      { model: GEMINI_PRO, maxTokens: 8192, temperature: 0.3, systemInstruction: CONFIG_SYSTEM }
    )

    // Validate not truncated — must have config export + backward-compat
    const required = ['export const config', 'business:', 'services:', 'testimonials:', 'trustBadges:']
    const missing = required.filter(k => !configContent.includes(k))
    if (missing.length > 0) {
      return { success: false, error: `Config truncated — missing: ${missing.join(', ')}` }
    }

    return {
      success: true,
      data: { ...lead, config_ts: configContent, status: 'config_generated' },
    }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
