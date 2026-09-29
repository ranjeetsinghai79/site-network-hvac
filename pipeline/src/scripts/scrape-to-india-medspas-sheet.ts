/**
 * scrape-to-india-medspas-sheet.ts
 *
 * India medspa/skin clinic scraper → "INDIA_MEDSPAS" sheet tab. No DB. Never clears.
 * Goal: 1000 unique Indian leads/day via 10 cron runs × 100 each.
 *
 * Search terms: med spa, skin clinic, laser clinic, beauty clinic,
 *   aesthetic centre, derma clinic (+ medspa, botox clinic)
 *
 * IMPORTANT: state = "India" for all cities so Google Maps search resolves
 *   correctly from a US machine (query = "<term> near <city> India").
 *
 * Run: npx tsx src/scripts/scrape-to-india-medspas-sheet.ts
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
const SHEET_TAB = 'INDIA_MEDSPAS'
const HEADLESS  = process.env.SCRAPE_HEADLESS !== 'false'
const MAX_RETRY = 3

// India-specific search terms — mix of global medspa + India-common beauty clinic terms
// T2 (noWebsiteOnly: false) dominates since we want all leads regardless of website status
// T1 (noWebsiteOnly: true) for terms that yield small/solo operators with no site
const INDIA_NICHES: { niche: string; tier: 'tier1' | 'tier2'; noWebsiteOnly: boolean }[] = [
  { niche: 'skin clinic',        tier: 'tier2', noWebsiteOnly: false },
  { niche: 'laser clinic',       tier: 'tier2', noWebsiteOnly: false },
  { niche: 'beauty clinic',      tier: 'tier1', noWebsiteOnly: true  },
  { niche: 'aesthetic centre',   tier: 'tier2', noWebsiteOnly: false },
  { niche: 'derma clinic',       tier: 'tier1', noWebsiteOnly: true  },
  { niche: 'med spa',            tier: 'tier2', noWebsiteOnly: false },
  { niche: 'cosmetology clinic', tier: 'tier1', noWebsiteOnly: true  },
  { niche: 'anti aging clinic',  tier: 'tier2', noWebsiteOnly: false },
]

// 150+ Indian cities — metro → tier-2 → tier-3 — all state = "India" for Maps query
// Real Indian state stored in region field (for reference — not used in query)
interface IndiaCity { city: string; state: string; region: string }

const CITIES: IndiaCity[] = [
  // Maharashtra
  { city: 'Mumbai',           state: 'India', region: 'MH' },
  { city: 'Pune',             state: 'India', region: 'MH' },
  { city: 'Bandra Mumbai',    state: 'India', region: 'MH' },
  { city: 'Juhu Mumbai',      state: 'India', region: 'MH' },
  { city: 'Koregaon Park Pune', state: 'India', region: 'MH' },
  { city: 'Viman Nagar Pune', state: 'India', region: 'MH' },
  { city: 'Nagpur',           state: 'India', region: 'MH' },
  { city: 'Nashik',           state: 'India', region: 'MH' },
  { city: 'Aurangabad',       state: 'India', region: 'MH' },
  { city: 'Kolhapur',         state: 'India', region: 'MH' },
  { city: 'Solapur',          state: 'India', region: 'MH' },
  { city: 'Thane',            state: 'India', region: 'MH' },
  { city: 'Navi Mumbai',      state: 'India', region: 'MH' },

  // Delhi NCR
  { city: 'New Delhi',        state: 'India', region: 'DL' },
  { city: 'South Delhi',      state: 'India', region: 'DL' },
  { city: 'Connaught Place Delhi', state: 'India', region: 'DL' },
  { city: 'Lajpat Nagar Delhi', state: 'India', region: 'DL' },
  { city: 'Vasant Kunj Delhi', state: 'India', region: 'DL' },
  { city: 'Gurgaon',          state: 'India', region: 'HR' },
  { city: 'Noida',            state: 'India', region: 'UP' },
  { city: 'Faridabad',        state: 'India', region: 'HR' },
  { city: 'Ghaziabad',        state: 'India', region: 'UP' },
  { city: 'Greater Noida',    state: 'India', region: 'UP' },

  // Karnataka
  { city: 'Bangalore',        state: 'India', region: 'KA' },
  { city: 'Indiranagar Bangalore', state: 'India', region: 'KA' },
  { city: 'Koramangala Bangalore', state: 'India', region: 'KA' },
  { city: 'Whitefield Bangalore', state: 'India', region: 'KA' },
  { city: 'Jayanagar Bangalore', state: 'India', region: 'KA' },
  { city: 'Mysuru',           state: 'India', region: 'KA' },
  { city: 'Mangaluru',        state: 'India', region: 'KA' },
  { city: 'Hubballi',         state: 'India', region: 'KA' },

  // Telangana & Andhra Pradesh
  { city: 'Hyderabad',        state: 'India', region: 'TS' },
  { city: 'Jubilee Hills Hyderabad', state: 'India', region: 'TS' },
  { city: 'Banjara Hills Hyderabad', state: 'India', region: 'TS' },
  { city: 'Kondapur Hyderabad', state: 'India', region: 'TS' },
  { city: 'Secunderabad',     state: 'India', region: 'TS' },
  { city: 'Vijayawada',       state: 'India', region: 'AP' },
  { city: 'Visakhapatnam',    state: 'India', region: 'AP' },
  { city: 'Tirupati',         state: 'India', region: 'AP' },

  // Tamil Nadu
  { city: 'Chennai',          state: 'India', region: 'TN' },
  { city: 'Anna Nagar Chennai', state: 'India', region: 'TN' },
  { city: 'Nungambakkam Chennai', state: 'India', region: 'TN' },
  { city: 'T Nagar Chennai',  state: 'India', region: 'TN' },
  { city: 'Coimbatore',       state: 'India', region: 'TN' },
  { city: 'Madurai',          state: 'India', region: 'TN' },
  { city: 'Tiruchirappalli',  state: 'India', region: 'TN' },
  { city: 'Salem',            state: 'India', region: 'TN' },
  { city: 'Tiruppur',         state: 'India', region: 'TN' },

  // Kerala
  { city: 'Kochi',            state: 'India', region: 'KL' },
  { city: 'Thiruvananthapuram', state: 'India', region: 'KL' },
  { city: 'Calicut',          state: 'India', region: 'KL' },
  { city: 'Thrissur',         state: 'India', region: 'KL' },
  { city: 'Kollam',           state: 'India', region: 'KL' },

  // West Bengal
  { city: 'Kolkata',          state: 'India', region: 'WB' },
  { city: 'Salt Lake Kolkata', state: 'India', region: 'WB' },
  { city: 'Park Street Kolkata', state: 'India', region: 'WB' },
  { city: 'Howrah',           state: 'India', region: 'WB' },
  { city: 'Durgapur',         state: 'India', region: 'WB' },

  // Gujarat
  { city: 'Ahmedabad',        state: 'India', region: 'GJ' },
  { city: 'Surat',            state: 'India', region: 'GJ' },
  { city: 'Vadodara',         state: 'India', region: 'GJ' },
  { city: 'Rajkot',           state: 'India', region: 'GJ' },
  { city: 'Gandhinagar',      state: 'India', region: 'GJ' },
  { city: 'Bhavnagar',        state: 'India', region: 'GJ' },

  // Rajasthan
  { city: 'Jaipur',           state: 'India', region: 'RJ' },
  { city: 'Jodhpur',          state: 'India', region: 'RJ' },
  { city: 'Udaipur',          state: 'India', region: 'RJ' },
  { city: 'Kota',             state: 'India', region: 'RJ' },
  { city: 'Ajmer',            state: 'India', region: 'RJ' },
  { city: 'Bikaner',          state: 'India', region: 'RJ' },

  // Madhya Pradesh
  { city: 'Indore',           state: 'India', region: 'MP' },
  { city: 'Bhopal',           state: 'India', region: 'MP' },
  { city: 'Gwalior',          state: 'India', region: 'MP' },
  { city: 'Jabalpur',         state: 'India', region: 'MP' },

  // Uttar Pradesh
  { city: 'Lucknow',          state: 'India', region: 'UP' },
  { city: 'Kanpur',           state: 'India', region: 'UP' },
  { city: 'Agra',             state: 'India', region: 'UP' },
  { city: 'Varanasi',         state: 'India', region: 'UP' },
  { city: 'Allahabad',        state: 'India', region: 'UP' },
  { city: 'Meerut',           state: 'India', region: 'UP' },

  // Punjab & Haryana
  { city: 'Chandigarh',       state: 'India', region: 'PB' },
  { city: 'Ludhiana',         state: 'India', region: 'PB' },
  { city: 'Amritsar',         state: 'India', region: 'PB' },
  { city: 'Jalandhar',        state: 'India', region: 'PB' },
  { city: 'Patiala',          state: 'India', region: 'PB' },
  { city: 'Rohtak',           state: 'India', region: 'HR' },
  { city: 'Karnal',           state: 'India', region: 'HR' },
  { city: 'Ambala',           state: 'India', region: 'HR' },

  // Uttarakhand & Himachal
  { city: 'Dehradun',         state: 'India', region: 'UK' },
  { city: 'Haridwar',         state: 'India', region: 'UK' },
  { city: 'Mussoorie',        state: 'India', region: 'UK' },
  { city: 'Shimla',           state: 'India', region: 'HP' },
  { city: 'Dharamshala',      state: 'India', region: 'HP' },

  // Odisha & Jharkhand
  { city: 'Bhubaneswar',      state: 'India', region: 'OR' },
  { city: 'Cuttack',          state: 'India', region: 'OR' },
  { city: 'Ranchi',           state: 'India', region: 'JH' },
  { city: 'Jamshedpur',       state: 'India', region: 'JH' },
  { city: 'Dhanbad',          state: 'India', region: 'JH' },

  // Bihar
  { city: 'Patna',            state: 'India', region: 'BR' },
  { city: 'Muzaffarpur',      state: 'India', region: 'BR' },

  // Assam & NE
  { city: 'Guwahati',         state: 'India', region: 'AS' },

  // Goa
  { city: 'Panaji Goa',       state: 'India', region: 'GA' },
  { city: 'Margao Goa',       state: 'India', region: 'GA' },
  { city: 'Calangute Goa',    state: 'India', region: 'GA' },

  // Chhattisgarh
  { city: 'Raipur',           state: 'India', region: 'CG' },
  { city: 'Bhilai',           state: 'India', region: 'CG' },

  // Jammu & Kashmir
  { city: 'Srinagar',         state: 'India', region: 'JK' },
  { city: 'Jammu',            state: 'India', region: 'JK' },

  // Puducherry
  { city: 'Pondicherry',      state: 'India', region: 'PY' },

  // More tier-2 up-and-coming medspa markets
  { city: 'Bhopal',           state: 'India', region: 'MP' },
  { city: 'Raipur',           state: 'India', region: 'CG' },
  { city: 'Nellore',          state: 'India', region: 'AP' },
  { city: 'Warangal',         state: 'India', region: 'TS' },
  { city: 'Karimnagar',       state: 'India', region: 'TS' },
  { city: 'Guntur',           state: 'India', region: 'AP' },
  { city: 'Kurnool',          state: 'India', region: 'AP' },
  { city: 'Belgaum',          state: 'India', region: 'KA' },
  { city: 'Davangere',        state: 'India', region: 'KA' },
  { city: 'Shimoga',          state: 'India', region: 'KA' },
  { city: 'Erode',            state: 'India', region: 'TN' },
  { city: 'Vellore',          state: 'India', region: 'TN' },
  { city: 'Thoothukudi',      state: 'India', region: 'TN' },
  { city: 'Puducherry',       state: 'India', region: 'PY' },
  { city: 'Kozhikode',        state: 'India', region: 'KL' },
  { city: 'Palakkad',         state: 'India', region: 'KL' },
  { city: 'Kannur',           state: 'India', region: 'KL' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function indiaTimezone(_state: string): string {
  return 'IST' // All of India = UTC+5:30
}

function shuffle<T>(arr: T[]): T[] {
  // Hour-seeded so each cron run covers different combos
  const now = new Date()
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
    lead.state,     // = "India" (for Maps query compatibility)
    indiaTimezone(lead.state),
    lead.phone ?? '',
    lead.email ?? '',
    lead.website ? 'has website' : 'no website',
    lead.website ?? '',
    lead.rating?.toString() ?? '',
    lead.review_count?.toString() ?? '',
    lead.gbp_claimed === true ? 'claimed' : lead.gbp_claimed === false ? 'unclaimed' : '',
    lead.tier ?? '',
    '',  // Pipeline Status
    '',  // Live URL
  ]
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }

  const date = new Date().toISOString().split('T')[0]
  const totalCombos = INDIA_NICHES.length * CITIES.length

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`🇮🇳  India Medspa Scrape → ${SHEET_TAB} — ${date}`)
  console.log(`   Target : ${TARGET} leads`)
  console.log(`   Niches : ${INDIA_NICHES.map(n => n.niche).join(', ')}`)
  console.log(`   Cities : ${CITIES.length} | Combos: ${totalCombos}`)
  console.log(`   Mode   : APPEND ONLY — never deletes existing rows`)
  console.log(`${'═'.repeat(60)}\n`)

  const seen = new Set<string>()
  let saved = 0
  let comboIdx = 0

  const combos = shuffle(
    INDIA_NICHES.flatMap(n =>
      CITIES.map(loc => ({ ...n, city: loc.city, state: loc.state, region: loc.region }))
    )
  )

  while (saved < TARGET && comboIdx < combos.length * 3) {
    const combo = combos[comboIdx % combos.length]
    comboIdx++

    const needed = TARGET - saved
    const perCombo = Math.max(10, Math.ceil(needed / Math.max(1, (combos.length - comboIdx + 1))))
    const tierLabel = combo.tier === 'tier2' ? '[T2]' : '[T1]'

    console.log(`\n[${comboIdx}] ${tierLabel} ${combo.niche.toUpperCase()} — ${combo.city} (need ${needed})`)

    let leads: Lead[] = []
    let attempts = 0

    while (attempts < MAX_RETRY) {
      attempts++
      try {
        leads = await runMapsScraper({
          niche:         combo.niche,
          city:          combo.city,
          state:         combo.state,   // "India"
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
