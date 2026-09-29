/**
 * build-hvac-rebuilds.ts
 *
 * Phase 2-4 of the HVAC tier-2 rebuild campaign (see the plan this came from,
 * 2026-09-28): for each candidate from select-hvac-rebuild-candidates.ts —
 *
 *   1. Quick free check on their CURRENT site (PageSpeed, same thresholds
 *      site-scorer.ts already uses) — skip candidates whose site is already decent.
 *   2. Build a real replacement site (Places match → brand-analyst → config-gen →
 *      image-gen → video-gen → builder → deployer), via the same
 *      buildLeadFromPlacesMatch() helper auto-build-from-sms.ts uses.
 *   3. Only THEN send outreach — runOutreachAgent's tier2 branch already sends a
 *      truthful "we rebuilt your site overnight, want to see it?" email once
 *      leads.cloudflare_url is set (sendAuditOutreachEmail in agents/outreach.ts).
 *
 * This is deliberately build-first: the pitch is true by the time it's sent, not a
 * claim to be made true later.
 *
 * Usage:
 *   cd pipeline && npx tsx src/scripts/build-hvac-rebuilds.ts rebuild-candidates/hvac-2026-09-28.json
 *   cd pipeline && DRY_RUN=true npx tsx src/scripts/build-hvac-rebuilds.ts <file>   # quick-check only, no spend
 *
 * Env:
 *   BATCH_SIZE   how many to actually build today (default 15 — see the plan's
 *                Firecrawl free-tier throughput note before raising this)
 *   DRY_RUN      "true" = run the quick check and log results, build/send nothing
 */

import 'dotenv/config'
import { readFileSync } from 'fs'
import pg from 'pg'
import { scoreSite } from '../tools/pagespeed.js'
import { buildLeadFromPlacesMatch } from '../tools/place-match-builder.js'
import { extractEmailsFromWebsite } from '../tools/email-extractor.js'
import { runOutreachAgent } from '../agents/outreach.js'
import { getLeadById, updateLead } from '../db/supabase.js'
import type { RebuildCandidate } from './select-hvac-rebuild-candidates.js'

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? '15', 10)
const DRY_RUN     = process.env.DRY_RUN === 'true'

// Same bar as site-scorer.ts's Track C — score below this, or 3+ issues, means the
// current site is genuinely bad enough to be worth a proactive rebuild.
const UPGRADE_THRESHOLD = 45

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

function phoneDigits(p?: string): string {
  return (p ?? '').replace(/\D/g, '').slice(-10)
}

async function alreadyContacted(phone: string): Promise<boolean> {
  if (!phone) return false
  const { rows } = await pool.query(
    `SELECT 1 FROM leads WHERE phone = $1 AND outreach_sent = true LIMIT 1`,
    [phone]
  )
  return rows.length > 0
}

async function main() {
  const filePath = process.argv[2]
  if (!filePath) { console.error('Usage: build-hvac-rebuilds.ts <candidates.json>'); process.exit(1) }

  const candidates: RebuildCandidate[] = JSON.parse(readFileSync(filePath, 'utf8'))
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`🏗️   Build HVAC Rebuilds — ${candidates.length} candidates loaded`)
  console.log(`   Batch size: ${BATCH_SIZE}  |  Dry run: ${DRY_RUN}`)
  console.log(`${'═'.repeat(60)}\n`)

  let checked = 0, skippedGoodSite = 0, skippedDup = 0, built = 0, sent = 0, errors = 0

  for (const c of candidates) {
    if (built >= BATCH_SIZE) break

    const digits = phoneDigits(c.phone)
    if (await alreadyContacted(digits || c.phone)) {
      skippedDup++
      continue
    }

    checked++
    console.log(`\n→ ${c.name} | ${c.city}, ${c.state} | ${c.websiteUrl}`)

    // ── Phase 2: quick free check on their current site ──────────────────────
    let score
    try {
      score = await scoreSite(c.websiteUrl)
    } catch (e: any) {
      console.log(`  [!] Score check failed (${e.message}) — treating as worth rebuilding`)
      score = { mobile_score: 0, issues: ['Score check failed'], scored: false, broken: false } as any
    }

    const worthRebuilding = score.broken || score.mobile_score < UPGRADE_THRESHOLD || score.issues.length >= 3
    if (!worthRebuilding) {
      console.log(`  Score ${score.mobile_score}/100, ${score.issues.length} issues — current site is fine, skip`)
      skippedGoodSite++
      continue
    }
    console.log(`  Score ${score.mobile_score}/100, ${score.issues.length} issues — worth rebuilding`)

    if (DRY_RUN) { console.log('  [dry-run] Would build + send outreach here'); continue }

    // ── Phase 3: build the real replacement site ──────────────────────────────
    try {
      const result = await buildLeadFromPlacesMatch({
        phone: c.phone,
        name:  c.name,
        niche: 'hvac',
        city:  c.city,
        state: c.state,
        tier:  'tier2',   // keeps runOutreachAgent's tier2 branch — the truthful "we
                          // rebuilt your site" email, not the tier1 "no website" copy
      })

      if (!result) {
        console.log(`  [!] Build failed — no Places match or no deploy URL`)
        errors++
        continue
      }
      built++
      console.log(`  ✅ Deployed: ${result.deployedUrl}`)

      // ── Phase 4: send the (now truthful) outreach email ──────────────────────
      let lead = await getLeadById(result.leadId)
      if (!lead) { console.log(`  [!] Could not reload lead ${result.leadId}`); errors++; continue }

      // Carry over the sheet's own email, or scrape the OLD site, as a fallback if
      // brand-analyst didn't find a contact email during the build.
      if (!lead.email && c.email) {
        lead = { ...lead, email: c.email }
        await updateLead(lead)
      }
      if (!lead.email) {
        try {
          const found = await extractEmailsFromWebsite(c.websiteUrl)
          const email = found.businessEmail ?? found.ownerEmail
          if (email) { lead = { ...lead, email }; await updateLead(lead) }
        } catch { /* no email found — outreach agent will fall back to SMS-only if consented */ }
      }

      if (!lead.email && !lead.phone) {
        console.log(`  [!] No email or phone — built but can't reach them, skip outreach`)
        continue
      }

      const outreachResult = await runOutreachAgent(lead)
      if (outreachResult.success) {
        sent++
        console.log(`  📧 Outreach sent → ${lead.email ?? lead.phone}`)
      } else {
        console.log(`  [!] Outreach failed: ${outreachResult.error}`)
      }
    } catch (e: any) {
      console.error(`  [ERROR] ${c.name}: ${e.message}`)
      errors++
    }
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`Checked: ${checked}  |  Already contacted (skipped): ${skippedDup}  |  Good site (skipped): ${skippedGoodSite}`)
  console.log(`Built: ${built}  |  Outreach sent: ${sent}  |  Errors: ${errors}`)
  console.log(`${'═'.repeat(60)}\n`)

  await pool.end()
}

main().catch(e => { console.error(e.message); process.exit(1) })
