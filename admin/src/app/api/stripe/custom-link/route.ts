export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const secret     = process.env.STRIPE_SECRET_KEY
  const resendKey  = process.env.RESEND_API_KEY
  if (!secret) return NextResponse.json({ error: 'No Stripe key' }, { status: 500 })

  const { amount, interval = 'month', description, clientEmail, clientName } = await req.json()

  if (!amount || amount < 1) {
    return NextResponse.json({ error: 'amount required (in dollars)' }, { status: 400 })
  }

  const amountCents = Math.round(Number(amount) * 100)
  const planName    = description || `WebCrew ${interval === 'month' ? 'Monthly' : 'Annual'} Plan`

  // 1. Create a one-off Price
  const priceRes = await fetch('https://api.stripe.com/v1/prices', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      currency: 'usd',
      unit_amount: String(amountCents),
      'recurring[interval]': interval,
      'product_data[name]': planName,
    }).toString(),
  })

  const price = await priceRes.json() as { id: string; error?: { message: string } }
  if (price.error) return NextResponse.json({ error: price.error.message }, { status: 400 })

  // 2. Create Payment Link
  const linkRes = await fetch('https://api.stripe.com/v1/payment_links', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'line_items[0][price]': price.id,
      'line_items[0][quantity]': '1',
    }).toString(),
  })

  const link = await linkRes.json() as { url: string; id: string; error?: { message: string } }
  if (link.error) return NextResponse.json({ error: link.error.message }, { status: 400 })

  // 3. Email the link to client if email provided
  let emailSent = false
  if (clientEmail && resendKey) {
    const greeting = clientName ? `Hi ${clientName},` : 'Hi,'
    const displayAmount = `$${amount}/${interval === 'month' ? 'mo' : 'yr'}`

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'WebCrew <billing@webcrew.app>',
        to: [clientEmail],
        subject: `Your WebCrew payment link — ${displayAmount}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0f172a;color:#e2e8f0;border-radius:12px">
            <img src="https://webcrew.app/logo.png" alt="WebCrew" style="height:32px;margin-bottom:24px" onerror="this.style.display='none'"/>
            <h1 style="font-size:20px;font-weight:800;color:#fff;margin:0 0 8px">${planName}</h1>
            <p style="color:#94a3b8;font-size:14px;margin:0 0 24px">${greeting}<br/><br/>
            Your custom WebCrew plan is ready. Click below to complete your subscription setup.</p>
            <a href="${link.url}" style="display:inline-block;padding:14px 28px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px">
              Pay ${displayAmount} →
            </a>
            <p style="color:#475569;font-size:12px;margin-top:32px">
              Questions? Reply to this email or text us at +1 (918) 255-5151.<br/>
              WebCrew · <a href="https://webcrew.app" style="color:#6366f1">webcrew.app</a>
            </p>
          </div>
        `,
      }),
    })
    emailSent = emailRes.ok
  }

  return NextResponse.json({
    url: link.url,
    price_id: price.id,
    link_id: link.id,
    amount_cents: amountCents,
    interval,
    email_sent: emailSent,
  })
}
