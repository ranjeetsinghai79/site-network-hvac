/**
 * sheets-sms-outreach.ts
 *
 * SMS outreach for scraped leads in Google Sheet — CONSENT-GATED (TCPA).
 * Only sends to numbers with an active consent_events row (captured by the
 * CF Worker on form submit or inbound reply). Cold leads with no consent are
 * skipped — use sheets-outreach.ts (email) for cold outreach instead.
 * Override (you accept the legal risk): ALLOW_COLD_SMS=true
 *
 * Reads phone (col G), can_sms (col V), sends T1/T2 pitch via Twilio.
 * Marks col W "SMS-SENT YYYY-MM-DD" — skips already-sent rows on next run.
 *
 * Tier 1 (no website): free demo site pitch → webcrew.app
 * Tier 2 (has website): AI reception pitch → webcrew.app
 *
 * Usage:
 *   cd pipeline && npx tsx src/scripts/sheets-sms-outreach.ts
 *   SHEET_TAB="Local SMBs" BATCH_SIZE=200 npx tsx src/scripts/sheets-sms-outreach.ts
 *   DRY_RUN=true BATCH_SIZE=50 npx tsx src/scripts/sheets-sms-outreach.ts
 *
 * Recommended daily runs:
 *   Week 1-2: BATCH_SIZE=500  (ramp up, test delivery rates)
 *   Week 3+ : BATCH_SIZE=1000 (safe 10DLC limit per number)
 *   Scale   : BATCH_SIZE=3000 (max 10DLC standard = 3,600/day)
 *
 * Cost: $0.0079/SMS (Twilio). 1000/day = $237/month.
 */

import 'dotenv/config'
import pg from 'pg'
import { readSheetRows, updateSheetCell } from '../tools/google-sheets.js'
import { loadTextableSet, consentSetAllows } from '../tools/sms-consent.js'

const SPREADSHEET_ID = process.env.LEADS_SHEET_ID!
const DRY_RUN        = process.env.DRY_RUN === 'true'
const BATCH_SIZE     = parseInt(process.env.BATCH_SIZE ?? '200', 10)
const SHEET_TAB      = process.env.SHEET_TAB ?? ''

// DB pool — upsert leads so CF Worker can look them up by phone on reply
let _pool: pg.Pool | null = null
function getPool(): pg.Pool | null {
  if (!process.env.DATABASE_URL) return null
  if (!_pool) _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  return _pool
}

async function upsertLeadByPhone(
  phone: string, name: string, niche: string, city: string,
  state: string, hasWebsite: boolean, tab: string
): Promise<void> {
  const pool = getPool()
  if (!pool) return
  const place_id = `sheet_${tab}_${phone.replace(/\D/g, '')}`
  await pool.query(`
    INSERT INTO leads (place_id, name, phone, niche, city, state, source, sms_sent, sms_sent_at, status, tier)
    VALUES ($1,$2,$3,$4,$5,$6,'sheet',true,NOW(),'sms_sent',$7)
    ON CONFLICT (place_id) DO UPDATE SET
      sms_sent=true, sms_sent_at=COALESCE(leads.sms_sent_at,NOW()), updated_at=NOW()
  `, [place_id, name, phone, niche, city, state, hasWebsite ? 'tier2' : 'tier1']).catch(() => {})
}

// Twilio credentials
const TWILIO_SID  = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER!
const SMS_DRY_RUN = process.env.SMS_DRY_RUN === 'true'

// Column indices (0-based) in the 22-col header from scrape-universal.ts
const COL = {
  NAME:       1,   // B — Business Name
  NICHE:      2,   // C — Niche / Category
  CITY:       3,   // D — City
  PHONE:      6,   // G — Phone
  HAS_WEBSITE: 8,  // I — Has Website (YES/NO)
  WEBSITE:    9,   // J — Website URL
  TIER:       16,  // Q — Tier (tier1/tier2)
  PHONE_TYPE: 20,  // U — Phone Type
  CAN_SMS:    21,  // V — Can SMS (YES/NO)
  SMS_SENT:   22,  // W — written by this script: "SMS-SENT YYYY-MM-DD"
}

// Priority tabs — ordered by conversion potential
const ALL_TABS = [
  'Local SMBs',
  'MEDSPAS',
  'USA_Salons',
  'USA_BarberShops',
  'USA_NailStudios',
  'USA_SkinClinics',
  'USA_IVTherapy',
  'USA_FinancialAdvisorsandInsuranceAgents',
  'USA_Restaurants',
  'USA_DentalOffices',
  'USA_LawFirms',
  'USA_RealEstateAgents',
  'Yelp_Dataset',
]

