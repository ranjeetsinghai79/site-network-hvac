/**
 * import-yelp-remaining.ts
 * Import the remaining ~58k Yelp businesses (non-target in original import)
 * Routes each business to the correct sheet tab based on expanded niche map.
 * Dedup via DB — already-imported yelp_* IDs are skipped automatically.
 *
 * New tabs created: USA_AutoRepair, USA_Fitness, USA_PetServices, USA_MedicalOffices
 *
 * Run:
 *   YELP_DATASET_FILE=../admin/Yelp/yelp_academic_dataset_business.json npx tsx --env-file=.env src/scripts/import-yelp-remaining.ts
 */
import * as fs from 'fs'
import * as readline from 'readline'
import pg from 'pg'
import { appendSheetRows, writeRangeValues, batchUpdateSheet, listSheetTabs } from '../tools/google-sheets.js'

const SHEET_ID     = process.env.LEADS_SHEET_ID!
const DATASET_FILE = process.env.YELP_DATASET_FILE ?? '../admin/Yelp/yelp_academic_dataset_business.json'
const DRY_RUN      = process.env.DRY_RUN === 'true'
const BATCH_SIZE   = 300

// ─── Niche → sheet tab routing ────────────────────────────────────────────────

const NICHE_TO_TAB: Record<string, string> = {
  hvac:          'Local SMBs',
  plumbing:      'Local SMBs',
  roofing:       'Local SMBs',
  landscaping:   'Local SMBs',
  cleaning:      'Local SMBs',
  remodeling:    'Local SMBs',
  autodetail:    'Local SMBs',
  handyman:      'Local SMBs',
  autorepair:    'USA_AutoRepair',
  restaurant:    'USA_Restaurants',
  dentist:       'USA_DentalOffices',
  medspa:        'MEDSPAS',
  skinclinic:    'USA_SkinClinics',
  salon:         'USA_Salons',
  barbershop:    'USA_BarberShops',
  nailstudio:    'USA_NailStudios',
  medoffice:     'USA_MedicalOffices',
  chiropractor:  'USA_MedicalOffices',
  lawfirm:       'USA_LawFirms',
  financial:     'USA_FinancialAdvisorsandInsuranceAgents',
  realestate:    'USA_RealEstateAgents',
  fitness:       'USA_Fitness',
  petservices:   'USA_PetServices',
}

// ─── Expanded category map ────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  // Home services → Local SMBs
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
  'gutter services':                'handyman',
  'carpet cleaning':                'cleaning',
  'pest control':                   'handyman',
  'pool & hot tub service':         'handyman',
  // Auto → USA_AutoRepair
  'auto detailing':                 'autodetail',
  'auto repair':                    'autorepair',
  'automotive':                     'autorepair',
  'body shops':                     'autorepair',
  'oil change stations':            'autorepair',
  'tires':                          'autorepair',
  'transmission repair':            'autorepair',
  'auto glass services':            'autorepair',
  'auto parts & supplies':          'autorepair',
  'car dealers':                    'autorepair',
  'car wash':                       'autodetail',
  // Food → USA_Restaurants
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
  'nightlife':                      'restaurant',
  'cocktail bars':                  'restaurant',
  'wine bars':                      'restaurant',
  'sports bars':                    'restaurant',
  'dive bars':                      'restaurant',
  'pubs':                           'restaurant',
  // Dental
  'dentists':                       'dentist',
  'dental hygienists':              'dentist',
  'orthodontists':                  'dentist',
  'oral surgeons':                  'dentist',
  'pediatric dentists':             'dentist',
  'general dentistry':              'dentist',
  'endodontists':                   'dentist',
  'periodontists':                  'dentist',
  // Beauty
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
  'tanning':                        'skinclinic',
  'barbers':                        'barbershop',
  'nail salons':                    'nailstudio',
  'massage':                        'medspa',
  'day spas':                       'medspa',
  'spray tanning':                  'skinclinic',
  // Medical / health → USA_MedicalOffices
  'doctors':                        'medoffice',
  'health & medical':               'medoffice',
  'family practice':                'medoffice',
  'internal medicine':              'medoffice',
  'pediatricians':                  'medoffice',
  'urgent care':                    'medoffice',
  'physical therapy':               'medoffice',
  'optometrists':                   'medoffice',
  'ophthalmologists':               'medoffice',
  'psychiatrists':                  'medoffice',
  'psychologists':                  'medoffice',
  'counseling & mental health':     'medoffice',
  'obstetricians & gynecologists':  'medoffice',
  'allergists':                     'medoffice',
  'cardiologists':                  'medoffice',
  'radiologists':                   'medoffice',
  'speech therapists':              'medoffice',
  'nutritionists':                  'medoffice',
  'acupuncture':                    'medoffice',
  'chiropractors':                  'chiropractor',
  // Legal
  'lawyers':                        'lawfirm',
  'divorce & family law':           'lawfirm',
  'criminal defense law':           'lawfirm',
  'personal injury law':            'lawfirm',
  'immigration law':                'lawfirm',
  'dui law':                        'lawfirm',
  'employment law':                 'lawfirm',
  'bankruptcy law':                 'lawfirm',
  'real estate law':                'lawfirm',
  'estate planning law':            'lawfirm',
  // Financial
  'financial services':             'financial',
  'insurance':                      'financial',
  'financial advising':             'financial',
  'accountants':                    'financial',
  'tax services':                   'financial',
  'mortgage brokers':               'financial',
  'banks & credit unions':          'financial',
  'investing':                      'financial',
  'debt relief services':           'financial',
  // Real estate
  'real estate':                    'realestate',
  'real estate agents':             'realestate',
  'property management':            'realestate',
  'home staging':                   'realestate',
  // Fitness → USA_Fitness
  'gyms':                           'fitness',
  'fitness & instruction':          'fitness',
  'yoga':                           'fitness',
  'pilates':                        'fitness',
  'personal training':              'fitness',
  'martial arts':                   'fitness',
  'dance studios':                  'fitness',
  'sports clubs':                   'fitness',
  'boot camps':                     'fitness',
  'cycling classes':                'fitness',
  'boxing':                         'fitness',
  'swimming lessons/schools':       'fitness',
  // Pets → USA_PetServices
  'veterinarians':                  'petservices',
  'pet services':                   'petservices',
  'pet groomers':                   'petservices',
  'pet sitting':                    'petservices',
  'pet boarding':                   'petservices',
  'pet training':                   'petservices',
  'pets':                           'petservices',
  'pet stores':                     'petservices',
  'dog walkers':                    'petservices',
  'holistic animal care':           'petservices',
}

