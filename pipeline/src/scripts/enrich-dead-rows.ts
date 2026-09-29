/**
 * enrich-dead-rows.ts — find phones for leads with no phone AND no email
 * Strategy: Google Maps Playwright search by business name + city
 *
 * Run: SHEET_TAB="Local SMBs" npx tsx --env-file=.env src/scripts/enrich-dead-rows.ts
 * Or all tabs: npx tsx --env-file=.env src/scripts/enrich-dead-rows.ts
 *
 * Env:
 *   SHEET_TAB       target tab (or all tabs if unset)
 *   DEAD_LIMIT      max dead rows to process per tab (default 500)
 *   DEAD_CONCUR     parallel pages within single browser (default 2)
 */
import { chromium, type BrowserContext } from 'playwright'
import { createSign } from 'crypto'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { lookupPhoneType } from '../tools/phone-lookup.js'

const SHEET_ID = process.env.LEADS_SHEET_ID!
const TAB_ARG  = process.env.SHEET_TAB ?? ''
const LIMIT    = parseInt(process.env.DEAD_LIMIT  ?? '500')
const CONCUR   = parseInt(process.env.DEAD_CONCUR ?? '2')

const ALL_TABS = [
  'Yelp_Dataset',
  'Local SMBs','MEDSPAS','USA_Restaurants','USA_FinancialAdvisorsandInsuranceAgents',
  'USA_DentalOffices','USA_Salons','USA_BarberShops','USA_SkinClinics',
  'USA_IVTherapy','USA_NailStudios','USA_LawFirms','USA_RealEstateAgents',
  'USA_AutoDetailing','USA_HVAC','USA_Roofing','USA_Remodeling','USA_Plumbing',
  'INDIA_DentalOffices','INDIA_MEDSPAS','India_Restaurants','USA_CosmeticSurgeons',
  'USA_AutoRepair','USA_MedicalOffices','USA_Fitness','USA_PetServices',
]

// ─── Sheets auth ─────────────────────────────────────────────────────────────

let _token: { v: string; exp: number } | null = null

async function getToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (_token && _token.exp > now + 60) return _token.v
  let sa: any
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  else if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) sa = JSON.parse(readFileSync(resolve(process.env.GOOGLE_SERVICE_ACCOUNT_FILE), 'utf8'))
  else throw new Error('No service account')
  const h = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const p = Buffer.from(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', exp: now+3600, iat: now })).toString('base64url')
  const s = createSign('RSA-SHA256'); s.update(`${h}.${p}`)
  const jwt = `${h}.${p}.${s.sign(sa.private_key,'base64url')}`
  const r = await (await fetch('https://oauth2.googleapis.com/token',{ method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`, signal:AbortSignal.timeout(30000) })).json() as any
  if (!r.access_token) throw new Error('Token: '+JSON.stringify(r))
  _token = { v: r.access_token, exp: now+3600 }
  return r.access_token
}

async function sheetGet(range: string): Promise<string[][]> {
  const t = await getToken()
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`, { headers:{ Authorization:`Bearer ${t}` } })
  if (!r.ok) return []
  const d = await r.json() as any
  return d.values ?? []
}

async function sheetBatchUpdate(tab: string, updates: { row: number; phone: string; phoneType: string; canSms: string }[]): Promise<void> {
  if (!updates.length) return
  // Write phone to col G, phone type + canSms to cols U:V
  const data = [
    ...updates.map(u => ({ range:`${tab}!G${u.row}`, values:[[u.phone]] })),
    ...updates.map(u => ({ range:`${tab}!U${u.row}:V${u.row}`, values:[[u.phoneType, u.canSms]] })),
  ]
  for (let attempt = 1; attempt <= 5; attempt++) {
    const t = await getToken()
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchUpdate`,{
      method:'POST', headers:{ Authorization:`Bearer ${t}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ valueInputOption:'RAW', data }),
      signal: AbortSignal.timeout(30000),
    })
    if (res.ok) return
    const err = await res.json() as any
    const code = err?.error?.code
    if (code===429 || (code>=500&&code<600)) await new Promise(r=>setTimeout(r, attempt*15000))
    else throw new Error('Sheet write: '+JSON.stringify(err))
  }
}

// ─── Google Maps phone lookup ─────────────────────────────────────────────────

function cleanName(raw: string): string {
  // Strip keyword-stuffed suffixes after –, |, ·, · etc.
  return raw.split(/[–|·]|\s{2,}/)[0].trim()
}

