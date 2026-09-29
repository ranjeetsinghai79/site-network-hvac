/**
 * scrape-universal.ts
 *
 * Universal scraper for ALL 11 sheet tabs. Append-only — never clears.
 * Captures ALL businesses (website or not) with full details.
 *
 * Usage:
 *   SHEET_TAB="Local SMBs"  npx tsx src/scripts/scrape-universal.ts
 *   SHEET_TAB=MEDSPAS        npx tsx src/scripts/scrape-universal.ts
 *   SHEET_TAB=USA_Salons     npx tsx src/scripts/scrape-universal.ts
 *   (no SHEET_TAB)           → runs all 11 tabs sequentially
 *
 * Env:
 *   SHEET_TAB         target tab name (or unset for all)
 *   SCRAPE_TARGET     leads per run, default 100
 *   SCRAPE_HEADLESS   true (default)
 *
 * Tabs → niches → cities:
 *   Local SMBs                       hvac, roofing, plumbing, cleaning, landscaping,
 *                                    auto-detailing, remodeling          US cities
 *   MEDSPAS                          medspa-usa                          US affluent cities
 *   INDIA_MEDSPAS                    india-medspa                        India cities
 *   USA_DentalOffices                dental-office                       US cities
 *   INDIA_DentalOffices              india-dental                        India cities
 *   USA_Salons                       hair-salon, nail-salon              US cities
 *   USA_BarberShops                  barbershop                          US cities
 *   USA_FinancialAdvisorsandInsuranceAgents  financial-advisor, insurance-agent  US cities
 *   USA_RealEstateAgents             real-estate-agent                   US cities
 *   USA_Restaurants                  restaurant                          US cities
 *   India_Restaurants                india-restaurant                    India cities
 */

import 'dotenv/config'
import pg from 'pg'
import { runMapsScraper } from '../agents/maps-scraper.js'
import { appendSheetRow } from '../tools/google-sheets.js'
import { extractEmailsFromWebsite } from '../tools/email-extractor.js'
import { lookupPhoneType } from '../tools/phone-lookup.js'
import type { Lead } from '../types.js'

// ─── Combo exhaustion tracking (DB-backed) ───────────────────────────────────
// scraped_combos(tab, niche, city, state, count_found, exhausted)
// Before visiting a combo: skip if exhausted=true in DB.
// After visiting: upsert count_found; mark exhausted if count_found < 5.

async function loadExhaustedCombos(tab: string): Promise<Set<string>> {
  if (!dbPool) return new Set()
  try {
    const r = await dbPool.query<{ niche: string; city: string }>(
      `SELECT niche, city FROM scraped_combos WHERE tab = $1 AND exhausted = true`,
      [tab]
    )
    return new Set(r.rows.map(row => `${row.niche}|${row.city}`))
  } catch { return new Set() }
}

async function upsertCombo(
  tab: string, niche: string, city: string, state: string, countFound: number
): Promise<void> {
  if (!dbPool) return
  try {
    const exhausted = countFound < 5  // < 5 new leads = this combo is dry
    await dbPool.query(
      `INSERT INTO scraped_combos (tab, niche, city, state, count_found, exhausted, scraped_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (tab, niche, city) DO UPDATE
         SET count_found = EXCLUDED.count_found,
             exhausted   = EXCLUDED.exhausted,
             scraped_at  = NOW()`,
      [tab, niche, city, state, countFound, exhausted]
    )
  } catch { /* non-fatal */ }
}

function comboKey(niche: string, city: string): string {
  return `${niche}|${city}`
}

const TARGET       = parseInt(process.env.SCRAPE_TARGET ?? '100')
const SHEET_ID     = process.env.LEADS_SHEET_ID ?? ''
const HEADLESS     = process.env.SCRAPE_HEADLESS !== 'false'
const TAB_ARG      = process.env.SHEET_TAB ?? ''
const SKIP_EMAIL   = process.env.SKIP_EMAIL_ENRICHMENT === 'true'
const MAX_RETRY    = 3

// ─── Cross-run dedup via Neon DB ──────────────────────────────────────────────

const dbPool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
  : null

async function loadScrapedIds(tab: string): Promise<Set<string>> {
  if (!dbPool) return new Set()
  try {
    const r = await dbPool.query<{ place_id: string }>(
      'SELECT place_id FROM scraped_places WHERE tab = $1', [tab]
    )
    return new Set(r.rows.map(row => row.place_id))
  } catch { return new Set() }
}

async function markScraped(placeId: string, tab: string, name: string, city: string): Promise<void> {
  if (!dbPool) return
  try {
    await dbPool.query(
      `INSERT INTO scraped_places (place_id, tab, name, city)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (place_id, tab) DO NOTHING`,
      [placeId, tab, name, city]
    )
  } catch { /* non-fatal */ }
}

// ─── City lists ───────────────────────────────────────────────────────────────

