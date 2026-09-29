/**
 * Ad Winners CLI — research proven Meta ads for a niche/competitor.
 *
 * Usage:
 *   npx tsx src/scripts/ad-winners.ts "med spa botox"
 *   MIN_DAYS=90 MAX_ADS=50 npx tsx src/scripts/ad-winners.ts "hvac repair"
 *   HEADLESS=false npx tsx src/scripts/ad-winners.ts "junk removal"   # watch the browser
 *
 * Output: ad-research/<slug>-<date>.md — winners table + full teardown copy
 * plus a creative-brief block ready to paste into the ads planner.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { findWinningAds, winnersReport, winnersToCreativeBrief } from '../ads/winners.js'

async function main() {
  const searchTerm = process.argv.slice(2).join(' ').trim()
  if (!searchTerm) {
    console.error('Usage: npx tsx src/scripts/ad-winners.ts "<niche or competitor keywords>"')
    process.exit(1)
  }

  const minDays = Number(process.env.MIN_DAYS ?? 60)
  const maxAds = Number(process.env.MAX_ADS ?? 30)
  const country = process.env.AD_COUNTRY ?? 'US'
  const headless = process.env.HEADLESS !== 'false'

  const winners = await findWinningAds({ searchTerm, country, minDaysRunning: minDays, maxAds, headless })

  if (winners.length === 0) {
    console.log('[AdWinners] No proven winners found — try broader keywords or lower MIN_DAYS.')
    return
  }

  const outDir = join(process.cwd(), 'ad-research')
  mkdirSync(outDir, { recursive: true })
  const slug = searchTerm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const outFile = join(outDir, `${slug}-${new Date().toISOString().slice(0, 10)}.md`)

  writeFileSync(outFile, winnersReport(searchTerm, winners))
  console.log(`[AdWinners] Report written: ${outFile}`)

  console.log('\n──── Creative brief (paste into planner / Gemini) ────\n')
  console.log(winnersToCreativeBrief(winners))
}

main().catch((e) => { console.error(e); process.exit(1) })
