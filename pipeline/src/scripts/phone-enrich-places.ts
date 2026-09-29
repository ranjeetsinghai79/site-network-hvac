/**
 * phone-enrich-places.ts
 *
 * Fills empty phone (col G) for sheet leads using FREE Playwright scraping:
 *   1. Google Search knowledge panel (fastest — no Maps overhead)
 *   2. Google Maps search fallback
 *
 * Zero API cost. ~3-5s per lead.
 *
 * Also fills: website (col J), has_website (col I), phone_type (col U), can_sms (col V).
 *
 * Run:
 *   SHEET_TAB=Yelp_Dataset ENRICH_LIMIT=200 npx tsx --env-file=.env src/scripts/phone-enrich-places.ts
 *   SHEET_TAB="Local SMBs" ENRICH_LIMIT=500 npx tsx --env-file=.env src/scripts/phone-enrich-places.ts
 *   (no SHEET_TAB) → all tabs
 */
import { chromium, type Browser, type BrowserContext } from 'playwright'
import { readSheetRows, writeRangeValues } from '../tools/google-sheets.js'
import { lookupPhoneType } from '../tools/phone-lookup.js'

const SHEET_ID = process.env.LEADS_SHEET_ID!
const TAB_ARG  = process.env.SHEET_TAB ?? ''
const LIMIT    = parseInt(process.env.ENRICH_LIMIT ?? '200')
const CONCUR   = parseInt(process.env.ENRICH_CONCUR ?? '3')   // keep low — avoid bot detection
const DRY_RUN  = process.env.DRY_RUN === 'true'

const ALL_TABS = [
  'Yelp_Dataset',
  'Local SMBs','MEDSPAS','USA_Restaurants','USA_DentalOffices',
  'USA_Salons','USA_BarberShops','USA_SkinClinics','USA_IVTherapy','USA_NailStudios',
]

const PHONE_RE = /(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g

interface Lead {
  rowNum:  number
  name:    string
  city:    string
  state:   string
  website: string
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
function rand(lo: number, hi: number) { return lo + Math.random() * (hi - lo) }

function extractPhoneFromText(text: string): string | null {
  const matches = [...text.matchAll(PHONE_RE)]
  if (!matches.length) return null
  const raw = matches[0][0].replace(/\D/g, '')
  if (raw.length === 11 && raw.startsWith('1')) return raw.slice(1)
  if (raw.length === 10) return raw
  return null
}

// ─── Google Search → Knowledge Panel phone ───────────────────────────────────

async function searchGoogle(ctx: BrowserContext, name: string, city: string, state: string): Promise<{
  phone?: string
  website?: string
}> {
  const page = await ctx.newPage()
  try {
    const q = encodeURIComponent(`${name} ${city} ${state} phone number`)
    await page.goto(`https://www.google.com/search?q=${q}&hl=en&gl=us`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    })
    await sleep(rand(800, 1500))

    const html = await page.content()

    // Knowledge panel phone: appears as tel: links
    const telMatch = html.match(/href="tel:([^"]+)"/)
    if (telMatch) {
      const phone = extractPhoneFromText(telMatch[1])
      if (phone) {
        // Try to grab website from knowledge panel too
        const siteMatch = html.match(/data-url="(https?:\/\/(?!maps\.google|google\.com)[^"]+)"/)
        return { phone: formatPhone(phone), website: siteMatch?.[1] }
      }
    }

    // Fallback: scan visible text for phone patterns
    const visibleText = await page.evaluate(() => document.body.innerText)
    const phone = extractPhoneFromText(visibleText)
    if (phone) return { phone: formatPhone(phone) }

    return {}
  } catch {
    return {}
  } finally {
    await page.close().catch(() => {})
  }
}

// ─── Google Maps fallback ─────────────────────────────────────────────────────

async function searchMaps(ctx: BrowserContext, name: string, city: string, state: string): Promise<{
  phone?: string
  website?: string
}> {
  const page = await ctx.newPage()
  try {
    const q = encodeURIComponent(`${name} ${city} ${state}`)
    await page.goto(`https://www.google.com/maps/search/${q}`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    })
    await sleep(rand(1500, 2500))

    // Click first result if list view
    const firstResult = page.locator('div[role="feed"] a').first()
    if (await firstResult.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstResult.click()
      await sleep(rand(1000, 2000))
    }

    const html = await page.content()

    // Maps phone: aria-label containing phone or tel: link
    const telMatch = html.match(/href="tel:([^"]+)"/)
    if (telMatch) {
      const phone = extractPhoneFromText(telMatch[1])
      if (phone) {
        const siteMatch = html.match(/data-url="(https?:\/\/(?!maps\.google|google\.com)[^"]+)"/)
        return { phone: formatPhone(phone), website: siteMatch?.[1] }
      }
    }

    // Maps button with phone text
    const ariaMatch = html.match(/aria-label="([^"]*\(\d{3}\)\s*\d{3}[^"]*)"/)
    if (ariaMatch) {
      const phone = extractPhoneFromText(ariaMatch[1])
      if (phone) return { phone: formatPhone(phone) }
    }

    return {}
  } catch {
    return {}
  } finally {
    await page.close().catch(() => {})
  }
}

