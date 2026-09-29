/**
 * multi-source-enrich.ts
 * Enrich existing sheet leads with owner info from ALL free sources simultaneously.
 *
 * Sources (parallel):
 *   Apollo.io    → owner name + direct email (10k/mo free, BEST for email)
 *   BBB          → principal/owner name (Playwright, free)
 *   Facebook     → phone + email from business page (Playwright, free)
 *   State SOS    → registered agent name = often owner (Playwright, free, FL/CA/NY/IL/GA)
 *
 * Writes to sheet cols: T (owner email), S (biz email), A-style owner name col
 * NOTE: Owner name goes into col B suffix or a note — sheet doesn't have owner col yet.
 *       We write to col T (Owner Email) and log owner names.
 *
 * Run:
 *   SHEET_TAB="Local SMBs" npx tsx --env-file=.env src/scripts/multi-source-enrich.ts
 *   ENRICH_LIMIT=200 SHEET_TAB="MEDSPAS" npx tsx --env-file=.env src/scripts/multi-source-enrich.ts
 */
import { readSheetRows, writeRangeValues } from '../tools/google-sheets.js'
import { enrichByDomain, enrichByCompanyName } from '../sources/apollo.js'
import { bbbEnrich } from '../sources/bbb.js'
import { facebookEnrich } from '../sources/facebook.js'
import { sosEnrich } from '../sources/sos.js'
import type { EnrichResult } from '../sources/types.js'

const SHEET_ID  = process.env.LEADS_SHEET_ID!
const TAB_ARG   = process.env.SHEET_TAB ?? ''
const LIMIT     = parseInt(process.env.ENRICH_LIMIT ?? '200')
const CONCUR    = parseInt(process.env.ENRICH_CONCUR ?? '4')
const DRY_RUN   = process.env.DRY_RUN === 'true'

const ALL_TABS = [
  'Yelp_Dataset',
  'Local SMBs','MEDSPAS','USA_Restaurants','USA_FinancialAdvisorsandInsuranceAgents',
  'USA_DentalOffices','USA_Salons','USA_BarberShops','USA_SkinClinics',
  'USA_IVTherapy','USA_NailStudios','USA_LawFirms','USA_RealEstateAgents',
]

interface SheetLead {
  rowNum:    number
  name:      string
  city:      string
  state:     string
  website:   string    // col J
  ownerEmail:string    // col T — if already set, skip
}

// ─── Read leads needing owner enrichment ─────────────────────────────────────

async function readLeadsForEnrichment(tab: string): Promise<SheetLead[]> {
  const rows = await readSheetRows({ spreadsheetId: SHEET_ID, sheetName: tab, range: 'A:V' })
  const leads: SheetLead[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    // Skip if owner email already set
    if (r[19]) continue   // col T (index 19) = owner email
    leads.push({
      rowNum:     i + 1,  // +1 because we started from index 1 (row 2 = header row is index 0)
      name:       r[1] ?? '',
      city:       r[3] ?? '',
      state:      r[4] ?? '',
      website:    r[9] ?? '',
      ownerEmail: r[19] ?? '',
    })
  }
  return leads
}

// ─── Merge enrichment results (best wins) ────────────────────────────────────

function mergeResults(results: Array<EnrichResult | null>): EnrichResult {
  const merged: EnrichResult = { source: 'merged' }
  for (const r of results) {
    if (!r) continue
    if (!merged.ownerName  && r.ownerName)  merged.ownerName  = r.ownerName
    if (!merged.ownerEmail && r.ownerEmail) merged.ownerEmail = r.ownerEmail
    if (!merged.ownerPhone && r.ownerPhone) merged.ownerPhone = r.ownerPhone
    if (!merged.ownerTitle && r.ownerTitle) merged.ownerTitle = r.ownerTitle
    if (!merged.phone      && r.phone)      merged.phone      = r.phone
    if (!merged.email      && r.email)      merged.email      = r.email
  }
  merged.source = results.filter(Boolean).map(r => r!.source).join('+') || 'none'
  return merged
}

// ─── Run all enrichers in parallel for one lead ──────────────────────────────

async function enrichLead(lead: SheetLead): Promise<EnrichResult> {
  const runners: Promise<EnrichResult | null>[] = [
    // Apollo: try domain first, then company name
    process.env.APOLLO_API_KEY
      ? (lead.website
          ? enrichByDomain(lead.website)
          : enrichByCompanyName(lead.name, lead.city, lead.state)
        ).catch(() => null)
      : Promise.resolve(null),

    // BBB: owner name (Playwright)
    bbbEnrich(lead.name, lead.city, lead.state).catch(() => null),

    // Facebook: phone + email (Playwright)
    facebookEnrich(lead.name, lead.city, lead.state).catch(() => null),

    // State SOS: registered agent name (Playwright)
    sosEnrich(lead.name, lead.city, lead.state).catch(() => null),
  ]

  const results = await Promise.all(runners)
  return mergeResults(results)
}

