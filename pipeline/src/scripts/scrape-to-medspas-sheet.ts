/**
 * scrape-to-medspas-sheet.ts
 *
 * Medspa-dedicated scraper → "MEDSPAS" sheet tab. No DB writes. Never clears.
 * Goal: 1000 unique medspa leads/day via 10 cron runs × 100 each.
 *
 * Sub-niches scraped: med spa, medical spa, medspa, aesthetics clinic,
 *   botox clinic, laser skin clinic
 *
 * Run: npx tsx src/scripts/scrape-to-medspas-sheet.ts
 *
 * Env:
 *   SCRAPE_TARGET=100   (default 100)
 *   SCRAPE_HEADLESS=true
 */

import 'dotenv/config'
import { runMapsScraper } from '../agents/maps-scraper.js'
import { appendSheetRow } from '../tools/google-sheets.js'
import type { Lead } from '../types.js'

const TARGET    = parseInt(process.env.SCRAPE_TARGET ?? '100')
const SHEET_ID  = process.env.LEADS_SHEET_ID ?? ''
const SHEET_TAB = 'MEDSPAS'
const HEADLESS  = process.env.SCRAPE_HEADLESS !== 'false'
const MAX_RETRY = 3

// Sub-niche search terms — mix T1 (no website) + T2 (has website)
const MEDSPA_NICHES: { niche: string; tier: 'tier1' | 'tier2'; noWebsiteOnly: boolean }[] = [
  { niche: 'med spa',           tier: 'tier2', noWebsiteOnly: false },
  { niche: 'medical spa',       tier: 'tier2', noWebsiteOnly: false },
  { niche: 'medspa',            tier: 'tier1', noWebsiteOnly: true  },
  { niche: 'aesthetics clinic', tier: 'tier2', noWebsiteOnly: false },
  { niche: 'botox clinic',      tier: 'tier1', noWebsiteOnly: true  },
  { niche: 'laser skin clinic', tier: 'tier2', noWebsiteOnly: false },
]

