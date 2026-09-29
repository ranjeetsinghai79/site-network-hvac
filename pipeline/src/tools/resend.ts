export const NICHE_LABEL: Record<string, string> = {
  hvac:                 'HVAC & Air Conditioning',
  roofing:              'Roofing',
  plumbing:             'Plumbing',
  dentist:              'Dental',
  medspa:               'Med Spa',
  lawfirm:              'Law Firm',
  cleaning:             'Cleaning',
  'auto-detailing':     'Auto Detailing',
  'junk-removal':       'Junk Removal',
  daycare:              'Daycare',
  remodeling:           'Home Remodeling',
  restaurant:           'Restaurant',
  'skin-clinic':        'Skin & Aesthetics Clinic',
  'iv-therapy':         'IV Therapy Clinic',
  'nail-studio':        'Nail Studio',
  orthodontist:         'Orthodontics',
  'weight-loss-clinic': 'Weight Loss Clinic',
  salon:                'Hair Salon',
  barbershop:           'Barbershop',
}

export async function sendOutreachEmail(params: {
  to: string
  businessName: string
  demoUrl: string
  niche: string
  paymentUrl?: string
}): Promise<boolean> {
  const { to, businessName, demoUrl, niche, paymentUrl } = params
  const nicheLabel = NICHE_LABEL[niche] || niche
  const fromEmail  = process.env.OUTREACH_FROM_EMAIL || 'hello@webcrew.dev'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your new website is ready</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <!-- Header -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:40px 20px 0;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:16px 16px 0 0;padding:36px 40px 28px;border:1px solid rgba(255,255,255,0.08);border-bottom:none;">
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Built specifically for</p>
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;line-height:1.2;">${businessName}</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.45);font-size:14px;">${nicheLabel} · Professional Website</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>

  <!-- Body -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:0 20px 40px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Preview card -->
        <tr>
          <td style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-top:none;padding:32px 40px;">
            <p style="margin:0 0 20px;color:rgba(255,255,255,0.7);font-size:16px;line-height:1.6;">
              Hi — I built <strong style="color:#fff;">${businessName}</strong> an AI-agent-ready ${nicheLabel.toLowerCase()} website overnight.
              ChatGPT, Perplexity, and Google AI can now find and recommend you — plus an AI receptionist answers every call 24/7.
            </p>

            <!-- Big CTA -->
            <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
              <tr>
                <td style="background:linear-gradient(135deg,#f97316,#ea580c);border-radius:12px;">
                  <a href="${demoUrl}" style="display:block;padding:18px 40px;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;letter-spacing:-0.2px;text-align:center;">
                    👀 &nbsp;View ${businessName}'s New Website
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 6px;color:rgba(255,255,255,0.45);font-size:12px;text-align:center;">
              ${demoUrl}
            </p>
          </td>
        </tr>

        <!-- What's included -->
        <tr>
          <td style="background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-top:none;padding:32px 40px;">
            <p style="margin:0 0 20px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">What's included</p>
            <table cellpadding="0" cellspacing="0" width="100%">
              ${[
                ['🤖', 'AI-Agent-Ready', 'Found & recommended by ChatGPT, Perplexity, and Google AI'],
                ['📄', 'llms.txt + Schema', 'AI crawlers read your business like a structured menu'],
                ['📞', 'AI Receptionist', 'Answers every call 24/7 — books jobs while you work'],
                ['⚡', 'Lightning-fast', 'Loads in under 1 second on mobile'],
                ['🔍', 'SEO-optimized', 'Built to rank on Google for local searches'],
                ['🔒', 'Free SSL & hosting', 'Secure, always-on, globally distributed'],
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
          </td>
        </tr>

        <!-- Pricing -->
        <tr>
          <td style="background:linear-gradient(135deg,rgba(249,115,22,0.12),rgba(234,88,12,0.06));border:1px solid rgba(249,115,22,0.3);border-top:none;padding:32px 40px;">
            <p style="margin:0 0 20px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Simple pricing</p>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="padding:16px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
                  <table cellpadding="0" cellspacing="0" width="100%"><tr>
                    <td style="color:rgba(255,255,255,0.7);font-size:15px;">Setup — see it before you pay anything</td>
                    <td align="right"><span style="color:#fb923c;font-size:22px;font-weight:800;">$0</span></td>
                  </tr></table>
                  <p style="margin:6px 0 0;color:rgba(255,255,255,0.4);font-size:12px;">No card required to see your site live</p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 0;">
                  <table cellpadding="0" cellspacing="0" width="100%"><tr>
                    <td style="color:rgba(255,255,255,0.7);font-size:15px;">AI Front Office — after a 30-day free trial</td>
                    <td align="right"><span style="color:#fff;font-size:16px;font-weight:700;">$297/mo</span></td>
                  </tr></table>
                  <p style="margin:6px 0 0;color:rgba(255,255,255,0.4);font-size:12px;">Site, hosting, 24/7 AI reception, booking, and more — flat rate, cancel anytime</p>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 0;color:rgba(255,255,255,0.45);font-size:13px;line-height:1.6;">
              $0 setup, 30-day free trial, then one flat monthly rate. No hidden fees.
            </p>
          </td>
        </tr>

        <!-- CTA footer -->
        <tr>
          <td style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-top:none;border-radius:0 0 16px 16px;padding:32px 40px;">
            <p style="margin:0 0 20px;color:rgba(255,255,255,0.7);font-size:15px;line-height:1.6;">
              Reply to this email or call — I'll have it live on your domain within 24 hours.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
              <tr>
                <td style="background:#1e293b;border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:14px 28px;">
                  <a href="${demoUrl}" style="color:#fb923c;text-decoration:none;font-size:14px;font-weight:600;">
                    View your site →
                  </a>
                </td>
              </tr>
            </table>
            ${paymentUrl ? `
            <table cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
              <tr>
                <td style="background:linear-gradient(135deg,#16a34a,#15803d);border-radius:10px;">
                  <a href="${paymentUrl}" style="display:block;padding:14px 28px;color:#fff;text-decoration:none;font-size:14px;font-weight:700;">
                    💳 &nbsp;Claim this site — $0 setup, 30-day free trial
                  </a>
                </td>
              </tr>
            </table>` : ''}
            <p style="margin:28px 0 0;color:rgba(255,255,255,0.3);font-size:12px;line-height:1.6;">
              You received this because we build free demo websites for ${nicheLabel.toLowerCase()} businesses in your area.<br>
              To unsubscribe, reply "no thanks" and we'll remove you immediately.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to,
      subject: `Your AI-agent-ready ${nicheLabel} site is live — built for ${businessName}`,
      html,
    }),
  })

  return res.ok
}

