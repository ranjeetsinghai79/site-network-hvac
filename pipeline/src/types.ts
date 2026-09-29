export interface Lead {
  id?: string
  place_id: string
  name: string
  phone?: string
  email?: string
  website?: string
  address: string
  city: string
  state: string
  niche: string

  // ── From Places API v1 (expanded extraction) ──────────────────────────────
  rating?: number               // e.g. 4.7
  review_count?: number         // e.g. 83
  international_phone?: string  // E.164, e.g. "+14155552671" — for Twilio
  business_status?: string      // OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY
  primary_type?: string         // e.g. "hvac_contractor"
  editorial_summary?: string    // Google AI-generated description
  open_now?: boolean            // currently open when scraped
  weekday_hours?: string[]      // ['Monday: 8 AM – 6 PM', ...]
  photo_count?: number          // # photos on listing
  photo_names?: string[]        // photo name refs for Places Photo API — "places/{id}/photos/{ref}"
  google_reviews?: Array<{      // real reviews from Places API (up to 5, used as testimonials)
    rating: number
    text: string
    authorName?: string
    relativeTime?: string
  }>
  price_level?: string          // PRICE_LEVEL_INEXPENSIVE etc.
  google_maps_uri?: string
  zip?: string
  latitude?: number
  longitude?: number

  // ── Phone enrichment ─────────────────────────────────────────────────────
  phone_type?: 'mobile' | 'landline' | 'voip' | 'toll-free' | 'unknown'
  can_sms?: boolean             // false = skip SMS outreach for this lead

  // ── Email enrichment (extracted from website) ────────────────────────────
  business_email?: string       // generic contact email (info@, hello@, contact@, etc.)
  owner_email?: string          // personal email found near owner/founder keywords

  // ── Pipeline enrichment ───────────────────────────────────────────────────
  gbp_claimed?: boolean         // Google Business Profile claimed/verified
  /** @deprecated use open_now — kept for maps-scraper compatibility */
  is_open?: boolean
  tier?: 'tier1' | 'tier2'     // tier1 = no website ($299-499), tier2 = bad site ($500-999)
  site_broken?: boolean        // true when existing website is unreachable/404
  site_score?: number
  site_issues?: string[]
  brand_data?: BrandData
  niche_profile?: NicheProfile
  config_ts?: string
  github_repo?: string
  vercel_url?: string
  cloudflare_url?: string
  custom_domain?: string            // e.g. "jazzheating.com" — added post-payment
  gsc_verified?: boolean            // Search Console property auto-verified via our own SA (gsc-agent.ts)
  gsc_site_url?: string             // the URL-prefix property that's verified, e.g. "https://foo.pages.dev/"
  gsc_verified_at?: string
  hero_video_url?: string
  outreach_sent?: boolean
  outreach_sent_at?: string

  // ── Sales funnel ──────────────────────────────────────────────────────────
  sms_sent?: boolean
  sms_sent_at?: string
  sms_opt_out?: boolean
  follow_up_1_sent_at?: string
  follow_up_2_sent_at?: string
  last_missed_call_at?: string
  missed_call_sms_sent_at?: string
  meeting_url?: string
  meeting_scheduled_at?: string
  stripe_payment_url?: string
  stripe_session_id?: string
  paid?: boolean
  paid_at?: string
  handed_off?: boolean
  handed_off_at?: string
  status: LeadStatus
  created_at?: string
  // ── Tier system (v3) ────────────────────────────────────────────────────
  client_plan?:        string        // 'launch' | 'grow' | 'scale'
  webhook_url?:        string        // Zapier/CRM webhook URL
  location_group_id?:  string        // multi-location group UUID
  reception_config_id?: string       // Gemini Live reception config UUID (reception_configs table)
  reception_phone?:    string        // Twilio number routed to Gemini Live reception
  slack_channel_id?:   string        // Slack channel for Grow+ clients
  // ── Per-client GBP credentials (override global env vars) ───────────────
  gbp_account_id?:     string        // Google My Business account ID for this client
  gbp_location_id?:    string        // Google My Business location ID for this client
}

