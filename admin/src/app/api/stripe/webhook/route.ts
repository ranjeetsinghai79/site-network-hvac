export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { createResetToken } from '@/lib/client-auth'
import { hmacSha256Hex, timingSafeEqual } from '@/lib/edge-crypto'

export const dynamic = 'force-dynamic'

// ─── Stripe signature verification ────────────────────────────────────────────

async function verifySignature(rawBody: string, sig: string, secret: string): Promise<boolean> {
  const parts = sig.split(',').reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split('=')
    if (k && v) acc[k] = v
    return acc
  }, {})
  const { t: timestamp, v1: sigHash } = parts
  if (!timestamp || !sigHash) return false
  // Reject events older than 5 min — blocks replay of a captured signed payload.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(age) || age > 300) return false
  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`)
  return timingSafeEqual(expected, sigHash)
}

// ─── Cloudflare Pages domain attachment ──────────────────────────────────────

async function attachDomain(projectName: string, domain: string): Promise<void> {
  const token     = process.env.CLOUDFLARE_TOKEN
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!token || !accountId || !projectName || !domain) return

  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/domains`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: domain }),
    }
  ).catch(() => {})
}

// ─── AI Reception provisioning ───────────────────────────────────────────────

// A Twilio number costs real money the moment it is bought. Only a LIVE-mode Stripe payment may
// buy one: test-mode checkouts (QA, our own end-to-end runs) still create the receptionist
// config so the flow can be exercised, but skip the purchase. `livemode` comes straight from
// Stripe's signed event, so it can't be spoofed by the client.
async function provisionReception(lead: any, livemode: boolean): Promise<{ phone: string | null; configId: string | null; webhook: string | null }> {
  const baseUrl = process.env.RECEPTION_BASE_URL
  const secret  = process.env.RECEPTION_PROVISION_SECRET
  if (!baseUrl || !secret) return { phone: null, configId: null, webhook: null }

  try {
    const res = await fetch(`${baseUrl}/provision`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: lead.id,
        websiteUrl: lead.website || undefined,
        businessName: lead.name,
        phone: lead.phone,
        email: lead.email,
        industry: lead.niche,
        city: [lead.city, lead.state].filter(Boolean).join(', '),
        paymentConfirmed: livemode === true,
      }),
    })
    const data = await res.json() as any
    if (!res.ok || !data?.ok) throw new Error(data?.error || 'Reception provisioning failed')
    return {
      phone: data.twilioNumber ?? null,
      configId: data.configId ?? null,
      webhook: data.twilioWebhook ?? null,
    }
  } catch {
    return { phone: null, configId: null, webhook: null }
  }
}

// ─── Welcome email ────────────────────────────────────────────────────────────

