/**
 * scrape-bulk.ts — Multi-source bulk scraper with checkpoint
 *
 * Sources : Google Places Text Search API + Google Maps Playwright
 * Cities  : 1,259 US cities (all 50 states) — src/data/us-cities.ts
 * Dedup   : scraped_places DB table (place_id level)
 * Checkpoint: bulk_progress DB table — skips already-queried city+term combos
 *             so re-runs accumulate NEW data without repeating API calls
 * Order   : medspa → hvac → roofing → dental → restaurant
 * Targets : 42k / 168k / 95k / 162k / 632k  (≈1.1M total)
 *
 * Usage:
 *   cd pipeline && npx tsx src/scripts/scrape-bulk.ts
 *   BULK_NICHE=dental npx tsx src/scripts/scrape-bulk.ts
 *   SKIP_MAPS=true npx tsx src/scripts/scrape-bulk.ts        # Places only
 *   PLACES_BATCH=1000 npx tsx src/scripts/scrape-bulk.ts     # larger batch
 *   SKIP_OSM=true SKIP_MAPS=true npx tsx src/scripts/scrape-bulk.ts  # Places only fast
 *
 * First run: apply migration
 *   psql $DATABASE_URL -f pipeline/src/db/migration-bulk-progress.sql
 */

import 'dotenv/config'
import pg from 'pg'
import { runMapsScraper } from '../agents/maps-scraper.js'
import { appendSheetRows } from '../tools/google-sheets.js'
import { US_CITIES } from '../data/us-cities.js'

// ─── Runtime config ────────────────────────────────────────────────────────

const SHEET_ID     = process.env.LEADS_SHEET_ID ?? ''
const ONLY_NICHE   = process.env.BULK_NICHE ?? ''
const PLACES_KEY   = process.env.GOOGLE_PLACES_API_KEY ?? ''
const SKIP_MAPS    = process.env.SKIP_MAPS === 'true'
const SKIP_OSM     = process.env.SKIP_OSM === 'true'      // OSM always returns 0 for these niches but keep flag
const SKIP_PLACES  = process.env.SKIP_PLACES === 'true'
const BATCH_SIZE   = 200                                   // rows per Sheets API call
const PLACES_BATCH = parseInt(process.env.PLACES_BATCH ?? '500')  // max new city-term combos per niche per run
const MAPS_BATCH   = parseInt(process.env.MAPS_BATCH ?? '80')     // max new cities via Maps per niche per run

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// ─── Niche definitions ─────────────────────────────────────────────────────

interface NicheConfig {
  key:         string
  tab:         string
  target:      number
  queryTerms:  string[]   // multiple terms → more coverage per city
  placesType:  string     // Places API type filter ('' = none)
  mapsKey:     string
}

const NICHES: NicheConfig[] = [
  {
    key:        'medspa',
    tab:        'MEDSPAS',
    target:     42_622,
    queryTerms: ['medical spa medspa', 'aesthetics clinic botox', 'med spa laser skincare'],
    placesType: '',
    mapsKey:    'medspa-usa',
  },
  {
    key:        'hvac',
    tab:        'Local SMBs',
    target:     167_717,
    queryTerms: ['hvac air conditioning heating', 'ac repair hvac contractor', 'heating cooling company'],
    placesType: '',
    mapsKey:    'hvac',
  },
  {
    key:        'roofing',
    tab:        'Local SMBs',
    target:     95_313,
    queryTerms: ['roofing contractor', 'roof repair company', 'roofer residential roofing'],
    placesType: '',
    mapsKey:    'roofing',
  },
  {
    key:        'dental',
    tab:        'USA_DentalOffices',
    target:     161_817,
    queryTerms: ['dentist dental office', 'dental clinic family dentist', 'cosmetic dentist teeth'],
    placesType: 'dentist',
    mapsKey:    'dental-office',
  },
  {
    key:        'restaurant',
    tab:        'USA_Restaurants',
    target:     632_090,
    queryTerms: ['restaurant', 'restaurant dining', 'cafe bistro eatery', 'bar grill food', 'ethnic restaurant'],
    placesType: 'restaurant',
    mapsKey:    'restaurant',
  },
]