async function mapsPhone(ctx: BrowserContext, name: string, city: string, state: string): Promise<string|null> {
  const page = await ctx.newPage()
  try {
    const cleanedName = cleanName(name)
    const loc = state ? `${city} ${state}` : city
    const url = `https://www.google.com/maps/search/${encodeURIComponent(`${cleanedName} ${loc}`)}`
    await page.goto(url, { waitUntil:'domcontentloaded', timeout:20000 })
    await page.waitForTimeout(1500)

    // If Maps redirected straight to a place page, extract phone immediately
    if (page.url().includes('/maps/place/')) {
      return await extractPhone(page)
    }

    // Otherwise we're on search results — click first listing
    const firstResult = page.locator('[role="feed"] a[href*="/maps/place/"], .Nv2PK a[href*="/maps/place/"]').first()
    const count = await firstResult.count()
    if (!count) return null

    await firstResult.click()
    await page.waitForURL('**/maps/place/**', { timeout:10000 })
    await page.waitForTimeout(1000)

    return await extractPhone(page)
  } catch {
    return null
  } finally {
    await page.close().catch(()=>{})
  }
}

async function extractPhone(page: import('playwright').Page): Promise<string|null> {
  const selectors = [
    '[data-item-id^="phone:tel:"]',
    'button[data-item-id*="phone"]',
    '[aria-label*="Phone"]',
    '[data-tooltip*="phone"]',
  ]
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first()
      if (await el.count() > 0) {
        const itemId = await el.getAttribute('data-item-id').catch(()=>null)
        if (itemId?.startsWith('phone:tel:')) return itemId.replace('phone:tel:','')
        const label = await el.getAttribute('aria-label').catch(()=>null)
        if (label) {
          const m = label.match(/[\+\d\(\)\-\s]{7,}/)
          if (m) return m[0].trim()
        }
      }
    } catch { /* next */ }
  }
  return null
}

// ─── Process one tab ──────────────────────────────────────────────────────────

async function processTab(tab: string, ctx: BrowserContext): Promise<{ found: number; notFound: number }> {
  console.log(`\n${'─'.repeat(60)}\n📋  ${tab}`)

  const rows = await sheetGet(`${tab}!A2:V`)
  if (!rows.length) { console.log('  empty'); return { found:0, notFound:0 } }

  // Dead = no phone (col G = idx 6) AND no email (col H=7, S=18, T=19)
  const dead: { rowNum:number; name:string; city:string; state:string }[] = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (!(r[6]??'') && !(r[7]??'') && !(r[18]??'') && !(r[19]??'')) {
      dead.push({ rowNum:i+2, name:r[1]??'', city:r[3]??'', state:r[4]??'' })
    }
  }

  const todo = dead.slice(0, LIMIT)
  console.log(`  Dead rows: ${dead.length}  |  This run: ${todo.length}`)
  if (!todo.length) { console.log('  ✅ No dead rows'); return { found:0, notFound:0 } }

  let found=0, notFound=0
  const pending: { row:number; phone:string; phoneType:string; canSms:string }[] = []

  let next = 0
  async function worker() {
    while (next < todo.length) {
      const idx = next++
      const { rowNum, name, city, state } = todo[idx]
      if (!name) { notFound++; continue }

      const phone = await mapsPhone(ctx, name, city, state)
      if (phone) {
        const { lineType, canSms } = lookupPhoneType(phone, state)
        pending.push({ row:rowNum, phone, phoneType:lineType, canSms:canSms?'YES':'NO' })
        found++
        console.log(`  [${idx+1}/${todo.length}] ✓ ${phone} (${lineType||'?'}) — ${name}, ${city}`)
      } else {
        notFound++
        if ((idx+1) % 25 === 0 || idx < 3) console.log(`  [${idx+1}/${todo.length}] – no phone — ${cleanName(name)}, ${city}`)
      }

      // Write batch every 50 finds
      if (pending.length >= 50) {
        const batch = pending.splice(0)
        await sheetBatchUpdate(tab, batch)
        console.log(`  💾 Wrote ${batch.length} phones`)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCUR, todo.length) }, worker))

  if (pending.length) {
    await sheetBatchUpdate(tab, pending)
    console.log(`  💾 Wrote ${pending.length} phones`)
  }

  console.log(`  ✅ Found: ${found} | Not on Maps: ${notFound}`)
  return { found, notFound }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }

  const tabs = TAB_ARG ? [TAB_ARG] : ALL_TABS

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`📍  Dead Row Enricher (Google Maps) — ${new Date().toISOString().split('T')[0]}`)
  console.log(`   Tabs: ${tabs.length}  |  Limit/tab: ${LIMIT}  |  Concur: ${CONCUR}`)
  console.log(`${'═'.repeat(60)}`)

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-blink-features=AutomationControlled'],
  })
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    viewport: { width:1280, height:900 },
  })

  let totalFound=0, totalNotFound=0
  try {
    for (const tab of tabs) {
      try {
        const { found, notFound } = await processTab(tab, ctx)
        totalFound += found; totalNotFound += notFound
      } catch(e:any) { console.error(`  ✗ ${tab}: ${e.message}`) }
    }
  } finally {
    await browser.close()
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`✅  Done — Found: ${totalFound} | Not found: ${totalNotFound}`)
  console.log(`   Hit rate: ${totalFound ? (totalFound/(totalFound+totalNotFound)*100).toFixed(1)+'%' : '0%'}`)
  console.log(`${'═'.repeat(60)}\n`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