async function sendWelcomeEmail(params: {
  to: string
  businessName: string
  siteUrl: string
  portalUrl: string
  connectGoogleUrl: string
  receptionPhone?: string | null
  calendlyUrl?: string | null
}): Promise<void> {
  const { to, businessName, siteUrl, portalUrl, connectGoogleUrl, receptionPhone, calendlyUrl } = params
  const fromEmail = process.env.OUTREACH_FROM_EMAIL || 'hello@webcrew.app'
  const key = process.env.RESEND_API_KEY
  if (!key) return

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your site is live — ${businessName}</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
<tr><td align="center" style="padding:40px 20px 0;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<tr><td style="background:linear-gradient(135deg,#052e16 0%,#14532d 100%);border-radius:16px 16px 0 0;padding:36px 40px 28px;border:1px solid rgba(255,255,255,0.08);border-bottom:none;">
  <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">✅ Payment confirmed</p>
  <h1 style="margin:0;color:#fff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">${businessName} is live.</h1>
  <p style="margin:8px 0 0;color:rgba(255,255,255,0.45);font-size:14px;">Your professional website is up and running.</p>
</td></tr>

<tr><td style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-top:none;padding:32px 40px;">
  <p style="margin:0 0 20px;color:rgba(255,255,255,0.7);font-size:16px;line-height:1.6;">
    Welcome aboard! Your site is live. Share it everywhere — Google, Instagram, business cards, everything.
  </p>
  <table cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
    <tr><td style="background:linear-gradient(135deg,#16a34a,#15803d);border-radius:12px;">
      <a href="${siteUrl}" style="display:block;padding:18px 40px;color:#fff;text-decoration:none;font-size:17px;font-weight:700;text-align:center;">🌐 &nbsp;View Your Live Site</a>
    </td></tr>
  </table>
  <p style="margin:0;color:rgba(255,255,255,0.4);font-size:12px;text-align:center;">${siteUrl}</p>
</td></tr>

${receptionPhone ? `
<tr><td style="background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-top:none;padding:32px 40px;">
  <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">🤖 AI Reception — Active</p>
  <p style="margin:0 0 12px;color:rgba(255,255,255,0.9);font-size:24px;font-weight:800;">${receptionPhone}</p>
  <p style="margin:0;color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;">
    Your AI receptionist answers every call 24/7 — qualifies leads, handles FAQs, books appointments. Forward your business line here or share it directly.
  </p>
</td></tr>` : ''}

<tr><td style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-top:none;padding:32px 40px;">
  <p style="margin:0 0 12px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Your dashboard</p>
  <p style="margin:0 0 20px;color:rgba(255,255,255,0.7);font-size:15px;line-height:1.6;">
    Track your site performance, reviews, and request changes anytime.
  </p>
  <table cellpadding="0" cellspacing="0">
    <tr><td style="background:#1e293b;border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:14px 28px;">
      <a href="${portalUrl}" style="color:#60a5fa;text-decoration:none;font-size:14px;font-weight:600;">Create my password and open my dashboard →</a>
    </td></tr>
  </table>
  <p style="margin:8px 0 0;color:rgba(255,255,255,0.3);font-size:11px;">One-click login — no password. Link expires in 15 min.</p>
</td></tr>

<tr><td style="background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(5,150,105,0.05));border:1px solid rgba(16,185,129,0.25);border-top:none;padding:28px 40px;text-align:center;">
  <p style="margin:0 0 6px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">⚡ Activate 3 more AI agents</p>
  <p style="margin:0 0 14px;color:rgba(255,255,255,0.8);font-size:16px;font-weight:600;">Connect Google to unlock GBP posts, review replies + weekly reports</p>
  <p style="margin:0 0 16px;color:rgba(255,255,255,0.55);font-size:13px;">Takes 30 seconds. We only access Business Profile + Search Console.</p>
  <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr><td style="background:linear-gradient(135deg,#16a34a,#0ea5e9);border-radius:10px;padding:14px 28px;">
      <a href="${connectGoogleUrl}" style="color:#fff;text-decoration:none;font-size:14px;font-weight:700;">🔗 &nbsp;Connect Google →</a>
    </td></tr>
  </table>
</td></tr>

${calendlyUrl ? `
<tr><td style="background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(79,70,229,0.06));border:1px solid rgba(99,102,241,0.25);border-top:none;padding:28px 40px;text-align:center;">
  <p style="margin:0 0 14px;color:rgba(255,255,255,0.7);font-size:15px;">Want a 15-min walkthrough? I'll show you everything your AI team is doing for you.</p>
  <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr><td style="background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);border-radius:10px;padding:12px 24px;">
      <a href="${calendlyUrl}" style="color:#a5b4fc;text-decoration:none;font-size:14px;font-weight:600;">📅 &nbsp;Book a free 15-min call — I'm open 9–6 PST</a>
    </td></tr>
  </table>
</td></tr>` : ''}

<tr><td style="background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;">
  <p style="margin:0;color:rgba(255,255,255,0.3);font-size:12px;line-height:1.6;">
    Questions? Reply to this email — we typically respond within a few hours.<br>
    Powered by <strong style="color:rgba(255,255,255,0.5);">Webcrew AI</strong>
  </p>
</td></tr>

</table></td></tr></table>
</body></html>`

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to,
      subject: `Your site is live — ${businessName} ✅`,
      html,
    }),
  }).catch(() => {})
}

async function sendWelcomeSms(to: string, businessName: string, portalUrl: string, receptionPhone?: string | null): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER
  if (!sid || !token || !from || !to) return false
  const receptionLine = receptionPhone ? ` Your AI Reception number: ${receptionPhone}.` : ''
  const body = `Welcome to WebCrew, ${businessName}. Create your password and open your client portal (link valid 7 days): ${portalUrl}.${receptionLine} Reply STOP to unsubscribe. – WebCrew`
  try {
    const form = new URLSearchParams({ To: to, From: from, Body: body })
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    })
    return res.ok
  } catch {
    return false
  }
}

// ─── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Two Stripe modes can hit this one endpoint: admin's own live-mode
  // Payment Links/subscriptions (STRIPE_WEBHOOK_SECRET), and Sofia's
  // autonomous-close checkout in api/ which deliberately stays on a
  // test-mode Stripe key (STRIPE_WEBHOOK_SECRET_TEST) until flipped live as
  // a separate decision. Stripe signs each mode's events with that mode's
  // own webhook endpoint secret, so try both rather than picking one.
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_WEBHOOK_SECRET_TEST]
    .filter((s): s is string => !!s)
  if (secrets.length === 0) {
    return NextResponse.json({ error: 'No STRIPE_WEBHOOK_SECRET(_TEST) set' }, { status: 500 })
  }

  const rawBody = await req.text()
  const sig     = req.headers.get('stripe-signature') ?? ''

  let verified = false
  for (const secret of secrets) {
    if (await verifySignature(rawBody, sig, secret)) { verified = true; break }
  }
  if (!verified) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(rawBody)
  // Stripe test and live endpoints can both deliver to multiple deployments.
  // Process an event only in the environment that created it so QA can never
  // provision a production client (or vice versa). Legacy events without the
  // marker remain production-only.
  const appEnvironment = process.env.APP_ENV === 'qa' ? 'qa' : 'production'
  const eventEnvironment = event.data?.object?.metadata?.environment ?? 'production'
  if (eventEnvironment !== appEnvironment) {
    return NextResponse.json({ ok: true, ignoredEnvironment: eventEnvironment })
  }
  const db    = await getDb()

  // ── One-time payment completed ──────────────────────────────────────────────
  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'payment_intent.succeeded'
  ) {
    const obj    = event.data.object
    const leadId = obj.metadata?.lead_id
    if (!leadId) return NextResponse.json({ ok: true })

    // A completed Checkout can still be unpaid for delayed payment methods.
    // Never purchase a number or activate a workspace until Stripe confirms it.
    // Exception: a subscription-mode session with a free trial and nothing due
    // today reports payment_status as 'no_payment_required', not 'paid' — a
    // card was still collected (that's what actually gates abuse here), so
    // this must count as confirmed for subscription mode specifically. Found
    // while wiring the call-triggered trial-start flow; this also silently
    // affected the pre-existing free-trial checkout flows before this fix.
    const paymentConfirmed = event.type === 'payment_intent.succeeded'
      ? obj.status === 'succeeded'
      : (obj.payment_status === 'paid' || (obj.mode === 'subscription' && obj.payment_status === 'no_payment_required'))
    if (!paymentConfirmed) {
      console.log(`[Stripe Webhook] Awaiting confirmed payment — ${leadId}`)
      return NextResponse.json({ ok: true, awaitingPayment: true })
    }

    const { rows } = await db.query(`SELECT * FROM leads WHERE id = $1`, [leadId])
    const lead = rows[0]
    if (!lead) return NextResponse.json({ ok: true })

    // Mark paid
    await db.query(
      `UPDATE leads SET paid = TRUE, paid_at = NOW(), status = 'paid',
       stripe_session_id = $1,
       subscription_active = CASE WHEN $3 THEN TRUE ELSE subscription_active END
       WHERE id = $2`,
      [obj.id, leadId, obj.mode === 'subscription']
    )

    // Attach custom domain (if pre-set)
    if (lead.custom_domain && lead.cloudflare_url) {
      const projectName = lead.cloudflare_url
        .replace(/^https?:\/\//, '')
        .replace('.pages.dev', '')
      await attachDomain(projectName, lead.custom_domain)
    }

    // Provision AI Reception
    if (event.livemode !== true) console.log(`[Stripe Webhook] Test-mode payment for ${leadId} — receptionist config created, Twilio number NOT purchased`)
    const reception = await provisionReception(lead, event.livemode === true)
    const receptionPhone = reception.phone
    if (reception.configId) {
      await db.query(
        `UPDATE leads SET reception_phone=$1,reception_config_id=$2,webhook_url=$3 WHERE id=$4`,
        [receptionPhone, reception.configId, reception.webhook, leadId]
      )
    }

    // Send welcome email with a 7-day create-password link
    if (lead.email) {
      const adminUrl  = process.env.ADMIN_URL || 'http://localhost:3010'
      // 7-day "create your password" link (the old 15-minute sign-in link was dead by the time most people opened the email).
      const token     = await createResetToken(lead.email, 'welcome', 7 * 24 * 60)
      const portalUrl = token ? `${adminUrl}/client/reset/${token}` : `${adminUrl}/client/forgot`
      const siteUrl   = lead.custom_domain
        ? `https://${lead.custom_domain}`
        : (lead.cloudflare_url || lead.vercel_url || '')

      await sendWelcomeEmail({
        to:               lead.email,
        businessName:     lead.name,
        siteUrl,
        portalUrl,
        connectGoogleUrl: `${adminUrl}/connect?leadId=${leadId}`,
        receptionPhone,
        calendlyUrl:      process.env.CALENDLY_URL ?? null,
      })
      // The caller explicitly consented to the trial-link SMS before checkout.
      // Reuse that channel only when the persisted lead confirms SMS consent.
      if (lead.phone && lead.sms_consent === true) {
        const smsSent = await sendWelcomeSms(lead.phone, lead.name, portalUrl, receptionPhone)
        console.log(`[Stripe Webhook] Portal welcome SMS sent=${smsSent} — ${leadId}`)
      }
    }

    // Mark handed off
    await db.query(
      `UPDATE leads SET handed_off = TRUE, handed_off_at = NOW(), status = 'handed_off' WHERE id = $1`,
      [leadId]
    )

    // Create + send receipt invoice for one-time payments
    if (event.type === 'checkout.session.completed' && obj.mode === 'payment' && lead.email) {
      try {
        const stripeKey = process.env.STRIPE_SECRET_KEY ?? ''
        const amountTotal = obj.amount_total ?? 29900
        const description = `WebCrew — ${lead.name} | ${obj.metadata?.plan ?? 'site'} plan`

        // Get or create customer
        const custParams = new URLSearchParams()
        custParams.set('email', lead.email)
        custParams.set('name',  lead.name ?? '')
        custParams.set('metadata[lead_id]', leadId)
        const custResp = await fetch('https://api.stripe.com/v1/customers', {
          method: 'POST',
          headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: custParams.toString(),
        })
        const customer = await custResp.json() as any
        if (customer.id) {
          await db.query(`UPDATE leads SET stripe_customer_id = $1 WHERE id = $2`, [customer.id, leadId])

          // Invoice item
          const itemP = new URLSearchParams()
          itemP.set('customer', customer.id); itemP.set('amount', String(amountTotal))
          itemP.set('currency', 'usd');        itemP.set('description', description)
          await fetch('https://api.stripe.com/v1/invoiceitems', {
            method: 'POST', headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: itemP.toString(),
          })

          // Create + finalize + send invoice
          const invP = new URLSearchParams()
          invP.set('customer', customer.id); invP.set('collection_method', 'send_invoice')
          invP.set('days_until_due', '0');   invP.set('auto_advance', 'false')
          invP.set('metadata[lead_id]', leadId)
          const invResp  = await fetch('https://api.stripe.com/v1/invoices', { method: 'POST', headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: invP.toString() })
          const inv      = await invResp.json() as any
          if (inv.id) {
            await fetch(`https://api.stripe.com/v1/invoices/${inv.id}/finalize`, { method: 'POST', headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: '' })
            await fetch(`https://api.stripe.com/v1/invoices/${inv.id}/send`,     { method: 'POST', headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: '' })
            console.log(`[Stripe Webhook] Invoice sent — ${lead.name} | ${inv.id}`)
          }
        }
      } catch (e: any) {
        console.warn(`[Stripe Webhook] Invoice creation failed (non-fatal): ${e.message}`)
      }
    }

    console.log(`[Stripe Webhook] Handoff complete — ${lead.name}`)
  }

  // ── Subscription created ────────────────────────────────────────────────────
  if (event.type === 'customer.subscription.created') {
    const sub    = event.data.object
    const leadId = sub.metadata?.lead_id
    if (leadId) {
      await db.query(
        `UPDATE leads SET stripe_customer_id = $1, stripe_subscription_id = $2,
         subscription_active = $5, subscription_plan = $3 WHERE id = $4`,
        [sub.customer, sub.id, sub.metadata?.plan || 'reception', leadId, sub.status === 'active']
      )
    }
  }

  // ── Subscription cancelled ──────────────────────────────────────────────────
  // Actually stops service now, not just a DB flag nobody read: also flips
  // reception_configs.active off, which pipeline/src/reception/server.ts's
  // /voice/:configId handler checks before ever opening a media stream (was
  // built with an index for exactly this purpose but never wired — a
  // canceled subscription kept answering calls, and costing real Gemini/
  // Twilio money, indefinitely).
  if (event.type === 'customer.subscription.deleted') {
    const sub    = event.data.object
    const leadId = sub.metadata?.lead_id
    if (leadId) {
      await db.query(
        `UPDATE leads SET subscription_active = FALSE WHERE id = $1`,
        [leadId]
      )
      await db.query(
        `UPDATE reception_configs SET active = FALSE, updated_at = NOW() WHERE lead_id = $1`,
        [leadId]
      )
    }
  }

  // ── Subscription updated (plan change, past_due, reactivated, etc.) ──────────
  // Previously unhandled entirely — a plan change or a card-decline-driven
  // past_due state never reached this system's DB at all. Mirrors the same
  // active-flag sync as subscription.deleted above, both directions: a
  // recovered payment (status back to active/trialing) re-activates
  // reception, not just cancellation deactivating it.
  if (event.type === 'customer.subscription.updated') {
    const sub    = event.data.object
    const leadId = sub.metadata?.lead_id
    if (leadId) {
      const isActive = ['active', 'trialing'].includes(sub.status)
      await db.query(
        `UPDATE leads SET subscription_active = $1, subscription_plan = COALESCE($2, subscription_plan) WHERE id = $3`,
        [isActive, sub.metadata?.plan || null, leadId]
      )
      await db.query(
        `UPDATE reception_configs SET active = $1, updated_at = NOW() WHERE lead_id = $2`,
        [isActive, leadId]
      )
      console.log(`[Stripe Webhook] Subscription updated — lead ${leadId} → status=${sub.status} active=${isActive}`)
    }
  }

  // ── Failed payment — previously silent, nobody at WebCrew ever knew ──────────
  // Stripe's own Smart Retries/dunning still runs regardless; this just makes
  // sure a human finds out instead of a declined card going unnoticed until
  // the subscription eventually cancels itself weeks later.
  if (event.type === 'invoice.payment_failed') {
    const invoice        = event.data.object
    const subscriptionId = invoice.subscription
    if (subscriptionId) {
      const { rows: leadRows } = await db.query(
        `SELECT id, name, email FROM leads WHERE stripe_subscription_id = $1`,
        [subscriptionId]
      )
      const lead = leadRows[0]
      const amountDue  = ((invoice.amount_due ?? 0) / 100).toFixed(2)
      const hostedUrl  = invoice.hosted_invoice_url ?? ''
      const notifyEmail = process.env.NOTIFICATION_EMAIL || process.env.BUSINESS_OWNER_EMAIL
      const resendKey   = process.env.RESEND_API_KEY
      const fromEmail   = process.env.OUTREACH_FROM_EMAIL || 'hello@webcrew.app'

      if (resendKey && notifyEmail) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: fromEmail, to: notifyEmail,
            subject: `⚠️ Payment failed — ${lead?.name ?? 'unknown lead'} ($${amountDue})`,
            html: `<p>A subscription payment failed for <b>${lead?.name ?? subscriptionId}</b> — $${amountDue} due.</p>
                   <p>Stripe will retry automatically. Hosted invoice: ${hostedUrl ? `<a href="${hostedUrl}">${hostedUrl}</a>` : '—'}</p>`,
          }),
        }).catch(() => {})
      }
      if (resendKey && lead?.email && hostedUrl) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: fromEmail, to: lead.email,
            subject: `Action needed — your WebCrew payment didn't go through`,
            html: `<p>Hi ${lead.name ?? 'there'},</p>
                   <p>We weren't able to process your payment of $${amountDue}. Please update your payment method to avoid any interruption:</p>
                   <p><a href="${hostedUrl}">Update payment method →</a></p>
                   <p>Questions? Just reply to this email.</p>`,
          }),
        }).catch(() => {})
      }
      console.log(`[Stripe Webhook] Payment failed — ${lead?.name ?? subscriptionId} | $${amountDue}`)
    }
  }

  // ── Recurring invoice paid → affiliate commission accrual ────────────────
  // Covers both the first cycle and every renewal uniformly (no separate
  // credit at checkout.session.completed — that would double-count month 1,
  // since Stripe invoices the first cycle immediately on subscription
  // creation too). 30% of what was actually collected, recurring for the
  // life of the subscription. dedupe via referral_commissions'
  // (affiliate_id, stripe_invoice_id) unique constraint protects against
  // webhook retries.
  if (event.type === 'invoice.payment_succeeded' || event.type === 'invoice.paid') {
    const invoice        = event.data.object
    const subscriptionId = invoice.subscription
    if (subscriptionId) {
      const { rows: leadRows } = await db.query(
        `SELECT id, referred_by FROM leads WHERE stripe_subscription_id = $1`,
        [subscriptionId]
      )
      const lead = leadRows[0]
      if (lead?.referred_by) {
        const { rows: affRows } = await db.query(
          `SELECT id FROM affiliates WHERE referral_code = $1 AND status = 'approved'`,
          [lead.referred_by]
        )
        const affiliate = affRows[0]
        if (affiliate) {
          const amountPaid        = (invoice.amount_paid ?? 0) / 100
          const commissionAmount  = Math.round(amountPaid * 0.30 * 100) / 100
          await db.query(
            `INSERT INTO referral_commissions (affiliate_id, lead_id, stripe_invoice_id, commission_amount, commission_pct)
             VALUES ($1, $2, $3, $4, 30)
             ON CONFLICT (affiliate_id, stripe_invoice_id) DO NOTHING`,
            [affiliate.id, lead.id, invoice.id, commissionAmount]
          )
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
