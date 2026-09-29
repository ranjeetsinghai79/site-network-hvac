/**
 * daily-scrape.ts
 *
 * Runs every morning (6 AM via cron/launchd).
 * Scrapes Google Maps for local businesses without websites.
 * Keeps going until 100 new leads are saved or total DB leads >= 1000.
 *
 * Strategy:
 *   - Rotate through NICHES × CITIES combos in random order
 *   - Auto-retry each combo up to 3× on error
 *   - Expand to more cities if first batch exhausted
 *   - Write every lead to Neon DB + Google Sheets (leads log)
 *   - Email summary at end
 *
 * Run:
 *   npx tsx src/scripts/daily-scrape.ts
 *
 * Env:
 *   SCRAPE_TARGET=100         (leads per day, default 100)
 *   TOTAL_LEAD_CAP=1000       (stop scraping after this many total in DB)
 *   SCRAPE_HEADLESS=true      (default true)
 */

import 'dotenv/config'
import { runMapsScraper } from '../agents/maps-scraper.js'
import { saveLead, leadExists, getTotalLeadCount, getAllLeads } from '../db/supabase.js'
import { clearSheet, writeSheetRows } from '../tools/google-sheets.js'
import type { Lead } from '../types.js'

// ─── Targets ─────────────────────────────────────────────────────────────────

const DAILY_TARGET  = parseInt(process.env.SCRAPE_TARGET   ?? '100')
const TOTAL_CAP     = parseInt(process.env.TOTAL_LEAD_CAP  ?? '1000')
const MAX_RETRY     = 3
const HEADLESS      = process.env.SCRAPE_HEADLESS !== 'false'

// ─── Niches + Cities matrix ──────────────────────────────────────────────────
// Strategy: one niche per day (7-day rotation), 10 cities per day = ~100 leads
// Tier 1 niches (no-website, fast close $299-499): days 1-7
// Tier 2 niches (bad website, premium upgrade $500-999): run in parallel
// Covers 10 niches × 20 cities = 200 combos total

// ── Tier 1: solo/small ops — mostly NO website ───────────────────────────────
const TIER1_NICHES = [
  'auto-detailing',
  'cleaning',
  'junk-removal',
  'landscaping',
  'handyman',
  'roofing',
  'hvac',
  'plumbing',
  'pressure-washing',
  'epoxy-flooring',
  'foundation-repair',
  'tree-services',
]

// ── Tier 2: established biz — BAD/outdated website ───────────────────────────
// Beauty & wellness focus (Week 2): medspa, skin-clinic, iv-therapy, nail-studio + existing
const TIER2_NICHES = [
  'medspa',
  'skin-clinic',
  'iv-therapy',
  'nail-studio',
  'dentist',
  'salon',
  'barbershop',
  'daycare',
  'remodeling',
]

// Daily niche: pick TODAY's niche from tier1 (deterministic, cycles every 7 days)
function getDailyNiche(): string {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  return TIER1_NICHES[dayOfYear % TIER1_NICHES.length]
}

// All niches for full scrape (override with SCRAPE_ALL_NICHES=true)
const NICHES = process.env.SCRAPE_ALL_NICHES === 'true'
  ? [...TIER1_NICHES, ...TIER2_NICHES]
  : process.env.NICHE_LIST
    ? process.env.NICHE_LIST.split(',').map(n => n.trim()).filter(Boolean)
    : process.env.NICHE_OVERRIDE
      ? [process.env.NICHE_OVERRIDE]
      : [getDailyNiche(), ...TIER2_NICHES]  // today's T1 niche + all T2 niches

