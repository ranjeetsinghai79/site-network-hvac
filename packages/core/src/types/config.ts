export type ThemeName =
  | "navy"
  | "ember"
  | "ocean"
  | "forest"
  | "slate"
  | "dubai"
  | "noir"
  | "clean"
  | "champagne"

export type NicheName =
  | "hvac"
  | "roofing"
  | "dentist"
  | "medspa"
  | "lawfirm"
  | "remodeling"
  | "cleaning"
  | "junk-removal"
  | "daycare"
  | "auto-detailing"
  | "restaurant"
  | "luxury-realestate"
  | "salon"
  | "barbershop"
  | "plumbing"
  | "tree-services"
  | "landscaping"
  | "pressure-washing"
  | "foundation-repair"
  | "basement-waterproofing"
  | "epoxy-flooring"
  | "septic-services"
  | "skin-clinic"
  | "iv-therapy"
  | "nail-studio"
  | "cosmetic-surgeon"
  | "financial-advisor"

export interface Business {
  name: string
  tagline: string
  phone: string
  phoneHref: string
  email: string
  address: string
  city: string
  serviceAreas: string[]
  /** Exact coordinates from the business's Google Maps listing, when known — used for a precise map pin instead of an address-text search. */
  location?: { lat: number; lng: number }
  /** Real logo scraped from the business's existing site (builder uploads it to /logo.png) — omit entirely rather than inventing one. */
  logoUrl?: string
  since: string
  google_rating: string
  review_count: string
  license?: string
  emergency?: boolean
  whatsapp?: string
  social?: Record<string, string>
  theme: ThemeName
  niche: NicheName
  /** Free-form hours summary, e.g. "Open 24 hours" or "Mon–Fri 8am–6pm" */
  hours?: string
  /** Lawfirm: lead attorney bio */
  attorney?: { name: string; credentials: string; bio: string; yearsExp?: number }
}

export interface Service {
  icon: string
  title: string
  desc: string
  urgent?: boolean
  /** Optional hint shown in niche-specific sections (e.g. "45 min · from $150") */
  meta?: string
  /** Optional image path — defaults to /hero-{1-4}.jpg cycling */
  image?: string
}

export interface Testimonial {
  name: string
  location?: string
  role?: string
  stars: number
  text: string
  /** URL to reviewer photo — falls back to initials if absent */
  avatar?: string
  /** Relative date string as shown by the source platform, e.g. "a year ago" */
  date?: string
  /** Photos attached to the review itself (not the reviewer's avatar) */
  images?: string[]
}

export interface Stat {
  value: string | number
  label: string
  suffix?: string
  decimals?: number
}

export interface Reason {
  icon: string
  title: string
  desc: string
}

export interface Property {
  id: string
  title: string
  type: string
  location: string
  price: string
  beds: number
  baths: number
  area: string
  image: string
  badge?: string
  img?: string
  tag?: string
  sqft?: string | number
}

export interface BrandStoryChapter {
  index: string
  label: string
  heading: string
  body: string
  bg: string
  fg: string
  items?: Array<{ n: string; title: string; desc: string }>
}

export interface FAQItem {
  q: string
  a: string
}

export interface AboutData {
  heading?: string
  body: string
  highlights?: Array<{ icon: string; text: string }>
}

export interface SiteConfig {
  business: Business
  /** 'premium' = ScrollHero + Kling v3 scroll-scrubbed. 'custom' = bespoke. Default: regular */
  tier?: 'regular' | 'premium' | 'custom'
  /** Pexels (or any) video URL for the hero background — scroll-scrubbed on premium tier */
  heroVideo?: string
  /** JPG frame sequence for ScrollSequenceHero, extracted from the generated hero video */
  heroFrames?: { count: number; basePath: string }
  services?: Service[]
  testimonials?: Testimonial[]
  trustBadges?: string[]
  stats?: Stat[]
  reasons?: Reason[]
  properties?: Property[]
  brandStoryChapters?: BrandStoryChapter[]
  formServiceOptions?: string[]
  faq?: FAQItem[]
  about?: AboutData
}