// ─── Types ─────────────────────────────────────────────────────────────────

interface RawBusiness {
  source:        'osm' | 'maps'
  place_id:      string
  name:          string
  phone?:        string
  website?:      string
  address?:      string
  city:          string
  state:         string
  niche:         string
  rating?:       number
  review_count?: number
}

// ─── US states list (OSM) ──────────────────────────────────────────────────

const US_STATES: Array<[string, string]> = [
  ['Alabama','AL'],['Alaska','AK'],['Arizona','AZ'],['Arkansas','AR'],['California','CA'],
  ['Colorado','CO'],['Connecticut','CT'],['Delaware','DE'],['Florida','FL'],['Georgia','GA'],
  ['Hawaii','HI'],['Idaho','ID'],['Illinois','IL'],['Indiana','IN'],['Iowa','IA'],
  ['Kansas','KS'],['Kentucky','KY'],['Louisiana','LA'],['Maine','ME'],['Maryland','MD'],
  ['Massachusetts','MA'],['Michigan','MI'],['Minnesota','MN'],['Mississippi','MS'],['Missouri','MO'],
  ['Montana','MT'],['Nebraska','NE'],['Nevada','NV'],['New Hampshire','NH'],['New Jersey','NJ'],
  ['New Mexico','NM'],['New York','NY'],['North Carolina','NC'],['North Dakota','ND'],['Ohio','OH'],
  ['Oklahoma','OK'],['Oregon','OR'],['Pennsylvania','PA'],['Rhode Island','RI'],['South Carolina','SC'],
  ['South Dakota','SD'],['Tennessee','TN'],['Texas','TX'],['Utah','UT'],['Vermont','VT'],
  ['Virginia','VA'],['Washington','WA'],['West Virginia','WV'],['Wisconsin','WI'],['Wyoming','WY'],
]

// ─── Helpers ───────────────────────────────────────────────────────────────

function normalizePhone(phone: string | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
}

function stateTimezone(state: string): string {
  if (['CA','OR','WA','NV','ID','AK','HI'].includes(state)) return 'Pacific'
  if (['MT','WY','CO','UT','NM','AZ'].includes(state)) return 'Mountain'
  if (['TX','OK','KS','NE','SD','ND','MN','IA','MO','AR','LA','WI','IL','MS','AL'].includes(state)) return 'Central'
  return 'Eastern'
}

function toRow(b: RawBusiness, date: string): string[] {
  return [
    date, b.name, b.niche, b.city, b.state,
    stateTimezone(b.state),
    b.phone ?? '', '',
    b.website ? 'YES' : 'NO',
    b.website ?? '',
    b.address ?? '',
    b.rating?.toString() ?? '',
    b.review_count?.toString() ?? '',
    '', '', '',
    b.website ? 'tier2' : 'tier1',
    '',
  ]
}

// ─── DB pool ───────────────────────────────────────────────────────────────

const dbPool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
  : null

// ─── Dedup: scraped_places (place-level, persistent) ──────────────────────

async function loadScrapedIds(tab: string): Promise<Set<string>> {
  if (!dbPool) return new Set()
  try {
    const r = await dbPool.query<{ place_id: string }>(
      'SELECT place_id FROM scraped_places WHERE tab = $1', [tab]
    )
    return new Set(r.rows.map(row => row.place_id))
  } catch { return new Set() }
}

