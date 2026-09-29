/**
 * maps-scraper.ts
 *
 * Scrapes Google Maps for local businesses without websites.
 * Free alternative to Google Places API — zero cost per lead.
 *
 * Strategy:
 *   1. Search Google Maps for niche + city
 *   2. Scroll results to load up to maxResults
 *   3. Click each listing → check if website link exists in detail panel
 *   4. Extract: name, phone, address, rating, review count
 *   5. Return as Lead[] with tier 1 (no website) sorted first
 *
 * Run standalone:
 *   npx tsx src/agents/maps-scraper.ts --niche hvac --city "Austin" --state TX --count 100
 */

import { chromium } from 'playwright'
import type { Lead, PipelineConfig, AgentResult } from '../types.js'

// ─── Niche → Google Maps search query ─────────────────────────────────────

const NICHE_QUERY: Record<string, string> = {
  // ── Tier 1 (high no-website rate — fast close at $299-499) ──
  'auto-detailing':         'auto detailing mobile car detailing',
  cleaning:                 'house cleaning maid service residential cleaning',
  'junk-removal':           'junk removal hauling junk pickup service',
  landscaping:              'landscaping lawn care lawn service',
  handyman:                 'handyman home repair local handyman',
  roofing:                  'roofing contractor roof repair',
  hvac:                     'hvac air conditioning heating repair',
  plumbing:                 'plumber plumbing repair drain service',
  'pressure-washing':       'pressure washing power washing exterior cleaning',
  'epoxy-flooring':         'epoxy flooring garage floor coating concrete coating',
  'basement-waterproofing': 'basement waterproofing foundation waterproofing wet basement',
  'foundation-repair':      'foundation repair foundation contractor structural repair',
  'tree-services':          'tree service tree removal tree trimming arborist',
  'septic-services':        'septic service septic tank pumping septic repair',
  // ── Tier 2 (established biz, bad/outdated site — upgrade at $500-999) ──
  remodeling:               'home remodeling kitchen bathroom remodel contractor',
  dentist:                  'dentist dental office local dentist',
  medspa:                   'medical spa medspa aesthetics laser skin',
  salon:                    'hair salon beauty salon hairstylist',
  barbershop:               'barbershop barber haircut mens grooming fade',
  daycare:                  'daycare childcare preschool',
  lawfirm:                  'law firm attorney personal injury lawyer',
  restaurant:               'restaurant local dining cafe eatery',
  'luxury-realestate':      'luxury real estate agent realtor',
  // ── New niche targets ──
  'dental-office':          'dentist dental office family dentistry oral surgeon',
  'india-dental':           'dentist dental clinic orthodontist dental implants',
  'hair-salon':             'hair salon beauty salon hairstylist hair color',
  'nail-salon':             'nail salon manicure pedicure nail art',
  'financial-advisor':      'financial advisor financial planner wealth management investment',
  'insurance-agent':        'insurance agent insurance agency auto home life insurance',
  'real-estate-agent':      'real estate agent realtor property agent homes for sale',
  'india-restaurant':       'restaurant dhaba food local restaurant north indian south indian',
  'medspa-usa':             'medical spa medspa aesthetics clinic botox laser skin rejuvenation',
  'india-medspa':           'skin clinic laser clinic beauty clinic aesthetic centre derma clinic',
  // ── Beauty & wellness (Week 2) ──
  'skin-clinic':            'skin clinic dermatology clinic esthetician skincare medical skincare',
  'iv-therapy':             'iv therapy iv drip bar hydration therapy iv infusion wellness drip',
  'nail-studio':            'nail studio nail salon nail art nail spa nail bar manicure pedicure',
  // ── High-value new niches (Week 3) ──
  'cosmetic-surgeon':       'cosmetic surgeon plastic surgeon aesthetic surgeon rhinoplasty breast augmentation',
  // ── MEDSPAS expansion — wave 2 (new terms, fresh combos) ──
  'botox-clinic':           'botox clinic cosmetic injections lip filler dermal filler injectables',
  'aesthetic-clinic':       'aesthetic clinic aesthetics medspa cosmetic treatment anti-aging',
  'cosmetic-dermatology':   'cosmetic dermatology skin specialist dermatologist aesthetic skin care',
  'laser-clinic':           'laser clinic laser hair removal laser skin treatment IPL photofacial',
  'hydrafacial-clinic':     'hydrafacial clinic facial treatment hydrodermabrasion glow facial',
  'body-contouring':        'body contouring coolsculpting sculpsure fat reduction body sculpting',
  'prp-clinic':             'PRP therapy platelet rich plasma facial hair restoration vampire facial',
  'weight-loss-clinic':     'weight loss clinic medical weight management semaglutide ozempic clinic',
  'hormone-clinic':         'hormone therapy HRT testosterone clinic hormone replacement wellness',
  'microblading-studio':    'microblading permanent makeup eyebrow tattoo brow studio PMU artist',
  'lash-studio':            'lash extension studio eyelash lift brow lamination lash bar',
  // ── Dental expansion wave 2 (currently exhausted on dental-office) ──
  'orthodontist':           'orthodontist braces Invisalign clear aligners teeth straightening',
  'cosmetic-dentist':       'cosmetic dentist teeth whitening veneers smile makeover porcelain crowns',
  'pediatric-dentist':      'pediatric dentist kids dentist children orthodontist baby teeth',
  'oral-surgeon':           'oral surgeon wisdom teeth extraction tooth removal implant surgery',
  'emergency-dentist':      'emergency dentist same day dentist walk-in dental urgent dental care',
  // ── Restaurants expansion → 100k target (5 niches × 340 cities × 60 = 102k) ──
  'italian-restaurant':     'italian restaurant pizza pasta trattoria pizzeria risotto',
  'mexican-restaurant':     'mexican restaurant tacos burritos cantina taqueria enchiladas',
  'asian-restaurant':       'asian restaurant chinese japanese thai korean sushi ramen pho',
  'bbq-steakhouse':         'bbq barbecue steakhouse grill smokehouse ribs brisket',
  // ── Financial expansion → 100k target (5 niches × 340 cities × 60 = 102k) ──
  'life-insurance':         'life insurance agent term life whole life insurance broker',
  'tax-advisor':            'tax advisor CPA accountant tax preparation tax consultant',
  'mortgage-broker':        'mortgage broker home loan lender refinance mortgage advisor',
  // ── Financial additional terms ──
  'cpa-accountant':         'CPA accountant certified public accountant bookkeeping tax firm',
  'wealth-manager':         'wealth management firm private wealth advisor investment management',
  'credit-union':           'credit union community bank savings bank local bank branch',
  // ── Law firm expansion → 100k (8 niches × 340 cities × 60 = 163k) ──
  'attorney':               'attorney at law law office legal services general practice',
  'personal-injury-lawyer': 'personal injury attorney accident lawyer injury law firm',
  'family-law-attorney':    'family law attorney divorce lawyer child custody attorney',
  'criminal-defense-lawyer':'criminal defense attorney DUI lawyer defense law firm',
  'immigration-attorney':   'immigration attorney visa lawyer immigration law firm',
  'estate-planning-attorney':'estate planning attorney probate lawyer wills trusts attorney',
  'business-attorney':      'business attorney corporate lawyer commercial law firm contract',
  // ── Real estate expansion → 100k (6 niches × 340 cities × 60 = 122k) ──
  'realtor':                'realtor licensed realtor home sales buyer agent listing agent',
  'real-estate-broker':     'real estate broker brokerage property broker',
  'property-management':    'property management company rental management landlord services',
  'home-buying-agent':      'home buying agent first time buyer real estate help sell my home',
  'commercial-real-estate': 'commercial real estate agent office space retail leasing broker',
  // ── Local SMBs wave 2 — 18 new home-service niches (6,120 fresh combos × 25 = 153k leads) ──
  'electrician':            'electrician electrical contractor licensed electrician wiring',
  'pest-control':           'pest control exterminator termite control bug spray rodent removal',
  'garage-door':            'garage door repair garage door installation garage door service',
  'locksmith':              'locksmith lock repair car lockout house lockout key replacement',
  'painting':               'house painter interior exterior painting contractor paint job',
  'flooring':               'flooring contractor hardwood floor laminate vinyl tile installation',
  'carpet-cleaning':        'carpet cleaning upholstery cleaning rug cleaning steam cleaning',
  'window-cleaning':        'window cleaning window washing residential commercial window cleaner',
  'gutter-cleaning':        'gutter cleaning gutter guard gutter repair gutter installation',
  'moving-company':         'moving company local movers residential moving packing service',
  'solar-installation':     'solar panel installation solar energy company solar contractor',
  'fence-installation':     'fence installation fence repair wood vinyl chain link fencing',
  'deck-builder':           'deck builder deck contractor patio deck wood composite deck',
  'insulation':             'insulation contractor attic insulation spray foam blown-in insulation',
  'pool-service':           'pool service pool cleaning pool repair swimming pool maintenance',
  'concrete':               'concrete contractor driveway concrete patio sidewalk flatwork',
  'appliance-repair':       'appliance repair washer dryer refrigerator dishwasher repair',
  'chimney-sweep':          'chimney sweep chimney cleaning fireplace service chimney repair',
}

