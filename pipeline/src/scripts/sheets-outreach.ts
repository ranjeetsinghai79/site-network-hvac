/**
 * sheets-outreach.ts
 *
 * Reads all 12 Google Sheets tabs, finds uncontacted leads with email,
 * sends cold intro email (T1: free demo pitch, T2: free audit pitch),
 * marks column S "SENT YYYY-MM-DD" when done.
 *
 * Usage:
 *   cd pipeline && npx tsx src/scripts/sheets-outreach.ts
 *   SHEET_TAB="MEDSPAS" npx tsx src/scripts/sheets-outreach.ts    # one tab
 *   BATCH_SIZE=50 npx tsx src/scripts/sheets-outreach.ts          # more per run
 *   DRY_RUN=true npx tsx src/scripts/sheets-outreach.ts           # preview only
 */

import 'dotenv/config'
import { readSheetRows, updateSheetCell } from '../tools/google-sheets.js'

const SPREADSHEET_ID = process.env.LEADS_SHEET_ID!
const DRY_RUN        = process.env.DRY_RUN === 'true'
const BATCH_SIZE     = parseInt(process.env.BATCH_SIZE ?? '20', 10)
const RESEND_KEY     = process.env.RESEND_API_KEY!
const FROM_EMAIL     = process.env.OUTREACH_FROM_EMAIL ?? 'pavan@medspaos.com'

// MedSpaOS: outreach to med spas only
const ALL_TABS = [
  'MEDSPAS',
  'USA_SkinClinics',
  'USA_IVTherapy',
]

// Column indices (0-based) — 22-column header (A-V)
const COL = {
  NAME:         1,   // B
  NICHE:        2,   // C
  CITY:         3,   // D
  EMAIL:        7,   // H — general email (legacy / first source)
  HAS_WEBSITE:  8,   // I
  WEBSITE_URL:  9,   // J
  TIER:         16,  // Q
  OUTREACH:     18,  // S — written by this script (Business Email col reused as outreach flag)
  BIZ_EMAIL:    18,  // S — Business Email (enriched)
  OWNER_EMAIL:  19,  // T — Owner Email (enriched)
}

async function sendEmail(params: { to: string; subject: string; html: string }): Promise<boolean> {
  if (!RESEND_KEY) { console.error('[Sheets Outreach] No RESEND_API_KEY'); return false }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: params.to, subject: params.subject, html: params.html }),
  })
  if (!res.ok) { console.error('[Sheets Outreach] Resend error:', await res.text()); return false }
  return true
}