export type LeadStatus =
  | 'found'
  | 'scored'
  | 'analyzed'
  | 'config_generated'
  | 'built'
  | 'deployed'
  | 'outreach_sent'
  | 'sms_sent'
  | 'conversation_active'
  | 'meeting_scheduled'
  | 'payment_link_sent'
  | 'paid'
  | 'handed_off'
  | 'skipped'
  | 'error'

// ─── Niche Brain output ─────────────────────────────────────────────────────

export interface NicheProfile {
  visualStyle:      string   // e.g. 'golden-editorial', 'dramatic-cinematic'
  timeOfDay:        string   // full description used in prompts
  season:           string
  cameraSpec:       string
  colorGrade:       string
  heroImagePrompts: [string, string, string, string]
  heroVideoPrompt:  string
  copyTone:         string
  signature:        string   // uniqueness fingerprint for dedup
  /** Full design profile from design-library — fonts, personality, colors, hero variant */
  design?: {
    personalityId:    string
    personalityName:  string
    fontPairingName:  string
    displayFont:      string
    bodyFont:         string
    displayStack:     string
    bodyStack:        string
    googleFontsImport: string
    heroLayoutId:     string
    sectionOrderId:   string
    colorPaletteName: string
    colorTokens:      Record<string, string>
    geminiBrief:      string
    cssTokenBlock:    string
  }
}

export interface BrandData {
  name: string
  tagline?: string
  phone?: string
  email?: string
  address?: string
  services?: string[]
  colors?: { primary?: string; secondary?: string; accent?: string }
  tone?: string
  unique_selling_points?: string[]
  years_in_business?: number
  license?: string
  service_areas?: string[]
  testimonials?: Array<{ name: string; text: string; rating: number }>
  google_rating?: string
  review_count?: string
  /** Real logo scraped from the business's existing site (firecrawl.ts) — never Gemini-fabricated. */
  logo_url?: string
}

export interface PipelineConfig {
  niche:
    | 'hvac'
    | 'roofing'
    | 'dentist'
    | 'medspa'
    | 'lawfirm'
    | 'remodeling'
    | 'cleaning'
    | 'junk-removal'
    | 'daycare'
    | 'auto-detailing'
    | 'restaurant'
    | 'luxury-realestate'
    | 'skin-clinic'
    | 'iv-therapy'
    | 'nail-studio'
    | 'orthodontist'
    | 'weight-loss-clinic'
    | 'salon'
    | 'barbershop'
    | 'financial-advisor'
  location: string
  city: string
  state: string
  count: number
  templateOwner: string
  templateRepo: string
  deployOwner: string
  dryRun?: boolean
  /** Use ScrollHero (Kling v3 scroll-scrubbed) instead of standard autoplay hero */
  premium?: boolean
  /** 'editorial' | 'zigzag' — which hand-built style to use, decoupled from niche. See builder.ts's resolveTemplateDir(). */
  templateStyle?: string
}

// ─── Audit Report (AI Growth Audit — free lead magnet) ──────────────────────

export interface AuditRecommendation {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  impact: string   // e.g. "Could generate 5-10 more bookings/month"
}

export interface AuditCompetitor {
  name: string
  rating: number
  review_count: number
  website?: string
}

export interface AuditReport {
  id?: string
  lead_id?: string
  website_url: string
  business_name: string
  niche?: string
  city?: string
  created_at: string

  // Scores (0-100)
  website_score: number      // PageSpeed mobile
  seo_score: number          // meta, schema, local SEO signals
  reputation_score: number   // reviews quality
  phone_score: number        // click-to-call present
  booking_score: number      // online booking present
  overall_score: number      // weighted composite

  // Site performance
  mobile_score: number
  desktop_score: number
  site_issues: string[]
  site_broken: boolean

  // SEO signals
  meta_title: string | null
  meta_description: string | null
  has_schema: boolean
  h1_content: string | null
  seo_issues: string[]

  // Contact/booking
  phone_found: boolean
  has_booking_link: boolean
  booking_url: string | null
  has_reviews_on_site: boolean

  // Competition
  competitors: AuditCompetitor[]

  // AI recommendations
  recommendations: AuditRecommendation[]

  // Delivery
  report_viewed?: boolean
  report_viewed_at?: string
  outreach_sent?: boolean
}

export interface AgentResult<T> {
  success: boolean
  data?: T
  error?: string
}