// 130+ cities — affluent hubs + growing metros where medspas concentrate
const CITIES: { city: string; state: string }[] = [
  // California — tech/beach/affluent
  { city: 'Beverly Hills',      state: 'CA' },
  { city: 'Santa Monica',       state: 'CA' },
  { city: 'Newport Beach',      state: 'CA' },
  { city: 'La Jolla',           state: 'CA' },
  { city: 'Irvine',             state: 'CA' },
  { city: 'Palo Alto',          state: 'CA' },
  { city: 'Walnut Creek',       state: 'CA' },
  { city: 'Pasadena',           state: 'CA' },
  { city: 'Thousand Oaks',      state: 'CA' },
  { city: 'San Jose',           state: 'CA' },
  { city: 'Glendale',           state: 'CA' },
  { city: 'Santa Barbara',      state: 'CA' },
  { city: 'San Diego',          state: 'CA' },
  { city: 'Los Angeles',        state: 'CA' },
  { city: 'San Francisco',      state: 'CA' },
  { city: 'Pleasanton',         state: 'CA' },
  { city: 'Danville',           state: 'CA' },
  { city: 'Burlingame',         state: 'CA' },
  { city: 'Malibu',             state: 'CA' },
  { city: 'Calabasas',          state: 'CA' },
  // Florida — medspa capital of the US
  { city: 'Boca Raton',         state: 'FL' },
  { city: 'Naples',             state: 'FL' },
  { city: 'Sarasota',           state: 'FL' },
  { city: 'Coral Gables',       state: 'FL' },
  { city: 'Palm Beach Gardens', state: 'FL' },
  { city: 'Jupiter',            state: 'FL' },
  { city: 'Aventura',           state: 'FL' },
  { city: 'Delray Beach',       state: 'FL' },
  { city: 'Fort Lauderdale',    state: 'FL' },
  { city: 'Miami Beach',        state: 'FL' },
  { city: 'Miami',              state: 'FL' },
  { city: 'Orlando',            state: 'FL' },
  { city: 'Tampa',              state: 'FL' },
  { city: 'West Palm Beach',    state: 'FL' },
  { city: 'Bonita Springs',     state: 'FL' },
  { city: 'Clearwater',         state: 'FL' },
  { city: 'Weston',             state: 'FL' },
  { city: 'Parkland',           state: 'FL' },
  // Texas — medspa boom in suburbs
  { city: 'Plano',              state: 'TX' },
  { city: 'Southlake',          state: 'TX' },
  { city: 'Frisco',             state: 'TX' },
  { city: 'The Woodlands',      state: 'TX' },
  { city: 'Sugar Land',         state: 'TX' },
  { city: 'Katy',               state: 'TX' },
  { city: 'Allen',              state: 'TX' },
  { city: 'McKinney',           state: 'TX' },
  { city: 'Flower Mound',       state: 'TX' },
  { city: 'Austin',             state: 'TX' },
  { city: 'Houston',            state: 'TX' },
  { city: 'Dallas',             state: 'TX' },
  { city: 'San Antonio',        state: 'TX' },
  { city: 'Celina',             state: 'TX' },
  { city: 'Prosper',            state: 'TX' },
  // Arizona — Scottsdale is medspa mecca
  { city: 'Scottsdale',         state: 'AZ' },
  { city: 'Paradise Valley',    state: 'AZ' },
  { city: 'Chandler',           state: 'AZ' },
  { city: 'Gilbert',            state: 'AZ' },
  { city: 'Tempe',              state: 'AZ' },
  { city: 'Peoria',             state: 'AZ' },
  { city: 'Phoenix',            state: 'AZ' },
  { city: 'Tucson',             state: 'AZ' },
  { city: 'Surprise',           state: 'AZ' },
  // Nevada
  { city: 'Las Vegas',          state: 'NV' },
  { city: 'Henderson',          state: 'NV' },
  { city: 'Summerlin',          state: 'NV' },
  { city: 'Reno',               state: 'NV' },
  // Colorado
  { city: 'Boulder',            state: 'CO' },
  { city: 'Denver',             state: 'CO' },
  { city: 'Greenwood Village',  state: 'CO' },
  { city: 'Colorado Springs',   state: 'CO' },
  { city: 'Fort Collins',       state: 'CO' },
  { city: 'Lone Tree',          state: 'CO' },
  // Georgia
  { city: 'Alpharetta',         state: 'GA' },
  { city: 'Buckhead',           state: 'GA' },
  { city: 'Atlanta',            state: 'GA' },
  { city: 'Marietta',           state: 'GA' },
  { city: 'Sandy Springs',      state: 'GA' },
  { city: 'Johns Creek',        state: 'GA' },
  // New York
  { city: 'Manhattan',          state: 'NY' },
  { city: 'Brooklyn',           state: 'NY' },
  { city: 'Garden City',        state: 'NY' },
  { city: 'White Plains',       state: 'NY' },
  { city: 'Great Neck',         state: 'NY' },
  { city: 'Scarsdale',          state: 'NY' },
  // New Jersey
  { city: 'Summit',             state: 'NJ' },
  { city: 'Short Hills',        state: 'NJ' },
  { city: 'Princeton',          state: 'NJ' },
  { city: 'Hoboken',            state: 'NJ' },
  { city: 'Montclair',          state: 'NJ' },
  { city: 'Ridgewood',          state: 'NJ' },
  // Illinois
  { city: 'Naperville',         state: 'IL' },
  { city: 'Barrington',         state: 'IL' },
  { city: 'Lake Forest',        state: 'IL' },
  { city: 'Chicago',            state: 'IL' },
  { city: 'Oak Brook',          state: 'IL' },
  // Virginia
  { city: 'McLean',             state: 'VA' },
  { city: 'Tysons',             state: 'VA' },
  { city: 'Reston',             state: 'VA' },
  { city: 'Arlington',          state: 'VA' },
  { city: 'Richmond',           state: 'VA' },
  // Maryland
  { city: 'Bethesda',           state: 'MD' },
  { city: 'Rockville',          state: 'MD' },
  { city: 'Columbia',           state: 'MD' },
  { city: 'Towson',             state: 'MD' },
  { city: 'Annapolis',          state: 'MD' },
  // Washington
  { city: 'Bellevue',           state: 'WA' },
  { city: 'Kirkland',           state: 'WA' },
  { city: 'Redmond',            state: 'WA' },
  { city: 'Seattle',            state: 'WA' },
  { city: 'Mercer Island',      state: 'WA' },
  { city: 'Issaquah',           state: 'WA' },
  // North Carolina
  { city: 'Charlotte',          state: 'NC' },
  { city: 'Cary',               state: 'NC' },
  { city: 'Raleigh',            state: 'NC' },
  { city: 'Chapel Hill',        state: 'NC' },
  { city: 'Pinehurst',          state: 'NC' },
  // Ohio
  { city: 'Dublin',             state: 'OH' },
  { city: 'Westlake',           state: 'OH' },
  { city: 'Beachwood',          state: 'OH' },
  { city: 'Columbus',           state: 'OH' },
  { city: 'Cincinnati',         state: 'OH' },
  // Tennessee
  { city: 'Brentwood',          state: 'TN' },
  { city: 'Franklin',           state: 'TN' },
  { city: 'Nashville',          state: 'TN' },
  { city: 'Germantown',         state: 'TN' },
  { city: 'Memphis',            state: 'TN' },
  // Michigan
  { city: 'Birmingham',         state: 'MI' },
  { city: 'Bloomfield Hills',   state: 'MI' },
  { city: 'Ann Arbor',          state: 'MI' },
  { city: 'Troy',               state: 'MI' },
  { city: 'Royal Oak',          state: 'MI' },
  // Pennsylvania
  { city: 'Wayne',              state: 'PA' },
  { city: 'Media',              state: 'PA' },
  { city: 'Philadelphia',       state: 'PA' },
  { city: 'Pittsburgh',         state: 'PA' },
  { city: 'Doylestown',         state: 'PA' },
  // Massachusetts
  { city: 'Boston',             state: 'MA' },
  { city: 'Newton',             state: 'MA' },
  { city: 'Wellesley',          state: 'MA' },
  { city: 'Lexington',          state: 'MA' },
  { city: 'Weston',             state: 'MA' },
  // Minnesota
  { city: 'Edina',              state: 'MN' },
  { city: 'Minneapolis',        state: 'MN' },
  { city: 'Minnetonka',         state: 'MN' },
  { city: 'St. Paul',           state: 'MN' },
  // Utah
  { city: 'Salt Lake City',     state: 'UT' },
  { city: 'Draper',             state: 'UT' },
  { city: 'Provo',              state: 'UT' },
  { city: 'Murray',             state: 'UT' },
  // Oregon
  { city: 'Portland',           state: 'OR' },
  { city: 'Lake Oswego',        state: 'OR' },
  { city: 'Beaverton',          state: 'OR' },
  { city: 'Bend',               state: 'OR' },
  // Connecticut
  { city: 'Greenwich',          state: 'CT' },
  { city: 'Westport',           state: 'CT' },
  { city: 'Fairfield',          state: 'CT' },
  { city: 'Stamford',           state: 'CT' },
  { city: 'New Canaan',         state: 'CT' },
  // South Carolina
  { city: 'Hilton Head',        state: 'SC' },
  { city: 'Mount Pleasant',     state: 'SC' },
  { city: 'Greenville',         state: 'SC' },
  { city: 'Charleston',         state: 'SC' },
  // Missouri
  { city: 'Clayton',            state: 'MO' },
  { city: 'Chesterfield',       state: 'MO' },
  { city: 'Kansas City',        state: 'MO' },
  { city: 'St. Louis',          state: 'MO' },
  // Louisiana
  { city: 'Metairie',           state: 'LA' },
  { city: 'New Orleans',        state: 'LA' },
  { city: 'Mandeville',         state: 'LA' },
  // Indiana
  { city: 'Carmel',             state: 'IN' },
  { city: 'Indianapolis',       state: 'IN' },
  { city: 'Fishers',            state: 'IN' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stateTimezone(state: string): string {
  const PT = ['CA','OR','WA','NV','ID']
  const MT = ['MT','WY','CO','UT','NM','AZ']
  const CT = ['TX','OK','KS','NE','SD','ND','MN','IA','MO','AR','LA','WI','IL','MS','AL','IN']
  if (PT.includes(state)) return 'Pacific'
  if (MT.includes(state)) return 'Mountain'
  if (CT.includes(state)) return 'Central'
  return 'Eastern'
}

function shuffle<T>(arr: T[]): T[] {
  const now = new Date()
  // Seed varies by hour so each cron run covers different city+niche combos
  const seed_str = `${now.toISOString().split('T')[0]}-${now.getHours()}`
  let seed = 0
  for (let i = 0; i < seed_str.length; i++) seed = (seed * 31 + seed_str.charCodeAt(i)) >>> 0
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const j = seed % (i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function leadRow(lead: Lead, date: string): string[] {
  return [
    date,
    lead.name,
    lead.niche,
    lead.city,
    lead.state,
    stateTimezone(lead.state.toUpperCase()),
    lead.phone ?? '',
    lead.email ?? '',
    lead.website ? 'has website' : 'no website',
    lead.website ?? '',
    lead.rating?.toString() ?? '',
    lead.review_count?.toString() ?? '',
    lead.gbp_claimed === true ? 'claimed' : lead.gbp_claimed === false ? 'unclaimed' : '',
    lead.tier ?? '',
    '',  // Pipeline Status — blank until outreach
    '',  // Live URL — blank until deployed
  ]
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }

  const date = new Date().toISOString().split('T')[0]
  const totalCombos = MEDSPA_NICHES.length * CITIES.length

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`💆  Medspa Scrape → ${SHEET_TAB} — ${date}`)
  console.log(`   Target : ${TARGET} leads`)
  console.log(`   Niches : ${MEDSPA_NICHES.map(n => n.niche).join(', ')}`)
  console.log(`   Cities : ${CITIES.length} | Combos: ${totalCombos}`)
  console.log(`   Mode   : APPEND ONLY — never deletes existing rows`)
  console.log(`${'═'.repeat(60)}\n`)

  const seen = new Set<string>()
  let saved = 0
  let comboIdx = 0

  // Hour-seeded shuffle: each cron run explores different city+niche combos
  const combos = shuffle(
    MEDSPA_NICHES.flatMap(n =>
      CITIES.map(loc => ({ ...n, city: loc.city, state: loc.state }))
    )
  )

  while (saved < TARGET && comboIdx < combos.length * 3) {
    const combo = combos[comboIdx % combos.length]
    comboIdx++

    const needed = TARGET - saved
    const perCombo = Math.max(10, Math.ceil(needed / Math.max(1, (combos.length - comboIdx + 1))))
    const tierLabel = combo.tier === 'tier2' ? '[T2]' : '[T1]'

    console.log(`\n[${comboIdx}] ${tierLabel} ${combo.niche.toUpperCase()} — ${combo.city}, ${combo.state} (need ${needed})`)

    let leads: Lead[] = []
    let attempts = 0

    while (attempts < MAX_RETRY) {
      attempts++
      try {
        leads = await runMapsScraper({
          niche:         combo.niche,
          city:          combo.city,
          state:         combo.state,
          maxResults:    perCombo * 4,
          noWebsiteOnly: combo.noWebsiteOnly,
          headless:      HEADLESS,
        })
        break
      } catch (e: any) {
        console.error(`  ✗ attempt ${attempts}/${MAX_RETRY}: ${e.message}`)
        if (attempts < MAX_RETRY) await new Promise(r => setTimeout(r, 5000 * attempts))
      }
    }

    if (!leads.length) { console.log('  → 0 leads'); continue }

    let fromCombo = 0
    for (const lead of leads.slice(0, perCombo)) {
      if (seen.has(lead.place_id)) continue
      seen.add(lead.place_id)
      lead.tier = combo.tier

      try {
        await appendSheetRow({
          spreadsheetId: SHEET_ID,
          sheetName:     SHEET_TAB,
          values:        leadRow(lead, date),
        })
        saved++
        fromCombo++
        console.log(`  ✓ [${saved}/${TARGET}] ${lead.name} | ${lead.phone ?? 'no phone'} | ${combo.city}`)
      } catch (e: any) {
        console.error(`  [Sheet] write failed: ${e.message}`)
      }

      if (saved >= TARGET) break
    }

    console.log(`  → ${fromCombo} saved from ${combo.city}`)
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000))
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`✅  Done — ${saved}/${TARGET} leads appended to ${SHEET_TAB}`)
  if (saved < TARGET) console.warn(`⚠️  Only got ${saved} — combos exhausted`)
  console.log(`${'═'.repeat(60)}\n`)

  if (saved < TARGET) process.exit(1)
}

main().catch(e => {
  console.error('\n💥 Fatal:', e.message)
  process.exit(1)
})
