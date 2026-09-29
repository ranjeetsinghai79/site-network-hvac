/**
 * scrape-to-sheet.ts
 *
 * Scrapes Google Maps → appends to Google Sheet. No DB writes. Never clears.
 * Target: 100k → 1M local businesses with no website.
 *
 * 8 niches (6 T1 no-website volume + 2 T2 upgrade premium):
 *   T1: hvac, roofing, plumbing, cleaning, landscaping, auto-detailing
 *   T2: dentist, remodeling
 *
 * Run:
 *   npx tsx src/scripts/scrape-to-sheet.ts
 *
 * Env:
 *   SCRAPE_TARGET=100       (default 100)
 *   NICHE_LIST=hvac,roofing (override — comma separated)
 *   SCRAPE_HEADLESS=true
 */

import 'dotenv/config'
import { runMapsScraper } from '../agents/maps-scraper.js'
import { appendSheetRow } from '../tools/google-sheets.js'
import type { Lead } from '../types.js'

const TARGET   = parseInt(process.env.SCRAPE_TARGET ?? '100')
const SHEET_ID = process.env.LEADS_SHEET_ID ?? ''
const HEADLESS = process.env.SCRAPE_HEADLESS !== 'false'
const MAX_RETRY = 3

// ─── 8 target niches ─────────────────────────────────────────────────────────

const ALL_NICHES: { niche: string; tier: 'tier1' | 'tier2'; noWebsiteOnly: boolean }[] = [
  // T1 — no website, high volume solo operators
  { niche: 'hvac',           tier: 'tier1', noWebsiteOnly: true  },
  { niche: 'roofing',        tier: 'tier1', noWebsiteOnly: true  },
  { niche: 'plumbing',       tier: 'tier1', noWebsiteOnly: true  },
  { niche: 'cleaning',       tier: 'tier1', noWebsiteOnly: true  },
  { niche: 'landscaping',    tier: 'tier1', noWebsiteOnly: true  },
  { niche: 'auto-detailing', tier: 'tier1', noWebsiteOnly: true  },
  // T2 — has website, bad/outdated, premium upgrade pitch
  { niche: 'dentist',        tier: 'tier2', noWebsiteOnly: false },
  { niche: 'remodeling',     tier: 'tier2', noWebsiteOnly: false },
]

// Override niches via env
const NICHES = process.env.NICHE_LIST
  ? process.env.NICHE_LIST.split(',').map(n => n.trim()).filter(Boolean)
      .map(name => ALL_NICHES.find(x => x.niche === name) ?? { niche: name, tier: 'tier1' as const, noWebsiteOnly: true })
  : ALL_NICHES

// ─── 100+ US cities — high no-website business density ───────────────────────

