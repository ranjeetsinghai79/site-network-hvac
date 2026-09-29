/**
 * Angi (angi.com) — contractor leads: HVAC, roofing, plumbing, remodeling, etc.
 * No API key. Playwright scraper.
 * Angi has phone + reviews + verified contractor status.
 */
import { chromium, type Browser } from 'playwright'
import type { SourceLead } from './types.js'

const BASE = 'https://www.angi.com'

function searchUrl(category: string, city: string, state: string): string {
  const loc = `${city.toLowerCase().replace(/\s+/g,'-')}-${state.toLowerCase()}`
  return `${BASE}/companylist/${loc}/${encodeURIComponent(category.toLowerCase().replace(/\s+/g,'-'))}.htm`
}

export async function scrapeAngi(opts: {
  category:  string    // e.g. "hvac", "roofing", "plumbing"
  city:      string
  state:     string
  niche:     string
  maxPages?: number    // default 3
}): Promise<SourceLead[]> {
  const { category, city, state, niche, maxPages = 3 } = opts
  const leads: SourceLead[] = []

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-blink-features=AutomationControlled'],
  })

  try {
    for (let p = 1; p <= maxPages; p++) {
      const url = searchUrl(category, city, state) + (p > 1 ? `?page=${p}` : '')
      const page = await browser.newPage()

      try {
        await page.goto(url, { waitUntil:'domcontentloaded', timeout:25000 })
        await page.waitForTimeout(2000)

        const listings = await page.evaluate(() => {
          const results: any[] = []
          // Angi card selectors
          const cards = document.querySelectorAll('[data-testid="pro-card"], .companyCard, .provider-card, article[class*="ProviderCard"]')
          cards.forEach(card => {
            const name    = card.querySelector('h2, h3, [data-testid="company-name"], .companyTitle')?.textContent?.trim() ?? ''
            const phone   = card.querySelector('a[href^="tel:"]')?.getAttribute('href')?.replace('tel:','')
                         ?? card.querySelector('[data-testid="phone"]')?.textContent?.trim() ?? ''
            const address = card.querySelector('[data-testid="address"], .companyAddress')?.textContent?.trim() ?? ''
            const webEl   = card.querySelector('a[data-testid="website"], a[class*="website"]')
            const website = webEl?.getAttribute('href') ?? ''
            const reviews = card.querySelector('[data-testid="review-count"], .reviewCount')?.textContent?.trim() ?? ''
            const rating  = card.querySelector('[data-testid="rating"], [aria-label*="rating"]')?.getAttribute('aria-label') ?? ''
            const url     = card.querySelector('a[href*="/cc/"]')?.getAttribute('href') ?? ''
            if (name) results.push({ name, phone, address, website, reviews, rating, url })
          })
          return results
        })

        if (!listings.length) break

        for (const l of listings) {
          leads.push({
            name:       l.name,
            phone:      l.phone?.replace(/[^\d+]/g,'').slice(0,15) || undefined,
            website:    l.website || undefined,
            address:    l.address || undefined,
            city,
            state,
            niche,
            hasWebsite: !!l.website,
            source:     'angi',
            sourceUrl:  l.url ? (l.url.startsWith('http') ? l.url : `${BASE}${l.url}`) : undefined,
          })
        }
      } finally {
        await page.close().catch(() => {})
      }

      await new Promise(r => setTimeout(r, 1500 + Math.random() * 500))
    }
  } finally {
    await browser.close().catch(() => {})
  }

  return leads
}