// Live demo URLs per niche — lead can SEE a real site, not just webcrew.app
const DEMO_URLS: Record<string, string> = {
  hvac:                   'demo-hvac.pages.dev',
  roofing:                'demo-roofing.pages.dev',
  plumbing:               'demo-plumbing.pages.dev',
  cleaning:               'demo-cleaning.pages.dev',
  landscaping:            'demo-landscaping.pages.dev',
  'auto-detailing':       'demo-auto-detailing.pages.dev',
  remodeling:             'demo-remodeling.pages.dev',
  dentist:                'demo-dentist.pages.dev',
  medspa:                 'demo-medspa.pages.dev',
  'medspa-usa':           'demo-medspa.pages.dev',
  'botox-clinic':         'demo-medspa.pages.dev',
  'aesthetic-clinic':     'demo-medspa.pages.dev',
  'skin-clinic':          'demo-medspa.pages.dev',
  'cosmetic-dermatology': 'demo-medspa.pages.dev',
  'laser-clinic':         'demo-medspa.pages.dev',
  salon:                  'demo-salon.pages.dev',
  barbershop:             'demo-barbershop.pages.dev',
}

function buildSmsBody(name: string, niche: string, city: string, isTier2: boolean): string {
  const label = name.length > 30 ? name.slice(0, 28) + '…' : name

  if (isTier2) {
    // Has website — AI front office pitch, Sofia voice, no price anchor
    return `Hi! Sofia from WebCrew — quick one.\n\nWe set up a free 24/7 AI receptionist for ${label} — answers every call, books appointments automatically, runs your front office end to end. Free to try, cancel anytime.\n\nWant to hear it in action? Reply YES. Reply STOP to opt out.`
  } else {
    // No website — same AI front office pitch, website mentioned as included
    return `Hi! Sofia from WebCrew — quick one.\n\nWe set up a free 24/7 AI receptionist for ${label} — answers every call, books appointments automatically, and runs your front office end to end. Website's included too, no upfront cost.\n\nWant to see it in action? Reply YES. Reply STOP to opt out.`
  }
}

// Twilio's inbound webhook always reports `From` in E.164 — the CF Worker
// looks up leads by exact phone match, so the DB row must be stored in the
// same format the outbound send used, not the sheet's raw formatting.
function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10) return null
  return digits.startsWith('1') ? `+${digits}` : `+1${digits}`
}

async function sendSms(to: string, body: string): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_FROM) {
    console.error('[SMS] Missing Twilio env vars (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER)')
    return false
  }

  const e164 = toE164(to)
  if (!e164) return false

  if (SMS_DRY_RUN) {
    console.log(`  [DRY-TWILIO] Would send to ${e164}: "${body.slice(0, 60)}..."`)
    return true
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: e164, From: TWILIO_FROM, Body: body }).toString(),
    }
  )

  const data = await res.json() as any
  if (!res.ok) {
    console.warn(`  [SMS] Twilio error: ${data?.message ?? JSON.stringify(data)}`)
    return false
  }
  return true
}

async function processTab(
  tabName: string,
  stats: { sent: number; skipped: number; noPhone: number; noSms: number; noConsent: number },
  consentSet: Set<string>,
): Promise<void> {
  console.log(`\n── Tab: ${tabName} ──`)

  let rows: string[][]
  try {
    // Default range is A:T — CAN_SMS (V) and SMS_SENT (W) live past that, so
    // without an explicit wider range both always read back undefined. That
    // silently defeated the already-sent guard: this script re-sent the same
    // "cold open" pitch to the same number every single day (confirmed via
    // Twilio logs — one lead got it 7 days running before this was caught).
    rows = await readSheetRows({ spreadsheetId: SPREADSHEET_ID, sheetName: tabName, range: 'A:W' })
  } catch (e: any) {
    console.log(`  ✗ Could not read tab: ${e.message}`)
    return
  }

  if (rows.length <= 1) { console.log('  Empty tab'); return }
  console.log(`  ${rows.length - 1} data rows`)

  for (let i = 1; i < rows.length; i++) {
    if (stats.sent >= BATCH_SIZE) break

    const row      = rows[i]
    const sheetRow = i + 1  // 1-indexed

    const phone    = row[COL.PHONE]?.trim()
    const canSms   = row[COL.CAN_SMS]?.trim()?.toUpperCase()
    const smsSent  = row[COL.SMS_SENT]?.trim()
    const name     = row[COL.NAME]?.trim() || 'Business'
    const niche    = row[COL.NICHE]?.trim() || 'local business'
    const city     = row[COL.CITY]?.trim() || 'your area'
    const tier     = row[COL.TIER]?.trim()?.toLowerCase()
    const hasWeb   = row[COL.HAS_WEBSITE]?.trim()?.toUpperCase()

    // Skip already-sent
    if (smsSent?.startsWith('SMS-SENT')) { stats.skipped++; continue }

    // Skip no phone
    if (!phone || phone.length < 10) { stats.noPhone++; continue }

    // Skip confirmed no-SMS (landlines in non-US, toll-free, etc)
    if (canSms === 'NO') { stats.noSms++; continue }

    // TCPA gate — no active consent, or leads.sms_opt_out=true → no SMS
    if (!consentSetAllows(consentSet, phone)) { stats.noConsent++; continue }

    const isTier2 = tier === 'tier2' || hasWeb === 'YES'
    const body = buildSmsBody(name, niche, city, isTier2)
    const today = new Date().toISOString().slice(0, 10)

    if (DRY_RUN) {
      console.log(`  [DRY] Row ${sheetRow}: ${name} (${phone}) → ${isTier2 ? 'T2 AI-reception' : 'T1 free-site'} pitch`)
      stats.sent++
      continue
    }

    const ok = await sendSms(phone, body)
    if (ok) {
      // Mark col W as SMS-SENT. Must not fail silently — an unmarked row
      // gets re-sent to on every future run (this is exactly how one lead
      // got the same pitch 7 days in a row before the A:T read-range bug
      // above was found and fixed).
      try {
        const marked = await updateSheetCell({
          spreadsheetId: SPREADSHEET_ID,
          sheetName:     tabName,
          row:           sheetRow,
          col:           COL.SMS_SENT + 1,  // 1-indexed
          value:         `SMS-SENT ${today}`,
        })
        if (!marked) console.error(`  [!] Row ${sheetRow} (${name}) sent but SMS-SENT marker FAILED to write — will re-send next run`)
      } catch (e: any) {
        console.error(`  [!] Row ${sheetRow} (${name}) sent but marker write threw: ${e.message} — will re-send next run`)
      }

      // Write to Neon so CF Worker can look up this lead by phone on inbound reply.
      // Must be E.164 — Twilio's inbound `From` is always E.164, and the worker
      // matches by exact string, so a raw sheet-formatted number here silently
      // breaks the lookup (lead comes back empty on every "YES"/"Interest" reply).
      const state = row[4]?.trim() ?? ''
      const e164Phone = toE164(phone)
      if (e164Phone) {
        await upsertLeadByPhone(e164Phone, name, niche, city, state, isTier2, tabName)
      } else {
        console.error(`  [!] Row ${sheetRow} (${name}) sent but phone "${phone}" didn't normalize — CF Worker won't find this lead on reply`)
      }

      const pitch = isTier2 ? '[T2 AI-reception]' : '[T1 free-site]'
      console.log(`  ✓ [${stats.sent + 1}/${BATCH_SIZE}] ${pitch} ${name} | ${phone} | ${city}`)
      stats.sent++
    } else {
      console.log(`  ✗ ${name} | ${phone} — SMS failed`)
    }

    // 350ms between sends — stays well under Twilio 10DLC rate limit
    if (!DRY_RUN && !SMS_DRY_RUN) {
      await new Promise(r => setTimeout(r, 350))
    }
  }
}