const CITIES: { city: string; state: string }[] = [
  // California — Central Valley (high no-website density)
  { city: 'Fresno',         state: 'CA' },
  { city: 'Modesto',        state: 'CA' },
  { city: 'Stockton',       state: 'CA' },
  { city: 'Bakersfield',    state: 'CA' },
  { city: 'Visalia',        state: 'CA' },
  { city: 'Turlock',        state: 'CA' },
  { city: 'Merced',         state: 'CA' },
  { city: 'Clovis',         state: 'CA' },
  { city: 'Tracy',          state: 'CA' },
  { city: 'Manteca',        state: 'CA' },
  // California — Inland Empire / SoCal
  { city: 'Riverside',      state: 'CA' },
  { city: 'San Bernardino', state: 'CA' },
  { city: 'Ontario',        state: 'CA' },
  { city: 'Fontana',        state: 'CA' },
  { city: 'Victorville',    state: 'CA' },
  // Texas — high density, lots of no-website businesses
  { city: 'Houston',        state: 'TX' },
  { city: 'San Antonio',    state: 'TX' },
  { city: 'El Paso',        state: 'TX' },
  { city: 'Laredo',         state: 'TX' },
  { city: 'Lubbock',        state: 'TX' },
]

interface ScrapeCombo {
  niche: string
  city: string
  state: string
  tier: 'tier1' | 'tier2'
}