async function markScrapedBatch(records: Array<{ placeId: string; tab: string; name: string; city: string }>): Promise<void> {
  if (!dbPool || !records.length) return
  for (let i = 0; i < records.length; i += 100) {
    const chunk = records.slice(i, i + 100)
    try {
      const vals = chunk.map((_, j) => `($${j*4+1},$${j*4+2},$${j*4+3},$${j*4+4})`).join(',')
      const params = chunk.flatMap(r => [r.placeId, r.tab, r.name, r.city])
      await dbPool.query(
        `INSERT INTO scraped_places (place_id,tab,name,city) VALUES ${vals} ON CONFLICT (place_id,tab) DO NOTHING`,
        params
      )
    } catch { /* non-fatal */ }
  }
}

// ─── Checkpoint: bulk_progress (query-level, prevents re-running same city+term) ─

async function loadProgress(niche: string): Promise<Set<string>> {
  if (!dbPool) return new Set()
  try {
    const r = await dbPool.query<{ city: string; state: string; query_term: string }>(
      'SELECT city, state, query_term FROM bulk_progress WHERE niche = $1', [niche]
    )
    return new Set(r.rows.map(row => `${row.city}|${row.state}|${row.query_term}`))
  } catch (e: any) {
    // Table may not exist yet — silently continue without checkpoint
    if (!e.message?.includes('does not exist')) console.warn('  [checkpoint] load failed:', e.message)
    return new Set()
  }
}

async function markProgress(niche: string, city: string, state: string, queryTerm: string, count: number): Promise<void> {
  if (!dbPool) return
  try {
    await dbPool.query(
      `INSERT INTO bulk_progress (niche, city, state, query_term, result_count)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (niche, city, state, query_term) DO NOTHING`,
      [niche, city, state, queryTerm, count]
    )
  } catch { /* non-fatal — checkpoint is best-effort */ }
}

// ─── OSM Overpass scraper (typically 0 results for these business types) ───

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]
let overpassIdx = 0

async function queryOverpass(query: string, attempt = 0): Promise<any> {
  const url = OVERPASS_URLS[overpassIdx % OVERPASS_URLS.length]
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(120_000),
    })
    if (res.status === 429 || res.status === 503) {
      overpassIdx++
      if (attempt < 3) { await sleep(15_000); return queryOverpass(query, attempt + 1) }
      return { elements: [] }
    }
    if (!res.ok) return { elements: [] }
    return res.json()
  } catch {
    if (attempt < 2) { await sleep(10_000); return queryOverpass(query, attempt + 1) }
    return { elements: [] }
  }
}

async function scrapeOSM(_niche: NicheConfig): Promise<RawBusiness[]> {
  if (SKIP_OSM) return []
  // OSM historically returns 0 for medspa/hvac/roofing/dental/restaurant — keeping for future
  return []
}

// ─── Google Places Text Search API ────────────────────────────────────────
// Free $200/month credit ≈ 6,250 requests × 60 results = 375k records/month
// With checkpoint: each city+term is queried ONCE across all runs

interface PlacesResult {
  place_id:            string
  name:                string
  formatted_address?:  string
  website?:            string
  rating?:             number
  user_ratings_total?: number
  business_status?:    string
}

async function placesTextSearch(query: string, pageToken?: string): Promise<{ results: PlacesResult[]; next?: string }> {
  const params = new URLSearchParams({ query, key: PLACES_KEY })
  if (pageToken) params.set('pagetoken', pageToken)
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return { results: [] }
    const data = await res.json() as any
    if (data.status === 'REQUEST_DENIED') {
      console.error('  [Places] API key denied — check GOOGLE_PLACES_API_KEY')
      PLACES_QUOTA_HIT = true
      return { results: [] }
    }
    if (data.status === 'OVER_QUERY_LIMIT') {
      console.warn('  [Places] quota exceeded — stopping Places scraper')
      PLACES_QUOTA_HIT = true
      return { results: [] }
    }
    return { results: data.results ?? [], next: data.next_page_token }
  } catch { return { results: [] } }
}

let PLACES_QUOTA_HIT = false