export async function sendPitchEmail(params: {
  to:           string
  businessName: string
  niche:        string
  services?:    string[]
}): Promise<boolean> {
  const { to, businessName, niche, services } = params
  const nicheLabel  = NICHE_LABEL[niche] || niche
  const fromEmail   = process.env.OUTREACH_FROM_EMAIL || 'hello@webcrew.app'
  const bookingUrl  = process.env.CALENDLY_URL || 'https://webcrew.app'
  const serviceList = services?.slice(0, 4).map(s => `<li style="color:rgba(255,255,255,0.6);font-size:13px;padding:3px 0;">${s}</li>`).join('') ?? ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%);border-radius:16px 16px 0 0;padding:36px 40px 28px;border:1px solid rgba(255,255,255,0.08);border-bottom:none;">
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.45);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Website + AI Team for</p>
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;">${businessName}</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.4);font-size:13px;">${nicheLabel}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-top:none;padding:32px 40px;">
            <p style="margin:0 0 18px;color:rgba(255,255,255,0.8);font-size:16px;line-height:1.7;">
              Hi — AI like ChatGPT and Perplexity now recommend local ${nicheLabel.toLowerCase()} businesses by name. <strong style="color:#fff;">${businessName}</strong> isn't showing up yet.
            </p>
            <p style="margin:0 0 18px;color:rgba(255,255,255,0.65);font-size:15px;line-height:1.7;">
              We fix that overnight: an AI-agent-ready website so every AI search engine finds and recommends you, plus an AI receptionist that answers every call 24/7 so you never miss a booking.
            </p>
            ${serviceList ? `
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">What we'd highlight for your business</p>
            <ul style="margin:0 0 24px;padding-left:18px;">${serviceList}</ul>
            ` : ''}
            <table cellpadding="0" cellspacing="0" style="margin:28px 0 20px;">
              <tr>
                <td style="background:linear-gradient(135deg,#6366f1,#7c3aed);border-radius:10px;">
                  <a href="${bookingUrl}" style="display:block;padding:16px 36px;color:#fff;text-decoration:none;font-size:15px;font-weight:700;text-align:center;">
                    See a Free Demo Built for ${businessName} →
                  </a>
                </td>
              </tr>
            </table>
            <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:8px;">
              ${[
                ['🤖', 'AI-Agent-Ready Site', 'ChatGPT & Perplexity find + recommend you — included'],
                ['📞', 'AI Receptionist', 'Answers every call 24/7, books jobs — included'],
                ['📈', 'AI Growth', 'Google reviews, GBP posts, monthly reports — included'],
              ].map(([icon, title, desc]) => `
              <tr><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="padding-right:12px;font-size:18px;">${icon}</td>
                  <td><strong style="color:#fff;font-size:13px;">${title}</strong><br><span style="color:rgba(255,255,255,0.4);font-size:12px;">${desc}</span></td>
                </tr></table>
              </td></tr>`).join('')}
            </table>
            <p style="margin:16px 0 0;color:rgba(255,255,255,0.5);font-size:13px;line-height:1.6;">
              $0 setup, 30-day free trial, then a flat <strong style="color:#fff;">$297/mo</strong> for everything above.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-top:none;border-radius:0 0 16px 16px;padding:20px 40px;">
            <p style="margin:0;color:rgba(255,255,255,0.25);font-size:12px;line-height:1.6;">
              Reply "interested" and we'll build a live demo for ${businessName} within 24 hours — no commitment, no credit card.<br>
              To unsubscribe: reply "no thanks" and we'll remove you immediately.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromEmail, to, subject: `${businessName} isn't showing up in ChatGPT — we can fix that overnight`, html }),
  })
  return res.ok
}

export async function sendAIReceptionEmail(params: {
  to: string
  businessName: string
  niche: string
  demoUrl: string
}): Promise<boolean> {
  const { to, businessName, niche, demoUrl } = params
  const nicheLabel = NICHE_LABEL[niche] || niche
  const fromEmail  = process.env.OUTREACH_FROM_EMAIL || 'hello@webcrew.app'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Receptionist for ${businessName}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:40px 20px 0;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#0f0c29 0%,#1a1a2e 100%);border-radius:16px 16px 0 0;padding:36px 40px 28px;border:1px solid rgba(255,255,255,0.08);border-bottom:none;">
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Built for</p>
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;line-height:1.2;">${businessName}</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.45);font-size:14px;">${nicheLabel} · AI Reception System</p>
          </td>
        </tr>
        <tr>
          <td style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-top:none;padding:32px 40px;">
            <p style="margin:0 0 20px;color:rgba(255,255,255,0.7);font-size:16px;line-height:1.6;">
              Hi — we built a <strong style="color:#fff;">24/7 AI receptionist</strong> specifically for ${nicheLabel.toLowerCase()} businesses like ${businessName}.
            </p>
            <p style="margin:0 0 24px;color:rgba(255,255,255,0.6);font-size:15px;line-height:1.7;">
              It answers every call instantly, qualifies leads, books appointments, and handles FAQs — so you never miss a customer, even at 2am or on weekends.
            </p>

            <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
              <tr>
                <td style="background:linear-gradient(135deg,#7c3aed,#5b21b6);border-radius:12px;">
                  <a href="${demoUrl}" style="display:block;padding:18px 40px;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;letter-spacing:-0.2px;text-align:center;">
                    🎙️ &nbsp;Test the AI Receptionist
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 6px;color:rgba(255,255,255,0.35);font-size:12px;text-align:center;">${demoUrl}</p>
          </td>
        </tr>

        <tr>
          <td style="background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-top:none;padding:32px 40px;">
            <p style="margin:0 0 20px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">What it does</p>
            <table cellpadding="0" cellspacing="0" width="100%">
              ${[
                ['📞', 'Answers every call', 'No hold music. No voicemail. Instant human-like response 24/7.'],
                ['📅', 'Books appointments', 'Integrates with your calendar. Confirms with the customer automatically.'],
                ['🎯', 'Qualifies leads', 'Asks the right questions, filters time-wasters, flags hot leads.'],
                ['💬', 'Handles FAQs', 'Hours, pricing, location — answered instantly without your time.'],
                ['📊', 'Full call summaries', 'Every call transcribed and emailed to you in seconds.'],
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
          </td>
        </tr>

        <tr>
          <td style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-top:none;border-radius:0 0 16px 16px;padding:32px 40px;">
            <p style="margin:0 0 20px;color:rgba(255,255,255,0.7);font-size:15px;line-height:1.6;">
              No tech setup. We handle everything. Reply to this email if you want to know more — or just test it at the link above.
            </p>
            <p style="margin:28px 0 0;color:rgba(255,255,255,0.3);font-size:12px;line-height:1.6;">
              You received this because we build AI reception systems for ${nicheLabel.toLowerCase()} businesses in your area.<br>
              To unsubscribe, reply "no thanks" and we'll remove you immediately.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>

</body>
</html>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to,
      subject: `AI receptionist for ${businessName} — never miss a call again`,
      html,
    }),
  })

  return res.ok
}

// ─── Audit report email ───────────────────────────────────────────────────────

export async function sendAuditEmail(params: {
  to: string
  businessName: string
  niche: string
  overallScore: number
  websiteScore: number
  seoScore: number
  reputationScore: number
  topIssues: string[]      // top 3 recommendation titles
  reportUrl: string        // link to full audit report
}): Promise<boolean> {
  const { to, businessName, niche, overallScore, websiteScore, seoScore, reputationScore, topIssues, reportUrl } = params
  const nicheLabel = NICHE_LABEL[niche] || niche
  const fromEmail  = process.env.OUTREACH_FROM_EMAIL || 'hello@webcrew.app'

  function scoreColor(s: number) {
    if (s >= 80) return '#10b981'
    if (s >= 50) return '#f59e0b'
    return '#ef4444'
  }

  function scoreLabel(s: number) {
    if (s >= 80) return 'Good'
    if (s >= 50) return 'Needs Work'
    return 'Critical'
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your Free AI Growth Audit</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:40px 20px 0;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0f0c29 0%,#1a1a2e 50%,#16213e 100%);border-radius:16px 16px 0 0;padding:36px 40px 28px;border:1px solid rgba(255,255,255,0.08);border-bottom:none;">
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Free AI Growth Audit</p>
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;line-height:1.2;">${businessName}</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.45);font-size:14px;">${nicheLabel} · Growth Analysis</p>
          </td>
        </tr>

        <!-- Overall score hero -->
        <tr>
          <td style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-top:none;padding:32px 40px;text-align:center;">
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Overall Score</p>
            <div style="font-size:72px;font-weight:900;color:${scoreColor(overallScore)};line-height:1;margin:12px 0 8px;">${overallScore}</div>
            <div style="font-size:18px;color:rgba(255,255,255,0.6);">/ 100 — ${scoreLabel(overallScore)}</div>
            <p style="margin:16px 0 0;color:rgba(255,255,255,0.5);font-size:14px;line-height:1.6;">
              We analyzed your website, SEO, reputation, and booking experience.<br>
              Here's what's holding <strong style="color:#fff;">${businessName}</strong> back from more clients.
            </p>
          </td>
        </tr>

        <!-- Score breakdown -->
        <tr>
          <td style="background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-top:none;padding:28px 40px;">
            <p style="margin:0 0 20px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Score Breakdown</p>
            ${[
              ['Website Speed', websiteScore],
              ['SEO & Local Visibility', seoScore],
              ['Reputation & Reviews', reputationScore],
            ].map(([label, score]) => `
            <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:14px;">
              <tr>
                <td style="color:rgba(255,255,255,0.7);font-size:14px;padding-bottom:6px;">${label}</td>
                <td align="right" style="color:${scoreColor(score as number)};font-size:14px;font-weight:700;padding-bottom:6px;">${score}/100</td>
              </tr>
              <tr>
                <td colspan="2">
                  <div style="background:rgba(255,255,255,0.08);border-radius:4px;height:6px;">
                    <div style="background:${scoreColor(score as number)};border-radius:4px;height:6px;width:${score}%;"></div>
                  </div>
                </td>
              </tr>
            </table>`).join('')}
          </td>
        </tr>

        <!-- Top issues -->
        <tr>
          <td style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-top:none;padding:28px 40px;">
            <p style="margin:0 0 20px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Top Issues Found</p>
            ${topIssues.slice(0, 3).map((issue, i) => `
            <table cellpadding="0" cellspacing="0" style="margin-bottom:12px;"><tr>
              <td style="padding-right:12px;vertical-align:top;">
                <div style="width:20px;height:20px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:50%;font-size:10px;font-weight:700;color:#ef4444;text-align:center;line-height:20px;">${i + 1}</div>
              </td>
              <td style="color:rgba(255,255,255,0.75);font-size:14px;line-height:1.5;">${issue}</td>
            </tr></table>`).join('')}
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(91,33,182,0.08));border:1px solid rgba(139,92,246,0.3);border-top:none;padding:32px 40px;text-align:center;">
            <p style="margin:0 0 16px;color:rgba(255,255,255,0.7);font-size:15px;line-height:1.6;">
              See your full report with all recommendations, competitor comparison, and a step-by-step fix plan.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
              <tr>
                <td style="background:linear-gradient(135deg,#7c3aed,#5b21b6);border-radius:12px;">
                  <a href="${reportUrl}" style="display:block;padding:16px 36px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;letter-spacing:-0.2px;">
                    View Full Audit Report →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;color:rgba(255,255,255,0.35);font-size:12px;">Takes 2 minutes to read. No signup required.</p>
          </td>
        </tr>

        <!-- What we do -->
        <tr>
          <td style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-top:none;border-radius:0 0 16px 16px;padding:28px 40px;">
            <p style="margin:0 0 16px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">We fix these for ${nicheLabel} businesses</p>
            <table cellpadding="0" cellspacing="0" width="100%">
              ${[
                ['🤖', 'AI Reception', '24/7 phone answering — included, $0 setup + 30-day free trial, then $297/mo flat'],
                ['🌐', 'AI Website', 'Lightning-fast, mobile-first, SEO-optimized'],
                ['⭐', 'AI Growth', 'Review responses + GBP posts + monthly report'],
              ].map(([icon, title, desc]) => `
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="padding-right:12px;font-size:18px;">${icon}</td>
                    <td>
                      <strong style="color:#fff;font-size:13px;display:block;">${title}</strong>
                      <span style="color:rgba(255,255,255,0.4);font-size:12px;">${desc}</span>
                    </td>
                  </tr></table>
                </td>
              </tr>`).join('')}
            </table>
            <p style="margin:20px 0 0;color:rgba(255,255,255,0.3);font-size:12px;line-height:1.6;">
              You received this free audit because we help ${nicheLabel.toLowerCase()} businesses grow with AI.<br>
              To unsubscribe, reply "no thanks" and we'll remove you immediately.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to,
      subject: `Your free AI Growth Audit — ${businessName} scored ${overallScore}/100`,
      html,
    }),
  })

  return res.ok
}

// ─── Welcome email (post-payment) ────────────────────────────────────────────

export async function sendWelcomeEmail(params: {
  to: string
  businessName: string
  siteUrl: string
  portalUrl: string          // magic-link URL → /client/dashboard
  receptionPhone?: string    // AI reception number if active
  calendlyUrl?: string       // booking link for onboarding call
}): Promise<boolean> {
  const { to, businessName, siteUrl, portalUrl, receptionPhone, calendlyUrl } = params
  const fromEmail = process.env.OUTREACH_FROM_EMAIL || 'hello@webcrew.app'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your site is live — ${businessName}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:40px 20px 0;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#052e16 0%,#14532d 100%);border-radius:16px 16px 0 0;padding:36px 40px 28px;border:1px solid rgba(255,255,255,0.08);border-bottom:none;">
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">✅ Payment confirmed</p>
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;line-height:1.2;">${businessName} is live.</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.45);font-size:14px;">Your professional website is up and running.</p>
          </td>
        </tr>

        <!-- Site live block -->
        <tr>
          <td style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-top:none;padding:32px 40px;">
            <p style="margin:0 0 20px;color:rgba(255,255,255,0.7);font-size:16px;line-height:1.6;">
              Welcome aboard! Your site is now live at the link below. Share it everywhere — Google, Instagram, business cards, everything.
            </p>

            <table cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
              <tr>
                <td style="background:linear-gradient(135deg,#16a34a,#15803d);border-radius:12px;">
                  <a href="${siteUrl}" style="display:block;padding:18px 40px;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;text-align:center;">
                    🌐 &nbsp;View Your Live Site
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;color:rgba(255,255,255,0.4);font-size:12px;text-align:center;">${siteUrl}</p>
          </td>
        </tr>

        ${receptionPhone ? `
        <!-- AI Reception block -->
        <tr>
          <td style="background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-top:none;padding:32px 40px;">
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">🤖 AI Reception — Active</p>
            <p style="margin:0 0 16px;color:rgba(255,255,255,0.8);font-size:22px;font-weight:800;letter-spacing:-0.3px;">${receptionPhone}</p>
            <p style="margin:0;color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;">
              Your AI receptionist is live on this number. It answers every call 24/7, qualifies leads, and handles FAQs — so you never miss a customer. Forward your business line here or share it directly.
            </p>
          </td>
        </tr>` : ''}

        <!-- Portal access -->
        <tr>
          <td style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-top:none;padding:32px 40px;">
            <p style="margin:0 0 12px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Your dashboard</p>
            <p style="margin:0 0 20px;color:rgba(255,255,255,0.7);font-size:15px;line-height:1.6;">
              Track your site performance, reviews, and request changes anytime from your client portal.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#1e293b;border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:14px 28px;">
                  <a href="${portalUrl}" style="color:#60a5fa;text-decoration:none;font-size:14px;font-weight:600;">
                    Open my dashboard →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:10px 0 0;color:rgba(255,255,255,0.3);font-size:11px;">One-click login — no password needed. Link expires in 15 min.</p>
          </td>
        </tr>

        ${calendlyUrl ? `
        <!-- Onboarding call -->
        <tr>
          <td style="background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(79,70,229,0.06));border:1px solid rgba(99,102,241,0.25);border-top:none;padding:28px 40px;text-align:center;">
            <p style="margin:0 0 10px;color:rgba(255,255,255,0.7);font-size:15px;line-height:1.5;">
              Want a 15-min walkthrough? I'll show you how to get the most from your new site.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);border-radius:10px;padding:12px 24px;">
                  <a href="${calendlyUrl}" style="color:#a5b4fc;text-decoration:none;font-size:14px;font-weight:600;">
                    📅 &nbsp;Book a free 15-min call
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>` : ''}

        <!-- Footer -->
        <tr>
          <td style="background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;">
            <p style="margin:0;color:rgba(255,255,255,0.3);font-size:12px;line-height:1.6;">
              Questions? Reply to this email — we typically respond within a few hours.<br>
              Powered by <strong style="color:rgba(255,255,255,0.5);">Webcrew AI</strong>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to,
      subject: `Your site is live — ${businessName} ✅`,
      html,
    }),
  })

  return res.ok
}
