/**
 * Stripe Agent — payment links + webhook handler
 *
 * Handles:
 * 1. Create payment link per lead (one-time or subscription)
 * 2. Webhook: payment.succeeded → trigger site handoff
 * 3. Handoff: add custom domain, deliver credentials, send confirmation
 *
 * Pricing tiers (set via env):
 *   WEBSITE_PRICE_ONE_TIME   e.g. 29900  (cents = $299)
 *   WEBSITE_PRICE_MONTHLY    e.g. 4900   (cents = $49/mo)
 *
 * Webhook secret: STRIPE_WEBHOOK_SECRET (from Stripe dashboard)
 */

import type { Lead, AgentResult } from '../types.js'

// ─── Stripe REST helper (no SDK dependency — raw fetch) ───────────────────

async function stripePost(path: string, params: Record<string, string>): Promise<any> {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY not set')

  const body = new URLSearchParams(params)
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  const data = await res.json() as any
  if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`)
  return data
}

async function stripeGet(path: string): Promise<any> {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY not set')

  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  const data = await res.json() as any
  if (!res.ok) throw new Error(data.error?.message || `Stripe ${res.status}`)
  return data
}

// ─── Create or retrieve Stripe price ─────────────────────────────────────

async function getOrCreatePrice(): Promise<{ oneTime: string; monthly: string }> {
  const oneTimeAmount  = parseInt(process.env.WEBSITE_PRICE_ONE_TIME || '29900', 10)
  const monthlyAmount  = parseInt(process.env.WEBSITE_PRICE_MONTHLY  || '4900', 10)

  // Create one-time price
  const oneTimePrice = await stripePost('/prices', {
    'currency': 'usd',
    'unit_amount': String(oneTimeAmount),
    'product_data[name]': 'AI-Agent-Ready Business Website',
    'product_data[description]': 'Professional website optimized for AI agent discovery. Found in ChatGPT, Perplexity & Google AI. Includes llms.txt, FAQPage + HowTo schema, 24/7 AI receptionist integration, sitemap, and local SEO.',
    'product_data[url]': 'https://webcrew.app',
  })

  // Create monthly recurring price
  const monthlyPrice = await stripePost('/prices', {
    'currency': 'usd',
    'unit_amount': String(monthlyAmount),
    'recurring[interval]': 'month',
    'product_data[name]': 'AI Business Manager — Monthly',
    'product_data[description]': 'AI Front Office for local businesses: 24/7 AI call answering, GBP posts, Google review replies, and monthly analytics. Cancel anytime.',
    'product_data[url]': 'https://webcrew.app',
  })

  return { oneTime: oneTimePrice.id, monthly: monthlyPrice.id }
}

// ─── Create payment link ──────────────────────────────────────────────────

export async function createPaymentLink(lead: Lead): Promise<{
  oneTimeUrl: string
  monthlyUrl: string
  sessionId: string
}> {
  const { oneTime, monthly } = await getOrCreatePrice()

  const successUrl = `${process.env.PIPELINE_API_URL || 'https://your-pipeline.com'}/payment/success?lead=${lead.id}&session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl  = `${process.env.PIPELINE_API_URL || 'https://your-pipeline.com'}/payment/cancel`

  // One-time payment session
  const session = await stripePost('/checkout/sessions', {
    'mode': 'payment',
    'line_items[0][price]': oneTime,
    'line_items[0][quantity]': '1',
    'success_url': successUrl,
    'cancel_url': cancelUrl,
    'customer_email': lead.email || '',
    'metadata[lead_id]': lead.id || '',
    'metadata[lead_name]': lead.name,
    'metadata[lead_niche]': lead.niche,
    'metadata[demo_url]': lead.vercel_url || lead.cloudflare_url || '',
  })

  // Payment link (shareable, no session expiry)
  const link = await stripePost('/payment_links', {
    'line_items[0][price]': oneTime,
    'line_items[0][quantity]': '1',
    'metadata[lead_id]': lead.id || '',
    'after_completion[type]': 'redirect',
    'after_completion[redirect][url]': successUrl.replace('{CHECKOUT_SESSION_ID}', 'pl_success'),
  })

  // Monthly link
  const monthlyLink = await stripePost('/payment_links', {
    'line_items[0][price]': monthly,
    'line_items[0][quantity]': '1',
    'metadata[lead_id]': lead.id || '',
    'subscription_data[metadata][lead_id]': lead.id || '',
  })

  return {
    oneTimeUrl: link.url,
    monthlyUrl: monthlyLink.url,
    sessionId: session.id,
  }
}

