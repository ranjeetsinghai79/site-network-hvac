/**
 * Niche-specific directories — higher quality targeted leads
 *
 * Directories covered:
 *   Healthgrades  — dental + medical (has doctor names)
 *   Zocdoc        — dental + medical (appointments = active patients)
 *   Avvo          — law firms (has attorney names)
 *   TripAdvisor   — restaurants
 *   Houzz         — remodeling + landscaping (has owner names + portfolio)
 *   Thumbtack     — all contractor niches
 */
import { chromium, type Browser } from 'playwright'
import type { SourceLead } from './types.js'

// ─── Shared browser scraper ───────────────────────────────────────────────────

async function scrapePage(
  browser: Browser,
  url: string,
  extractFn: (page: import('playwright').Page) => Promise<Partial<SourceLead>[]>,
  waitFor = 2000
): Promise<Partial<SourceLead>[]> {
  const page = await browser.newPage()
  try {
    await page.goto(url, { waitUntil:'domcontentloaded', timeout:25000 })
    await page.waitForTimeout(waitFor)
    return await extractFn(page)
  } catch {
    return []
  } finally {
    await page.close().catch(() => {})
  }
}

// ─── Healthgrades (dental + medical) ─────────────────────────────────────────

export async function scrapeHealthgrades(opts: {
  specialty: string    // 'dentist' | 'general-practitioner' | 'dermatologist' etc.
  city:      string
  state:     string
  niche:     string
  maxPages?: number
}): Promise<SourceLead[]> {
  const { specialty, city, state, niche, maxPages = 3 } = opts
  const leads: SourceLead[] = []

  const browser = await chromium.launch({ headless:true, args:['--no-sandbox','--disable-setuid-sandbox'] })
  try {
    for (let p = 1; p <= maxPages; p++) {
      const url = `https://www.healthgrades.com/find-a-doctor/${specialty}/in-${state.toLowerCase()}/${city.toLowerCase().replace(/\s+/g,'-')}?page=${p}`
      const results = await scrapePage(browser, url, async (page) => {
        return page.evaluate(() =>
          Array.from(document.querySelectorAll('[data-qa-target="provider-card"], .provider-card, [class*="ProviderCard"]')).map(card => ({
            name:       card.querySelector('[data-qa-target="provider-name"], h2, h3')?.textContent?.trim() ?? '',
            phone:      card.querySelector('a[href^="tel:"]')?.getAttribute('href')?.replace('tel:','') ?? undefined,
            address:    card.querySelector('[data-qa-target="address"], .address')?.textContent?.trim() ?? undefined,
            ownerName:  card.querySelector('[data-qa-target="provider-name"]')?.textContent?.trim() ?? undefined,
            sourceUrl:  (card.querySelector('a[href*="/physician/"]') as HTMLAnchorElement)?.href ?? undefined,
          }))
        )
      })

      if (!results.length) break
      results.forEach(r => {
        if (r.name) leads.push({ ...r as any, city, state, niche, hasWebsite:false, source:'healthgrades' })
      })
      await new Promise(r => setTimeout(r, 1200))
    }
  } finally {
    await browser.close().catch(() => {})
  }

  return leads
}

// ─── Avvo (law firms + attorneys) ─────────────────────────────────────────────

export async function scrapeAvvo(opts: {
  practiceArea: string   // 'personal-injury' | 'family' | 'criminal-defense' etc.
  city:         string
  state:        string
  maxPages?:    number
}): Promise<SourceLead[]> {
  const { practiceArea, city, state, maxPages = 3 } = opts
  const leads: SourceLead[] = []

  const browser = await chromium.launch({ headless:true, args:['--no-sandbox','--disable-setuid-sandbox'] })
  try {
    for (let p = 1; p <= maxPages; p++) {
      const stateSlug = state.toLowerCase()
      const citySlug  = city.toLowerCase().replace(/\s+/g,'-')
      const url = `https://www.avvo.com/find-a-lawyer/${stateSlug}/${citySlug}/${practiceArea}-lawyer.html?page=${p}`

      const results = await scrapePage(browser, url, async (page) =>
        page.evaluate(() =>
          Array.from(document.querySelectorAll('.profile-info, [class*="attorney-card"], .search-result-card')).map(card => ({
            name:      card.querySelector('h2 a, h3 a, .attorney-name')?.textContent?.trim() ?? '',
            phone:     card.querySelector('a[href^="tel:"]')?.getAttribute('href')?.replace('tel:','') ?? undefined,
            address:   card.querySelector('.address, [class*="location"]')?.textContent?.trim() ?? undefined,
            ownerName: card.querySelector('h2 a, h3 a, .attorney-name')?.textContent?.trim() ?? undefined,
            website:   (card.querySelector('a[class*="website"]') as HTMLAnchorElement)?.href ?? undefined,
            sourceUrl: (card.querySelector('h2 a, h3 a') as HTMLAnchorElement)?.href ?? undefined,
          }))
        )
      )

      if (!results.length) break
      results.forEach(r => {
        if (r.name) leads.push({ ...r as any, city, state, niche:'lawfirm', hasWebsite:!!r.website, source:'avvo' })
      })
      await new Promise(r => setTimeout(r, 1200))
    }
  } finally {
    await browser.close().catch(() => {})
  }

  return leads
}