function getNiche(categories: string | null | undefined): string {
  if (!categories) return 'other'
  const cats = categories.toLowerCase()
  for (const [key, niche] of Object.entries(CATEGORY_MAP)) {
    if (cats.includes(key)) return niche
  }
  return 'other'
}

// ─── DB ───────────────────────────────────────────────────────────────────────

let pool: pg.Pool | null = null
function getPool() {
  if (!pool) pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  return pool
}

async function getExistingIds(ids: string[]): Promise<Set<string>> {
  if (!process.env.DATABASE_URL) return new Set()
  const { rows } = await getPool().query<{place_id:string}>(
    'SELECT place_id FROM scraped_places WHERE place_id = ANY($1)',
    [ids]
  )
  return new Set(rows.map(r => r.place_id))
}

async function markDB(entries: {id:string; tab:string; name:string; city:string}[]): Promise<void> {
  if (!entries.length || !process.env.DATABASE_URL) return
  const p = getPool()
  const vals = entries.map((e, i) => `($${i*4+1},$${i*4+2},$${i*4+3},$${i*4+4})`).join(',')
  await p.query(
    `INSERT INTO scraped_places (place_id,tab,name,city) VALUES ${vals} ON CONFLICT DO NOTHING`,
    entries.flatMap(e => [e.id, e.tab, e.name, e.city])
  ).catch(() => {})
}

// ─── Sheet management ─────────────────────────────────────────────────────────

const HEADER = [
  'Date Added','Business Name','Niche / Category','City','State / Country','Timezone',
  'Phone','Email','Has Website','Website URL','Address','Rating','Reviews',
  'GBP Claimed','Open Now','Price Level','Tier','Maps URL',
  'Business Email','Owner Email','Phone Type','Can SMS',
]

const ensuredTabs = new Set<string>()

async function ensureTab(tab: string, existingTabs: Set<string>): Promise<void> {
  if (ensuredTabs.has(tab)) return
  ensuredTabs.add(tab)

  if (!existingTabs.has(tab)) {
    console.log(`  Creating new tab: ${tab}`)
    await batchUpdateSheet({
      spreadsheetId: SHEET_ID,
      requests: [{ addSheet: { properties: { title: tab } } }],
    })
    await new Promise(r => setTimeout(r, 1500))
    existingTabs.add(tab)
  }
  await writeRangeValues({ spreadsheetId: SHEET_ID, range: `${tab}!A1:V1`, values: [HEADER] }).catch(() => {})
}