function parseRaw(place: PlacesResult, city: string, state: string, niche: string): RawBusiness {
  let parsedCity = city
  let parsedState = state
  if (place.formatted_address) {
    const m = /,\s*([^,]+),\s*([A-Z]{2})\s+\d{5}/.exec(place.formatted_address)
    if (m) { parsedCity = m[1].trim(); parsedState = m[2] }
  }
  return {
    source:       'maps',
    place_id:     `gp_${place.place_id}`,
    name:         place.name,
    website:      place.website,
    address:      place.formatted_address,
    city:         parsedCity,
    state:        parsedState,
    niche,
    rating:       place.rating,
    review_count: place.user_ratings_total,
  }
}

async function scrapePlacesAPI(niche: NicheConfig, done: Set<string>): Promise<RawBusiness[]> {
  if (SKIP_PLACES || !PLACES_KEY) {
    if (!PLACES_KEY) console.warn('  [Places] GOOGLE_PLACES_API_KEY not set — skipping')
    return []
  }

  // Count how many combos remain vs already done
  const totalCombos = US_CITIES.length * niche.queryTerms.length
  const doneCombos  = US_CITIES.filter(c => niche.queryTerms.every(t => done.has(`${c.city}|${c.state}|${t}`))).length
  const remainCombos = totalCombos - US_CITIES.filter(c => niche.queryTerms.some(t => done.has(`${c.city}|${c.state}|${t}`))).length * niche.queryTerms.length + (totalCombos - totalCombos)  // simplify below
  const trueRemain = US_CITIES.reduce((cnt, c) => {
    for (const t of niche.queryTerms) {
      if (!done.has(`${c.city}|${c.state}|${t}`)) cnt++
    }
    return cnt
  }, 0)

  console.log(`  [Places] ${niche.key} — ${US_CITIES.length} cities × ${niche.queryTerms.length} terms = ${totalCombos.toLocaleString()} total combos`)
  console.log(`  [Places] Already done: ${(totalCombos - trueRemain).toLocaleString()} | Remaining: ${trueRemain.toLocaleString()} | This run: ${Math.min(trueRemain, PLACES_BATCH).toLocaleString()}`)

  if (trueRemain === 0) {
    console.log(`  [Places] All city-term combos done for ${niche.key}!`)
    return []
  }

  const results: RawBusiness[] = []
  let queried = 0

  outer: for (const { city, state } of US_CITIES) {
    for (const term of niche.queryTerms) {
      if (PLACES_QUOTA_HIT) break outer
      if (queried >= PLACES_BATCH) break outer

      const key = `${city}|${state}|${term}`
      if (done.has(key)) continue

      const query = `${term} near ${city} ${state}`
      let pageToken: string | undefined
      let page = 0
      let termCount = 0

      do {
        if (pageToken) await sleep(2_000)
        const { results: batch, next } = await placesTextSearch(query, pageToken)
        for (const p of batch) results.push(parseRaw(p, city, state, niche.key))
        termCount += batch.length
        pageToken = next
        page++
      } while (pageToken && page < 3 && !PLACES_QUOTA_HIT)

      done.add(key)
      await markProgress(niche.key, city, state, term, termCount)
      queried++
      await sleep(100)
    }
  }

  console.log(`  [Places] done: ${results.length.toLocaleString()} raw results (${queried} city-term combos queried this run)`)
  return results
}

// ─── Google Maps Playwright scraper ────────────────────────────────────────

