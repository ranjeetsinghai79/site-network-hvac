/**
 * bulk-bbb-scrape.ts
 * Scrape BBB across 50 cities × top niches simultaneously → write to sheet
 *
 * Run:
 *   npx tsx --env-file=.env src/scripts/bulk-bbb-scrape.ts
 *   DRY_RUN=true npx tsx --env-file=.env src/scripts/bulk-bbb-scrape.ts
 */
import pg from 'pg'
import { scrapeBBB } from '../sources/bbb.js'
import { appendSheetRows } from '../tools/google-sheets.js'
import { lookupPhoneType } from '../tools/phone-lookup.js'
import type { SourceLead } from '../sources/types.js'

const SHEET_ID = process.env.LEADS_SHEET_ID!
const DRY_RUN  = process.env.DRY_RUN === 'true'
const CONCUR   = parseInt(process.env.CONCUR ?? '4')   // parallel BBB scrapers

// ─── City × niche matrix ─────────────────────────────────────────────────────
// 30 high-value US cities
const CITIES: [string, string][] = [
  ['Los Angeles','CA'],['Houston','TX'],['Phoenix','AZ'],['Philadelphia','PA'],
  ['San Antonio','TX'],['San Diego','CA'],['Dallas','TX'],['Jacksonville','FL'],
  ['San Jose','CA'],['Fort Worth','TX'],['Columbus','OH'],['Indianapolis','IN'],
  ['Charlotte','NC'],['San Francisco','CA'],['Seattle','WA'],['Denver','CO'],
  ['Nashville','TN'],['Oklahoma City','OK'],['El Paso','TX'],['Las Vegas','NV'],
  ['Louisville','KY'],['Baltimore','MD'],['Milwaukee','WI'],['Albuquerque','NM'],
  ['Tucson','AZ'],['Fresno','CA'],['Sacramento','CA'],['Mesa','AZ'],
  ['Atlanta','GA'],['Omaha','NE'],
]

// Niche → BBB search term → target sheet tab
const NICHES: Array<{ term: string; niche: string; tab: string }> = [
  { term:'HVAC air conditioning heating',  niche:'hvac',      tab:'Local SMBs'  },
  { term:'medical spa aesthetics',         niche:'medspa',    tab:'MEDSPAS'     },
  { term:'dental office dentist',          niche:'dentist',   tab:'USA_DentalOffices' },
  { term:'hair salon beauty',              niche:'salon',     tab:'USA_Salons'  },
  { term:'restaurant food',               niche:'restaurant', tab:'USA_Restaurants' },
  { term:'nail salon manicure',            niche:'nailstudio',tab:'USA_NailStudios' },
  { term:'skin clinic dermatology',        niche:'skinclinic',tab:'USA_SkinClinics' },
]

// ─── DB dedup ─────────────────────────────────────────────────────────────────
let pool: pg.Pool | null = null
function getPool(): pg.Pool {
  if (!pool) pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  return pool
}

function makeId(phone: string, name: string, city: string): string {
  const clean = phone.replace(/\D/g,'')
  if (clean.length >= 10) return `phone_${clean}`
  let h = 0
  const key = `${name.toLowerCase()}::${city.toLowerCase()}`
  for (let i = 0; i < key.length; i++) { h = ((h << 5) - h) + key.charCodeAt(i); h |= 0 }
  return `hash_${Math.abs(h).toString(16)}`
}

async function filterNew(leads: SourceLead[], tab: string): Promise<SourceLead[]> {
  if (!process.env.DATABASE_URL) return leads
  const p = getPool()
  const ids = leads.map(l => makeId(l.phone??'', l.name, l.city))
  const { rows } = await p.query<{place_id:string}>(
    'SELECT place_id FROM scraped_places WHERE place_id = ANY($1) AND tab = $2',
    [ids, tab]
  )
  const existing = new Set(rows.map(r => r.place_id))
  return leads.filter(l => !existing.has(makeId(l.phone??'', l.name, l.city)))
}

async function markDB(leads: SourceLead[], tab: string): Promise<void> {
  if (!process.env.DATABASE_URL || !leads.length) return
  const p = getPool()
  const vals = leads.map(l => [makeId(l.phone??'', l.name, l.city), tab, l.name, l.city])
  const ph = vals.map((_,i) => `($${i*4+1},$${i*4+2},$${i*4+3},$${i*4+4})`).join(',')
  await p.query(
    `INSERT INTO scraped_places (place_id,tab,name,city) VALUES ${ph} ON CONFLICT DO NOTHING`,
    vals.flat()
  ).catch(() => {})
}

function toRow(l: SourceLead): string[] {
  const date = new Date().toISOString().split('T')[0]
  const { lineType, canSms } = l.phone ? lookupPhoneType(l.phone, l.state) : { lineType:'', canSms:false }
  return [
    date, l.name, l.niche, l.city, l.state, '', l.phone??'', l.email??'',
    l.hasWebsite ? 'YES' : 'NO', l.website??'', l.address??'',
    String(l.rating??''), String(l.reviewCount??''), '', '', '', '', l.sourceUrl??'',
    '', '', lineType, canSms ? 'YES' : '',
  ]
}

// ─── Worker: one city × one niche ─────────────────────────────────────────────
interface Job { city:string; state:string; term:string; niche:string; tab:string }
const queue: Job[] = []
const stats = { scraped:0, new:0, written:0, errors:0 }

for (const [city, state] of CITIES) {
  for (const n of NICHES) {
    queue.push({ city, state, ...n })
  }
}

async function worker(id: number) {
  while (queue.length) {
    const job = queue.shift()
    if (!job) break
    const { city, state, term, niche, tab } = job

    try {
      const leads = await scrapeBBB({ term, city, state, niche, maxPages:2 })
      stats.scraped += leads.length
      const fresh = await filterNew(leads, tab)
      stats.new += fresh.length

      if (fresh.length && !DRY_RUN) {
        const rows = fresh.map(toRow)
        const ok = await appendSheetRows({ spreadsheetId: SHEET_ID, sheetName: tab, rows })
        if (ok) {
          await markDB(fresh, tab)
          stats.written += fresh.length
        }
      }
      console.log(`[W${id}] ${niche}@${city},${state}: ${leads.length} found → ${fresh.length} new → ${DRY_RUN?'(dry)':''} written`)
    } catch(e: any) {
      stats.errors++
      console.log(`[W${id}] ✗ ${niche}@${city},${state}: ${e.message?.slice(0,60)}`)
    }

    await new Promise(r => setTimeout(r, 500))   // polite delay between BBB requests
  }
}

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`BBB Bulk Scrape — ${CITIES.length} cities × ${NICHES.length} niches = ${queue.length} jobs`)
  console.log(`Concurrency: ${CONCUR} | DRY_RUN: ${DRY_RUN}`)
  console.log(`${'═'.repeat(60)}\n`)

  const t0 = Date.now()
  await Promise.all(Array.from({ length: CONCUR }, (_, i) => worker(i + 1)))
  const elapsed = ((Date.now() - t0) / 60000).toFixed(1)

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`✅  Done in ${elapsed}min`)
  console.log(`   Scraped: ${stats.scraped} | New: ${stats.new} | Written: ${stats.written} | Errors: ${stats.errors}`)
  console.log(`${'═'.repeat(60)}\n`)

  if (pool) await pool.end()
}

main().catch(e => { console.error(e.message); process.exit(1) })
