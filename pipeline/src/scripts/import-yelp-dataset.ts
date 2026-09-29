/**
 * import-yelp-dataset.ts
 * Parse Yelp Open Dataset (business.json) → write to "Yelp_Dataset" tab in leads sheet
 *
 * Dataset download: yelp.com/dataset → Download Dataset → yelp_dataset.tar.gz
 * Extract: tar -xzf yelp_dataset.tar.gz → yelp_academic_dataset_business.json
 *
 * Run:
 *   YELP_DATASET_FILE=/path/to/yelp_academic_dataset_business.json npx tsx --env-file=.env src/scripts/import-yelp-dataset.ts
 *   DRY_RUN=true YELP_DATASET_FILE=./yelp_academic_dataset_business.json npx tsx --env-file=.env src/scripts/import-yelp-dataset.ts
 *
 * Dataset covers: Las Vegas NV, Phoenix AZ, Charlotte NC, Pittsburgh PA,
 *                 Cleveland OH, Madison WI, Champaign IL + some Canadian cities
 * ~150k businesses, data from 2022
 */
import * as fs from 'fs'
import * as readline from 'readline'
import pg from 'pg'
import { appendSheetRows, writeRangeValues, batchUpdateSheet, listSheetTabs } from '../tools/google-sheets.js'
import { lookupPhoneType } from '../tools/phone-lookup.js'

const SHEET_ID      = process.env.LEADS_SHEET_ID!
const DATASET_FILE  = process.env.YELP_DATASET_FILE ?? './yelp_academic_dataset_business.json'
const DRY_RUN       = process.env.DRY_RUN === 'true'
const BATCH_SIZE    = 500
const TAB           = 'Yelp_Dataset'

// ─── Niche mapping (Yelp categories → our niche slugs) ───────────────────────

const CATEGORY_MAP: Record<string, string> = {
  // ── Home services ──
  'hvac':                           'hvac',
  'heating & air conditioning/hvac':'hvac',
  'plumbing':                       'plumbing',
  'roofing':                        'roofing',
  'landscaping':                    'landscaping',
  'cleaning':                       'cleaning',
  'home cleaners':                  'cleaning',
  'home cleaning':                  'cleaning',
  'remodeling':                     'remodeling',
  'general contractors':            'remodeling',
  'contractors':                    'remodeling',
  'home services':                  'remodeling',
  'handyman':                       'handyman',
  'electricians':                   'handyman',
  'painters':                       'handyman',
  'flooring':                       'remodeling',
  'windows installation':           'remodeling',
  'insulation installation':        'hvac',
  'garage door services':           'handyman',
  // ── Auto ──
  'auto detailing':                 'autodetail',
  'auto repair':                    'autorepair',
  'automotive':                     'autorepair',
  'body shops':                     'autorepair',
  'oil change stations':            'autorepair',
  'tires':                          'autorepair',
  'transmission repair':            'autorepair',
  'auto glass services':            'autorepair',
  // ── Food & drink ──
  'restaurants':                    'restaurant',
  'food':                           'restaurant',
  'bars':                           'restaurant',
  'american (traditional)':         'restaurant',
  'american (new)':                 'restaurant',
  'breakfast & brunch':             'restaurant',
  'fast food':                      'restaurant',
  'pizza':                          'restaurant',
  'burgers':                        'restaurant',
  'sandwiches':                     'restaurant',
  'delis':                          'restaurant',
  'diners':                         'restaurant',
  'cafes':                          'restaurant',
  'coffee & tea':                   'restaurant',
  'bakeries':                       'restaurant',
  'juice bars & smoothies':         'restaurant',
  'desserts':                       'restaurant',
  'ice cream & frozen yogurt':      'restaurant',
  'caterers':                       'restaurant',
  // ── Medical / dental ──
  'dentists':                       'dentist',
  'dental hygienists':              'dentist',
  'orthodontists':                  'dentist',
  'oral surgeons':                  'dentist',
  'pediatric dentists':             'dentist',
  'doctors':                        'medoffice',
  'general dentistry':              'dentist',
  'health & medical':               'medoffice',
  'family practice':                'medoffice',
  'internal medicine':              'medoffice',
  'pediatricians':                  'medoffice',
  'urgent care':                    'medoffice',
  'physical therapy':               'medoffice',
  'chiropractors':                  'chiropractor',
  'optometrists':                   'medoffice',
  'ophthalmologists':               'medoffice',
  'psychiatrists':                  'medoffice',
  'psychologists':                  'medoffice',
  'counseling & mental health':     'medoffice',
  // ── Beauty ──
  'medical spas':                   'medspa',
  'aesthetics':                     'medspa',
  'skin care':                      'skinclinic',
  'dermatologists':                 'skinclinic',
  'hair salons':                    'salon',
  'beauty & spas':                  'salon',
  'hair removal':                   'skinclinic',
  'eyelash service':                'salon',
  'eyebrow services':               'salon',
  'threading services':             'salon',
  'waxing':                         'salon',
  'barbers':                        'barbershop',
  'nail salons':                    'nailstudio',
  'massage':                        'medspa',
  'tanning':                        'skinclinic',
  // ── Professional services ──
  'lawyers':                        'lawfirm',
  'divorce & family law':           'lawfirm',
  'criminal defense law':           'lawfirm',
  'personal injury law':            'lawfirm',
  'immigration law':                'lawfirm',
  'dui law':                        'lawfirm',
  'employment law':                 'lawfirm',
  'real estate':                    'realestate',
  'real estate agents':             'realestate',
  'property management':            'realestate',
  'financial services':             'financial',
  'insurance':                      'financial',
  'financial advising':             'financial',
  'accountants':                    'financial',
  'tax services':                   'financial',
  'mortgage brokers':               'financial',
  'banks & credit unions':          'financial',
  // ── Fitness / wellness ──
  'gyms':                           'fitness',
  'fitness & instruction':          'fitness',
  'yoga':                           'fitness',
  'pilates':                        'fitness',
  'personal training':              'fitness',
  'martial arts':                   'fitness',
  'dance studios':                  'fitness',
  'sports clubs':                   'fitness',
  // ── Pets ──
  'veterinarians':                  'petservices',
  'pet services':                   'petservices',
  'pet groomers':                   'petservices',
  'pet sitting':                    'petservices',
  'pet boarding':                   'petservices',
  'pet training':                   'petservices',
  'pets':                           'petservices',
}