async function scrapeMaps(niche: NicheConfig, done: Set<string>): Promise<RawBusiness[]> {
  if (SKIP_MAPS) return []

  const MAPS_TERM = '_maps'
  const pending = US_CITIES.filter(c => !done.has(`${c.city}|${c.state}|${MAPS_TERM}`))
  const toRun   = pending.slice(0, MAPS_BATCH)

  console.log(`  [Maps] ${niche.key} — ${US_CITIES.length} cities total | already done: ${US_CITIES.length - pending.length} | this run: ${toRun.length}`)

  if (toRun.length === 0) {
    console.log(`  [Maps] All cities already scraped for ${niche.key}!`)
    return []
  }

  const results: RawBusiness[] = []

  for (let i = 0; i < toRun.length; i += 2) {
    const batch = toRun.slice(i, i + 2)
    const leads = await Promise.all(
      batch.map(({ city, state }) =>
        runMapsScraper({
          niche:         niche.mapsKey,
          city,
          state,
          maxResults:    25,
          noWebsiteOnly: false,
          headless:      true,
        }).catch(() => [])
      )
    )

    for (let b = 0; b < batch.length; b++) {
      const { city, state } = batch[b]
      const cityLeads = leads[b]
      for (const lead of cityLeads) {
        results.push({
          source:       'maps',
          place_id:     lead.place_id,
          name:         lead.name,
          phone:        lead.phone,
          website:      lead.website,
          address:      lead.address,
          city:         lead.city,
          state:        lead.state,
          niche:        niche.key,
          rating:       lead.rating,
          review_count: lead.review_count,
        })
      }
      done.add(`${city}|${state}|${MAPS_TERM}`)
      await markProgress(niche.key, city, state, MAPS_TERM, cityLeads.length)
    }

    console.log(`  [Maps] ${batch.map(c => c.city).join(', ')}: ${results.length} total`)
    await sleep(1000)
  }

  console.log(`  [Maps] done: ${results.length.toLocaleString()} for ${niche.key}`)
  return results
}

// ─── Niche orchestrator ────────────────────────────────────────────────────

