/**
 * Facebook Business Pages — owner name + contact info
 * No API key. Playwright scraper on public business pages.
 * Strategy: Google search "site:facebook.com {business name} {city}" → scrape FB page
 */
import { chromium, type Browser } from 'playwright'
import type { EnrichResult } from './types.js'

async function googleSearchFBPage(browser: Browser, name: string, city: string): Promise<string | null> {
  const page = await browser.newPage()
  try {
    const q = encodeURIComponent(`site:facebook.com/pages "${name}" "${city}"`)
    await page.goto(`https://www.google.com/search?q=${q}`, { waitUntil:'domcontentloaded', timeout:15000 })
    await page.waitForTimeout(1000)

    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href*="facebook.com"]'))
        .map(a => a.getAttribute('href') ?? '')
        .filter(h => h.includes('facebook.com/pages') || h.includes('facebook.com/') && !h.includes('facebook.com/search'))
        .slice(0,3)
    )
    return links[0] ?? null
  } catch {
    return null
  } finally {
    await page.close().catch(() => {})
  }
}

async function scrapeFBPage(browser: Browser, url: string): Promise<Partial<EnrichResult>> {
  const page = await browser.newPage()
  try {
    // FB requires login for most content — use the about page which is more public
    const aboutUrl = url.replace(/\/?$/, '/about')
    await page.goto(aboutUrl, { waitUntil:'domcontentloaded', timeout:20000 })
    await page.waitForTimeout(2000)

    const data = await page.evaluate(() => {
      const text = document.body.innerText ?? ''

      // Phone: look for phone number patterns
      const phoneMatch = text.match(/\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/)
      const phone = phoneMatch?.[0]

      // Email: look for email patterns
      const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)
      const email = emailMatch?.[0]

      // Website: look for website link
      const webEl = document.querySelector('a[data-lynx-uri*="http"]')
      const website = webEl?.getAttribute('data-lynx-uri')

      return { phone, email, website }
    })

    return {
      phone:  data.phone,
      email:  data.email,
      source: 'facebook',
    }
  } catch {
    return { source: 'facebook' }
  } finally {
    await page.close().catch(() => {})
  }
}

/** Enrich a single business by searching Facebook */
export async function facebookEnrich(name: string, city: string, state: string): Promise<EnrichResult | null> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-blink-features=AutomationControlled'],
  })
  try {
    // Try Google first to find the FB page URL
    const fbUrl = await googleSearchFBPage(browser, name, city)
    if (!fbUrl) return null

    const data = await scrapeFBPage(browser, fbUrl)
    if (!data.phone && !data.email) return null

    return {
      phone:  data.phone,
      email:  data.email,
      source: 'facebook',
    }
  } catch {
    return null
  } finally {
    await browser.close().catch(() => {})
  }
}

/** Batch enrich multiple businesses from Facebook */
export async function facebookEnrichBatch(
  items: Array<{ name: string; city: string; state: string; meta: Record<string, any> }>,
  concurrency = 2
): Promise<Array<{ meta: Record<string, any>; result: EnrichResult | null }>> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-blink-features=AutomationControlled'],
  })

  const out: Array<{ meta: Record<string, any>; result: EnrichResult | null }> = new Array(items.length)
  let next = 0

  async function worker() {
    while (next < items.length) {
      const idx = next++
      const { name, city, state, meta } = items[idx]
      try {
        const fbUrl = await googleSearchFBPage(browser, name, city)
        if (!fbUrl) { out[idx] = { meta, result: null }; continue }
        const data = await scrapeFBPage(browser, fbUrl)
        out[idx] = { meta, result: data.phone || data.email ? { ...data, source:'facebook' } : null }
      } catch {
        out[idx] = { meta, result: null }
      }
      await new Promise(r => setTimeout(r, 500))
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  } finally {
    await browser.close().catch(() => {})
  }

  return out
}