function getNiche(categories: string | Array<{alias: string; title: string}> | null | undefined): string {
  if (!categories) return 'other'

  // Academic dataset: categories is a comma-separated string
  // Fusion API: categories is Array<{alias, title}>
  const categoryStr = typeof categories === 'string'
    ? categories.toLowerCase()
    : categories.map(c => c?.title ?? '').join(', ').toLowerCase()

  if (!categoryStr) return 'other'

  for (const [key, niche] of Object.entries(CATEGORY_MAP)) {
    if (categoryStr.includes(key)) return niche
  }
  return 'other'
}

// ─── Target our niches only (skip restaurants/generic to keep dataset focused) ─
const TARGET_NICHES = new Set([
  'hvac','plumbing','roofing','landscaping','cleaning','remodeling','autodetail','handyman',
  'autorepair',
  'medspa','skinclinic','dentist','salon','barbershop','nailstudio',
  'medoffice','chiropractor',
  'lawfirm','financial','realestate',
  'restaurant',
  'fitness','petservices',
])

// ─── DB dedup ─────────────────────────────────────────────────────────────────

let pool: pg.Pool | null = null
function getPool(): pg.Pool {
  if (!pool) pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  return pool
}

async function filterNew(ids: string[]): Promise<Set<string>> {
  if (!process.env.DATABASE_URL) return new Set()
  const p = getPool()
  const { rows } = await p.query<{place_id:string}>(
    'SELECT place_id FROM scraped_places WHERE place_id = ANY($1) AND tab = $2',
    [ids, TAB]
  )
  return new Set(rows.map(r => r.place_id))
}

async function markDB(ids: string[], names: string[], cities: string[]): Promise<void> {
  if (!process.env.DATABASE_URL || !ids.length) return
  const p = getPool()
  const vals = ids.map((id, i) => [id, TAB, names[i], cities[i]])
  const ph = vals.map((_,i) => `($${i*4+1},$${i*4+2},$${i*4+3},$${i*4+4})`).join(',')
  await p.query(
    `INSERT INTO scraped_places (place_id,tab,name,city) VALUES ${ph} ON CONFLICT DO NOTHING`,
    vals.flat()
  ).catch(() => {})
}

// ─── Row format ───────────────────────────────────────────────────────────────

interface YelpBiz {
  business_id:  string
  name:         string
  address:      string
  city:         string
  state:        string
  postal_code:  string
  stars:        number
  review_count: number
  is_open:      number
  categories:   string | Array<{alias:string; title:string}> | null
  attributes?:  Record<string, any>
}

function toRow(b: YelpBiz, niche: string): string[] {
  const date = new Date().toISOString().split('T')[0]
  const { lineType, canSms } = { lineType: 'unknown', canSms: true }  // no phone in dataset
  const address = [b.address, b.city, b.state, b.postal_code].filter(Boolean).join(', ')
  return [
    date,                                    // A  Date Added
    b.name,                                  // B  Business Name
    niche,                                   // C  Niche
    b.city,                                  // D  City
    b.state,                                 // E  State
    '',                                      // F  Timezone
    '',                                      // G  Phone (not in dataset)
    '',                                      // H  Email
    '',                                      // I  Has Website (unknown)
    '',                                      // J  Website URL
    address,                                 // K  Address
    String(b.stars ?? ''),                   // L  Rating
    String(b.review_count ?? ''),            // M  Reviews
    '',                                      // N  GBP Claimed
    b.is_open ? 'YES' : 'NO',               // O  Open Now
    '',                                      // P  Price Level
    '',                                      // Q  Tier
    `yelp:${b.business_id}`,                // R  Source URL / Yelp ID
    '',                                      // S  Business Email
    '',                                      // T  Owner Email
    lineType,                                // U  Phone Type
    '',                                      // V  Can SMS
  ]
}