// Deterministic daily shuffle — same order per calendar day, different each day
function dailyShuffle<T>(arr: T[]): T[] {
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

function buildCombos(): ScrapeCombo[] {
  const combos: ScrapeCombo[] = []
  for (const niche of NICHES) {
    const tier = (TIER2_NICHES.includes(niche) ? 'tier2' : 'tier1') as 'tier1' | 'tier2'
    for (const loc of CITIES) {
      combos.push({ niche, city: loc.city, state: loc.state, tier })
    }
  }
  return dailyShuffle(combos)
}

// ─── Google Sheets sync (full rewrite from DB — no duplicates possible) ──────

const SHEET_ID   = process.env.LEADS_SHEET_ID ?? ''
const SHEET_NAME = 'Local SMBs'

const SHEET_HEADER = [
  'Date Added', 'Name', 'Phone', 'Address', 'City', 'State', 'Niche',
  'Website', 'Rating', 'Reviews', 'GBP', 'Open', 'Status', 'Place ID',
]

async function syncLeadsToSheet(): Promise<void> {
  if (!SHEET_ID) return
  try {
    const leads = await getAllLeads(5000)
    const rows: string[][] = [SHEET_HEADER]
    for (const lead of leads) {
      rows.push([
        lead.created_at ? new Date(lead.created_at).toISOString().split('T')[0] : '',
        lead.name,
        lead.phone ?? '',
        lead.address ?? '',
        lead.city,
        lead.state,
        lead.niche,
        lead.website ? 'has website' : 'no website',
        lead.rating?.toString() ?? '',
        lead.review_count?.toString() ?? '',
        lead.gbp_claimed === true ? 'claimed' : lead.gbp_claimed === false ? 'unclaimed' : '',
        lead.is_open === true ? 'open' : lead.is_open === false ? 'closed' : '',
        lead.status ?? '',
        lead.place_id,
      ])
    }
    await clearSheet({ spreadsheetId: SHEET_ID, sheetName: SHEET_NAME })
    await writeSheetRows({ spreadsheetId: SHEET_ID, sheetName: SHEET_NAME, rows })
    console.log(`  Google Sheets synced: ${leads.length} leads`)
  } catch (e: any) {
    console.error('[Sheets] sync failed:', e.message)
  }
}

// ─── Main scrape loop ─────────────────────────────────────────────────────────

async function main() {
  const dateStr = new Date().toISOString().split('T')[0]
  const startTime = Date.now()

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`🗺  Daily Lead Scrape — ${dateStr}`)
  console.log(`   Target: ${DAILY_TARGET} new leads | Cap: ${TOTAL_CAP} total`)
  console.log(`${'═'.repeat(60)}\n`)

  // Check total leads in DB
  const totalExisting = await getTotalLeadCount()
  console.log(`  DB total leads: ${totalExisting}`)

  if (totalExisting >= TOTAL_CAP) {
    console.log(`\n✅ Reached ${TOTAL_CAP} total leads. Daily scrape skipped.`)
    console.log(`   Time to start BUILDING. Run: npm run worker:enqueue`)
    return
  }

  const combos = buildCombos()
  let newLeadsToday = 0
  let totalProcessed = 0
  let comboIndex = 0
  let round = 1

  // Keep looping through combos until daily target hit
  while (newLeadsToday < DAILY_TARGET && comboIndex < combos.length * 3) {
    const combo = combos[comboIndex % combos.length]
    comboIndex++
    if (comboIndex % combos.length === 0) {
      round++
      if (round > 3) {
        console.log('\n⚠️  Exhausted all combos × 3 rounds. Stopping.')
        break
      }
      console.log(`\n  ── Round ${round} (re-shuffling combos) ──`)
    }

    const needed = DAILY_TARGET - newLeadsToday
    const perCombo = Math.max(10, Math.ceil(needed / Math.max(1, combos.length - comboIndex + 1)))
    const tierLabel = combo.tier === 'tier2' ? '[T2 upgrade]' : '[T1 no-site]'

    console.log(`\n[${comboIndex}] ${tierLabel} ${combo.niche.toUpperCase()} — ${combo.city}, ${combo.state} (need ${needed} more)`)

    let leads: Lead[] = []
    let attempts = 0
    let success = false

    // Tier 2: scrape ALL (has website) then filter by bad score in pipeline
    // Tier 1: noWebsiteOnly = true
    const noWebsiteOnly = combo.tier === 'tier1'

    // Retry per combo
    while (attempts < MAX_RETRY && !success) {
      attempts++
      try {
        leads = await runMapsScraper({
          niche:         combo.niche,
          city:          combo.city,
          state:         combo.state,
          maxResults:    perCombo * 4,  // over-fetch — many will be filtered
          noWebsiteOnly,
          headless:      HEADLESS,
        })
        success = true
      } catch (e: any) {
        console.error(`  ✗ Attempt ${attempts}/${MAX_RETRY} failed: ${e.message}`)
        if (attempts < MAX_RETRY) {
          const wait = 5000 * attempts
          console.log(`  Retrying in ${wait / 1000}s...`)
          await new Promise(r => setTimeout(r, wait))
        }
      }
    }

    if (!success || leads.length === 0) {
      console.log(`  → No leads from this combo, skipping`)
      continue
    }

    // Save new leads to DB + Sheets
    let savedFromCombo = 0
    for (const lead of leads.slice(0, perCombo)) {
      totalProcessed++

      const exists = await leadExists(lead.place_id).catch(() => false)
      if (exists) continue

      // Tag tier before saving
      lead.tier = combo.tier

      const saved = await saveLead(lead).catch(() => null)
      if (!saved) continue

      newLeadsToday++
      savedFromCombo++

      console.log(`  ✓ [${newLeadsToday}/${DAILY_TARGET}] ${lead.name} | ${lead.phone}`)

      if (newLeadsToday >= DAILY_TARGET) break
    }

    console.log(`  Saved ${savedFromCombo} from ${combo.city} ${combo.niche}`)

    // Random pause between combos (3-8s) to appear human
    const pause = 3000 + Math.random() * 5000
    await new Promise(r => setTimeout(r, pause))
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  const newTotal = totalExisting + newLeadsToday

  // Sync full DB → sheet (replaces entire sheet — zero duplicates)
  if (SHEET_ID) await syncLeadsToSheet()

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`✅  Daily Scrape Complete`)
  console.log(`   New leads today : ${newLeadsToday}`)
  console.log(`   Total in DB     : ${newTotal} / ${TOTAL_CAP}`)
  console.log(`   Time elapsed    : ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`)
  if (SHEET_ID) console.log(`   Google Sheets   : synced ✓ (${newTotal} total rows)`)
  console.log(`${'═'.repeat(60)}\n`)

  if (newTotal >= TOTAL_CAP) {
    console.log(`🎯 Reached ${TOTAL_CAP} total leads! Time to build sites.`)
    console.log(`   Start pipeline: cd pipeline && npm run worker:enqueue`)
  }
}

main().catch(e => {
  console.error('\n💥 Daily scrape fatal error:', e.message)
  console.error(e.stack)
  process.exit(1)
})