// ─── Human-like delays ─────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const jitter = (base: number, range = 400) =>
  sleep(base + Math.floor(Math.random() * range))

// ─── Extract place_id from Maps URL ───────────────────────────────────────
// URL pattern: /maps/place/Name/@lat,lng,z/data=...!1sChIJ...!
// Also handles: /maps/place/Name/...?... with no data segment

function extractPlaceId(url: string, name?: string, city?: string): string {
  // Try !1s{placeId}! pattern (canonical Google place ID)
  const m = url.match(/!1s([^!]+)!/)
  if (m) return m[1]
  // Try CID pattern: !3m1!...!4m...!... or ?cid= in URL
  const cid = url.match(/[?&]cid=(\d+)/)
  if (cid) return `cid_${cid[1]}`
  // Stable fallback: hash name+city (NOT the URL — URLs are session-dynamic)
  const key = name && city ? `${name.toLowerCase().trim()}::${city.toLowerCase().trim()}` : url
  let h = 0
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) - h) + key.charCodeAt(i)
    h |= 0
  }
  return `scraped_${Math.abs(h).toString(36)}`
}

// ─── Extract phone from detail panel ─────────────────────────────────────

async function extractPhone(page: import('playwright').Page): Promise<string | undefined> {
  // Multiple selector attempts — Google Maps DOM changes often
  const selectors = [
    '[data-item-id^="phone:tel:"]',
    'button[data-item-id*="phone"]',
    '[aria-label*="Phone"]',
    '[data-tooltip*="phone"]',
  ]
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first()
      if (await el.count() > 0) {
        // Try data-item-id first (format: phone:tel:+15125551234)
        const itemId = await el.getAttribute('data-item-id').catch(() => null)
        if (itemId?.startsWith('phone:tel:')) {
          return itemId.replace('phone:tel:', '')
        }
        // Try aria-label
        const label = await el.getAttribute('aria-label').catch(() => null)
        if (label) {
          const match = label.match(/[\+\d\(\)\-\s]{7,}/)
          if (match) return match[0].trim()
        }
      }
    } catch { /* try next */ }
  }
  return undefined
}

