/**
 * maps-place-scraper.ts
 *
 * Deep-scrapes a single Google Maps place page with Playwright:
 *  - Inline reviews from the Overview pane (~6-10 with full text — Places API caps at 5)
 *  - ALL photo URLs from the gallery (Places API caps at ~10)
 *
 * Requirements discovered by testing (July 2026):
 *  - channel: 'chrome' + --disable-blink-features=AutomationControlled + webdriver spoof
 *  - HEADFUL only — headless gets Google's "limited view" with zero reviews
 *  - Full review list (e.g. all 96) is not reachable without sign-in or a paid API
 *    (DataForSEO google/reviews) — inline set is the free ceiling
 *
 * Free (no API cost). Used by auto-build to make generated sites 100% real-data.
 */

import { chromium } from 'playwright'

export interface ScrapedReview {
  author: string
  rating: number
  text: string
  date: string
}

export interface PlaceDetails {
  reviews: ScrapedReview[]
  photos: string[]                                    // full-res URLs
  beforeAfter: Array<{ before: string; after: string }>
}

// Upgrade Google photo URL to high resolution
function highRes(url: string): string {
  return url.replace(/=w\d+-h\d+[^"']*/, '=w1920-h1080-k-no').replace(/=s\d+[^"']*/, '=s1920-k-no')
}

export async function scrapePlaceDetails(
  placeIdOrUri: string,
  opts: { maxPhotos?: number } = {}
): Promise<PlaceDetails> {
  const { maxPhotos = 60 } = opts
  const empty: PlaceDetails = { reviews: [], photos: [], beforeAfter: [] }
  if (!placeIdOrUri) return empty

  const url = placeIdOrUri.startsWith('http')
    ? placeIdOrUri
    : `https://www.google.com/maps/place/?q=place_id:${placeIdOrUri}`

  let browser
  try {
    browser = await chromium.launch({
      channel: 'chrome',
      headless: false,   // headless → "limited view" with zero reviews
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    })
  } catch {
    // No Chrome channel or no display — degrade to bundled chromium (photos still work)
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    })
  }

  try {
    const ctx = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 900 } })
    await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }) })
    const page = await ctx.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(4000)

    // Dismiss consent dialog if shown
    await page.locator('button[aria-label*="Accept"], form[action*="consent"] button').first()
      .click({ timeout: 2000 }).catch(() => {})

    // ── Scroll Overview pane to load inline reviews ─────────────────────────
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => {
        const pane = document.querySelector('div.m6QErb.DxyBCb') as HTMLElement | null
        pane?.scrollBy(0, 2500)
      }).catch(() => {})
      await page.waitForTimeout(500)
    }

    // Expand truncated review texts
    const moreButtons = page.locator('button[aria-label*="See more"]')
    const mbCount = Math.min(await moreButtons.count(), 40)
    for (let i = 0; i < mbCount; i++) {
      await moreButtons.nth(i).click({ timeout: 600 }).catch(() => {})
    }

    const reviews: ScrapedReview[] = await page.evaluate(() => {
      const out: Array<{ author: string; rating: number; text: string; date: string }> = []
      document.querySelectorAll('div[data-review-id]').forEach((el) => {
        const ratingEl = el.querySelector('span[role="img"][aria-label*="star" i]')
        if (!ratingEl) return
        const ratingMatch = ratingEl.getAttribute('aria-label')?.match(/([\d.]+)/)
        const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0
        const author = el.querySelector('.d4r55')?.textContent?.trim() ?? ''
        const text   = el.querySelector('.wiI7pd')?.textContent?.trim() ?? ''
        const date   = el.querySelector('.rsqaWe')?.textContent?.trim() ?? ''
        if (author && rating > 0) out.push({ author, rating, text, date })
      })
      const seen = new Set<string>()
      return out.filter(r => {
        const k = r.author + '|' + r.text.slice(0, 40)
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
    })
    console.log(`[PlaceScraper] ${reviews.length} inline reviews scraped`)

    // ── Photos gallery ──────────────────────────────────────────────────────
    let photos: string[] = []
    const photoBtn = page.locator('button[aria-label*="Photo" i], button[jsaction*="heroHeaderImage"]').first()
    if (await photoBtn.count()) {
      await photoBtn.click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(2000)
      let last = 0
      for (let i = 0; i < 25; i++) {
        const count = await page.locator('div[style*="background-image"]').count()
        if (count >= maxPhotos || (count === last && i > 3)) break
        last = count
        await page.evaluate(() => {
          const pane = document.querySelector('div[role="main"] div[tabindex="-1"]') as HTMLElement | null
          ;(pane ?? document.querySelector('div[role="main"]'))?.scrollBy(0, 2400)
        }).catch(() => {})
        await page.waitForTimeout(600)
      }
      photos = (await page.evaluate(() => {
        const urls = new Set<string>()
        document.querySelectorAll('div[style*="background-image"]').forEach((el) => {
          const m = (el.getAttribute('style') ?? '').match(/url\("?(https:\/\/lh\d[^"')]+)"?\)/)
          if (m) urls.add(m[1])
        })
        document.querySelectorAll('img[src*="googleusercontent"]').forEach((img) => {
          const src = (img as HTMLImageElement).src
          if (src.includes('lh3.') || src.includes('lh5.')) urls.add(src)
        })
        return [...urls]
      })).map(highRes)
    }
    console.log(`[PlaceScraper] ${photos.length} photos scraped`)

    // Before/after pairs: Maps gallery has no reliable captions — never fabricate pairs
    return { reviews, photos, beforeAfter: [] }
  } catch (e: any) {
    console.warn(`[PlaceScraper] failed: ${e.message}`)
    return empty
  } finally {
    await browser.close()
  }
}