// ─── Main ─────────────────────────────────────────────────────────────────────

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
  categories:   string | null
}

function toRow(b: YelpBiz, niche: string, tab: string): string[] {
  const date = new Date().toISOString().split('T')[0]
  const address = [b.address, b.city, b.state, b.postal_code].filter(Boolean).join(', ')
  return [
    date, b.name, niche, b.city, b.state, '', '', '', '', '',
    address, String(b.stars ?? ''), String(b.review_count ?? ''),
    '', b.is_open ? 'YES' : 'NO', '', '', `yelp:${b.business_id}`,
    '', '', 'unknown', '',
  ]
}

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }
  if (!fs.existsSync(DATASET_FILE)) { console.error(`Dataset not found: ${DATASET_FILE}`); process.exit(1) }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`Yelp Dataset — REMAINING 58k import (multi-tab routing)`)
  console.log(`File: ${DATASET_FILE} | DRY_RUN: ${DRY_RUN}`)
  console.log(`${'═'.repeat(60)}\n`)

  const existingTabsList = await listSheetTabs({ spreadsheetId: SHEET_ID }).catch(() => [] as {title:string}[])
  const existingTabs = new Set(existingTabsList.map(t => t.title))

  if (!DRY_RUN) {
    for (const tab of new Set(Object.values(NICHE_TO_TAB))) {
      await ensureTab(tab, existingTabs)
    }
  }

  const rl = readline.createInterface({ input: fs.createReadStream(DATASET_FILE) })

  // Buffer per tab: tab → [{row, id, name, city}]
  type Entry = { row: string[]; id: string; name: string; city: string }
  const tabBuffers: Record<string, Entry[]> = {}
  const nicheCount: Record<string, number> = {}
  let totalRead = 0, skipped = 0, written = 0, alreadyImported = 0

  async function flushTab(tab: string) {
    const buf = tabBuffers[tab]
    if (!buf?.length) return
    tabBuffers[tab] = []

    const ids = buf.map(e => e.id)
    const existing = await getExistingIds(ids)
    const fresh = buf.filter(e => !existing.has(e.id))
    alreadyImported += buf.length - fresh.length

    if (!fresh.length) return

    if (!DRY_RUN) {
      const ok = await appendSheetRows({ spreadsheetId: SHEET_ID, sheetName: tab, rows: fresh.map(e => e.row) })
      if (ok) {
        await markDB(fresh.map(e => ({ id: e.id, tab, name: e.name, city: e.city })))
        written += fresh.length
      }
    } else {
      written += fresh.length
    }
    process.stdout.write(`  Written: ${written} | Skipped(dup): ${alreadyImported} | Read: ${totalRead}\r`)
  }

  async function flushAll() {
    for (const tab of Object.keys(tabBuffers)) {
      await flushTab(tab)
    }
  }

  let lineCount = 0
  for await (const line of rl) {
    if (!line.trim()) continue
    let biz: YelpBiz
    try { biz = JSON.parse(line) } catch { continue }
    totalRead++
    lineCount++

    if (!biz.name || !biz.city || !biz.state || biz.state.length !== 2) continue

    const niche = getNiche(biz.categories as string)
    if (niche === 'other') { skipped++; continue }

    const tab = NICHE_TO_TAB[niche]
    if (!tab) { skipped++; continue }

    nicheCount[niche] = (nicheCount[niche] ?? 0) + 1
    if (!tabBuffers[tab]) tabBuffers[tab] = []
    tabBuffers[tab].push({ row: toRow(biz, niche, tab), id: `yelp_${biz.business_id}`, name: biz.name, city: biz.city })

    // Flush each tab buffer when it hits BATCH_SIZE
    for (const t of Object.keys(tabBuffers)) {
      if ((tabBuffers[t]?.length ?? 0) >= BATCH_SIZE) await flushTab(t)
    }
  }

  // Final flush
  await flushAll()

  console.log(`\n\n${'═'.repeat(60)}`)
  console.log(`✅  Done — ${written} new leads written to proper tabs`)
  console.log(`   Already imported: ${alreadyImported} | No-niche skipped: ${skipped}`)
  console.log(`\n   Niche breakdown:`)
  Object.entries(nicheCount).sort((a,b) => b[1]-a[1])
    .forEach(([n,c]) => console.log(`   ${n.padEnd(15)} → ${(NICHE_TO_TAB[n]||'?').padEnd(40)} ${c}`))
  console.log(`${'═'.repeat(60)}\n`)

  if (pool) await pool.end()
}

main().catch(e => { console.error(e.message); process.exit(1) })
