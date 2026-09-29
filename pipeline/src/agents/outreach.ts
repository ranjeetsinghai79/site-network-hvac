import { sendOutreachEmail, sendAIReceptionEmail, sendPitchEmail } from '../tools/resend.js'
import { sendOutreachSMS }                           from '../tools/sms.js'
import { sendSMS }                                   from './sms-outreach.js'
import { canTextNow }                                from '../tools/sms-consent.js'
import { runAuditReportAgent }                       from './audit-report.js'
import { checkAIVisibility, buildVisibilityGapSMS } from '../tools/visibility-check.js'
import { logLeadEvent }                              from '../db/supabase.js'
import type { Lead, AgentResult }                    from '../types.js'

const NICHE_LABELS: Record<string, string> = {
  hvac: 'HVAC', roofing: 'roofing', dentist: 'dental', medspa: 'med spa',
  lawfirm: 'law firm', cleaning: 'cleaning', 'auto-detailing': 'auto detailing',
  'junk-removal': 'junk removal', daycare: 'daycare', remodeling: 'remodeling',
  restaurant: 'restaurant', salon: 'salon', barbershop: 'barbershop',
  plumbing: 'plumbing', landscaping: 'landscaping', 'skin-clinic': 'skin clinic',
  'iv-therapy': 'IV therapy', 'nail-studio': 'nail studio',
}

export async function runOutreachAgent(lead: Lead): Promise<AgentResult<Lead>> {
  if (!lead.email && !lead.phone) return { success: false, error: 'No email or phone' }

  const sentVia: string[] = []

  // TCPA gate — cold leads without an active consent event, or who opted out
  // (leads.sms_opt_out), are email-only. canTextNow checks both, fresh from
  // the DB rather than trusting an in-memory lead.sms_opt_out that could be stale.
  const isDry = process.env.DRY_RUN === 'true' || process.env.SMS_DRY_RUN === 'true'
  const smsConsent = !!lead.phone && (isDry || await canTextNow(lead.phone))
  if (lead.phone && !smsConsent) {
    console.log(`[Outreach] ${lead.name} — not textable (no consent / opted out), email-only (TCPA gate)`)
  }

  // ── Tier 1: no website → pitch outreach (build triggered manually when interested) ──
  if (lead.tier === 'tier1' || !lead.website) {
    const hasDemoUrl = !!(lead.cloudflare_url || lead.vercel_url)

    if (hasDemoUrl) {
      // Site already built (admin-triggered) — send "your site is live" email
      const demoUrl = (lead.cloudflare_url || lead.vercel_url || '')
      const url = demoUrl.startsWith('http') ? demoUrl : `https://${demoUrl}`
      if (lead.email) {
        const ok = await sendOutreachEmail({ to: lead.email, businessName: lead.name, demoUrl: url, niche: lead.niche })
        if (ok) {
          sentVia.push('email')
          console.log(`[Outreach] T1 live-site email → ${lead.email}`)
          if (lead.id) logLeadEvent(lead.id, 'email_sent', { to: lead.email, demoUrl: url })
        }
      }
      if (lead.phone && smsConsent && process.env.TWILIO_ACCOUNT_SID && lead.can_sms !== false) {
        const ok = await sendOutreachSMS({ to: lead.phone, businessName: lead.name, demoUrl: url, niche: lead.niche })
        if (ok) { sentVia.push('sms'); if (lead.id) logLeadEvent(lead.id, 'sms_sent', { to: lead.phone }) }
      }
    } else {
      // No site yet — send pitch: "we analyzed you, want to see a demo?"
      if (lead.email) {
        const services = (lead.brand_data as any)?.services?.map((s: any) => typeof s === 'string' ? s : s.name).filter(Boolean)
        const ok = await sendPitchEmail({ to: lead.email, businessName: lead.name, niche: lead.niche, services })
        if (ok) {
          sentVia.push('email')
          console.log(`[Outreach] T1 pitch email → ${lead.email}`)
          if (lead.id) logLeadEvent(lead.id, 'email_sent', { to: lead.email, type: 'pitch' })
        } else console.warn('[Outreach] T1 pitch email failed')
      }
      if (lead.phone && smsConsent && process.env.TWILIO_ACCOUNT_SID && lead.can_sms !== false) {
        const msg = [
          `Hi — missed calls, no-shows, and consults that don't book are costing ${lead.name} real revenue every week.`,
          `MedSpaOS is an AI system that follows up automatically so nothing falls through. No extra staff. No leads needed.`,
          `Want to see what ${lead.name} could recover? Reply YES. Reply STOP to opt out.`,
        ].join('\n')
        const ok = await sendSMS(lead.phone, msg)
        if (ok) { sentVia.push('sms'); if (lead.id) logLeadEvent(lead.id, 'sms_sent', { to: lead.phone, type: 'pitch' }) }
      } else if (lead.phone && lead.can_sms === false) {
        console.log(`[Outreach] SMS skipped — landline: ${lead.phone}`)
      }
    }

  // ── Tier 2: has website → free audit report + AI reception pitch ──────────
  } else {
    const hasNewSite = !!(lead.cloudflare_url || lead.vercel_url)

    // Generate free audit report — the hook that gets them to reply. Skipped when a
    // replacement site is already built: the newSiteUrl branch of the email below
    // doesn't reference auditSummary/auditHtml, so running it here would only burn
    // Firecrawl/PageSpeed/Gemini quota for an attachment nothing points to.
    let auditSummary = ''
    let auditHtml: string | undefined

    if (!hasNewSite) {
      console.log(`[Outreach] Generating free audit for ${lead.name}`)
      const audit = await runAuditReportAgent(lead)

      if (audit) {
        auditSummary = audit.summary_text
        auditHtml    = audit.html
        console.log(`[Outreach] Audit: grade ${audit.grade}, score ${audit.overall_score}, ${audit.issues.length} issues`)
      }
    }

    if (lead.email) {
      const newSiteUrl = lead.cloudflare_url ?? lead.vercel_url ?? undefined
      const ok = await sendAuditOutreachEmail({
        to:           lead.email,
        businessName: lead.name,
        niche:        lead.niche,
        website:      lead.website,
        newSiteUrl:   newSiteUrl ? (newSiteUrl.startsWith('http') ? newSiteUrl : `https://${newSiteUrl}`) : undefined,
        auditSummary,
        auditHtml,
        receptionDemoUrl: process.env.RECEPTION_BASE_URL
          ? `${process.env.RECEPTION_BASE_URL}/demo`
          : 'https://ai-reception-571925663575.us-central1.run.app/demo',
      })
      if (ok) {
        sentVia.push('email')
        console.log(`[Outreach] T2 audit email → ${lead.email}`)
        if (lead.id) logLeadEvent(lead.id, 'email_sent', { to: lead.email, type: 'audit' })
      }
      else console.warn('[Outreach] T2 audit email failed')
    }
    if (lead.phone && smsConsent && process.env.TWILIO_ACCOUNT_SID && lead.can_sms !== false) {
      // Run visibility check — personalize SMS with actual gaps found on their site
      let smsBody: string | null = null
      if (lead.website) {
        try {
          const vis = await checkAIVisibility(lead.website)
          smsBody = buildVisibilityGapSMS({
            businessName: lead.name,
            website:      lead.website,
            niche:        lead.niche,
            result:       vis,
          })
          console.log(`[Outreach] T2 visibility score: ${vis.score}/3 — gaps: ${vis.gaps.join(', ') || 'none'}`)
        } catch (e: any) {
          console.log(`[Outreach] Visibility check failed (${e.message}) — using fallback SMS`)
        }
      }

      // Fallback if check failed or no website
      if (!smsBody) {
        smsBody = [
          `Hi — we help med spas turn the leads and patients they already have into booked, completed, repeat revenue.`,
          `AI follow-up for no-shows, consults that didn't book, and dormant patients — all automated. No new leads needed.`,
          `Want to see how ${lead.name} could use this? Reply YES to talk or STOP to opt out.`,
        ].join('\n')
      }

      const ok = await sendSMS(lead.phone, smsBody)
      if (ok) {
        sentVia.push('sms')
        if (lead.id) logLeadEvent(lead.id, 'sms_sent', { to: lead.phone, type: 'visibility_pitch' })
      }
    }
  }

  if (sentVia.length === 0) return { success: false, error: 'All outreach channels failed' }

  return {
    success: true,
    data: {
      ...lead,
      outreach_sent:    true,
      outreach_sent_at: new Date().toISOString(),
      status:           'outreach_sent',
    },
  }
}