// ─── Webhook event verification ───────────────────────────────────────────

export function verifyStripeWebhook(rawBody: string, signature: string): any {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET not set')

  // Manual HMAC-SHA256 verification (no Stripe SDK needed)
  const parts = signature.split(',').reduce((acc, part) => {
    const [key, val] = part.split('=')
    acc[key] = val
    return acc
  }, {} as Record<string, string>)

  const timestamp = parts['t']
  const sigHash   = parts['v1']

  if (!timestamp || !sigHash) throw new Error('Invalid Stripe signature format')

  const { createHmac } = require('crypto')
  const payload = `${timestamp}.${rawBody}`
  const expected = createHmac('sha256', webhookSecret).update(payload).digest('hex')

  if (expected !== sigHash) throw new Error('Stripe signature mismatch')

  return JSON.parse(rawBody)
}

// ─── Handle successful payment ────────────────────────────────────────────

export async function handlePaymentSuccess(
  event: any,
  findLeadById: (id: string) => Promise<Lead | null>,
  updateLeadFn: (lead: Lead) => Promise<void>,
  sendHandoffEmail: (lead: Lead) => Promise<void>
): Promise<void> {
  const session = event.data.object
  const leadId  = session.metadata?.lead_id

  if (!leadId) return

  const lead = await findLeadById(leadId)
  if (!lead) return

  console.log(`[Stripe] Payment received for ${lead.name} (${session.amount_total / 100} USD)`)

  const updatedLead: Lead = {
    ...lead,
    paid: true,
    paid_at: new Date().toISOString(),
    stripe_session_id: session.id,
    status: 'paid',
  }

  await updateLeadFn(updatedLead)
  await sendHandoffEmail(updatedLead)
  await triggerHandoff(updatedLead, updateLeadFn)
}

// ─── Site handoff after payment ───────────────────────────────────────────

async function triggerHandoff(
  lead: Lead,
  updateLeadFn: (lead: Lead) => Promise<void>
): Promise<void> {
  console.log(`[Handoff] Starting for ${lead.name}`)

  // Options delivered to client:
  // 1. Point their domain's CNAME to Cloudflare Pages URL
  // 2. Transfer GitHub repo ownership
  // 3. Export static build as zip

  const handoffNotes = `
Your website is live at: ${lead.vercel_url || lead.cloudflare_url}

To connect your domain:
1. Log in to your domain registrar (GoDaddy, Namecheap, etc.)
2. Add a CNAME record:
   Name: www (or @)
   Value: ${(lead.vercel_url || '').replace('https://', '')}
3. Your site will be live at your domain within 24 hours.

Need help? Reply to this email or text us.
  `.trim()

  // Send handoff email via Resend
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey && lead.email) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.OUTREACH_FROM_EMAIL || 'hello@yourcompany.com',
        to: lead.email,
        subject: `Your website is ready — ${lead.name}`,
        text: handoffNotes,
        html: handoffNotes.replace(/\n/g, '<br>'),
      }),
    })
  }

  await updateLeadFn({
    ...lead,
    handed_off: true,
    handed_off_at: new Date().toISOString(),
    status: 'handed_off',
  })

  console.log(`[Handoff] ✓ ${lead.name} — instructions sent to ${lead.email}`)
}

// ─── Main agent ───────────────────────────────────────────────────────────

type StripeAction = 'create_link'

export async function runStripeAgent(
  lead: Lead,
  action: StripeAction
): Promise<AgentResult<{ paymentUrl: string; monthlyUrl: string }>> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { success: false, error: 'STRIPE_SECRET_KEY not set' }
  }

  try {
    if (action === 'create_link') {
      const { oneTimeUrl, monthlyUrl } = await createPaymentLink(lead)
      console.log(`[Stripe] Payment link created for ${lead.name}`)
      return { success: true, data: { paymentUrl: oneTimeUrl, monthlyUrl } }
    }
    return { success: false, error: `Unknown action: ${action}` }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
