/**
 * Download free stock images from Pexels for all niche templates.
 * Only downloads missing files — safe to re-run.
 *
 * Setup: add PEXELS_API_KEY to pipeline/.env
 *   Get free key (instant, no approval): https://www.pexels.com/api/
 *
 * Usage:
 *   cd pipeline && PEXELS_API_KEY=xxx npx tsx src/scripts/download-stock-images.ts
 *   cd pipeline && PEXELS_API_KEY=xxx npx tsx src/scripts/download-stock-images.ts iv-therapy
 */

import fs from 'fs'
import path from 'path'

const KEY = process.env.PEXELS_API_KEY
if (!KEY) {
  console.error('Missing PEXELS_API_KEY — get a free key at https://www.pexels.com/api/')
  process.exit(1)
}

const ROOT = path.join(import.meta.dirname, '..', '..', '..')

// Per-niche search terms — hero images + service images use same pool
const NICHE_QUERIES: Record<string, { hero: string; services: string[] }> = {
  hvac: {
    hero: 'HVAC air conditioning technician',
    services: ['air conditioner installation', 'heating system repair', 'furnace technician', 'air duct cleaning', 'thermostat smart home', 'HVAC maintenance'],
  },
  roofing: {
    hero: 'roofing contractor roof installation',
    services: ['roof shingles installation', 'gutter cleaning repair', 'roof inspection drone', 'storm damage roof repair', 'skylight installation', 'roof waterproofing'],
  },
  dentist: {
    hero: 'dental office dentist smile',
    services: ['dental cleaning teeth whitening', 'dental implants', 'braces orthodontics', 'root canal dentist', 'dental crown veneer', 'pediatric dentist child'],
  },
  medspa: {
    hero: 'luxury medical spa facial treatment',
    services: ['botox injection aesthetic', 'laser skin treatment', 'chemical peel facial', 'microneedling skin', 'body contouring treatment', 'IV drip vitamin infusion'],
  },
  lawfirm: {
    hero: 'law firm attorney office professional',
    services: ['attorney consultation client', 'courtroom legal', 'contract signing legal', 'personal injury lawyer', 'family law attorney', 'business law corporate'],
  },
  remodeling: {
    hero: 'home remodeling kitchen renovation',
    services: ['kitchen remodel renovation', 'bathroom renovation modern', 'open floor plan living room', 'home addition construction', 'basement finishing remodel', 'deck patio outdoor renovation'],
  },
  cleaning: {
    hero: 'professional house cleaning service',
    services: ['home cleaning vacuuming', 'bathroom deep cleaning', 'kitchen cleaning professional', 'window cleaning service', 'carpet steam cleaning', 'move-out cleaning service'],
  },
  'junk-removal': {
    hero: 'junk removal truck hauling',
    services: ['furniture removal hauling', 'garage cleanout junk', 'appliance removal disposal', 'yard debris cleanout', 'estate cleanout service', 'dumpster rental construction debris'],
  },
  daycare: {
    hero: 'daycare children playing learning',
    services: ['children learning classroom', 'toddler art activities', 'outdoor playground children', 'reading storytime kids', 'healthy meals children lunch', 'childcare teacher classroom'],
  },
  'auto-detailing': {
    hero: 'luxury car detailing polishing',
    services: ['car wash exterior detailing', 'interior car cleaning vacuuming', 'paint correction polishing', 'ceramic coating car', 'window tinting car', 'engine bay cleaning'],
  },
  restaurant: {
    hero: 'restaurant dining elegant interior',
    services: ['gourmet food plating dish', 'restaurant kitchen chef cooking', 'wine dining table setting', 'breakfast brunch cafe', 'pizza fresh baked', 'dessert pastry plating'],
  },
  'luxury-realestate': {
    hero: 'luxury real estate mansion interior',
    services: ['luxury home living room', 'modern kitchen luxury home', 'master bedroom luxury', 'swimming pool luxury estate', 'real estate agent showing home', 'luxury condominium city view'],
  },
  salon: {
    hero: 'hair salon styling professional',
    services: ['hair coloring highlights salon', 'hair cutting styling', 'blowout hair salon', 'keratin treatment smooth hair', 'balayage hair color', 'hair extensions salon'],
  },
  barbershop: {
    hero: 'barbershop barber haircut grooming',
    services: ['men haircut fade barbershop', 'beard trim shave barber', 'straight razor shave classic', 'men hair styling pomade', 'hot towel shave barber', 'barbershop interior vintage'],
  },
  plumbing: {
    hero: 'plumber plumbing repair professional',
    services: ['pipe repair plumber', 'water heater installation', 'drain cleaning plumbing', 'bathroom plumbing fixture', 'kitchen sink plumbing', 'sewer line repair'],
  },
  landscaping: {
    hero: 'landscaping lawn garden beautiful',
    services: ['lawn mowing landscaping', 'garden design planting', 'tree trimming pruning', 'irrigation sprinkler installation', 'mulching garden beds', 'patio hardscape design'],
  },
  'pressure-washing': {
    hero: 'pressure washing house driveway',
    services: ['pressure washing driveway concrete', 'house siding power washing', 'deck fence pressure washing', 'patio stone cleaning', 'roof soft washing', 'commercial pressure washing'],
  },
  'foundation-repair': {
    hero: 'foundation repair basement waterproofing',
    services: ['foundation crack repair concrete', 'basement waterproofing interior', 'crawl space encapsulation', 'helical pier foundation', 'sump pump installation', 'foundation inspection engineer'],
  },
  'basement-waterproofing': {
    hero: 'basement waterproofing dry interior',
    services: ['basement interior waterproofing', 'sump pump battery backup', 'french drain installation basement', 'egress window basement', 'mold remediation basement', 'basement finishing dry'],
  },
  'epoxy-flooring': {
    hero: 'epoxy floor coating garage shiny',
    services: ['garage floor epoxy coating', 'commercial epoxy flooring', 'metallic epoxy floor design', 'concrete floor grinding prep', 'flake chip epoxy floor', 'industrial floor coating'],
  },
  'septic-services': {
    hero: 'septic tank pumping service',
    services: ['septic tank pumping truck', 'drain field inspection', 'septic system installation', 'grease trap cleaning', 'sewer line inspection camera', 'septic repair maintenance'],
  },
  'tree-services': {
    hero: 'tree service arborist tree removal',
    services: ['tree removal crane large', 'tree trimming pruning arborist', 'stump grinding removal', 'emergency storm tree damage', 'tree health assessment', 'land clearing trees'],
  },
  'skin-clinic': {
    hero: 'skin clinic facial treatment aesthetician',
    services: ['facial treatment skincare clinic', 'microdermabrasion skin resurfacing', 'chemical peel treatment', 'acne treatment skin clinic', 'hydrafacial skin treatment', 'LED light therapy skin'],
  },
  'iv-therapy': {
    hero: 'IV therapy wellness drip clinic',
    services: ['IV vitamin drip infusion', 'wellness hydration therapy', 'NAD IV therapy clinic', 'immune boost vitamin IV', 'hangover recovery IV drip', 'athletic recovery IV infusion'],
  },
  'nail-studio': {
    hero: 'nail salon manicure pedicure luxury',
    services: ['gel manicure nail art', 'pedicure spa foot care', 'acrylic nail extensions', 'nail art design intricate', 'dip powder nails', 'nail salon interior luxury'],
  },
}