// ─── Check if website link exists in detail panel ─────────────────────────

async function hasWebsiteLink(page: import('playwright').Page): Promise<{ exists: boolean; url?: string }> {
  const selectors = [
    '[data-item-id="authority"]',
    'a[aria-label*="website" i]',
    'a[aria-label*="Website" i]',
    '[data-tooltip="Open website"]',
    'a[href*="http"]:has([data-item-id])',
  ]
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first()
      if (await el.count() > 0) {
        const href = await el.getAttribute('href').catch(() => null)
        return { exists: true, url: href ?? undefined }
      }
    } catch { /* try next */ }
  }
  return { exists: false }
}

// ─── Extract address from detail panel ────────────────────────────────────

async function extractAddress(page: import('playwright').Page): Promise<string | undefined> {
  const selectors = [
    '[data-item-id="address"]',
    'button[data-item-id="address"]',
    '[aria-label*="Address"]',
  ]
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first()
      if (await el.count() > 0) {
        const label = await el.getAttribute('aria-label').catch(() => null)
        if (label) return label.replace(/^Address:\s*/i, '').trim()
        const text = await el.textContent().catch(() => null)
        if (text) return text.trim()
      }
    } catch { /* try next */ }
  }
  return undefined
}

// ─── Extract rating + review count ───────────────────────────────────────

interface RatingData { rating?: number; reviewCount?: number }

