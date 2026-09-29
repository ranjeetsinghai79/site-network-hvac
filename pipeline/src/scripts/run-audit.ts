/**
 * run-audit.ts
 *
 * Standalone script — spawned by admin /api/audit route.
 * Reads env vars: AUDIT_URL, AUDIT_BUSINESS_NAME, AUDIT_NICHE, AUDIT_CITY, AUDIT_SEND_OUTREACH
 *
 * Usage:
 *   AUDIT_URL=https://example.com AUDIT_NICHE=medspa npx tsx src/scripts/run-audit.ts
 */

import 'dotenv/config'
import { runAuditAgent } from '../agents/audit-agent.js'
import { sendAuditEmail } from '../tools/resend.js'
import pg from 'pg'

const { Pool } = pg

async function main() {
  const url         = process.env.AUDIT_URL
  const businessName = process.env.AUDIT_BUSINESS_NAME || undefined
  const niche       = process.env.AUDIT_NICHE || undefined
  const city        = process.env.AUDIT_CITY || undefined
  const sendOutreach = process.env.AUDIT_SEND_OUTREACH === 'true'

  if (!url) {
    console.error('[run-audit] AUDIT_URL not set')
    process.exit(1)
  }

  console.log(`[run-audit] Auditing: ${url}`)

  const result = await runAuditAgent({ url, businessName, niche, city })

  if (!result.success || !result.report) {
    console.error('[run-audit] Audit failed:', result.error)
    process.exit(1)
  }

  const { report, auditId } = result
  const adminBase = process.env.ADMIN_BASE_URL || 'http://localhost:3010'
  const reportUrl = `${adminBase}/audit/${auditId}`

  console.log(`\n✅ Audit complete — ${report.business_name}`)
  console.log(`   Overall:    ${report.overall_score}/100`)
  console.log(`   Website:    ${report.website_score}/100`)
  console.log(`   SEO:        ${report.seo_score}/100`)
  console.log(`   Reputation: ${report.reputation_score}/100`)
  console.log(`   Phone CTA:  ${report.phone_found ? '✓' : '✗'}`)
  console.log(`   Booking:    ${report.has_booking_link ? '✓' : '✗'}`)
  console.log(`   Report:     ${reportUrl}`)
  console.log(`\n   Top issues:`)
  report.recommendations.slice(0, 3).forEach((r, i) => {
    console.log(`   ${i + 1}. [${r.priority}] ${r.title}`)
  })

  // Try to find email for the lead and send outreach
  if (sendOutreach && auditId) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    try {
      // Look up email from leads table matching website URL
      const { rows } = await pool.query(
        `SELECT email FROM leads WHERE website ILIKE $1 AND email IS NOT NULL LIMIT 1`,
        [`%${new URL(url).hostname}%`]
      )
      const email = rows[0]?.email

      if (email && report.niche) {
        const topIssues = report.recommendations.map(r => r.title)
        const ok = await sendAuditEmail({
          to:              email,
          businessName:    report.business_name,
          niche:           report.niche,
          overallScore:    report.overall_score,
          websiteScore:    report.website_score,
          seoScore:        report.seo_score,
          reputationScore: report.reputation_score,
          topIssues,
          reportUrl,
        })
        if (ok) {
          console.log(`\n📧 Audit email sent to ${email}`)
          await pool.query(
            'UPDATE audits SET outreach_sent=TRUE, outreach_sent_at=NOW() WHERE id=$1',
            [auditId]
          )
        }
      } else {
        console.log('\n⚠️  No email found for lead — skipping outreach')
      }
    } finally {
      await pool.end()
    }
  }

  console.log('\nDone.')
}

main().catch(e => {
  console.error('[run-audit] Fatal:', e.message)
  process.exit(1)
})
