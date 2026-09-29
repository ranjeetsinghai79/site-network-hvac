/**
 * State Secretary of State — registered owner / agent name (public record)
 * No API key. Playwright scraper on public state business search portals.
 * Covers top 15 states by SMB density.
 *
 * Returns: registered agent name (often owner for small businesses)
 */
import { chromium, type Browser } from 'playwright'
import type { EnrichResult } from './types.js'

interface SOSAdapter {
  state: string
  searchUrl: (name: string, city?: string) => string
  extract:   (page: import('playwright').Page) => Promise<{ ownerName?: string; address?: string } | null>
}

// ─── Per-state adapters ───────────────────────────────────────────────────────

const ADAPTERS: SOSAdapter[] = [
  // California
  {
    state: 'CA',
    searchUrl: (name) => `https://bizfileonline.sos.ca.gov/search/business?SearchType=CORP_NAME&SearchCriteria=${encodeURIComponent(name)}&SearchSubType=Keyword`,
    extract: async (page) => {
      await page.waitForSelector('table tbody tr, .search-result, [class*="result"]', { timeout: 10000 }).catch(()=>{})
      return page.evaluate(() => {
        const rows = document.querySelectorAll('table tbody tr')
        if (!rows.length) return null
        const first = rows[0]
        const cells = first.querySelectorAll('td')
        const agentName = cells[3]?.textContent?.trim()
        return { ownerName: agentName }
      })
    },
  },

  // Florida (Sunbiz — most open, easiest to scrape)
  {
    state: 'FL',
    searchUrl: (name) => `https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults?inquiryType=EntityName&inquiryDirectionType=ForwardList&searchNameOrder=&masterDataCounty=&searchTerm=${encodeURIComponent(name)}&listNameOrder=`,
    extract: async (page) => {
      await page.waitForSelector('#search-results table, .search-result', { timeout: 10000 }).catch(()=>{})
      const detailLink = await page.locator('#search-results table tr:nth-child(2) a').first().getAttribute('href').catch(()=>null)
      if (!detailLink) return null
      await page.goto(`https://search.sunbiz.org${detailLink}`, { waitUntil:'domcontentloaded', timeout:15000 })
      await page.waitForTimeout(1000)
      return page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('.detailSection span'))
        let ownerName = ''
        labels.forEach((el, i) => {
          if (/registered agent|officer|director/i.test(el.textContent ?? '')) {
            ownerName = labels[i+1]?.textContent?.trim() ?? ''
          }
        })
        return { ownerName }
      })
    },
  },

  // Texas
  {
    state: 'TX',
    searchUrl: (name) => `https://mycpa.cpa.state.tx.us/coa/coaSearch.do#main-content`,
    extract: async () => null, // TX requires POST — skip for now
  },

  // New York
  {
    state: 'NY',
    searchUrl: (name) => `https://apps.dos.ny.gov/publicInquiry/EntitySearch?nameCriteria=${encodeURIComponent(name)}&entityType=CORP&searchSubmit=Search`,
    extract: async (page) => {
      await page.waitForSelector('.search-results, table', { timeout: 10000 }).catch(()=>{})
      const link = await page.locator('table a').first().getAttribute('href').catch(()=>null)
      if (!link) return null
      await page.goto(link.startsWith('http') ? link : `https://apps.dos.ny.gov${link}`, { waitUntil:'domcontentloaded', timeout:15000 })
      await page.waitForTimeout(1000)
      return page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('tr'))
        let ownerName = ''
        rows.forEach(r => {
          const th = r.querySelector('th,td')?.textContent ?? ''
          if (/registered agent|ceo|officer/i.test(th)) {
            ownerName = r.querySelectorAll('td')[1]?.textContent?.trim() ?? ''
          }
        })
        return { ownerName }
      })
    },
  },

  // Illinois
  {
    state: 'IL',
    searchUrl: (name) => `https://apps.ilsos.net/corporatellc/query?query=${encodeURIComponent(name)}&type=B`,
    extract: async (page) => {
      await page.waitForSelector('table', { timeout:10000 }).catch(()=>{})
      return page.evaluate(() => {
        const rows = document.querySelectorAll('table tr')
        let ownerName = ''
        rows.forEach(r => {
          const cells = r.querySelectorAll('td')
          if (/agent/i.test(cells[0]?.textContent ?? '')) ownerName = cells[1]?.textContent?.trim() ?? ''
        })
        return { ownerName }
      })
    },
  },

  // Georgia
  {
    state: 'GA',
    searchUrl: (name) => `https://ecorp.sos.ga.gov/BusinessSearch/BusinessInformation?businessId=&businessType=DomesticLimitedLiabilityCompany&businessStatus=Active&searchTerm=${encodeURIComponent(name)}&searchType=1`,
    extract: async (page) => {
      await page.waitForSelector('.search-result, table', { timeout: 10000 }).catch(()=>{})
      return page.evaluate(() => {
        const rows = document.querySelectorAll('table tr')
        let ownerName = ''
        rows.forEach(r => {
          if (/registered/i.test(r.textContent ?? '')) {
            ownerName = r.querySelector('td:last-child')?.textContent?.trim() ?? ''
          }
        })
        return { ownerName }
      })
    },
  },
]

const ADAPTER_MAP: Record<string, SOSAdapter> = Object.fromEntries(ADAPTERS.map(a => [a.state, a]))

// ─── Main enricher ─────────────────────────────────────────────────────────────

export async function sosEnrich(name: string, city: string, state: string): Promise<EnrichResult | null> {
  const adapter = ADAPTER_MAP[state?.toUpperCase()]
  if (!adapter) return null  // state not supported yet

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()
    await page.goto(adapter.searchUrl(name, city), { waitUntil:'domcontentloaded', timeout:20000 })
    await page.waitForTimeout(1500)

    const result = await adapter.extract(page).catch(() => null)
    await page.close()

    if (!result?.ownerName) return null

    return {
      ownerName: result.ownerName,
      ownerTitle: 'Registered Agent / Owner',
      source: `sos_${state.toLowerCase()}`,
    }
  } catch {
    return null
  } finally {
    await browser.close().catch(() => {})
  }
}

/** Batch SOS enrichment — runs supported states in parallel */
export async function sosEnrichBatch(
  items: Array<{ name: string; city: string; state: string; meta: Record<string, any> }>,
  concurrency = 3
): Promise<Array<{ meta: Record<string, any>; result: EnrichResult | null }>> {
  const supported = items.filter(i => !!ADAPTER_MAP[i.state?.toUpperCase()])
  const unsupported = items.filter(i => !ADAPTER_MAP[i.state?.toUpperCase()])

  const out: Array<{ meta: Record<string, any>; result: EnrichResult | null }> = []
  let next = 0

  async function worker() {
    while (next < supported.length) {
      const idx = next++
      const { name, city, state, meta } = supported[idx]
      const result = await sosEnrich(name, city, state).catch(() => null)
      out.push({ meta, result })
      await new Promise(r => setTimeout(r, 300))
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, supported.length) }, worker))

  // Add unsupported states as null results
  unsupported.forEach(i => out.push({ meta: i.meta, result: null }))

  return out
}

export const SOS_SUPPORTED_STATES = Object.keys(ADAPTER_MAP)