async function extractRatingData(page: import('playwright').Page): Promise<RatingData> {
  try {
    // Try aria-label pattern first: "4.7 stars 83 reviews"
    const wrapper = page.locator('[aria-label*="stars"][aria-label*="reviews"], [aria-label*="star"][aria-label*="review"]').first()
    if (await wrapper.count() > 0) {
      const label = await wrapper.getAttribute('aria-label').catch(() => null)
      if (label) {
        const ratingMatch = label.match(/(\d+\.?\d*)\s*star/)
        const reviewMatch = label.match(/(\d[\d,]*)\s*review/)
        return {
          rating:      ratingMatch  ? parseFloat(ratingMatch[1]) : undefined,
          reviewCount: reviewMatch  ? parseInt(reviewMatch[1].replace(/,/g, '')) : undefined,
        }
      }
    }
    // Fallback: separate elements
    const ratingEl = page.locator('div.F7nice span[aria-hidden="true"]').first()
    if (await ratingEl.count() > 0) {
      const t = await ratingEl.textContent()
      const rating = parseFloat(t ?? '')
      // review count often in next sibling span with aria-label="X reviews"
      const reviewEl = page.locator('span[aria-label*="review"]').first()
      let reviewCount: number | undefined
      if (await reviewEl.count() > 0) {
        const rl = await reviewEl.getAttribute('aria-label').catch(() => null)
        const m = rl?.match(/(\d[\d,]*)/)
        if (m) reviewCount = parseInt(m[1].replace(/,/g, ''))
      }
      return { rating: isNaN(rating) ? undefined : rating, reviewCount }
    }
  } catch { /* ignore */ }
  return {}
}

// ─── Extract GBP claimed + open status ───────────────────────────────────

async function extractGBPMeta(page: import('playwright').Page): Promise<{ gbpClaimed: boolean; isOpen: boolean | undefined }> {
  let gbpClaimed = false
  let isOpen: boolean | undefined

  try {
    // GBP "Claimed" / "Verified" indicators
    const claimedEl = page.locator('[aria-label*="Claimed"], [aria-label*="Verified"], button:has-text("Claim this business")').first()
    if (await claimedEl.count() > 0) {
      const label = (await claimedEl.getAttribute('aria-label').catch(() => null)) ?? ''
      const text  = (await claimedEl.textContent().catch(() => null)) ?? ''
      // "Claim this business" = NOT claimed; anything else = claimed
      gbpClaimed = !text.toLowerCase().includes('claim this business') && !label.toLowerCase().includes('claim this')
    } else {
      // If no claim button found, likely claimed (most active businesses are)
      gbpClaimed = true
    }
  } catch { /* ignore */ }

  try {
    // Open/closed — look for "Open now" or "Closed" text
    const hours = page.locator('[aria-label*="Open"], [aria-label*="Closed"], [data-item-id*="oh"]').first()
    if (await hours.count() > 0) {
      const t = (await hours.textContent().catch(() => null))?.toLowerCase() ?? ''
      const l = (await hours.getAttribute('aria-label').catch(() => null))?.toLowerCase() ?? ''
      const combined = t + l
      if (combined.includes('open now')) isOpen = true
      else if (combined.includes('closed') || combined.includes('closes')) isOpen = false
    }
  } catch { /* ignore */ }

  return { gbpClaimed, isOpen }
}

// ─── Scrape single place page (navigated directly to place URL) ───────────

interface ScrapedBusiness {
  name: string
  phone?: string
  address?: string
  rating?: number
  reviewCount?: number
  gbpClaimed?: boolean
  isOpen?: boolean
  hasWebsite: boolean
  websiteUrl?: string
  placeUrl: string
  placeId: string
}

