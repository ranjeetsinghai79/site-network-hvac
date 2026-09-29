import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const ownerPhone = process.env.BUSINESS_OWNER_PHONE || ''
    const ownerEmail = process.env.BUSINESS_OWNER_EMAIL || ''
    const businessName = process.env.BUSINESS_NAME || 'ProFix HVAC & Plumbing'
    const businessNiche = process.env.BUSINESS_NICHE || 'hvac'

    const payload = {
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      email: body.email || '',
      service: body.service,
      message: body.message || '',
      source: req.headers.get('origin') || 'website',
      businessName,
      businessNiche,
      businessOwnerPhone: ownerPhone,
      businessOwnerEmail: ownerEmail,
      submittedAt: new Date().toISOString(),
    }

    const customerName = `${body.firstName || ''} ${body.lastName || ''}`.trim() || 'A new customer'
    const smsBody = `🔔 New lead from ${businessName} website!\n${customerName} — ${body.phone}\nService: ${body.service || 'Not specified'}\n${body.message ? `Note: ${body.message}` : ''}`

    // ── Forward to pipeline API (primary) ─────────────────────────────────
    if (process.env.PIPELINE_API_URL) {
      await fetch(`${process.env.PIPELINE_API_URL}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {})
    }

    // ── SMS via Twilio (always fire if creds present) ─────────────────────
    const twilioSid = process.env.TWILIO_ACCOUNT_SID
    const twilioToken = process.env.TWILIO_AUTH_TOKEN
    const twilioFrom = process.env.TWILIO_FROM_NUMBER

    if (twilioSid && twilioToken && twilioFrom && ownerPhone) {
      const toNumber = ownerPhone.startsWith('+') ? ownerPhone : `+1${ownerPhone.replace(/\D/g, '')}`
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`

      await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: twilioFrom, To: toNumber, Body: smsBody }).toString(),
      }).catch(() => {})
    }

    // ── Email via Resend (always fire if creds present) ───────────────────
    const resendKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.OUTREACH_FROM_EMAIL || 'leads@webcrew.app'

    if (resendKey && ownerEmail) {
      const html = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#F97316;margin-bottom:4px">New Lead — ${businessName}</h2>
          <p style="color:#666;margin-top:0">Submitted ${new Date().toLocaleString()}</p>
          <table style="width:100%;border-collapse:collapse;margin-top:16px">
            <tr><td style="padding:8px 0;color:#666;width:130px">Name</td><td style="padding:8px 0;font-weight:600">${customerName}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Phone</td><td style="padding:8px 0;font-weight:600"><a href="tel:${body.phone}" style="color:#F97316">${body.phone}</a></td></tr>
            ${body.email ? `<tr><td style="padding:8px 0;color:#666">Email</td><td style="padding:8px 0"><a href="mailto:${body.email}" style="color:#F97316">${body.email}</a></td></tr>` : ''}
            <tr><td style="padding:8px 0;color:#666">Service</td><td style="padding:8px 0">${body.service || '—'}</td></tr>
            ${body.message ? `<tr><td style="padding:8px 0;color:#666">Message</td><td style="padding:8px 0">${body.message}</td></tr>` : ''}
          </table>
          <div style="margin-top:24px;padding:16px;background:#FFF7F0;border-radius:8px;border-left:4px solid #F97316">
            <strong>Respond within 5 minutes</strong> to maximize conversion. Call them now: <a href="tel:${body.phone}" style="color:#F97316">${body.phone}</a>
          </div>
        </div>
      `

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${businessName} Leads <${fromEmail}>`,
          to: [ownerEmail],
          subject: `🔔 New lead: ${customerName} — ${body.service || businessNiche}`,
          html,
        }),
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
