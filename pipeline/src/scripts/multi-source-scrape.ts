/**
 * multi-source-scrape.ts
 * Scrape NEW leads from ALL working directories simultaneously.
 *
 * WORKING sources (confirmed):
 *   BBB           → Playwright, free, ~45 leads/city+niche, has phones
 *   Yelp API      → REST, free 500/day, YELP_API_KEY required (yelp.com/developers → Create App)
 *
 * DEAD/BLOCKED:
 *   Foursquare    → deprecated /v3/places in 2024, returns 410
 *   YP.com        → Cloudflare blocked
 *   Angi          → URL structure broken, no working endpoint
 *   Thumbtack, TripAdvisor, Houzz, Healthgrades, Avvo → bot-blocked
 *
 * Run:
 *   SCRAPE_CITY="Austin" SCRAPE_STATE="TX" SCRAPE_NICHE="hvac" npx tsx --env-file=.env src/scripts/multi-source-scrape.ts
 *   SCRAPE_CITY="Miami"  SCRAPE_STATE="FL" SCRAPE_NICHE="medspa" npx tsx --env-file=.env src/scripts/multi-source-scrape.ts
 *
 * Env:
 *   SCRAPE_CITY          city to search
 *   SCRAPE_STATE         state abbreviation (TX, FL, CA etc.)
 *   SCRAPE_NICHE         niche slug (hvac, medspa, dentist, restaurant, lawfirm, etc.)
 *   SHEET_TAB            override target sheet tab (auto-detected from niche if not set)
 *   DRY_RUN              true = print only, don't write to sheet
 *   YELP_API_KEY         free at yelp.com/developers — 500 calls/day
 *   FOURSQUARE_API_KEY   free at developer.foursquare.com — 1000 calls/day
 */
import pg from 'pg'
import { scrapeYelp } from '../sources/yelp.js'
import { scrapeBBB } from '../sources/bbb.js'
import { appendSheetRows } from '../tools/google-sheets.js'
import { extractEmailsFromWebsite } from '../tools/email-extractor.js'
import { lookupPhoneType } from '../tools/phone-lookup.js'
import type { SourceLead } from '../sources/types.js'
import { NICHE_TERMS } from '../sources/types.js'

const CITY    = process.env.SCRAPE_CITY  ?? 'Los Angeles'
const STATE   = process.env.SCRAPE_STATE ?? 'CA'
const NICHE   = process.env.SCRAPE_NICHE ?? 'hvac'
const DRY_RUN = process.env.DRY_RUN === 'true'
const SHEET_ID = process.env.LEADS_SHEET_ID!

// ─── Niche → Sheet tab mapping ────────────────────────────────────────────────

const NICHE_TO_TAB: Record<string, string> = {
  medspa:     'MEDSPAS',
  hvac:       'Local SMBs',
  roofing:    'Local SMBs',
  plumbing:   'Local SMBs',
  cleaning:   'Local SMBs',
  landscaping:'Local SMBs',
  remodeling: 'Local SMBs',
  autodetail: 'USA_AutoDetailing',
  restaurant: 'USA_Restaurants',
  dentist:    'USA_DentalOffices',
  salon:      'USA_Salons',
  barbershop: 'USA_BarberShops',
  lawfirm:    'USA_LawFirms',
  realestate: 'USA_RealEstateAgents',
  financial:  'USA_FinancialAdvisorsandInsuranceAgents',
  skinclinic: 'USA_SkinClinics',
  ivtherapy:  'USA_IVTherapy',
  nailstudio: 'USA_NailStudios',
}

const TAB = process.env.SHEET_TAB ?? NICHE_TO_TAB[NICHE] ?? 'Local SMBs'

// ─── DB dedup ─────────────────────────────────────────────────────────────────

let pool: pg.Pool | null = null

function getPool(): pg.Pool {
  if (!pool) pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  return pool
}