async function scrapePlacePage(
  page: import('playwright').Page,
  placeUrl: string
): Promise<ScrapedBusiness | null> {
  try {
    await page.goto(placeUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
    // Google Maps SPA: content renders via JS after initial load
    // Wait until h1 exists AND has non-empty content that isn't a search heading
    await page.waitForFunction(
      () => {
        const h1 = document.querySelector('h1')
        if (!h1) return false
        const t = (h1.textContent ?? '').trim()
        return t.length > 1 && !t.startsWith('Results') && !t.startsWith('Google Maps')
      },
      { timeout: 20000 }
    )
    await jitter(800, 300)

    // Make sure we're on a place page, not search results
    const currentUrl = page.url()
    if (!currentUrl.includes('/maps/place/')) {
      return null
    }

    // Get the business name — must NOT be generic search heading
    // Place page h1 is inside a specific container
    const nameSelectors = [
      'h1.DUwDvf',
      'h1.fontHeadlineLarge',
      '[role="main"] h1',
      'h1',
    ]
    let name: string | undefined
    for (const sel of nameSelectors) {
      try {
        const el = page.locator(sel).first()
        if (await el.count() > 0) {
          const t = (await el.textContent())?.trim()
          // Reject if it looks like a search results heading
          if (t && t !== 'Results' && !t.startsWith('Results for') && t.length > 1) {
            name = t
            break
          }
        }
      } catch { /* try next */ }
    }
    if (!name) return null

    // The /maps/place/<slug>/ portion of the URL is stable (it's the business name slug).
    // Pass it as `city` param so the hash fallback keys on name+slug, not the full dynamic URL.
    const urlSlug = currentUrl.match(/\/maps\/place\/([^/]+)\//)?.[1] ?? undefined
    const placeId = extractPlaceId(currentUrl, name, urlSlug)

    const [phone, address, ratingData, websiteInfo, gbpMeta] = await Promise.all([
      extractPhone(page),
      extractAddress(page),
      extractRatingData(page),
      hasWebsiteLink(page),
      extractGBPMeta(page),
    ])

    return {
      name,
      phone,
      address,
      rating:      ratingData.rating,
      reviewCount: ratingData.reviewCount,
      gbpClaimed:  gbpMeta.gbpClaimed,
      isOpen:      gbpMeta.isOpen,
      hasWebsite:  websiteInfo.exists,
      websiteUrl:  websiteInfo.url,
      placeUrl:    currentUrl,
      placeId,
    }
  } catch (e: any) {
    console.error(`  [scraper] place page error: ${e.message}`)
    return null
  }
}

// ─── Main scraper ─────────────────────────────────────────────────────────

export interface MapsScrapeConfig {
  niche: string
  city: string
  state: string
  maxResults?: number
  noWebsiteOnly?: boolean   // default true — only return businesses without websites
  headless?: boolean        // default true
}

export async function runMapsScraper(cfg: MapsScrapeConfig): Promise<Lead[]> {
  const {
    niche,
    city,
    state,
    maxResults = 100,
    noWebsiteOnly = true,
    headless = true,
  } = cfg

  const query = NICHE_QUERY[niche] ?? niche
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${query} near ${city} ${state}`)}`

  console.log(`[MapsScraper] Searching: ${query} near ${city} ${state}`)
  console.log(`[MapsScraper] URL: ${searchUrl}`)

  const browser = await chromium.launch({
    headless,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  })

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    viewport: { width: 1280, height: 900 },
  })

  const page = await context.newPage()
  const leads: Lead[] = []
  const seen = new Set<string>()

  try {
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await jitter(2000, 1000)

    // Dismiss consent dialog if present (EU/cookie notices)
    try {
      const consent = page.locator('button:has-text("Accept all"), button:has-text("Reject all")').first()
      if (await consent.count() > 0) await consent.click()
    } catch { /* no consent dialog */ }

    // Wait for results feed
    await page.waitForSelector('[role="feed"], div.m6QErb', { timeout: 15000 })
    await jitter(1500, 500)

    // ── Phase 1: Collect all place URLs from search results (scroll to load more) ──
    const placeUrls: string[] = []
    let scrollAttempts = 0
    const maxScrollAttempts = 20
    const target = maxResults * 3  // collect 3x so we have enough after filtering

    console.log(`  Collecting place URLs from search results...`)

    // Wait for actual place links to appear
    await page.waitForSelector('a[href*="/maps/place/"]', { timeout: 15000 })

    while (placeUrls.length < target && scrollAttempts < maxScrollAttempts) {
      // Grab all place links currently in the feed
      const links = await page.locator('a[href*="/maps/place/"]').all()
      for (const link of links) {
        const href = await link.getAttribute('href').catch(() => null)
        if (!href || !href.includes('/maps/place/')) continue
        // Normalize: could be relative (/maps/place/...) or full (https://www.google.com/maps/...)
        let fullUrl: string
        if (href.startsWith('http')) {
          fullUrl = href.split('?')[0]
        } else {
          fullUrl = `https://www.google.com${href.startsWith('/') ? href : '/' + href}`.split('?')[0]
        }
        const dedupeKey = fullUrl.split('@')[0]  // strip coordinates
        if (seen.has(dedupeKey)) continue
        seen.add(dedupeKey)
        placeUrls.push(fullUrl)
      }

      console.log(`  Collected ${placeUrls.length} unique URLs so far...`)

      if (placeUrls.length >= target) break

      // Scroll the feed panel to load more
      scrollAttempts++
      await page.evaluate(() => {
        const feed = document.querySelector('[role="feed"]') as HTMLElement
        if (feed) feed.scrollBy(0, 1400)
        else window.scrollBy(0, 1400)
      })
      await jitter(2500, 800)

      const endMsg = await page.locator("p:has-text(\"You've reached the end\")").count()
      if (endMsg > 0) { console.log('  Reached end of results'); break }
    }

    console.log(`  Total place URLs collected: ${placeUrls.length}`)

    // ── Phase 2: Visit each place URL, extract data ─────────────────────────
    let processedCount = 0
    for (const placeUrl of placeUrls) {
      if (leads.length >= maxResults) break
      processedCount++
      console.log(`  [${processedCount}/${placeUrls.length}] Scraping...`)

      try {
        const business = await scrapePlacePage(page, placeUrl)

        if (!business) {
          await jitter(800, 400)
          continue
        }

        const skipForWebsite = noWebsiteOnly && business.hasWebsite
        if (skipForWebsite) {
          console.log(`  → skip (has website): ${business.name}`)
          await jitter(800, 400)
          continue
        }

        // Require at least phone to be contactable
        if (!business.phone) {
          console.log(`  → skip (no phone): ${business.name}`)
          await jitter(800, 400)
          continue
        }

        console.log(`  ✓ ${business.name} | ${business.phone} | ${business.address ?? '—'}`)

        leads.push({
          place_id:     business.placeId,
          name:         business.name,
          phone:        business.phone,
          email:        undefined,
          website:      business.websiteUrl,
          address:      business.address ?? `${city}, ${state}`,
          city,
          state,
          niche,
          rating:       business.rating,
          review_count: business.reviewCount,
          gbp_claimed:  business.gbpClaimed,
          is_open:      business.isOpen,
          status:       'found',
        })

        await jitter(2000, 800)
      } catch (e: any) {
        console.error(`  [scraper] error on ${placeUrl}: ${e.message}`)
        await jitter(1000, 500)
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`[MapsScraper] Done. Found ${leads.length} leads (no website) from ~${seen.size} total businesses`)
  return leads
}

// ─── Agent wrapper (fits pipeline AgentResult pattern) ───────────────────

export async function runMapsScrapeAgent(
  config: PipelineConfig
): Promise<AgentResult<Lead[]>> {
  try {
    const leads = await runMapsScraper({
      niche:         config.niche,
      city:          config.city,
      state:         config.state,
      maxResults:    config.count * 3,  // scrape 3x — some will be filtered/skipped
      noWebsiteOnly: true,
      headless:      true,
    })

    const trimmed = leads.slice(0, config.count)

    console.log(`[MapsScraper] Returning ${trimmed.length} leads to pipeline`)
    return { success: true, data: trimmed }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ─── CLI standalone mode ──────────────────────────────────────────────────
// npx tsx src/agents/maps-scraper.ts --niche hvac --city "Austin" --state TX --count 100

if (process.argv[1]?.endsWith('maps-scraper.ts') || process.argv[1]?.endsWith('maps-scraper.js')) {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i !== -1 ? args[i + 1] : undefined
  }

  const niche  = get('--niche')  ?? 'hvac'
  const city   = get('--city')   ?? 'Austin'
  const state  = get('--state')  ?? 'TX'
  const count  = parseInt(get('--count') ?? '20')
  const headed = args.includes('--headed')

  console.log(`\n🗺  Maps Scraper — ${niche} near ${city}, ${state} (target: ${count} leads)\n`)

  runMapsScraper({ niche, city, state, maxResults: count, noWebsiteOnly: true, headless: !headed })
    .then(leads => {
      console.log('\n─── Results ───────────────────────────────────────────')
      leads.forEach((l, i) => {
        console.log(`${i + 1}. ${l.name}`)
        console.log(`   Phone: ${l.phone ?? '—'}  |  Address: ${l.address}`)
      })
      console.log(`\nTotal: ${leads.length} leads`)
      process.exit(0)
    })
    .catch(e => {
      console.error('Fatal:', e)
      process.exit(1)
    })
}