const US_CITIES = [
  // California — major metros + mid-size
  { city: 'Los Angeles',      state: 'CA' },
  { city: 'San Diego',        state: 'CA' },
  { city: 'San Jose',         state: 'CA' },
  { city: 'San Francisco',    state: 'CA' },
  { city: 'Oakland',          state: 'CA' },
  { city: 'Long Beach',       state: 'CA' },
  { city: 'Anaheim',          state: 'CA' },
  { city: 'Santa Ana',        state: 'CA' },
  { city: 'Riverside',        state: 'CA' },
  { city: 'Fresno',           state: 'CA' },
  { city: 'Bakersfield',      state: 'CA' },
  { city: 'San Bernardino',   state: 'CA' },
  { city: 'Modesto',          state: 'CA' },
  { city: 'Stockton',         state: 'CA' },
  { city: 'Visalia',          state: 'CA' },
  { city: 'Oxnard',           state: 'CA' },
  { city: 'Fontana',          state: 'CA' },
  { city: 'Moreno Valley',    state: 'CA' },
  { city: 'Glendale',         state: 'CA' },
  { city: 'Huntington Beach', state: 'CA' },
  { city: 'Santa Rosa',       state: 'CA' },
  { city: 'Garden Grove',     state: 'CA' },
  { city: 'Rancho Cucamonga', state: 'CA' },
  { city: 'Oceanside',        state: 'CA' },
  { city: 'Hayward',          state: 'CA' },
  { city: 'Ontario',          state: 'CA' },
  { city: 'Torrance',         state: 'CA' },
  { city: 'Sunnyvale',        state: 'CA' },
  { city: 'Salinas',          state: 'CA' },
  { city: 'Pomona',           state: 'CA' },
  { city: 'Escondido',        state: 'CA' },
  { city: 'Palmdale',         state: 'CA' },
  { city: 'Pasadena',         state: 'CA' },
  { city: 'Lancaster',        state: 'CA' },
  { city: 'Victorville',      state: 'CA' },
  { city: 'Murrieta',         state: 'CA' },
  { city: 'Temecula',         state: 'CA' },
  { city: 'Santa Clarita',    state: 'CA' },
  { city: 'Thousand Oaks',    state: 'CA' },
  { city: 'Concord',          state: 'CA' },
  { city: 'Simi Valley',      state: 'CA' },
  { city: 'Roseville',        state: 'CA' },
  { city: 'Turlock',          state: 'CA' },
  { city: 'Tracy',            state: 'CA' },
  { city: 'Antioch',          state: 'CA' },
  { city: 'Vallejo',          state: 'CA' },
  { city: 'El Monte',         state: 'CA' },
  { city: 'Fremont',          state: 'CA' },
  // Texas — all major + mid
  { city: 'Houston',          state: 'TX' },
  { city: 'San Antonio',      state: 'TX' },
  { city: 'Dallas',           state: 'TX' },
  { city: 'Austin',           state: 'TX' },
  { city: 'Fort Worth',       state: 'TX' },
  { city: 'El Paso',          state: 'TX' },
  { city: 'Arlington',        state: 'TX' },
  { city: 'Corpus Christi',   state: 'TX' },
  { city: 'Plano',            state: 'TX' },
  { city: 'Laredo',           state: 'TX' },
  { city: 'Lubbock',          state: 'TX' },
  { city: 'Garland',          state: 'TX' },
  { city: 'Irving',           state: 'TX' },
  { city: 'Frisco',           state: 'TX' },
  { city: 'Amarillo',         state: 'TX' },
  { city: 'Grand Prairie',    state: 'TX' },
  { city: 'McKinney',         state: 'TX' },
  { city: 'Denton',           state: 'TX' },
  { city: 'Waco',             state: 'TX' },
  { city: 'Beaumont',         state: 'TX' },
  { city: 'Midland',          state: 'TX' },
  { city: 'McAllen',          state: 'TX' },
  { city: 'Brownsville',      state: 'TX' },
  { city: 'Killeen',          state: 'TX' },
  { city: 'Carrollton',       state: 'TX' },
  { city: 'Mesquite',         state: 'TX' },
  { city: 'Abilene',          state: 'TX' },
  { city: 'Pasadena',         state: 'TX' },
  { city: 'Lewisville',       state: 'TX' },
  { city: 'Wichita Falls',    state: 'TX' },
  { city: 'Sugar Land',       state: 'TX' },
  { city: 'Round Rock',       state: 'TX' },
  // Florida — full coverage
  { city: 'Jacksonville',     state: 'FL' },
  { city: 'Miami',            state: 'FL' },
  { city: 'Tampa',            state: 'FL' },
  { city: 'Orlando',          state: 'FL' },
  { city: 'St. Petersburg',   state: 'FL' },
  { city: 'Hialeah',          state: 'FL' },
  { city: 'Port St. Lucie',   state: 'FL' },
  { city: 'Cape Coral',       state: 'FL' },
  { city: 'Fort Lauderdale',  state: 'FL' },
  { city: 'Tallahassee',      state: 'FL' },
  { city: 'Pembroke Pines',   state: 'FL' },
  { city: 'Hollywood',        state: 'FL' },
  { city: 'Miramar',          state: 'FL' },
  { city: 'Gainesville',      state: 'FL' },
  { city: 'Coral Springs',    state: 'FL' },
  { city: 'Palm Bay',         state: 'FL' },
  { city: 'West Palm Beach',  state: 'FL' },
  { city: 'Clearwater',       state: 'FL' },
  { city: 'Lakeland',         state: 'FL' },
  { city: 'Pompano Beach',    state: 'FL' },
  { city: 'Kissimmee',        state: 'FL' },
  { city: 'Daytona Beach',    state: 'FL' },
  { city: 'Ocala',            state: 'FL' },
  { city: 'Deltona',          state: 'FL' },
  { city: 'Boca Raton',       state: 'FL' },
  // New York
  { city: 'New York',         state: 'NY' },
  { city: 'Buffalo',          state: 'NY' },
  { city: 'Rochester',        state: 'NY' },
  { city: 'Yonkers',          state: 'NY' },
  { city: 'Syracuse',         state: 'NY' },
  { city: 'Albany',           state: 'NY' },
  { city: 'New Rochelle',     state: 'NY' },
  { city: 'Schenectady',      state: 'NY' },
  // Arizona
  { city: 'Phoenix',          state: 'AZ' },
  { city: 'Tucson',           state: 'AZ' },
  { city: 'Mesa',             state: 'AZ' },
  { city: 'Chandler',         state: 'AZ' },
  { city: 'Gilbert',          state: 'AZ' },
  { city: 'Scottsdale',       state: 'AZ' },
  { city: 'Tempe',            state: 'AZ' },
  { city: 'Peoria',           state: 'AZ' },
  { city: 'Surprise',         state: 'AZ' },
  { city: 'Goodyear',         state: 'AZ' },
  { city: 'Avondale',         state: 'AZ' },
  { city: 'Yuma',             state: 'AZ' },
  // Pennsylvania
  { city: 'Philadelphia',     state: 'PA' },
  { city: 'Pittsburgh',       state: 'PA' },
  { city: 'Allentown',        state: 'PA' },
  { city: 'Erie',             state: 'PA' },
  { city: 'Reading',          state: 'PA' },
  { city: 'Lancaster',        state: 'PA' },
  // Illinois
  { city: 'Chicago',          state: 'IL' },
  { city: 'Aurora',           state: 'IL' },
  { city: 'Joliet',           state: 'IL' },
  { city: 'Naperville',       state: 'IL' },
  { city: 'Rockford',         state: 'IL' },
  { city: 'Springfield',      state: 'IL' },
  { city: 'Peoria',           state: 'IL' },
  { city: 'Elgin',            state: 'IL' },
  { city: 'Waukegan',         state: 'IL' },
  // Ohio
  { city: 'Columbus',         state: 'OH' },
  { city: 'Cleveland',        state: 'OH' },
  { city: 'Cincinnati',       state: 'OH' },
  { city: 'Toledo',           state: 'OH' },
  { city: 'Akron',            state: 'OH' },
  { city: 'Dayton',           state: 'OH' },
  { city: 'Youngstown',       state: 'OH' },
  // Michigan
  { city: 'Detroit',          state: 'MI' },
  { city: 'Grand Rapids',     state: 'MI' },
  { city: 'Warren',           state: 'MI' },
  { city: 'Sterling Heights', state: 'MI' },
  { city: 'Ann Arbor',        state: 'MI' },
  { city: 'Lansing',          state: 'MI' },
  { city: 'Flint',            state: 'MI' },
  { city: 'Dearborn',         state: 'MI' },
  // Georgia
  { city: 'Atlanta',          state: 'GA' },
  { city: 'Columbus',         state: 'GA' },
  { city: 'Augusta',          state: 'GA' },
  { city: 'Savannah',         state: 'GA' },
  { city: 'Macon',            state: 'GA' },
  { city: 'Sandy Springs',    state: 'GA' },
  { city: 'Roswell',          state: 'GA' },
  { city: 'Athens',           state: 'GA' },
  // North Carolina
  { city: 'Charlotte',        state: 'NC' },
  { city: 'Raleigh',          state: 'NC' },
  { city: 'Greensboro',       state: 'NC' },
  { city: 'Durham',           state: 'NC' },
  { city: 'Winston-Salem',    state: 'NC' },
  { city: 'Fayetteville',     state: 'NC' },
  { city: 'Cary',             state: 'NC' },
  { city: 'Concord',          state: 'NC' },
  // Nevada
  { city: 'Las Vegas',        state: 'NV' },
  { city: 'Henderson',        state: 'NV' },
  { city: 'Reno',             state: 'NV' },
  { city: 'North Las Vegas',  state: 'NV' },
  { city: 'Sparks',           state: 'NV' },
  // Colorado
  { city: 'Denver',           state: 'CO' },
  { city: 'Colorado Springs', state: 'CO' },
  { city: 'Aurora',           state: 'CO' },
  { city: 'Fort Collins',     state: 'CO' },
  { city: 'Lakewood',         state: 'CO' },
  { city: 'Thornton',         state: 'CO' },
  { city: 'Pueblo',           state: 'CO' },
  { city: 'Westminster',      state: 'CO' },
  { city: 'Arvada',           state: 'CO' },
  // Tennessee
  { city: 'Nashville',        state: 'TN' },
  { city: 'Memphis',          state: 'TN' },
  { city: 'Knoxville',        state: 'TN' },
  { city: 'Chattanooga',      state: 'TN' },
  { city: 'Clarksville',      state: 'TN' },
  { city: 'Murfreesboro',     state: 'TN' },
  // Virginia
  { city: 'Virginia Beach',   state: 'VA' },
  { city: 'Norfolk',          state: 'VA' },
  { city: 'Chesapeake',       state: 'VA' },
  { city: 'Richmond',         state: 'VA' },
  { city: 'Newport News',     state: 'VA' },
  { city: 'Alexandria',       state: 'VA' },
  { city: 'Arlington',        state: 'VA' },
  // Washington state
  { city: 'Seattle',          state: 'WA' },
  { city: 'Spokane',          state: 'WA' },
  { city: 'Tacoma',           state: 'WA' },
  { city: 'Bellevue',         state: 'WA' },
  { city: 'Kent',             state: 'WA' },
  { city: 'Everett',          state: 'WA' },
  { city: 'Renton',           state: 'WA' },
  // New Jersey
  { city: 'Newark',           state: 'NJ' },
  { city: 'Jersey City',      state: 'NJ' },
  { city: 'Paterson',         state: 'NJ' },
  { city: 'Elizabeth',        state: 'NJ' },
  { city: 'Clifton',          state: 'NJ' },
  { city: 'Trenton',          state: 'NJ' },
  { city: 'Toms River',       state: 'NJ' },
  // Massachusetts
  { city: 'Boston',           state: 'MA' },
  { city: 'Worcester',        state: 'MA' },
  { city: 'Springfield',      state: 'MA' },
  { city: 'Lowell',           state: 'MA' },
  { city: 'Cambridge',        state: 'MA' },
  // Indiana
  { city: 'Indianapolis',     state: 'IN' },
  { city: 'Fort Wayne',       state: 'IN' },
  { city: 'Evansville',       state: 'IN' },
  { city: 'South Bend',       state: 'IN' },
  // Wisconsin
  { city: 'Milwaukee',        state: 'WI' },
  { city: 'Madison',          state: 'WI' },
  { city: 'Green Bay',        state: 'WI' },
  { city: 'Kenosha',          state: 'WI' },
  { city: 'Racine',           state: 'WI' },
  // Minnesota
  { city: 'Minneapolis',      state: 'MN' },
  { city: 'St. Paul',         state: 'MN' },
  { city: 'Rochester',        state: 'MN' },
  { city: 'Duluth',           state: 'MN' },
  { city: 'Bloomington',      state: 'MN' },
  // Missouri
  { city: 'Kansas City',      state: 'MO' },
  { city: 'St. Louis',        state: 'MO' },
  { city: 'Springfield',      state: 'MO' },
  { city: 'Columbia',         state: 'MO' },
  // Maryland
  { city: 'Baltimore',        state: 'MD' },
  { city: 'Frederick',        state: 'MD' },
  { city: 'Rockville',        state: 'MD' },
  { city: 'Gaithersburg',     state: 'MD' },
  // Kentucky
  { city: 'Louisville',       state: 'KY' },
  { city: 'Lexington',        state: 'KY' },
  { city: 'Bowling Green',    state: 'KY' },
  // Oregon
  { city: 'Portland',         state: 'OR' },
  { city: 'Eugene',           state: 'OR' },
  { city: 'Salem',            state: 'OR' },
  { city: 'Gresham',          state: 'OR' },
  { city: 'Hillsboro',        state: 'OR' },
  // Utah
  { city: 'Salt Lake City',   state: 'UT' },
  { city: 'West Valley City', state: 'UT' },
  { city: 'Provo',            state: 'UT' },
  { city: 'Ogden',            state: 'UT' },
  { city: 'St. George',       state: 'UT' },
  // Oklahoma
  { city: 'Oklahoma City',    state: 'OK' },
  { city: 'Tulsa',            state: 'OK' },
  { city: 'Norman',           state: 'OK' },
  { city: 'Broken Arrow',     state: 'OK' },
  // New Mexico
  { city: 'Albuquerque',      state: 'NM' },
  { city: 'Las Cruces',       state: 'NM' },
  { city: 'Santa Fe',         state: 'NM' },
  // Nebraska
  { city: 'Omaha',            state: 'NE' },
  { city: 'Lincoln',          state: 'NE' },
  // Kansas
  { city: 'Wichita',          state: 'KS' },
  { city: 'Overland Park',    state: 'KS' },
  { city: 'Topeka',           state: 'KS' },
  // Iowa
  { city: 'Des Moines',       state: 'IA' },
  { city: 'Cedar Rapids',     state: 'IA' },
  { city: 'Davenport',        state: 'IA' },
  { city: 'Sioux City',       state: 'IA' },
  // Arkansas
  { city: 'Little Rock',      state: 'AR' },
  { city: 'Fort Smith',       state: 'AR' },
  { city: 'Fayetteville',     state: 'AR' },
  { city: 'Springdale',       state: 'AR' },
  // Mississippi
  { city: 'Jackson',          state: 'MS' },
  { city: 'Gulfport',         state: 'MS' },
  // Alabama
  { city: 'Birmingham',       state: 'AL' },
  { city: 'Montgomery',       state: 'AL' },
  { city: 'Huntsville',       state: 'AL' },
  { city: 'Mobile',           state: 'AL' },
  // Louisiana
  { city: 'New Orleans',      state: 'LA' },
  { city: 'Baton Rouge',      state: 'LA' },
  { city: 'Shreveport',       state: 'LA' },
  { city: 'Lafayette',        state: 'LA' },
  // South Carolina
  { city: 'Columbia',         state: 'SC' },
  { city: 'Charleston',       state: 'SC' },
  { city: 'North Charleston', state: 'SC' },
  { city: 'Rock Hill',        state: 'SC' },
  { city: 'Greenville',       state: 'SC' },
  // Connecticut
  { city: 'Bridgeport',       state: 'CT' },
  { city: 'New Haven',        state: 'CT' },
  { city: 'Hartford',         state: 'CT' },
  { city: 'Stamford',         state: 'CT' },
  // Rhode Island
  { city: 'Providence',       state: 'RI' },
  { city: 'Cranston',         state: 'RI' },
  // Idaho
  { city: 'Boise',            state: 'ID' },
  { city: 'Meridian',         state: 'ID' },
  { city: 'Nampa',            state: 'ID' },
  // Montana / Wyoming / Dakotas
  { city: 'Billings',         state: 'MT' },
  { city: 'Missoula',         state: 'MT' },
  { city: 'Cheyenne',         state: 'WY' },
  { city: 'Casper',           state: 'WY' },
  { city: 'Fargo',            state: 'ND' },
  { city: 'Bismarck',         state: 'ND' },
  { city: 'Sioux Falls',      state: 'SD' },
  { city: 'Rapid City',       state: 'SD' },
  // Delaware / New Hampshire / Vermont / Maine / West Virginia
  { city: 'Wilmington',       state: 'DE' },
  { city: 'Dover',            state: 'DE' },
  { city: 'Manchester',       state: 'NH' },
  { city: 'Nashua',           state: 'NH' },
  { city: 'Burlington',       state: 'VT' },
  { city: 'Portland',         state: 'ME' },
  { city: 'Charleston',       state: 'WV' },
  { city: 'Huntington',       state: 'WV' },
  // Alaska / Hawaii
  { city: 'Anchorage',        state: 'AK' },
  { city: 'Honolulu',         state: 'HI' },
]