async function main() {
  if (!SPREADSHEET_ID) { console.error('LEADS_SHEET_ID not set'); process.exit(1) }
  if (!DRY_RUN && !TWILIO_SID) { console.error('TWILIO_ACCOUNT_SID not set'); process.exit(1) }

  const tabs = SHEET_TAB ? [SHEET_TAB] : ALL_TABS

  console.log('═══════════════════════════════════════════════════════════')
  console.log(`📱  Sheets SMS Outreach`)
  console.log(`    Tabs      : ${tabs.join(', ')}`)
  console.log(`    Batch size: ${BATCH_SIZE} messages`)
  console.log(`    Dry run   : ${DRY_RUN}`)
  console.log(`    SMS dry   : ${SMS_DRY_RUN}`)
  console.log(`    Est cost  : $${(BATCH_SIZE * 0.0079).toFixed(2)} (at $0.0079/SMS)`)
  console.log('═══════════════════════════════════════════════════════════')

  // TCPA gate — load textable numbers once: active consent AND not opted out
  // (leads.sms_opt_out). A consent_events-only check would miss a lead who
  // opted out via the Worker's STOP handler but still has an old, unrevoked
  // consent_events row.
  const consentSet = await loadTextableSet()
  if (consentSet.has('*')) {
    console.log('    Consent   : GATE BYPASSED (ALLOW_COLD_SMS=true)')
  } else {
    console.log(`    Consent   : ${consentSet.size} numbers with active SMS consent`)
    if (consentSet.size === 0) {
      console.log('\n⛔  No consented numbers on file — nothing to send.')
      console.log('    Cold leads get EMAIL outreach: npx tsx src/scripts/sheets-outreach.ts')
      console.log('    SMS unlocks per-lead once they submit the webcrew.app form or reply to an email/SMS.')
      console.log('    (Override at your own TCPA risk: ALLOW_COLD_SMS=true)')
      return
    }
  }

  const stats = { sent: 0, skipped: 0, noPhone: 0, noSms: 0, noConsent: 0 }

  for (const tab of tabs) {
    if (stats.sent >= BATCH_SIZE) break
    await processTab(tab, stats, consentSet)
  }

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('SUMMARY')
  console.log(`  Sent         : ${stats.sent}`)
  console.log(`  Already sent : ${stats.skipped}`)
  console.log(`  No phone     : ${stats.noPhone}`)
  console.log(`  No SMS       : ${stats.noSms}`)
  console.log(`  No consent   : ${stats.noConsent}  (TCPA gate — email these via sheets-outreach.ts)`)
  if (!DRY_RUN && !SMS_DRY_RUN) {
    console.log(`  Cost         : ~$${(stats.sent * 0.0079).toFixed(2)}`)
  }
  console.log('═══════════════════════════════════════════════════════════')
}

main().catch(e => { console.error(e); process.exit(1) })