async function runNiche(niche: NicheConfig, tabSeen: Set<string>): Promise<number> {
  const date  = new Date().toISOString().split('T')[0]
  const seen  = new Set(tabSeen)
  let   saved = 0

  // Load checkpoint for this niche (which city+term combos already done)
  console.log(`  Loading checkpoint for ${niche.key}...`)
  const progressDone = await loadProgress(niche.key)

  console.log(`\n${'═'.repeat(64)}`)
  console.log(`▶  ${niche.key.toUpperCase()} — target: ${niche.target.toLocaleString()} → ${niche.tab}`)
  console.log(`   Already in sheet/DB: ${tabSeen.size.toLocaleString()}`)
  console.log(`${'═'.repeat(64)}`)

  const [osmResults, placesResults] = await Promise.all([
    scrapeOSM(niche),
    scrapePlacesAPI(niche, progressDone),
  ])

  const mapsResults = await scrapeMaps(niche, progressDone)

  const allRaw = [...osmResults, ...placesResults, ...mapsResults]
  console.log(`\n  Raw totals: OSM=${osmResults.length} Places=${placesResults.length.toLocaleString()} Maps=${mapsResults.length.toLocaleString()}`)

  // Dedup: primary by phone, secondary by place_id
  const phoneSeen = new Set<string>()
  const deduped:  RawBusiness[] = []
  const dbToMark: Array<{ placeId: string; tab: string; name: string; city: string }> = []

  for (const b of allRaw) {
    if (seen.has(b.place_id)) continue

    const pn = normalizePhone(b.phone)
    // Production lead policy: never append or checkpoint a lead without a
    // valid US phone number. This keeps the sheet phone-qualified by design.
    if (pn.length !== 10) continue
    if (phoneSeen.has(pn)) continue
    phoneSeen.add(pn)

    seen.add(b.place_id)
    tabSeen.add(b.place_id)
    deduped.push(b)
    dbToMark.push({ placeId: b.place_id, tab: niche.tab, name: b.name, city: b.city })
  }

  console.log(`  After dedup: ${deduped.length.toLocaleString()} unique records`)

  // Batch flush to Google Sheets + DB
  const rows = deduped.map(b => toRow(b, date))

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE)
    const ok    = await appendSheetRows({ spreadsheetId: SHEET_ID, sheetName: niche.tab, rows: chunk })
    if (ok) {
      saved += chunk.length
      process.stdout.write(`\r  Flushed: ${saved.toLocaleString()}/${deduped.length.toLocaleString()} rows to sheet   `)
    }
    await markScrapedBatch(dbToMark.slice(i, i + BATCH_SIZE))
    await sleep(300)
  }

  const total  = tabSeen.size
  const target = niche.target
  const pct    = ((total / target) * 100).toFixed(1)
  console.log(`\n  ✅ ${niche.key}: ${saved.toLocaleString()} saved → ${niche.tab} | running total: ${total.toLocaleString()} / ${target.toLocaleString()} (${pct}%)`)
  return saved
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }

  const niches = ONLY_NICHE ? NICHES.filter(n => n.key === ONLY_NICHE) : NICHES
  if (!niches.length) {
    console.error(`Unknown BULK_NICHE="${ONLY_NICHE}". Valid: ${NICHES.map(n => n.key).join(', ')}`)
    process.exit(1)
  }

  const totalCityTerms = niches.reduce((s, n) => s + US_CITIES.length * n.queryTerms.length, 0)

  console.log(`\n${'═'.repeat(64)}`)
  console.log('🚀  Bulk Scraper — Google Places API + Google Maps')
  console.log(`   Niches        : ${niches.map(n => n.key).join(' → ')}`)
  console.log(`   Cities        : ${US_CITIES.length.toLocaleString()} (all 50 states)`)
  console.log(`   Places batch  : ${PLACES_BATCH} city-term combos per niche per run`)
  console.log(`   Maps batch    : ${MAPS_BATCH} cities per niche per run`)
  console.log(`   Total combos  : ${totalCityTerms.toLocaleString()} (across all niches)`)
  console.log(`   Target total  : ${niches.reduce((s, n) => s + n.target, 0).toLocaleString()}`)
  if (SKIP_OSM)    console.log('   ⚠ OSM    : SKIPPED')
  if (SKIP_PLACES) console.log('   ⚠ Places : SKIPPED')
  if (SKIP_MAPS)   console.log('   ⚠ Maps   : SKIPPED')
  console.log(`${'═'.repeat(64)}\n`)

  // Per-tab seen sets — shared across niches writing to same tab (hvac+roofing → Local SMBs)
  const tabSeenMap = new Map<string, Set<string>>()
  for (const n of niches) {
    if (!tabSeenMap.has(n.tab)) {
      console.log(`Loading DB dedup for tab "${n.tab}"...`)
      tabSeenMap.set(n.tab, await loadScrapedIds(n.tab))
    }
  }

  const summary: Array<{ niche: string; saved: number; target: number; total: number }> = []

  for (const niche of niches) {
    PLACES_QUOTA_HIT = false  // reset per niche
    const tabSeen = tabSeenMap.get(niche.tab)!
    const before  = tabSeen.size
    const saved   = await runNiche(niche, tabSeen)
    summary.push({ niche: niche.key, saved, target: niche.target, total: tabSeen.size })
  }

  console.log(`\n${'═'.repeat(64)}`)
  console.log('SUMMARY')
  let totalSaved = 0
  for (const s of summary) {
    const pct = ((s.total / s.target) * 100).toFixed(1)
    const bar = '█'.repeat(Math.min(20, Math.floor(s.total / s.target * 20)))
    console.log(`  ${s.niche.padEnd(12)} +${s.saved.toLocaleString().padStart(6)} saved | ${s.total.toLocaleString().padStart(7)} / ${s.target.toLocaleString().padEnd(8)} (${pct.padStart(5)}%) ${bar}`)
    totalSaved += s.saved
  }
  console.log(`\n  TOTAL SAVED THIS RUN : ${totalSaved.toLocaleString()}`)
  console.log(`  Run again to continue accumulating (checkpoint skips already-done cities)`)
  console.log(`${'═'.repeat(64)}\n`)
}

main()
  .catch(e => { console.error('\n💥 Fatal:', e.message); process.exit(1) })
  .finally(() => { dbPool?.end().catch(() => {}) })