const US_AFFLUENT_CITIES = [
  { city: 'Scottsdale',         state: 'AZ' },
  { city: 'Beverly Hills',      state: 'CA' },
  { city: 'Boca Raton',         state: 'FL' },
  { city: 'The Woodlands',      state: 'TX' },
  { city: 'Bellevue',           state: 'WA' },
  { city: 'Plano',              state: 'TX' },
  { city: 'Frisco',             state: 'TX' },
  { city: 'Naperville',         state: 'IL' },
  { city: 'Irvine',             state: 'CA' },
  { city: 'San Jose',           state: 'CA' },
  { city: 'San Francisco',      state: 'CA' },
  { city: 'San Diego',          state: 'CA' },
  { city: 'Los Angeles',        state: 'CA' },
  { city: 'Miami',              state: 'FL' },
  { city: 'Fort Lauderdale',    state: 'FL' },
  { city: 'Austin',             state: 'TX' },
  { city: 'Dallas',             state: 'TX' },
  { city: 'Houston',            state: 'TX' },
  { city: 'Chicago',            state: 'IL' },
  { city: 'New York',           state: 'NY' },
  { city: 'Atlanta',            state: 'GA' },
  { city: 'Charlotte',          state: 'NC' },
  { city: 'Raleigh',            state: 'NC' },
  { city: 'Phoenix',            state: 'AZ' },
  { city: 'Denver',             state: 'CO' },
  { city: 'Seattle',            state: 'WA' },
  { city: 'Portland',           state: 'OR' },
  { city: 'Las Vegas',          state: 'NV' },
  { city: 'Henderson',          state: 'NV' },
  { city: 'Nashville',          state: 'TN' },
  { city: 'Tampa',              state: 'FL' },
  { city: 'Orlando',            state: 'FL' },
  { city: 'Jacksonville',       state: 'FL' },
  { city: 'Virginia Beach',     state: 'VA' },
  { city: 'Richmond',           state: 'VA' },
  { city: 'Salt Lake City',     state: 'UT' },
  { city: 'Provo',              state: 'UT' },
  { city: 'Overland Park',      state: 'KS' },
  { city: 'Kansas City',        state: 'MO' },
  { city: 'St. Louis',          state: 'MO' },
  { city: 'Columbus',           state: 'OH' },
  { city: 'Cincinnati',         state: 'OH' },
  { city: 'Indianapolis',       state: 'IN' },
  { city: 'Pittsburgh',         state: 'PA' },
  { city: 'Philadelphia',       state: 'PA' },
  { city: 'Boston',             state: 'MA' },
  { city: 'Hartford',           state: 'CT' },
  { city: 'Providence',         state: 'RI' },
  { city: 'Minneapolis',        state: 'MN' },
  { city: 'Omaha',              state: 'NE' },
]

