/**
 * Ad Winners Research — Meta Ad Library proven-winner scraper
 *
 * Core trick (pattern from advertising-ops): an ad that STARTED months ago
 * AND is STILL ACTIVE has been paying for itself the whole time. The Ad
 * Library search is filtered to active ads only; we parse each card's
 * "Started running on" date and keep ads older than a minimum run time.
 * Started long ago + still live = the market already validated it.
 *
 * $0 — Playwright against the public Ad Library, same stack as maps-scraper.
 */
import { chromium } from 'playwright'

export interface AdWinner {
  libraryId: string
  pageName: string
  adText: string
  startDate: string       // ISO date the ad started running
  daysRunning: number
  hasVideo: boolean
  snapshotUrl: string     // permalink into the Ad Library
}

export interface WinnersConfig {
  searchTerm: string      // niche keyword or competitor name
  country?: string        // default US
  minDaysRunning?: number // default 60 (2-month floor)
  maxAds?: number         // default 30 cards scanned
  headless?: boolean
}

const CARD_BOILERPLATE = new Set([
  'Active', 'Sponsored', 'See ad details', 'See summary details',
  'Open Drop-down', 'Open Dropdown', 'Learn More', 'Learn more', 'Shop Now', 'Shop now',
  'Sign Up', 'Sign up', 'Book Now', 'Book now', 'Contact Us', 'Contact us',
  'Get Offer', 'Send Message', 'Apply Now', 'Download', 'Subscribe',
  'Like', 'Comment', 'Share', 'Watch More', 'Watch more',
])

function jitter(base: number, spread: number) {
  return new Promise((r) => setTimeout(r, base + Math.random() * spread))
}

export async function findWinningAds(cfg: WinnersConfig): Promise<AdWinner[]> {
  const country = cfg.country ?? 'US'
  const minDays = cfg.minDaysRunning ?? 60
  const maxAds = cfg.maxAds ?? 30

  const searchUrl =
    `https://www.facebook.com/ads/library/?active_status=active&ad_type=all` +
    `&country=${encodeURIComponent(country)}&q=${encodeURIComponent(cfg.searchTerm)}` +
    `&search_type=keyword_unordered&media_type=all`

  console.log(`[AdWinners] Searching Ad Library: "${cfg.searchTerm}" (${country}, active, ${minDays}+ days)`)

  const browser = await chromium.launch({
    headless: cfg.headless ?? true,
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
    viewport: { width: 1440, height: 960 },
  })

  const page = await context.newPage()
  const winners: AdWinner[] = []

  try {
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await jitter(3000, 1500)

    // Dismiss cookie/consent dialog if present
    try {
      const consent = page
        .locator('div[role="dialog"] div[role="button"]:has-text("Allow all cookies"), div[role="dialog"] div[role="button"]:has-text("Decline optional cookies")')
        .first()
      if (await consent.count() > 0) await consent.click()
    } catch { /* no consent dialog */ }

    // Wait for at least one ad card ("Library ID" label is stable across redesigns)
    await page.waitForSelector('text=/Library ID/', { timeout: 20_000 })

    // Scroll to load more cards
    let scrolls = 0
    while (scrolls < 8) {
      const count = await page.locator('text=/Library ID/').count()
      if (count >= maxAds) break
      await page.mouse.wheel(0, 2500)
      await jitter(1500, 800)
      scrolls++
    }

    // Extract card data in-page: anchor on "Library ID" spans, climb to the card
    const rawCards: Array<{ text: string; hasVideo: boolean }> = await page.evaluate((limit) => {
      const out: Array<{ text: string; hasVideo: boolean }> = []
      const seen = new Set<Element>()
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      const anchors: Element[] = []
      let node: Node | null
      while ((node = walker.nextNode())) {
        if (node.textContent && node.textContent.includes('Library ID') && node.parentElement) {
          anchors.push(node.parentElement)
        }
      }
      for (const anchor of anchors) {
        // Climb until the element also contains the start-date line
        let card: Element | null = anchor
        for (let i = 0; i < 12 && card; i++) {
          const t = (card as HTMLElement).innerText ?? ''
          if (t.includes('Started running on')) break
          card = card.parentElement
        }
        if (!card) continue
        // Keep climbing to pull in the ad copy below the meta header — stop
        // before an ancestor that spans a second card (2+ Library IDs)
        while (
          card.parentElement &&
          ((card.parentElement as HTMLElement).innerText ?? '').split('Library ID').length - 1 === 1
        ) {
          card = card.parentElement
        }
        if (seen.has(card)) continue
        seen.add(card)
        out.push({
          text: (card as HTMLElement).innerText ?? '',
          hasVideo: !!card.querySelector('video'),
        })
        if (out.length >= limit) break
      }
      return out
    }, maxAds)

    console.log(`[AdWinners] Scanned ${rawCards.length} ad cards`)

    const now = Date.now()
    const seenIds = new Set<string>()

    for (const card of rawCards) {
      // Facebook injects zero-width chars into ad copy — strip them first
      card.text = card.text.replace(/[\u200B-\u200F\uFEFF]/g, '')
      const idMatch = card.text.match(/Library ID:?\s*(\d+)/)
      const dateMatch = card.text.match(/Started running on ([A-Z][a-z]{2,8} \d{1,2}, \d{4})/)
      if (!idMatch || !dateMatch) continue
      if (seenIds.has(idMatch[1])) continue
      seenIds.add(idMatch[1])

      const start = new Date(dateMatch[1])
      if (isNaN(start.getTime())) continue
      const daysRunning = Math.floor((now - start.getTime()) / 86_400_000)
      if (daysRunning < minDays) continue

      const lines = card.text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .filter((l) => !CARD_BOILERPLATE.has(l))
        .filter((l) => !/^Library ID/.test(l) && !/^Started running on/.test(l))
        .filter((l) => !/^Platforms$/.test(l) && !/^Categories$/.test(l))
        .filter((l) => !/^\d+ ads? use this creative/i.test(l))
        .filter((l) => !/^This ad has multiple versions/i.test(l))
        .filter((l) => !/^https?:\/\/\S+$/.test(l))
        .filter((l) => !/^\d+:\d{2}\s*\/\s*\d+:\d{2}$/.test(l))

      // First surviving line is almost always the page name; rest is ad copy
      const pageName = lines[0] ?? 'Unknown'
      const adText = lines.slice(1).join('\n')

      winners.push({
        libraryId: idMatch[1],
        pageName,
        adText,
        startDate: start.toISOString().slice(0, 10),
        daysRunning,
        hasVideo: card.hasVideo,
        snapshotUrl: `https://www.facebook.com/ads/library/?id=${idMatch[1]}`,
      })
    }
  } finally {
    await browser.close()
  }

  winners.sort((a, b) => b.daysRunning - a.daysRunning)
  console.log(`[AdWinners] ${winners.length} proven winners (${minDays}+ days, still active)`)
  return winners
}