async function pexelsSearch(query: string, perPage = 1, page = 1): Promise<string | null> {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&orientation=landscape&size=large`
  const res = await fetch(url, { headers: { Authorization: KEY! } })
  if (!res.ok) { console.error(`Pexels error ${res.status} for "${query}"`); return null }
  const data: any = await res.json()
  const photo = data.photos?.[0]
  if (!photo) { console.warn(`No results for "${query}"`); return null }
  return photo.src.large2x || photo.src.large || photo.src.original
}

async function downloadUrl(url: string, outPath: string): Promise<boolean> {
  const res = await fetch(url)
  if (!res.ok) { console.error(`  Download failed: ${res.status} ${url}`); return false }
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(outPath, buf)
  return true
}

async function main() {
  const nicheArg = process.argv[2]

  const niches = nicheArg
    ? [nicheArg]
    : Object.keys(NICHE_QUERIES)

  let downloaded = 0
  let skipped = 0
  let failed = 0

  for (const niche of niches) {
    const queries = NICHE_QUERIES[niche]
    if (!queries) { console.warn(`Unknown niche: ${niche}`); continue }

    const outDir = path.join(ROOT, 'templates', niche, 'public')
    if (!fs.existsSync(path.join(ROOT, 'templates', niche))) {
      console.warn(`Template dir not found: templates/${niche}`)
      continue
    }
    fs.mkdirSync(outDir, { recursive: true })

    console.log(`\n=== ${niche} ===`)

    // Hero images — hero-1 through hero-4 using varied pages from hero query
    for (let i = 1; i <= 4; i++) {
      const file = `hero-${i}.jpg`
      const outPath = path.join(outDir, file)
      if (fs.existsSync(outPath)) { console.log(`  skip ${file} (exists)`); skipped++; continue }

      const imgUrl = await pexelsSearch(queries.hero, 1, i)
      if (!imgUrl) { failed++; continue }

      const ok = await downloadUrl(imgUrl, outPath)
      if (ok) {
        const kb = (fs.statSync(outPath).size / 1024).toFixed(0)
        console.log(`  ✓ ${file} (${kb} KB)`)
        downloaded++
      } else { failed++ }

      await new Promise(r => setTimeout(r, 300)) // rate limit
    }

    // Service images — one per service query
    for (let i = 0; i < queries.services.length; i++) {
      const file = `service-${i + 1}.jpg`
      const outPath = path.join(outDir, file)
      if (fs.existsSync(outPath)) { console.log(`  skip ${file} (exists)`); skipped++; continue }

      const imgUrl = await pexelsSearch(queries.services[i], 1, 1)
      if (!imgUrl) { failed++; continue }

      const ok = await downloadUrl(imgUrl, outPath)
      if (ok) {
        const kb = (fs.statSync(outPath).size / 1024).toFixed(0)
        console.log(`  ✓ ${file} — "${queries.services[i]}" (${kb} KB)`)
        downloaded++
      } else { failed++ }

      await new Promise(r => setTimeout(r, 300))
    }
  }

  console.log(`\n=== Done: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed ===`)
}

main().catch(console.error)
