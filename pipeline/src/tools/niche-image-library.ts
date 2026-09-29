/**
 * Niche image library — picks pre-generated gpt-image-1 images from pipeline/assets/<niche>/
 * Returns file paths that the builder agent copies into the deployed site.
 * Falls back to fal.ai generation if library images don't exist yet.
 */

import fs from 'fs'
import path from 'path'

const ASSETS_DIR = path.resolve(__dirname, '../../assets')

export interface LibraryImage {
  file: string
  localPath: string
  exists: boolean
}

const NICHE_FILES: Record<string, string[]> = {
  medspa:           ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'treatment.jpg', 'before-after.jpg'],
  'skin-clinic':    ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'clinic.jpg', 'results.jpg'],
  'iv-therapy':     ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'drips.jpg', 'lounge.jpg'],
  salon:            ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'salon.jpg', 'result.jpg'],
  barbershop:       ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'shop.jpg', 'tools.jpg'],
  'nail-studio':    ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'polish.jpg', 'result.jpg'],
  hvac:             ['hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'hero-4.jpg'],
  roofing:          ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'damage.jpg', 'result.jpg'],
  plumbing:         ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'pipes.jpg', 'drain.jpg'],
  cleaning:         ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'supplies.jpg', 'result.jpg'],
  landscaping:      ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'lawn.jpg', 'install.jpg'],
  'auto-detailing': ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'ceramic.jpg', 'interior.jpg'],
  remodeling:       ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'project-1.jpg', 'project-2.jpg', 'before-after.jpg'],
  dentist:          ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'consult.jpg', 'smile.jpg'],
  restaurant:       ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'dish-2.jpg', 'ambience.jpg'],
  lawfirm:          ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'office.jpg', 'courtroom.jpg'],
  'luxury-realestate': ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'pool.jpg', 'kitchen.jpg'],
  'junk-removal':   ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'truck.jpg', 'clear.jpg'],
  daycare:          ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'playground.jpg', 'learn.jpg'],
  'pressure-washing': ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'deck.jpg', 'truck.jpg'],
  'epoxy-flooring': ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'metallic.jpg', 'flake.jpg'],
  'tree-services':  ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'trim.jpg', 'removal.jpg'],
  'basement-waterproofing': ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'sump.jpg', 'drain.jpg'],
  'foundation-repair': ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'pier.jpg', 'crack.jpg'],
  'septic-services': ['hero-bg.jpg', 'hero-1.jpg', 'hero-2.jpg', 'hero-3.jpg', 'truck.jpg', 'repair.jpg'],
}

/** Returns library images for a niche — only those that exist on disk. */
export function getNicheImages(niche: string): LibraryImage[] {
  const files = NICHE_FILES[niche] ?? NICHE_FILES[normalizeNiche(niche)] ?? []
  const nicheDir = path.join(ASSETS_DIR, niche)

  return files.map(file => {
    const localPath = path.join(nicheDir, file)
    return { file, localPath, exists: fs.existsSync(localPath) }
  })
}

/** Returns only images that exist on disk — ready to use. */
export function getAvailableImages(niche: string): LibraryImage[] {
  return getNicheImages(niche).filter(img => img.exists)
}

/** True if library has ≥4 images for this niche — enough to skip fal.ai. */
export function libraryReady(niche: string): boolean {
  return getAvailableImages(niche).length >= 4
}

/** Returns hero background image path if available. */
export function getHeroBg(niche: string): string | null {
  const img = getNicheImages(niche).find(i => i.file === 'hero-bg.jpg')
  return img?.exists ? img.localPath : null
}

/** Returns hero grid images (hero-1 through hero-4) that exist. */
export function getHeroGridImages(niche: string, count = 4): LibraryImage[] {
  return getAvailableImages(niche)
    .filter(i => /^hero-\d+\.jpg$/.test(i.file))
    .slice(0, count)
}

/** Maps scraper niche slugs → library niche keys */
function normalizeNiche(niche: string): string {
  const MAP: Record<string, string> = {
    'medspa-usa': 'medspa',
    'botox-clinic': 'medspa',
    'aesthetic-clinic': 'medspa',
    'cosmetic-dermatology': 'skin-clinic',
    'laser-clinic': 'skin-clinic',
    'financial-advisor': 'lawfirm',
    'insurance-agent': 'lawfirm',
    'life-insurance': 'lawfirm',
    'tax-advisor': 'lawfirm',
    'mortgage-broker': 'lawfirm',
    'italian-restaurant': 'restaurant',
    'mexican-restaurant': 'restaurant',
    'asian-restaurant': 'restaurant',
    'bbq-steakhouse': 'restaurant',
  }
  return MAP[niche] ?? niche
}

/** Summary of library status across all niches. */
export function libraryStatus(): Record<string, { total: number; ready: number; complete: boolean }> {
  return Object.fromEntries(
    Object.entries(NICHE_FILES).map(([niche, files]) => {
      const ready = getAvailableImages(niche).length
      return [niche, { total: files.length, ready, complete: ready >= files.length }]
    })
  )
}