const INDIA_CITIES = [
  { city: 'Mumbai',       state: 'India' },
  { city: 'Delhi',        state: 'India' },
  { city: 'Bangalore',    state: 'India' },
  { city: 'Hyderabad',    state: 'India' },
  { city: 'Chennai',      state: 'India' },
  { city: 'Kolkata',      state: 'India' },
  { city: 'Pune',         state: 'India' },
  { city: 'Ahmedabad',    state: 'India' },
  { city: 'Jaipur',       state: 'India' },
  { city: 'Surat',        state: 'India' },
  { city: 'Lucknow',      state: 'India' },
  { city: 'Kanpur',       state: 'India' },
  { city: 'Nagpur',       state: 'India' },
  { city: 'Visakhapatnam',state: 'India' },
  { city: 'Bhopal',       state: 'India' },
  { city: 'Patna',        state: 'India' },
  { city: 'Ludhiana',     state: 'India' },
  { city: 'Agra',         state: 'India' },
  { city: 'Nashik',       state: 'India' },
  { city: 'Vadodara',     state: 'India' },
  { city: 'Meerut',       state: 'India' },
  { city: 'Rajkot',       state: 'India' },
  { city: 'Kalyan',       state: 'India' },
  { city: 'Vasai-Virar',  state: 'India' },
  { city: 'Varanasi',     state: 'India' },
  { city: 'Srinagar',     state: 'India' },
  { city: 'Aurangabad',   state: 'India' },
  { city: 'Dhanbad',      state: 'India' },
  { city: 'Amritsar',     state: 'India' },
  { city: 'Allahabad',    state: 'India' },
  { city: 'Ranchi',       state: 'India' },
  { city: 'Howrah',       state: 'India' },
  { city: 'Coimbatore',   state: 'India' },
  { city: 'Jabalpur',     state: 'India' },
  { city: 'Gwalior',      state: 'India' },
  { city: 'Vijayawada',   state: 'India' },
  { city: 'Jodhpur',      state: 'India' },
  { city: 'Madurai',      state: 'India' },
  { city: 'Raipur',       state: 'India' },
  { city: 'Kota',         state: 'India' },
  { city: 'Guwahati',     state: 'India' },
  { city: 'Chandigarh',   state: 'India' },
  { city: 'Solapur',      state: 'India' },
  { city: 'Hugli-Chinsurah', state: 'India' },
  { city: 'Thiruvananthapuram', state: 'India' },
  { city: 'Kochi',        state: 'India' },
  { city: 'Indore',       state: 'India' },
  { city: 'Bhubaneswar',  state: 'India' },
  { city: 'Guntur',       state: 'India' },
  { city: 'Noida',        state: 'India' },
  { city: 'Gurgaon',      state: 'India' },
  { city: 'Faridabad',    state: 'India' },
  { city: 'Ghaziabad',    state: 'India' },
]