// ─── TripAdvisor (restaurants) ─────────────────────────────────────────────────

export async function scrapeTripAdvisor(opts: {
  city:      string
  state:     string
  maxPages?: number
}): Promise<SourceLead[]> {
  const { city, state, maxPages = 3 } = opts
  const leads: SourceLead[] = []

  const browser = await chromium.launch({ headless:true, args:['--no-sandbox','--disable-setuid-sandbox','--disable-blink-features=AutomationControlled'] })
  try {
    // Get the city page first
    const searchUrl = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(city + ' ' + state)}&searchSessionId=&sid=&blockRedirect=true&ssrc=e&geo=&redirected_from_ta_search=y&categoryType=geo`
    const page = await browser.newPage()
    await page.goto(searchUrl, { waitUntil:'domcontentloaded', timeout:20000 }).catch(()=>{})
    await page.waitForTimeout(1500)

    // Find the geo ID from search results
    const geoLink = await page.locator('a[href*="Restaurants"]').first().getAttribute('href').catch(()=>null)
    await page.close()

    if (!geoLink) {
      await browser.close()
      return leads
    }

    const baseUrl = `https://www.tripadvisor.com${geoLink}`

    for (let p = 0; p < maxPages; p++) {
      const url = p === 0 ? baseUrl : baseUrl.replace(/\.html$/, `-oa${p * 30}.html`)
      const results = await scrapePage(browser, url, async (pg) =>
        pg.evaluate(() =>
          Array.from(document.querySelectorAll('[data-test*="restaurant_review"], [class*="RCard"]')).map(card => ({
            name:    card.querySelector('a[class*="title"], h2, h3')?.textContent?.trim() ?? '',
            phone:   undefined,
            address: card.querySelector('[class*="address"]')?.textContent?.trim() ?? undefined,
            rating:  parseFloat(card.querySelector('[class*="rating"]')?.getAttribute('aria-label') ?? '') || undefined,
            sourceUrl: (card.querySelector('a[href*="Restaurant_Review"]') as HTMLAnchorElement)?.href ?? undefined,
          }))
        )
      )

      if (!results.length) break
      results.forEach(r => {
        if (r.name) leads.push({ ...r as any, city, state, niche:'restaurant', hasWebsite:false, source:'tripadvisor' })
      })
      await new Promise(r => setTimeout(r, 1200))
    }
  } finally {
    await browser.close().catch(() => {})
  }

  return leads
}

// ─── Houzz (remodeling + landscaping + interior design) ────────────────────────

export async function scrapeHouzz(opts: {
  category:  string    // 'general-contractors' | 'landscape-architects' | etc.
  city:      string
  state:     string
  niche:     string
  maxPages?: number
}): Promise<SourceLead[]> {
  const { category, city, state, niche, maxPages = 3 } = opts
  const leads: SourceLead[] = []

  const browser = await chromium.launch({ headless:true, args:['--no-sandbox','--disable-setuid-sandbox'] })
  try {
    for (let p = 1; p <= maxPages; p++) {
      const url = `https://www.houzz.com/professionals/${category}/${city.toLowerCase().replace(/\s+/g,'-')}-${state.toLowerCase()}--probr0-bo--pp~${(p-1)*15}`

      const results = await scrapePage(browser, url, async (page) =>
        page.evaluate(() =>
          Array.from(document.querySelectorAll('[class*="hz-pro-search-results__pro-card"], .pro-card')).map(card => ({
            name:      card.querySelector('h3, [class*="pro-name"]')?.textContent?.trim() ?? '',
            phone:     card.querySelector('a[href^="tel:"]')?.getAttribute('href')?.replace('tel:','') ?? undefined,
            website:   (card.querySelector('a[class*="website"]') as HTMLAnchorElement)?.href ?? undefined,
            ownerName: card.querySelector('[class*="owner"], [class*="contact"]')?.textContent?.trim() ?? undefined,
            sourceUrl: (card.querySelector('a[href*="/pro/"]') as HTMLAnchorElement)?.href ?? undefined,
          }))
        )
      )

      if (!results.length) break
      results.forEach(r => {
        if (r.name) leads.push({ ...r as any, city, state, niche, hasWebsite:!!r.website, source:'houzz' })
      })
      await new Promise(r => setTimeout(r, 1200))
    }
  } finally {
    await browser.close().catch(() => {})
  }

  return leads
}