const CITIES: { city: string; state: string }[] = [
  // California — Central Valley
  { city: 'Fresno',          state: 'CA' },
  { city: 'Bakersfield',     state: 'CA' },
  { city: 'Modesto',         state: 'CA' },
  { city: 'Stockton',        state: 'CA' },
  { city: 'Visalia',         state: 'CA' },
  { city: 'Turlock',         state: 'CA' },
  { city: 'Merced',          state: 'CA' },
  { city: 'Hanford',         state: 'CA' },
  { city: 'Tulare',          state: 'CA' },
  { city: 'Madera',          state: 'CA' },
  // California — Inland Empire / SoCal suburbs
  { city: 'Riverside',       state: 'CA' },
  { city: 'San Bernardino',  state: 'CA' },
  { city: 'Ontario',         state: 'CA' },
  { city: 'Fontana',         state: 'CA' },
  { city: 'Victorville',     state: 'CA' },
  { city: 'Moreno Valley',   state: 'CA' },
  { city: 'Murrieta',        state: 'CA' },
  { city: 'Hemet',           state: 'CA' },
  { city: 'Perris',          state: 'CA' },
  { city: 'Hesperia',        state: 'CA' },
  // California — Bay Area suburbs
  { city: 'Tracy',           state: 'CA' },
  { city: 'Manteca',         state: 'CA' },
  { city: 'Lodi',            state: 'CA' },
  { city: 'Antioch',         state: 'CA' },
  { city: 'Vallejo',         state: 'CA' },
  // Texas — major metros + suburbs
  { city: 'Houston',         state: 'TX' },
  { city: 'San Antonio',     state: 'TX' },
  { city: 'Dallas',          state: 'TX' },
  { city: 'Fort Worth',      state: 'TX' },
  { city: 'El Paso',         state: 'TX' },
  { city: 'Arlington',       state: 'TX' },
  { city: 'Corpus Christi',  state: 'TX' },
  { city: 'Laredo',          state: 'TX' },
  { city: 'Lubbock',         state: 'TX' },
  { city: 'Amarillo',        state: 'TX' },
  { city: 'Beaumont',        state: 'TX' },
  { city: 'Killeen',         state: 'TX' },
  { city: 'Waco',            state: 'TX' },
  { city: 'Midland',         state: 'TX' },
  { city: 'Odessa',          state: 'TX' },
  { city: 'McAllen',         state: 'TX' },
  { city: 'Brownsville',     state: 'TX' },
  { city: 'Pasadena',        state: 'TX' },
  { city: 'Mesquite',        state: 'TX' },
  { city: 'McKinney',        state: 'TX' },
  // Florida — high density, no-website friendly
  { city: 'Jacksonville',    state: 'FL' },
  { city: 'Tampa',           state: 'FL' },
  { city: 'Orlando',         state: 'FL' },
  { city: 'St. Petersburg',  state: 'FL' },
  { city: 'Hialeah',         state: 'FL' },
  { city: 'Cape Coral',      state: 'FL' },
  { city: 'Fort Lauderdale', state: 'FL' },
  { city: 'Pembroke Pines',  state: 'FL' },
  { city: 'Hollywood',       state: 'FL' },
  { city: 'Gainesville',     state: 'FL' },
  { city: 'Miramar',         state: 'FL' },
  { city: 'Clearwater',      state: 'FL' },
  { city: 'Lakeland',        state: 'FL' },
  { city: 'West Palm Beach', state: 'FL' },
  { city: 'Kissimmee',       state: 'FL' },
  { city: 'Daytona Beach',   state: 'FL' },
  { city: 'Ocala',           state: 'FL' },
  // Arizona
  { city: 'Phoenix',         state: 'AZ' },
  { city: 'Tucson',          state: 'AZ' },
  { city: 'Mesa',            state: 'AZ' },
  { city: 'Chandler',        state: 'AZ' },
  { city: 'Scottsdale',      state: 'AZ' },
  { city: 'Gilbert',         state: 'AZ' },
  { city: 'Tempe',           state: 'AZ' },
  { city: 'Peoria',          state: 'AZ' },
  { city: 'Surprise',        state: 'AZ' },
  { city: 'Yuma',            state: 'AZ' },
  // Nevada
  { city: 'Las Vegas',       state: 'NV' },
  { city: 'Henderson',       state: 'NV' },
  { city: 'Reno',            state: 'NV' },
  { city: 'North Las Vegas', state: 'NV' },
  // Colorado
  { city: 'Denver',          state: 'CO' },
  { city: 'Colorado Springs',state: 'CO' },
  { city: 'Aurora',          state: 'CO' },
  { city: 'Fort Collins',    state: 'CO' },
  { city: 'Lakewood',        state: 'CO' },
  { city: 'Pueblo',          state: 'CO' },
  // Georgia
  { city: 'Atlanta',         state: 'GA' },
  { city: 'Columbus',        state: 'GA' },
  { city: 'Augusta',         state: 'GA' },
  { city: 'Savannah',        state: 'GA' },
  { city: 'Macon',           state: 'GA' },
  // North Carolina
  { city: 'Charlotte',       state: 'NC' },
  { city: 'Raleigh',         state: 'NC' },
  { city: 'Greensboro',      state: 'NC' },
  { city: 'Durham',          state: 'NC' },
  { city: 'Fayetteville',    state: 'NC' },
  { city: 'Winston-Salem',   state: 'NC' },
  // Ohio
  { city: 'Columbus',        state: 'OH' },
  { city: 'Cleveland',       state: 'OH' },
  { city: 'Cincinnati',      state: 'OH' },
  { city: 'Toledo',          state: 'OH' },
  { city: 'Akron',           state: 'OH' },
  // Michigan
  { city: 'Detroit',         state: 'MI' },
  { city: 'Grand Rapids',    state: 'MI' },
  { city: 'Warren',          state: 'MI' },
  { city: 'Sterling Heights',state: 'MI' },
  { city: 'Lansing',         state: 'MI' },
  // Illinois
  { city: 'Chicago',         state: 'IL' },
  { city: 'Aurora',          state: 'IL' },
  { city: 'Joliet',          state: 'IL' },
  { city: 'Rockford',        state: 'IL' },
  { city: 'Naperville',      state: 'IL' },
  // Pennsylvania
  { city: 'Philadelphia',    state: 'PA' },
  { city: 'Pittsburgh',      state: 'PA' },
  { city: 'Allentown',       state: 'PA' },
  { city: 'Erie',            state: 'PA' },
  // Tennessee
  { city: 'Nashville',       state: 'TN' },
  { city: 'Memphis',         state: 'TN' },
  { city: 'Knoxville',       state: 'TN' },
  { city: 'Chattanooga',     state: 'TN' },
  // Virginia
  { city: 'Virginia Beach',  state: 'VA' },
  { city: 'Norfolk',         state: 'VA' },
  { city: 'Chesapeake',      state: 'VA' },
  { city: 'Richmond',        state: 'VA' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stateTimezone(state: string): string {
  const PT = ['CA','OR','WA','NV','ID']
  const MT = ['MT','WY','CO','UT','NM','AZ']
  const CT = ['TX','OK','KS','NE','SD','ND','MN','IA','MO','AR','LA','WI','IL','MS','AL']
  if (PT.includes(state)) return 'Pacific'
  if (MT.includes(state)) return 'Mountain'
  if (CT.includes(state)) return 'Central'
  return 'Eastern'
}

function shuffle<T>(arr: T[]): T[] {
  const today = new Date().toISOString().split('T')[0]
  let seed = 0
  for (let i = 0; i < today.length; i++) seed = (seed * 31 + today.charCodeAt(i)) >>> 0
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
  ]
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }

  const date = new Date().toISOString().split('T')[0]
  const nicheNames = NICHES.map(n => n.niche).join(', ')
  const totalCombos = NICHES.length * CITIES.length

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`🗺  Scrape-to-Sheet — ${date}`)
  console.log(`   Target : ${TARGET} leads`)
  console.log(`   Niches : ${nicheNames}`)
  console.log(`   Cities : ${CITIES.length} | Combos: ${totalCombos}`)
  console.log(`   Mode   : APPEND ONLY — never deletes existing rows`)
  console.log(`${'═'.repeat(60)}\n`)

  const seen = new Set<string>()
  let saved = 0
  let comboIdx = 0

  const combos = shuffle(
    NICHES.flatMap(n =>
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
          niche:        combo.niche,
          city:         combo.city,
          state:        combo.state,
          maxResults:   perCombo * 4,
          noWebsiteOnly: combo.noWebsiteOnly,
          headless:     HEADLESS,
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
          sheetName: 'Local SMBs',
          values: leadRow(lead, date),
        })
        saved++
        fromCombo++
        console.log(`  ✓ [${saved}/${TARGET}] ${lead.name} | ${lead.phone} | ${combo.city}`)
      } catch (e: any) {
        console.error(`  [Sheet] write failed: ${e.message}`)
      }

      if (saved >= TARGET) break
    }

    console.log(`  → ${fromCombo} saved from ${combo.city}`)
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000))
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`✅  Done — ${saved}/${TARGET} leads appended to Local SMBs`)
  if (saved < TARGET) console.warn(`⚠️  Only got ${saved} — combos exhausted`)
  console.log(`${'═'.repeat(60)}\n`)

  if (saved < TARGET) process.exit(1)
}

main().catch(e => {
  console.error('\n💥 Fatal:', e.message)
  process.exit(1)
})
