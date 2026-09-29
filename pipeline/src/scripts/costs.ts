/**
 * costs.ts — view pipeline spend
 * Usage:
 *   npx tsx src/scripts/costs.ts          → last 30 days
 *   npx tsx src/scripts/costs.ts --days 7 → last 7 days
 *   npx tsx src/scripts/costs.ts --total  → all-time totals
 */
import 'dotenv/config'
import { getDailySpend, getTotalSpend, UNIT_COSTS } from '../tools/cost-tracker.js'

const args  = process.argv.slice(2)
const days  = Number(args[args.indexOf('--days') + 1] || 30)
const total = args.includes('--total')

const fmt = (n: number) => `$${n.toFixed(4)}`

void (async () => {
  if (total) {
    const { total_usd, by_service } = await getTotalSpend()
    console.log('\n══════════════════════════════════════')
    console.log('  ALL-TIME PIPELINE SPEND')
    console.log('══════════════════════════════════════')
    for (const [svc, d] of Object.entries(by_service).sort((a,b) => b[1].total_usd - a[1].total_usd)) {
      console.log(`  ${svc.padEnd(16)} ${String(d.units).padStart(6)} units   ${fmt(d.total_usd)}`)
    }
    console.log('──────────────────────────────────────')
    console.log(`  TOTAL                               ${fmt(total_usd)}`)
    console.log('══════════════════════════════════════\n')
    process.exit(0)
  }

  const days_data = await getDailySpend(days)

  console.log(`\n══════════════════════════════════════════════════`)
  console.log(`  DAILY PIPELINE SPEND  (last ${days} days)`)
  console.log(`══════════════════════════════════════════════════`)

  if (days_data.length === 0) {
    console.log('  No paid API calls recorded yet.')
    console.log(`  (logCost() is called from agents during pipeline runs)\n`)
    console.log('  Pricing reference:')
    for (const [svc, cost] of Object.entries(UNIT_COSTS)) {
      if (cost > 0) console.log(`    ${svc.padEnd(16)} ${fmt(cost)}/unit`)
      else          console.log(`    ${svc.padEnd(16)} FREE`)
    }
  } else {
    let grand = 0
    for (const day of days_data) {
      console.log(`\n  ${day.date}   TOTAL: ${fmt(day.total_usd)}`)
      for (const s of day.services) {
        console.log(`    ${s.service.padEnd(16)} ${String(s.units).padStart(4)} × ${fmt(Number(UNIT_COSTS[s.service as keyof typeof UNIT_COSTS]) || 0)}  = ${fmt(s.total_usd)}`)
      }
      grand += day.total_usd
    }
    console.log(`\n──────────────────────────────────────────────────`)
    console.log(`  ${days}-day total:  ${fmt(grand)}`)
  }

  console.log('══════════════════════════════════════════════════\n')
  process.exit(0)
})()
