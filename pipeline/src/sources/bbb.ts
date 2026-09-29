/**
 * Better Business Bureau (bbb.org) — leads + owner/principal names
 * No API key needed. Playwright scraper.
 * BBB listings include business contact name (often the owner).
 */
import { chromium, type Browser } from 'playwright'
import type { SourceLead, EnrichResult } from './types.js'

const BASE = 'https://www.bbb.org'

function searchUrl(name: string, city: string, state: string): string {
  return `${BASE}/search?find_text=${encodeURIComponent(name)}&find_loc=${encodeURIComponent(`${city}, ${state}`)}&page=1`
}

function categoryUrl(term: string, city: string, state: string, page = 1): string {
  return `${BASE}/search?find_text=${encodeURIComponent(term)}&find_loc=${encodeURIComponent(`${city}, ${state}`)}&page=${page}`
}

interface BBBListing {
  name:        string
  phone:       string
  address:     string
  website:     string
  contactName: string   // principal/owner
  rating:      string
  url:         string
}

async function scrapeSearchPage(browser: Browser, url: string): Promise<BBBListing[]> {
  const page = await browser.newPage()
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(2500)

    return await page.evaluate((base: string) => {
      const results: any[] = []
      const seen = new Set<string>()

      // BBB uses a[href^="tel:"] as the reliable anchor — walk up to div.stack for card context
      const telLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"]'))

      telLinks.forEach(a => {
        const phone = a.getAttribute('href')?.replace('tel:','') ?? ''

        // Walk up to find card container that has h2/h3
        let el: Element | null = a.parentElement
        let depth = 0
        while (el && depth < 12) {
          if (el.querySelector('h2,h3')) break
          el = el.parentElement; depth++
        }
        if (!el) return

        const name    = el.querySelector('h2,h3')?.textContent?.trim() ?? ''
        if (!name || seen.has(name)) return
        seen.add(name)

        const bizLinkEl = el.querySelector<HTMLAnchorElement>('a[href*="/profile/"]')
                       ?? el.querySelector<HTMLAnchorElement>('a[href*="/us/"]')
        const listUrl   = bizLinkEl ? (base + bizLinkEl.getAttribute('href')) : ''
        const website   = Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href^="http"]'))
                            .find(a => !a.href.includes('bbb.org'))?.href ?? ''

        results.push({ name, phone, address:'', website, contactName:'', rating:'', url: listUrl })
      })
      return results
    }, BASE)
  } catch {
    return []
  } finally {
    await page.close().catch(() => {})
  }
}

async function scrapeDetailPage(browser: Browser, url: string): Promise<Partial<BBBListing>> {
  const page = await browser.newPage()
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(3000)   // BBB needs extra time to hydrate

    return await page.evaluate(() => {
      // Primary: extract from JSON-LD (always present, no JS hydration needed)
      const jsonLdScripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'))
      let contactName = ''
      let phone = ''
      let website = ''

      for (const script of jsonLdScripts) {
        try {
          const data = JSON.parse(script.textContent ?? '')
          const arr = Array.isArray(data) ? data : [data]
          for (const obj of arr) {
            if (obj.telephone) phone = obj.telephone
            if (obj.url)       website = obj.url
            // employees list has owners/managers
            if (Array.isArray(obj.employee)) {
              const owner = obj.employee.find((e: any) =>
                /owner|managing|principal|president|founder|director|partner/i.test(e.jobTitle ?? '')
              ) ?? obj.employee[0]
              if (owner) {
                contactName = [owner.honorificPrefix, owner.givenName, owner.additionalName, owner.familyName]
                  .filter(Boolean).join(' ').replace(/\s+/g,' ').trim()
              }
            }
          }
        } catch { /* skip */ }
      }

      // Fallback: DOM selectors (post-hydration)
      if (!phone) {
        phone = document.querySelector('a[href^="tel:"]')?.getAttribute('href')?.replace('tel:','') ?? ''
      }
      if (!website) {
        website = (document.querySelector('a[data-testid="website-button"], a[title*="website"]') as HTMLAnchorElement)?.href ?? ''
      }

      return { phone, contactName, website }
    })
  } catch {
    return {}
  } finally {
    await page.close().catch(() => {})
  }
}

export async function scrapeBBB(opts: {
  term:      string
  city:      string
  state:     string
  niche:     string
  maxPages?: number    // default 3
}): Promise<SourceLead[]> {
  const { term, city, state, niche, maxPages = 3 } = opts
  const leads: SourceLead[] = []

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-blink-features=AutomationControlled'],
  })

  try {
    for (let p = 1; p <= maxPages; p++) {
      const url = categoryUrl(term, city, state, p)
      const listings = await scrapeSearchPage(browser, url)
      if (!listings.length) break

      for (const l of listings) {
        leads.push({
          name:       l.name,
          phone:      l.phone.replace(/[^\d+]/g, '').slice(0,15) || undefined,
          website:    l.website || undefined,
          address:    l.address || undefined,
          city,
          state,
          niche,
          hasWebsite: !!l.website,
          ownerName:  l.contactName || undefined,
          source:     'bbb',
          sourceUrl:  l.url || undefined,
        })
      }

      await new Promise(r => setTimeout(r, 1500 + Math.random() * 500))
    }
  } finally {
    await browser.close().catch(() => {})
  }

  return leads
}

/** BBB enrichment — find owner name for specific business */
export async function bbbEnrich(name: string, city: string, state: string): Promise<EnrichResult | null> {
  const browser = await chromium.launch({ headless:true, args:['--no-sandbox','--disable-setuid-sandbox'] })
  try {
    const url = searchUrl(name, city, state)
    const listings = await scrapeSearchPage(browser, url)
    if (!listings.length) return null

    const match = listings.find(l =>
      l.name.toLowerCase().includes(name.toLowerCase().slice(0,12))
    ) ?? listings[0]

    // Get detail page for more complete info
    if (match.url) {
      const detail = await scrapeDetailPage(browser, match.url)
      return {
        ownerName:  detail.contactName || match.contactName || undefined,
        phone:      detail.phone || match.phone || undefined,
        email:      undefined,
        source:     'bbb',
      }
    }

    return {
      ownerName: match.contactName || undefined,
      phone:     match.phone || undefined,
      source:    'bbb',
    }
  } catch {
    return null
  } finally {
    await browser.close().catch(() => {})
  }
}