/**
 * Condense winners into a creative brief block — feed this to Gemini/planner
 * as reference for hooks, angles, and offers the market already validated.
 */
export function winnersToCreativeBrief(winners: AdWinner[], limit = 10): string {
  if (winners.length === 0) return 'No proven winning ads found for this search.'
  const top = winners.slice(0, limit)
  const blocks = top.map((w, i) => {
    const copy = w.adText.length > 600 ? `${w.adText.slice(0, 600)}…` : w.adText
    return `### Winner ${i + 1} — ${w.pageName} (${w.daysRunning} days live, ${w.hasVideo ? 'video' : 'image'})\n${copy}`
  })
  return [
    `Proven winning ads (started 60+ days ago AND still running — market-validated):`,
    ...blocks,
    `\nUse these for hook/angle/offer patterns only. Never copy text verbatim.`,
  ].join('\n\n')
}

/** Markdown research report, sorted longest-running first. */
export function winnersReport(searchTerm: string, winners: AdWinner[]): string {
  const rows = winners
    .map((w) => `| ${w.pageName.replace(/\|/g, '/')} | ${w.daysRunning} | ${w.startDate} | ${w.hasVideo ? 'video' : 'image'} | [view](${w.snapshotUrl}) |`)
    .join('\n')
  const details = winners
    .map((w, i) => `## ${i + 1}. ${w.pageName} — ${w.daysRunning} days\n\n- Started: ${w.startDate}\n- Format: ${w.hasVideo ? 'video' : 'image'}\n- Library: ${w.snapshotUrl}\n\n\`\`\`\n${w.adText || '(no text extracted)'}\n\`\`\``)
    .join('\n\n')
  return `# Ad Winners Research — "${searchTerm}"

Generated ${new Date().toISOString().slice(0, 10)} · ${winners.length} proven winners (active + long-running)

| Page | Days live | Started | Format | Link |
|------|-----------|---------|--------|------|
${rows}

${details}
`
}