// ─── Tier 2 audit outreach email (inline, no extra Resend function needed) ───

function formatPhoneForDisplay(e164OrDigits: string): string {
  const digits = e164OrDigits.replace(/\D/g, '').replace(/^1/, '')
  if (digits.length !== 10) return e164OrDigits
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

async function sendAuditOutreachEmail(params: {
  to:                string
  businessName:      string
  niche:             string
  website:           string
  newSiteUrl?:       string
  auditSummary:      string
  auditHtml?:        string
  receptionDemoUrl:  string
}): Promise<boolean> {
  const { to, businessName, niche, website, newSiteUrl, auditSummary, auditHtml, receptionDemoUrl } = params
  const fromEmail = process.env.OUTREACH_FROM_EMAIL || 'hello@webcrew.app'

  const subject = newSiteUrl
    ? `Your new ${businessName} website is live — built overnight by WebCrew`
    : `Free audit for ${businessName} — we found ${auditSummary ? '3 quick wins' : 'some issues'}`

  // Main email: audit summary + what we offer
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Free Website Audit — ${businessName}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <tr>
          <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);border-radius:16px 16px 0 0;padding:36px 40px 28px;border:1px solid rgba(255,255,255,0.08);border-bottom:none;">
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Free Website Audit</p>
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;">${businessName}</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.45);font-size:13px;">${website}</p>
          </td>
        </tr>

        <tr>
          <td style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-top:none;padding:32px 40px;">
            ${newSiteUrl ? `
            <!-- Before / After callout -->
            <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;border:1px solid rgba(255,255,255,0.1);border-radius:12px;overflow:hidden;">
              <tr>
                <td style="padding:18px 20px;background:rgba(255,255,255,0.03);width:50%;vertical-align:top;">
                  <p style="margin:0 0 6px;color:rgba(255,255,255,0.35);font-size:10px;letter-spacing:2px;text-transform:uppercase;">BEFORE</p>
                  <p style="margin:0;color:rgba(255,255,255,0.45);font-size:12px;word-break:break-all;">${website}</p>
                </td>
                <td style="padding:18px 20px;background:rgba(37,99,235,0.12);border-left:1px solid rgba(255,255,255,0.06);width:50%;vertical-align:top;">
                  <p style="margin:0 0 6px;color:#60a5fa;font-size:10px;letter-spacing:2px;text-transform:uppercase;">AFTER — YOUR NEW SITE</p>
                  <a href="${newSiteUrl}" style="color:#93c5fd;font-size:12px;font-weight:700;text-decoration:none;word-break:break-all;">${newSiteUrl} →</a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 20px;color:rgba(255,255,255,0.8);font-size:16px;line-height:1.7;">
              We rebuilt ${businessName}'s website overnight — cinematic design, lightning-fast CDN, and lead forms that actually convert. See the live site above.
            </p>
            <p style="margin:0 0 24px;color:rgba(255,255,255,0.6);font-size:15px;line-height:1.7;">
              It's yours with <strong style="color:#fff;">$0 setup</strong> and a <strong style="color:#fff;">30-day free trial</strong>, then a flat <strong style="color:#fff;">$297/month</strong> — the AI team included answers every inbound call 24/7, books appointments, and follows up automatically.
            </p>
            ${process.env.TWILIO_FROM_NUMBER ? `
            <p style="margin:0 0 24px;color:rgba(255,255,255,0.5);font-size:13px;line-height:1.6;">
              Questions, or want it hooked up to your domain? Text us at <strong style="color:#fff;">${formatPhoneForDisplay(process.env.TWILIO_FROM_NUMBER)}</strong> and we'll walk you through it.
            </p>
            ` : ''}
            ` : `
            <p style="margin:0 0 20px;color:rgba(255,255,255,0.8);font-size:16px;line-height:1.7;">
              ${auditSummary || `We ran a free website audit for ${businessName} and found several areas that are costing you customers. The full report is attached to this email.`}
            </p>
            <p style="margin:0 0 24px;color:rgba(255,255,255,0.6);font-size:15px;line-height:1.7;">
              We fix these exact problems for local ${niche} businesses — faster sites, better Google rankings, and an AI receptionist that answers every call when you're busy.
            </p>
            `}

            <!-- 2-product pitch: site + all-inclusive AI team bundle -->
            <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
              ${[
                ['🌐', 'Professional Website', 'Lightning-fast, mobile-first, SEO-ready. Included.'],
                ['🤖', 'AI Front Office', '24/7 reception, booking, SMS follow-up, GBP posts, review replies. $0 setup, 30-day free trial, then $297/month flat.'],
              ].map(([icon, title, desc]) => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="padding-right:14px;font-size:20px;vertical-align:top;">${icon}</td>
                    <td>
                      <strong style="color:#fff;font-size:14px;display:block;">${title}</strong>
                      <span style="color:rgba(255,255,255,0.45);font-size:13px;">${desc}</span>
                    </td>
                  </tr></table>
                </td>
              </tr>`).join('')}
            </table>

            <table cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              <tr>
                <td style="background:linear-gradient(135deg,#0ea5e9,#6366f1);border-radius:10px;">
                  <a href="${newSiteUrl ?? process.env.CALENDLY_URL ?? receptionDemoUrl}" style="display:block;padding:16px 32px;color:#fff;text-decoration:none;font-size:15px;font-weight:700;text-align:center;">
                    ${newSiteUrl ? 'View Your New Site →' : 'Book a Free 15-min Call →'}
                  </a>
                </td>
              </tr>
            </table>

            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#1e293b;border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:12px 24px;">
                  <a href="${receptionDemoUrl}" style="color:#60a5fa;text-decoration:none;font-size:13px;font-weight:600;">
                    🎙️ Test AI Receptionist live →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;">
            <p style="margin:0;color:rgba(255,255,255,0.3);font-size:12px;line-height:1.6;">
              Full audit report attached below. Reply to this email or just book a call — no pushy sales, promise.<br>
              To unsubscribe: reply "no thanks" and we'll remove you immediately.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  // Build Resend payload — attach audit HTML as inline if available
  const payload: any = {
    from:    fromEmail,
    to,
    subject,
    html,
  }

  if (auditHtml) {
    payload.attachments = [{
      filename:    `${businessName.replace(/[^a-zA-Z0-9]/g, '_')}_Website_Audit.html`,
      content:     Buffer.from(auditHtml).toString('base64'),
      content_type: 'text/html',
    }]
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return res.ok
}