// ─── Ensure header + tab exists ───────────────────────────────────────────────

const HEADER = [
  'Date Added','Business Name','Niche / Category','City','State / Country','Timezone',
  'Phone','Email','Has Website','Website URL','Address','Rating','Reviews',
  'GBP Claimed','Open Now','Price Level','Tier','Maps URL',
  'Business Email','Owner Email','Phone Type','Can SMS',
]

async function ensureTab(): Promise<void> {
  // Create tab if it doesn't exist
  const tabs = await listSheetTabs({ spreadsheetId: SHEET_ID }).catch(() => [])
  if (!tabs.some(t => t.title === TAB)) {
    console.log(`  Creating tab: ${TAB}`)
    await batchUpdateSheet({
      spreadsheetId: SHEET_ID,
      requests: [{ addSheet: { properties: { title: TAB } } }],
    })
    await new Promise(r => setTimeout(r, 1000))
  }
  // Write header
  await writeRangeValues({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A1:V1`,
    values: [HEADER],
  }).catch(() => {})
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }
  if (!fs.existsSync(DATASET_FILE)) {
    console.error(`Dataset not found: ${DATASET_FILE}`)
    console.error('')
    console.error('Download from: https://www.yelp.com/dataset')
    console.error('Then extract: tar -xzf yelp_dataset.tar.gz')
    console.error('Then run: YELP_DATASET_FILE=./yelp_academic_dataset_business.json npx tsx --env-file=.env src/scripts/import-yelp-dataset.ts')
    process.exit(1)
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`Yelp Dataset Import — ${DATASET_FILE}`)
  console.log(`Tab: ${TAB} | DRY_RUN: ${DRY_RUN}`)
  console.log(`${'═'.repeat(60)}\n`)

  if (!DRY_RUN) await ensureTab()

  const rl = readline.createInterface({ input: fs.createReadStream(DATASET_FILE) })
  let totalRead = 0, filtered = 0, skipped = 0, written = 0
  const batch: string[][] = []
  const batchIds: string[] = []
  const batchNames: string[] = []
  const batchCities: string[] = []

  const nicheCount: Record<string, number> = {}

  async function flushBatch() {
    if (!batch.length) return

    const existing = await filterNew(batchIds)
    const fresh = batch.filter((_, i) => !existing.has(batchIds[i]))
    const freshIds = batchIds.filter(id => !existing.has(id))
    const freshNames = batchNames.filter((_, i) => !existing.has(batchIds[i]))
    const freshCities = batchCities.filter((_, i) => !existing.has(batchIds[i]))
    skipped += batch.length - fresh.length

    if (fresh.length && !DRY_RUN) {
      const ok = await appendSheetRows({ spreadsheetId: SHEET_ID, sheetName: TAB, rows: fresh })
      if (ok) {
        await markDB(freshIds, freshNames, freshCities)
        written += fresh.length
        process.stdout.write(`  Written: ${written} | Skipped: ${skipped} | Read: ${totalRead}\r`)
      }
    } else if (DRY_RUN) {
      written += fresh.length
    }

    batch.length = 0; batchIds.length = 0; batchNames.length = 0; batchCities.length = 0
  }

  for await (const line of rl) {
    if (!line.trim()) continue
    let biz: YelpBiz
    try { biz = JSON.parse(line) } catch { continue }
    totalRead++

    if (!biz.name || !biz.city || !biz.state) continue
    // US only
    if (biz.state.length !== 2) continue

    const niche = getNiche(biz.categories)
    if (!TARGET_NICHES.has(niche)) continue
    filtered++

    nicheCount[niche] = (nicheCount[niche] ?? 0) + 1
    batch.push(toRow(biz, niche))
    batchIds.push(`yelp_${biz.business_id}`)
    batchNames.push(biz.name)
    batchCities.push(biz.city)

    if (batch.length >= BATCH_SIZE) await flushBatch()
  }
  await flushBatch()

  console.log(`\n\n${'═'.repeat(60)}`)
  console.log(`✅  Done`)
  console.log(`   Total read: ${totalRead} | Matched niches: ${filtered}`)
  console.log(`   Written: ${written} | Skipped (dup): ${skipped}`)
  console.log(`\n   Niche breakdown:`)
  Object.entries(nicheCount).sort((a,b) => b[1]-a[1]).forEach(([n,c]) => console.log(`   ${n.padEnd(15)} ${c}`))
  console.log(`${'═'.repeat(60)}\n`)

  if (pool) await pool.end()
}

main().catch(e => { console.error(e.message); process.exit(1) })