function formatPhone(digits: string): string {
  // Format as (XXX) XXX-XXXX
  const d = digits.replace(/\D/g, '').slice(-10)
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
}

// ─── Sheet operations ─────────────────────────────────────────────────────────

async function readLeadsMissingPhone(tab: string): Promise<Lead[]> {
  const rows = await readSheetRows({ spreadsheetId: SHEET_ID, sheetName: tab, range: 'A:V' })
  const leads: Lead[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (r[6]) continue  // col G = phone already set
    const name = r[1] ?? ''
    const city = r[3] ?? ''
    if (!name || !city) continue
    leads.push({ rowNum: i + 1, name, city, state: r[4] ?? '', website: r[9] ?? '' })
  }
  return leads
}

async function writeResult(tab: string, rowNum: number, phone: string, website: string): Promise<void> {
  const { lineType, canSms } = lookupPhoneType(phone)

  await writeRangeValues({
    spreadsheetId: SHEET_ID,
    range: `${tab}!G${rowNum}`,
    values: [[phone]],
  }).catch(() => {})

  if (website) {
    await writeRangeValues({
      spreadsheetId: SHEET_ID,
      range: `${tab}!I${rowNum}:J${rowNum}`,
      values: [['YES', website]],
    }).catch(() => {})
  }

  await writeRangeValues({
    spreadsheetId: SHEET_ID,
    range: `${tab}!U${rowNum}:V${rowNum}`,
    values: [[lineType, canSms ? 'YES' : 'NO']],
  }).catch(() => {})
}

// ─── Per-tab processor ────────────────────────────────────────────────────────

async function processTab(tab: string, browser: Browser): Promise<{ found: number; total: number }> {
  console.log(`\n${'─'.repeat(60)}\n📋  ${tab}`)
  const all  = await readLeadsMissingPhone(tab)
  // Sample across the entire backlog. Keeping only the first N rows causes
  // permanently unresolvable businesses to block every later enrichment run.
  const todo = [...all].sort(() => Math.random() - 0.5).slice(0, LIMIT)
  console.log(`  Missing phone: ${all.length} | This run: ${todo.length}`)
  if (!todo.length) return { found: 0, total: 0 }

  let found = 0
  let next  = 0

  async function worker() {
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'en-US',
      viewport: { width: 1280, height: 800 },
    })

    try {
      while (next < todo.length) {
        const idx  = next++
        const lead = todo[idx]

        // Try Google Search first
        let result = await searchGoogle(ctx, lead.name, lead.city, lead.state)

        // Fallback to Maps if no phone
        if (!result.phone) {
          await sleep(rand(500, 1000))
          result = await searchMaps(ctx, lead.name, lead.city, lead.state)
        }

        if (result.phone) {
          found++
          const website = lead.website || result.website || ''
          console.log(`  [${idx+1}/${todo.length}] ✓ ${lead.name} → ${result.phone}${website ? ' + site' : ''}`)
          if (!DRY_RUN) await writeResult(tab, lead.rowNum, result.phone, website)
        } else {
          if ((idx + 1) % 10 === 0) process.stdout.write(`  [${idx+1}/${todo.length}] ...\r`)
        }

        // Random delay between requests — avoid bot detection
        await sleep(rand(1200, 2500))
      }
    } finally {
      await ctx.close().catch(() => {})
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCUR, todo.length) }, worker))

  const hitRate = todo.length ? (found / todo.length * 100).toFixed(1) : '0'
  console.log(`\n  ✅ Found: ${found}/${todo.length} (${hitRate}%)`)
  return { found, total: todo.length }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }
  const tabs = TAB_ARG ? [TAB_ARG] : ALL_TABS

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`📞  Phone Enrichment — Playwright / Google Search (FREE)`)
  console.log(`    Strategy: Google Knowledge Panel → Google Maps fallback`)
  console.log(`    Tabs: ${tabs.join(', ')}`)
  console.log(`    Limit/tab: ${LIMIT} | Concur: ${CONCUR} | DRY_RUN: ${DRY_RUN}`)
  console.log(`${'═'.repeat(60)}`)

  const browser = await chromium.launch({ headless: true })
  let totalFound = 0, totalProcessed = 0

  try {
    for (const tab of tabs) {
      const { found, total } = await processTab(tab, browser)
      totalFound     += found
      totalProcessed += total
    }
  } finally {
    await browser.close()
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`✅  Done — Phone found: ${totalFound}/${totalProcessed} | Cost: $0`)
  console.log(`${'═'.repeat(60)}\n`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