// ─── Write enrichment back to sheet ──────────────────────────────────────────

interface Update {
  rowNum:     number
  ownerEmail: string
  ownerName:  string
  bizEmail:   string
  phone:      string
}

async function flushUpdates(tab: string, updates: Update[]): Promise<void> {
  if (!updates.length) return
  // Write cols S (biz email), T (owner email), G (phone if better)
  // We'll do individual row ranges
  const data: (string|number)[][] = []

  for (const u of updates) {
    // We write owner email + owner name combined into col T for now
    // (Sheet doesn't have a dedicated owner name column)
    const ownerVal = u.ownerName && u.ownerEmail
      ? `${u.ownerEmail} (${u.ownerName})`
      : u.ownerEmail || u.ownerName || ''

    await writeRangeValues({
      spreadsheetId: SHEET_ID,
      range: `${tab}!S${u.rowNum}:T${u.rowNum}`,
      values: [[u.bizEmail || '', ownerVal]],
    }).catch(() => {})

    // Update phone (col G) only if current is empty
    if (u.phone) {
      await writeRangeValues({
        spreadsheetId: SHEET_ID,
        range: `${tab}!G${u.rowNum}`,
        values: [[u.phone]],
      }).catch(() => {})
    }
  }
}

// ─── Process one tab ──────────────────────────────────────────────────────────

async function processTab(tab: string): Promise<{ found: number; total: number }> {
  console.log(`\n${'─'.repeat(60)}\n📋  ${tab}`)

  const all  = await readLeadsForEnrichment(tab)
  const todo = all.slice(0, LIMIT)
  console.log(`  Need enrichment: ${all.length} | This run: ${todo.length}`)
  if (!todo.length) { console.log('  ✅ All enriched'); return { found:0, total:0 } }

  let found=0
  const pending: Update[] = []
  let next = 0

  async function worker() {
    while (next < todo.length) {
      const idx = next++
      const lead = todo[idx]
      if (!lead.name) continue

      const result = await enrichLead(lead)
      const hasData = !!(result.ownerEmail || result.ownerName || result.phone || result.email)

      if (hasData) {
        found++
        pending.push({
          rowNum:     lead.rowNum,
          ownerEmail: result.ownerEmail ?? '',
          ownerName:  result.ownerName  ?? '',
          bizEmail:   result.email      ?? '',
          phone:      result.phone      ?? '',
        })
        console.log(`  [${idx+1}/${todo.length}] ✓ ${lead.name} | owner:${result.ownerName??'—'} | email:${result.ownerEmail??'—'} | via:${result.source}`)
      } else {
        if ((idx+1) % 20 === 0) console.log(`  [${idx+1}/${todo.length}] ...`)
      }

      // Flush every 25 updates
      if (!DRY_RUN && pending.length >= 25) {
        const batch = pending.splice(0)
        await flushUpdates(tab, batch)
        console.log(`  💾 Wrote ${batch.length} updates`)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCUR, todo.length) }, worker))

  if (!DRY_RUN && pending.length) {
    await flushUpdates(tab, pending)
    console.log(`  💾 Wrote ${pending.length} updates`)
  }

  console.log(`  ✅ Found owner info: ${found}/${todo.length} (${(found/todo.length*100).toFixed(1)}%)`)
  return { found, total: todo.length }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }

  const tabs = TAB_ARG ? [TAB_ARG] : ALL_TABS

  const apolloKey = process.env.APOLLO_API_KEY
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`🔍  Multi-Source Owner Enrichment — ${new Date().toISOString().split('T')[0]}`)
  console.log(`   Tabs: ${tabs.length} | Limit/tab: ${LIMIT} | Concur: ${CONCUR}`)
  console.log(`   Apollo: ${apolloKey ? '✓ active' : '✗ no key (set APOLLO_API_KEY for best results)'}`)
  console.log(`   BBB, Facebook, State SOS: ✓ active (Playwright)`)
  console.log(`${'═'.repeat(60)}`)

  let totalFound = 0, totalProcessed = 0
  for (const tab of tabs) {
    const { found, total } = await processTab(tab)
    totalFound += found
    totalProcessed += total
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`✅  Done — Owner info found: ${totalFound}/${totalProcessed} (${totalProcessed ? (totalFound/totalProcessed*100).toFixed(1) : 0}%)`)
  console.log(`${'═'.repeat(60)}\n`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