// ─── Tab configuration ────────────────────────────────────────────────────────

interface TabConfig {
  tab:          string
  niches:       string[]
  cities:       { city: string; state: string }[]
  noWebsiteOnly: boolean
  tier:         'tier1' | 'tier2' | 'mixed'
}

const TAB_CONFIGS: TabConfig[] = [
  {
    tab:          'Local SMBs',
    niches:       [
      // wave 1
      'hvac', 'roofing', 'plumbing', 'cleaning', 'landscaping', 'auto-detailing', 'remodeling',
      // wave 2 — 18 new niches × 340 cities = 6,120 fresh combos → ~153k leads
      'electrician', 'pest-control', 'garage-door', 'locksmith', 'painting',
      'flooring', 'carpet-cleaning', 'window-cleaning', 'gutter-cleaning',
      'moving-company', 'solar-installation', 'fence-installation', 'deck-builder',
      'insulation', 'pool-service', 'concrete', 'appliance-repair', 'chimney-sweep',
    ],
    cities:       US_CITIES,
    noWebsiteOnly: false,
    tier:         'mixed',
  },
  {
    tab:          'MEDSPAS',
    niches:       ['medspa-usa', 'botox-clinic', 'aesthetic-clinic', 'cosmetic-dermatology', 'laser-clinic', 'hydrafacial-clinic', 'body-contouring', 'prp-clinic', 'weight-loss-clinic', 'hormone-clinic', 'microblading-studio', 'lash-studio'],
    cities:       US_CITIES,
    noWebsiteOnly: false,
    tier:         'tier2',
  },
  {
    tab:          'INDIA_MEDSPAS',
    niches:       ['india-medspa'],
    cities:       INDIA_CITIES,
    noWebsiteOnly: false,
    tier:         'mixed',
  },
  {
    tab:          'USA_DentalOffices',
    niches:       ['dental-office', 'orthodontist', 'cosmetic-dentist', 'pediatric-dentist', 'oral-surgeon', 'emergency-dentist'],
    cities:       US_CITIES,
    noWebsiteOnly: false,
    tier:         'tier2',
  },
  {
    tab:          'INDIA_DentalOffices',
    niches:       ['india-dental'],
    cities:       INDIA_CITIES,
    noWebsiteOnly: false,
    tier:         'mixed',
  },
  {
    tab:          'USA_Salons',
    niches:       ['hair-salon', 'nail-salon'],
    cities:       US_CITIES,
    noWebsiteOnly: false,
    tier:         'mixed',
  },
  {
    tab:          'USA_BarberShops',
    niches:       ['barbershop'],
    cities:       US_CITIES,
    noWebsiteOnly: false,
    tier:         'mixed',
  },
  {
    tab:          'USA_FinancialAdvisorsandInsuranceAgents',
    niches:       ['financial-advisor', 'insurance-agent', 'life-insurance', 'tax-advisor', 'mortgage-broker', 'cpa-accountant', 'wealth-manager', 'credit-union'],
    cities:       US_CITIES,
    noWebsiteOnly: false,
    tier:         'tier2',
  },
  {
    tab:          'USA_RealEstateAgents',
    niches:       ['real-estate-agent', 'realtor', 'real-estate-broker', 'property-management', 'home-buying-agent', 'commercial-real-estate'],
    cities:       US_CITIES,
    noWebsiteOnly: false,
    tier:         'tier2',
  },
  {
    tab:          'USA_Restaurants',
    niches:       ['restaurant', 'italian-restaurant', 'mexican-restaurant', 'asian-restaurant', 'bbq-steakhouse'],
    cities:       US_CITIES,
    noWebsiteOnly: false,
    tier:         'mixed',
  },
  {
    tab:          'India_Restaurants',
    niches:       ['india-restaurant'],
    cities:       INDIA_CITIES,
    noWebsiteOnly: false,
    tier:         'mixed',
  },
  {
    tab:          'USA_LawFirms',
    niches:       ['lawfirm', 'attorney', 'personal-injury-lawyer', 'family-law-attorney', 'criminal-defense-lawyer', 'immigration-attorney', 'estate-planning-attorney', 'business-attorney'],
    cities:       US_CITIES,
    noWebsiteOnly: false,
    tier:         'tier2',
  },
  // ── Beauty & wellness (Week 2) ──
  {
    tab:          'USA_SkinClinics',
    niches:       ['skin-clinic'],
    cities:       US_CITIES,
    noWebsiteOnly: false,
    tier:         'tier2',
  },
  {
    tab:          'USA_IVTherapy',
    niches:       ['iv-therapy'],
    cities:       US_CITIES,
    noWebsiteOnly: false,
    tier:         'tier2',
  },
  {
    tab:          'USA_NailStudios',
    niches:       ['nail-studio'],
    cities:       US_CITIES,
    noWebsiteOnly: false,
    tier:         'tier2',
  },
  // ── High-value niches (Week 3) — Tier S → A → B ──
  {
    tab:          'USA_CosmeticSurgeons',
    niches:       ['cosmetic-surgeon'],
    cities:       US_AFFLUENT_CITIES,
    noWebsiteOnly: false,
    tier:         'tier2',
  },
  {
    tab:          'USA_AutoDetailing',
    niches:       ['auto-detailing'],
    cities:       US_CITIES,
    noWebsiteOnly: false,
    tier:         'mixed',
  },
  {
    tab:          'USA_HVAC',
    niches:       ['hvac'],
    cities:       US_CITIES,
    noWebsiteOnly: false,
    tier:         'mixed',
  },
  {
    tab:          'USA_Roofing',
    niches:       ['roofing'],
    cities:       US_CITIES,
    noWebsiteOnly: false,
    tier:         'mixed',
  },
  {
    tab:          'USA_Remodeling',
    niches:       ['remodeling'],
    cities:       US_CITIES,
    noWebsiteOnly: false,
    tier:         'mixed',
  },
  {
    tab:          'USA_Plumbing',
    niches:       ['plumbing'],
    cities:       US_CITIES,
    noWebsiteOnly: false,
    tier:         'mixed',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stateTimezone(state: string): string {
  const PT = ['CA','OR','WA','NV','ID']
  const MT = ['MT','WY','CO','UT','NM','AZ']
  const CT = ['TX','OK','KS','NE','SD','ND','MN','IA','MO','AR','LA','WI','IL','MS','AL']
  if (PT.includes(state)) return 'Pacific'
  if (MT.includes(state)) return 'Mountain'
  if (CT.includes(state)) return 'Central'
  if (state === 'India') return 'IST'
  return 'Eastern'
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr]
  let s = seed
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function daySeed(): number {
  const d = new Date().toISOString().split('T')[0]
  let h = 0
  for (let i = 0; i < d.length; i++) h = ((h << 5) - h) + d.charCodeAt(i)
  return h >>> 0
}

// Full header — all 22 columns
const HEADER = [
  'Date Added', 'Business Name', 'Niche / Category', 'City', 'State / Country',
  'Timezone', 'Phone', 'Email', 'Has Website', 'Website URL', 'Address',
  'Rating', 'Reviews', 'GBP Claimed', 'Open Now', 'Price Level',
  'Tier', 'Maps URL', 'Business Email', 'Owner Email',
  'Phone Type', 'Can SMS',
]

function leadToRow(lead: Lead, date: string): string[] {
  const tz = stateTimezone((lead.state ?? '').toUpperCase())
  return [
    date,
    lead.name,
    lead.niche,
    lead.city,
    lead.state,
    tz,
    lead.phone ?? '',
    lead.email ?? lead.business_email ?? '',
    lead.website ? 'YES' : 'NO',
    lead.website ?? '',
    lead.address ?? '',
    lead.rating?.toString() ?? '',
    lead.review_count?.toString() ?? '',
    lead.gbp_claimed === true ? 'claimed' : lead.gbp_claimed === false ? 'unclaimed' : '',
    (lead.open_now ?? lead.is_open) === true ? 'open' : (lead.open_now ?? lead.is_open) === false ? 'closed' : '',
    lead.price_level ?? '',
    lead.tier ?? '',
    lead.google_maps_uri ?? '',
    lead.business_email ?? '',
    lead.owner_email ?? '',
    lead.phone_type ?? '',
    lead.can_sms === true ? 'YES' : lead.can_sms === false ? 'NO' : '',
  ]
}

function hasValidPhone(phone: string | undefined): boolean {
  let digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  return digits.length === 10
}

// ─── Scrape one tab ───────────────────────────────────────────────────────────

async function scrapeTab(cfg: TabConfig, target: number): Promise<number> {
  const date    = new Date().toISOString().split('T')[0]
  const seed    = daySeed()

  // Load exhausted combos from DB — skip these entirely
  const exhaustedCombos = await loadExhaustedCombos(cfg.tab)

  const allCombos = cfg.niches.flatMap(niche =>
    cfg.cities.map(loc => ({ niche, city: loc.city, state: loc.state }))
  )
  const freshCombos = allCombos.filter(
    c => !exhaustedCombos.has(comboKey(c.niche, c.city))
  )
  const combos = shuffle(freshCombos, seed + cfg.tab.length)

  // Load already-scraped place_ids from DB for this tab (lead-level dedup)
  const seen = await loadScrapedIds(cfg.tab)
  const dbCount = seen.size
  let saved = 0
  let comboIdx = 0

  console.log(`\n  Niches : ${cfg.niches.join(', ')}`)
  console.log(`  Cities : ${cfg.cities.length}  |  Total combos: ${allCombos.length}  |  Skipping exhausted: ${exhaustedCombos.size}  |  Fresh to visit: ${combos.length}`)
  console.log(`  Already scraped: ${dbCount} place_ids in DB (will skip)`)

  while (saved < target && comboIdx < combos.length) {
    const combo  = combos[comboIdx++]
    const needed = target - saved
    const perCombo = Math.max(8, Math.ceil(needed / Math.max(1, combos.length - comboIdx + 1)))
    const tierLabel = cfg.tier === 'tier2' ? '[T2]' : cfg.tier === 'tier1' ? '[T1]' : '[MX]'

    console.log(`\n  [${comboIdx}] ${tierLabel} ${combo.niche.toUpperCase()} — ${combo.city}, ${combo.state} (need ${needed})`)

    let leads: Lead[] = []
    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      try {
        leads = await runMapsScraper({
          niche:         combo.niche,
          city:          combo.city,
          state:         combo.state,
          maxResults:    perCombo * 4,
          noWebsiteOnly: cfg.noWebsiteOnly,
          headless:      HEADLESS,
        })
        break
      } catch (e: any) {
        console.error(`    ✗ attempt ${attempt}/${MAX_RETRY}: ${e.message}`)
        if (attempt < MAX_RETRY) await new Promise(r => setTimeout(r, 5000 * attempt))
      }
    }

    if (!leads.length) { console.log('    → 0 leads'); continue }

    let fromCombo = 0
    for (const lead of leads.slice(0, perCombo)) {
      if (seen.has(lead.place_id)) continue

      // Production lead policy: a business is not a lead without a phone number.
      // Do not mark phone-less results as scraped so a later run can retry them.
      if (!hasValidPhone(lead.phone)) {
        console.log(`    → skip (no valid phone): ${lead.name}`)
        continue
      }

      seen.add(lead.place_id)
      lead.tier = lead.website
        ? 'tier2'
        : cfg.tier === 'mixed' ? 'tier1' : cfg.tier

      // Phone type lookup — free offline classification
      if (lead.phone) {
        const { lineType, canSms } = lookupPhoneType(lead.phone, lead.state)
        lead.phone_type = lineType
        lead.can_sms    = canSms
      }

      // Email enrichment — skip in fast mode (SKIP_EMAIL_ENRICHMENT=true)
      if (!SKIP_EMAIL && lead.website) {
        try {
          const { businessEmail, ownerEmail } = await extractEmailsFromWebsite(lead.website)
          if (businessEmail) lead.business_email = businessEmail
          if (ownerEmail)    lead.owner_email    = ownerEmail
        } catch { /* non-fatal */ }
      }

      try {
        await appendSheetRow({
          spreadsheetId: SHEET_ID,
          sheetName:     cfg.tab,
          values:        leadToRow(lead, date),
        })
        // Persist to DB so next run skips this business
        await markScraped(lead.place_id, cfg.tab, lead.name, combo.city)
        saved++
        fromCombo++
        const websiteFlag = lead.website ? '🌐' : '📵'
        const emailFlag   = lead.business_email ? ` ✉ ${lead.business_email}` : ''
        const phoneFlag   = lead.phone_type === 'mobile' ? ' 📱' : lead.phone_type === 'landline' ? ' ☎' : lead.phone_type === 'voip' ? ' 💻' : ''
        const smsFlag     = lead.can_sms === false ? ' [no-sms]' : ''
        console.log(`    ✓ [${saved}/${target}] ${websiteFlag} ${lead.name} | ${lead.phone ?? '—'}${phoneFlag}${smsFlag} | ${combo.city}${emailFlag}`)
      } catch (e: any) {
        console.error(`    [Sheet] write failed: ${e.message}`)
      }

      if (saved >= target) break
    }

    // Upsert combo result into DB — marks exhausted if < 5 new leads found
    await upsertCombo(cfg.tab, combo.niche, combo.city, combo.state, fromCombo)
    if (fromCombo === 0 && leads.length > 0) {
      console.log(`    ⚠ exhausted: ${combo.niche}|${combo.city} (${leads.length} results, all dupes) — skipped next run`)
    }

    console.log(`    → ${fromCombo} saved from ${combo.city}`)
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000))
  }

  return saved
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }

  const date = new Date().toISOString().split('T')[0]
  const tabs  = TAB_ARG
    ? TAB_CONFIGS.filter(c => c.tab === TAB_ARG)
    : TAB_CONFIGS

  if (!tabs.length) {
    console.error(`Unknown SHEET_TAB="${TAB_ARG}". Valid tabs:\n  ${TAB_CONFIGS.map(c => c.tab).join('\n  ')}`)
    process.exit(1)
  }

  console.log(`\n${'═'.repeat(64)}`)
  console.log(`🗺  Scrape-Universal — ${date}`)
  console.log(`   Target  : ${TARGET} leads per tab`)
  console.log(`   Tabs    : ${tabs.map(c => c.tab).join(', ')}`)
  console.log(`   Mode    : APPEND ONLY — never deletes rows`)
  console.log(`${'═'.repeat(64)}`)

  const results: { tab: string; saved: number }[] = []

  for (const cfg of tabs) {
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`📋  Tab: ${cfg.tab}`)
    const saved = await scrapeTab(cfg, TARGET)
    results.push({ tab: cfg.tab, saved })
    console.log(`  ✅ ${cfg.tab}: ${saved}/${TARGET} saved`)
  }

  console.log(`\n${'═'.repeat(64)}`)
  console.log('SUMMARY')
  let total = 0
  for (const r of results) {
    const bar = '█'.repeat(Math.floor(r.saved / 5)) + (r.saved < TARGET ? '░' : '')
    console.log(`  ${r.tab.padEnd(44)} ${String(r.saved).padStart(4)}/${TARGET}  ${bar}`)
    total += r.saved
  }
  console.log(`\n  TOTAL: ${total} leads appended`)
  console.log(`${'═'.repeat(64)}\n`)

  const anyFailed = results.some(r => r.saved < TARGET * 0.5)
  if (anyFailed) process.exit(1)
}

main()
  .catch(e => { console.error('\n💥 Fatal:', e.message); process.exit(1) })
  .finally(() => { dbPool?.end().catch(() => {}) })