function phoneToPlaceId(phone: string, name: string, city: string): string {
  // Use phone as place_id for non-Maps leads (prefixed so no collision)
  const clean = phone.replace(/\D/g,'')
  if (clean.length >= 10) return `phone_${clean}`
  // Fallback: name+city hash
  let h = 0
  const key = `${name.toLowerCase()}::${city.toLowerCase()}`
  for (let i = 0; i < key.length; i++) { h = ((h << 5) - h) + key.charCodeAt(i); h |= 0 }
  return `hash_${Math.abs(h).toString(16)}`
}

async function filterNewLeads(leads: SourceLead[], tab: string): Promise<SourceLead[]> {
  if (!process.env.DATABASE_URL) return leads
  const p = getPool()
  const ids = leads.map(l => phoneToPlaceId(l.phone??'', l.name, l.city))
  const { rows } = await p.query<{ place_id: string }>(
    `SELECT place_id FROM scraped_places WHERE place_id = ANY($1) AND tab = $2`,
    [ids, tab]
  )
  const existing = new Set(rows.map(r => r.place_id))
  return leads.filter(l => !existing.has(phoneToPlaceId(l.phone??'', l.name, l.city)))
}

async function markInDB(leads: SourceLead[], tab: string): Promise<void> {
  if (!process.env.DATABASE_URL) return
  const p = getPool()
  const values = leads.map(l => [phoneToPlaceId(l.phone??'', l.name, l.city), tab, l.name, l.city])
  if (!values.length) return
  const placeholders = values.map((_,i) => `($${i*4+1},$${i*4+2},$${i*4+3},$${i*4+4})`).join(',')
  await p.query(
    `INSERT INTO scraped_places (place_id,tab,name,city) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
    values.flat()
  ).catch(() => {})
}

// ─── Run all scrapers in parallel ─────────────────────────────────────────────

async function runAllScrapers(): Promise<SourceLead[]> {
  const terms = NICHE_TERMS[NICHE] ?? { yelp:[NICHE], yp:[NICHE], general:[NICHE] }
  const yelpTerm = terms.yelp[0]

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`🌐  Multi-Source Scrape — ${NICHE} in ${CITY}, ${STATE}`)
  if (!process.env.YELP_API_KEY)  console.log(`   ⚠  Yelp: no key → yelp.com/developers → Create App → copy API Key (free 500/day)`)
  console.log(`${'═'.repeat(60)}\n`)

  const runners: Array<Promise<SourceLead[]>> = [
    // BBB — always active, no key needed
    scrapeBBB({ term:terms.general[0], city:CITY, state:STATE, niche:NICHE, maxPages:3 })
      .then(r => { console.log(`  ✓ BBB: ${r.length} leads`); return r })
      .catch(e => { console.log(`  ✗ BBB: ${e.message?.slice(0,50)}`); return [] }),

    // Yelp API — needs free key
    process.env.YELP_API_KEY
      ? scrapeYelp({ term:yelpTerm, city:CITY, state:STATE, niche:NICHE, maxResults:100 })
          .then(r => { console.log(`  ✓ Yelp: ${r.length} leads`); return r })
          .catch(e => { console.log(`  ✗ Yelp: ${e.message?.slice(0,50)}`); return [] })
      : Promise.resolve([]).then(() => { console.log(`  – Yelp: skipped (no YELP_API_KEY)`); return [] }),

  ]

  const results = await Promise.all(runners)
  const all = results.flat()

  // Dedup within this batch by name+city
  const seen = new Set<string>()
  const deduped = all.filter(l => {
    const key = `${l.name.toLowerCase().trim()}::${l.city.toLowerCase().trim()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  console.log(`\n  📊 Total raw: ${all.length} | After dedup: ${deduped.length}`)
  return deduped
}

// ─── Enrich leads (phone type + email) ───────────────────────────────────────

async function enrichLead(lead: SourceLead): Promise<SourceLead> {
  // Phone type
  if (lead.phone) {
    const { lineType, canSms } = lookupPhoneType(lead.phone, lead.state)
    ;(lead as any).phoneType = lineType
    ;(lead as any).canSms = canSms ? 'YES' : 'NO'
  }

  // Email from website
  if (lead.website && !lead.email) {
    try {
      const r = await extractEmailsFromWebsite(lead.website)
      lead.email     = r.businessEmail ?? undefined
      lead.ownerEmail = lead.ownerEmail ?? r.ownerEmail ?? undefined
    } catch { /* skip */ }
  }

  return lead
}

// ─── Convert lead → 22-col sheet row ─────────────────────────────────────────

function toSheetRow(l: SourceLead): string[] {
  const date = new Date().toISOString().split('T')[0]
  const phoneType = (l as any).phoneType ?? ''
  const canSms    = (l as any).canSms    ?? ''
  return [
    date,                           // A  Date Added
    l.name,                         // B  Business Name
    l.niche,                        // C  Niche
    l.city,                         // D  City
    l.state,                        // E  State
    '',                             // F  Timezone
    l.phone ?? '',                  // G  Phone
    l.email ?? '',                  // H  Email
    l.hasWebsite ? 'YES' : 'NO',   // I  Has Website
    l.website ?? '',                // J  Website URL
    l.address ?? '',                // K  Address
    String(l.rating ?? ''),         // L  Rating
    String(l.reviewCount ?? ''),    // M  Reviews
    '',                             // N  GBP Claimed
    '',                             // O  Open Now
    '',                             // P  Price Level
    '',                             // Q  Tier
    l.sourceUrl ?? '',              // R  Source URL (replaces Maps URL)
    l.email ?? '',                  // S  Business Email
    l.ownerEmail ?? '',             // T  Owner Email
    phoneType,                      // U  Phone Type
    canSms,                         // V  Can SMS
  ]
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const raw = await runAllScrapers()

  // Filter out leads already in DB
  const newLeads = process.env.DATABASE_URL
    ? await filterNewLeads(raw, TAB)
    : raw

  console.log(`\n  🆕 New leads (not in DB): ${newLeads.length}`)

  if (!newLeads.length) {
    console.log('  Nothing new to write.\n')
    return
  }

  // Enrich in parallel (phone type + email)
  console.log(`\n  ⚡ Enriching ${newLeads.length} leads...`)
  const enriched: SourceLead[] = []
  let next = 0
  const CONCUR = 8

  async function worker() {
    while (next < newLeads.length) {
      const idx = next++
      enriched[idx] = await enrichLead(newLeads[idx])
    }
  }
  await Promise.all(Array.from({ length: CONCUR }, worker))

  if (DRY_RUN) {
    console.log('\n  [DRY RUN] Would write:')
    enriched.slice(0,5).forEach(l => console.log(`    ${l.source} | ${l.name} | ${l.phone??'—'} | ${l.email??'—'} | ${l.ownerName??'—'}`))
    return
  }

  // Write to sheet
  const rows = enriched.map(toSheetRow)
  console.log(`\n  📝 Writing ${rows.length} rows to ${TAB}...`)
  const ok = await appendSheetRows({ spreadsheetId: SHEET_ID, sheetName: TAB, rows })
  if (ok) {
    console.log(`  ✅ Written to sheet`)
    await markInDB(enriched, TAB)
    console.log(`  ✅ Marked in DB`)
  } else {
    console.log(`  ✗ Sheet write failed`)
  }

  // Summary
  const withPhone = enriched.filter(l => l.phone).length
  const withEmail = enriched.filter(l => l.email).length
  const withOwner = enriched.filter(l => l.ownerName || l.ownerEmail).length
  const sources   = [...new Set(enriched.map(l => l.source))].join(', ')

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`✅  Done — ${newLeads.length} new leads from: ${sources}`)
  console.log(`   With phone: ${withPhone} | With email: ${withEmail} | Owner info: ${withOwner}`)
  console.log(`${'═'.repeat(60)}\n`)

  if (pool) await pool.end()
}

main().catch(e => { console.error(e.message); process.exit(1) })