function buildT1Email(name: string, niche: string, city: string): { subject: string; html: string } {
  const subject = `Quick question about ${name}'s patient follow-up`
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F5;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #EDE6DC;">
        <tr>
          <td style="background:#1a1613;padding:36px 40px 28px;">
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.45);font-size:11px;letter-spacing:3px;text-transform:uppercase;">MedSpaOS — AI Revenue OS for Med Spas</p>
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;line-height:1.3;">We don't sell ${name} more leads.</h1>
            <p style="margin:8px 0 0;color:#B8832A;font-size:15px;font-weight:600;">We turn the patients you already have into revenue.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.7;">
              Hi — I'm Pavan. I work with independent med spas in ${city} to recover revenue that's already slipping through.
            </p>
            <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">
              Most med spas lose $3–8k/month from three things that are fully fixable with AI:
            </p>
            <table cellpadding="0" cellspacing="8" style="margin:0 0 24px;width:100%;border:1px solid #EDE6DC;border-radius:10px;overflow:hidden;">
              ${[
                ['📞', 'Missed calls that never call back', 'AI answers every call 24/7, books the appointment.'],
                ['📅', 'No-shows that aren\'t followed up', 'AI re-engages within 2 hours, recovers 60% of slots.'],
                ['💬', 'Consults that didn\'t book a treatment', 'AI sends a 3-touch follow-up sequence — 30% convert.'],
              ].map(([icon, title, desc], idx, arr) => `
              <tr style="${idx < arr.length - 1 ? 'border-bottom:1px solid #EDE6DC;' : ''}">
                <td style="padding:14px 18px;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="padding-right:14px;font-size:20px;vertical-align:top;">${icon}</td>
                    <td>
                      <strong style="color:#1a1613;font-size:14px;display:block;">${title}</strong>
                      <span style="color:#6b7280;font-size:13px;">${desc}</span>
                    </td>
                  </tr></table>
                </td>
              </tr>`).join('')}
            </table>
            <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.7;">
              I'm talking to 10 med spas this month to validate this. If ${name} wants to be one of them, I'll personally walk you through what we'd set up — no pitch, just the numbers.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#1a1613;border-radius:10px;">
                  <a href="https://medspaos.com?utm_source=sheets&utm_medium=email&utm_campaign=t1-cold" style="display:block;padding:16px 32px;color:#fff;text-decoration:none;font-size:15px;font-weight:700;text-align:center;">
                    See How MedSpaOS Works →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;color:#9B8E84;font-size:12px;line-height:1.6;">
              Questions? Just reply to this email — I read every response personally.<br>
              To unsubscribe, reply "no thanks" and you're off the list immediately.<br>
              MedSpaOS · pavan@medspaos.com
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`
  return { subject, html }
}

function buildT2Email(name: string, niche: string, website: string): { subject: string; html: string } {
  const subject = `${name} — what's your no-show rate right now?`
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F5;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #EDE6DC;">
        <tr>
          <td style="background:#1a1613;padding:36px 40px 28px;">
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.45);font-size:11px;letter-spacing:3px;text-transform:uppercase;">MedSpaOS — AI Revenue OS for Med Spas</p>
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;line-height:1.3;">Revenue you're already earning — just not collecting.</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.7;">
              Hi — I'm Pavan. I looked at ${name}'s online presence and had a quick question:
              <strong>what happens when a patient no-shows, or a consult doesn't book a treatment that same day?</strong>
            </p>
            <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">
              For most independent med spas, the honest answer is: nothing. No follow-up, no re-engagement — just lost revenue.
            </p>
            <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">
              MedSpaOS fixes that with AI:
            </p>
            <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;border:1px solid #EDE6DC;border-radius:10px;overflow:hidden;">
              ${[
                ['AI Reception', 'Answers every missed call 24/7, books appointments while you\'re with a patient.'],
                ['No-Show Recovery', 'Sends a warm re-engagement SMS within 2 hours. 60% of no-shows rebook.'],
                ['Consultation Converter', 'Follows up on every unbooked treatment plan — 24h, 72h, 7-day cadence.'],
                ['Retention Engine', 'Re-engages dormant patients at 60 days. Turns cold lists into booked revenue.'],
              ].map(([title, desc], idx, arr) => `
              <tr style="${idx < arr.length - 1 ? 'border-bottom:1px solid #EDE6DC;' : ''}">
                <td style="padding:14px 18px;">
                  <strong style="color:#1a1613;font-size:14px;display:block;">${title}</strong>
                  <span style="color:#6b7280;font-size:13px;">${desc}</span>
                </td>
              </tr>`).join('')}
            </table>
            <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.7;">
              I'm personally talking to 10 med spas this month. Would ${name} be one of them? 15 minutes, no pitch — just want to understand your current setup and show you the numbers.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#1a1613;border-radius:10px;">
                  <a href="https://medspaos.com?utm_source=sheets&utm_medium=email&utm_campaign=t2-cold" style="display:block;padding:16px 32px;color:#fff;text-decoration:none;font-size:15px;font-weight:700;text-align:center;">
                    Book a 15-Minute Call →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;color:#9B8E84;font-size:12px;line-height:1.6;">
              Reply to this email anytime — I respond personally.<br>
              To unsubscribe, reply "no thanks" and you're removed immediately.<br>
              MedSpaOS · pavan@medspaos.com
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`
  return { subject, html }
}

async function processTab(
  tabName: string,
  stats: { sent: number; skipped: number; noEmail: number },
): Promise<void> {
  console.log(`\n── Tab: ${tabName} ──`)
  const rows = await readSheetRows({ spreadsheetId: SPREADSHEET_ID, sheetName: tabName })
  if (!rows.length) { console.log('  Empty tab'); return }

  console.log(`  ${rows.length - 1} data rows`)

  for (let i = 1; i < rows.length; i++) {
    if (stats.sent >= BATCH_SIZE) break

    const row      = rows[i]
    const sheetRow = i + 1  // 1-indexed for Sheets API

    // Try col H first, then enriched cols S (biz email) and T (owner email)
    const email      = [row[COL.EMAIL], row[COL.BIZ_EMAIL], row[COL.OWNER_EMAIL]]
      .map(v => v?.trim() ?? '')
      .find(v => v.includes('@')) ?? ''
    const name       = row[COL.NAME]?.trim() || 'your business'
    const niche      = row[COL.NICHE]?.trim() || 'local business'
    const city       = row[COL.CITY]?.trim() || 'your area'
    const tier       = row[COL.TIER]?.trim() || 'tier1'
    const website    = row[COL.WEBSITE_URL]?.trim() || ''
    const outreachSt = row[COL.OUTREACH]?.trim()

    if (outreachSt?.startsWith('SENT')) { stats.skipped++; continue }
    if (!email) { stats.noEmail++; continue }

    const isTier2 = tier === 'tier2' && !!website
    const { subject, html } = isTier2
      ? buildT2Email(name, niche, website)
      : buildT1Email(name, niche, city)

    const today = new Date().toISOString().slice(0, 10)

    if (DRY_RUN) {
      console.log(`  [DRY] Row ${sheetRow}: ${name} <${email}> → ${isTier2 ? 'T2' : 'T1'} — "${subject}"`)
      stats.sent++
      continue
    }

    const ok = await sendEmail({ to: email, subject, html })
    if (ok) {
      await updateSheetCell({
        spreadsheetId: SPREADSHEET_ID,
        sheetName:     tabName,
        row:           sheetRow,
        col:           COL.OUTREACH + 1,  // 1-indexed col
        value:         `SENT ${today}`,
      })
      console.log(`  ✓ Row ${sheetRow}: ${name} <${email}>`)
      stats.sent++
    } else {
      console.log(`  ✗ Row ${sheetRow}: ${name} <${email}> — email failed`)
    }

    // 200ms between emails to stay within Resend rate limits
    await new Promise(r => setTimeout(r, 200))
  }
}

async function main() {
  if (!SPREADSHEET_ID) { console.error('LEADS_SHEET_ID env var missing'); process.exit(1) }
  if (!RESEND_KEY && !DRY_RUN) { console.error('RESEND_API_KEY env var missing'); process.exit(1) }

  const targetTab = process.env.SHEET_TAB
  const tabs = targetTab ? [targetTab] : ALL_TABS

  console.log(`=== Sheets Outreach ===`)
  console.log(`Tabs: ${tabs.join(', ')}`)
  console.log(`Batch: ${BATCH_SIZE} emails | Dry run: ${DRY_RUN}`)

  const stats = { sent: 0, skipped: 0, noEmail: 0 }

  for (const tab of tabs) {
    if (stats.sent >= BATCH_SIZE) break
    await processTab(tab, stats)
  }

  console.log(`\n=== Done ===`)
  console.log(`Sent:         ${stats.sent}`)
  console.log(`Already sent: ${stats.skipped}`)
  console.log(`No email:     ${stats.noEmail}`)
}

main().catch(e => { console.error(e); process.exit(1) })
