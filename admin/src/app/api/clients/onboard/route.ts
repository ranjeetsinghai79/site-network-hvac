export const runtime = 'edge'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

type Step = { key: string; ok: boolean; detail: string }

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i

function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

function safeText(value: unknown, max = 300): string {
  return String(value ?? '').trim().slice(0, max)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))
}

async function createPaymentLink(params: { leadId: string; email: string; businessName: string; plan: string; amount: number }) {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Stripe is not configured')
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' }
  const priceRes = await fetch('https://api.stripe.com/v1/prices', {
    method: 'POST', headers,
    body: new URLSearchParams({
      currency: 'usd', unit_amount: String(Math.round(params.amount * 100)),
      'recurring[interval]': 'month', 'product_data[name]': `WebCrew ${params.plan}`,
    }),
  })
  const price = await priceRes.json() as any
  if (!priceRes.ok || !price.id) throw new Error(price?.error?.message ?? 'Could not create Stripe price')

  const linkRes = await fetch('https://api.stripe.com/v1/payment_links', {
    method: 'POST', headers,
    body: new URLSearchParams({
      'line_items[0][price]': price.id, 'line_items[0][quantity]': '1',
      'metadata[lead_id]': params.leadId, 'metadata[plan]': params.plan,
      'subscription_data[metadata][lead_id]': params.leadId,
      'subscription_data[metadata][plan]': params.plan,
      'after_completion[type]': 'redirect',
      'after_completion[redirect][url]': `${process.env.NEXT_PUBLIC_URL ?? 'https://admin.webcrew.app'}/client/login`,
    }),
  })
  const link = await linkRes.json() as any
  if (!linkRes.ok || !link.url) throw new Error(link?.error?.message ?? 'Could not create Stripe payment link')
  return { url: String(link.url), id: String(link.id), priceId: String(price.id) }
}

async function sendPaymentRequestEmail(params: { to: string; ownerName: string; businessName: string; amount: number; plan: string; paymentUrl: string }) {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.OUTREACH_FROM_EMAIL ?? 'WebCrew <hello@webcrew.app>',
      to: [params.to],
      subject: `Complete your WebCrew activation — ${params.businessName}`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:32px;color:#111827">
        <h1 style="font-size:24px">Your WebCrew plan is ready, ${escapeHtml(params.ownerName)}</h1>
        <p>We prepared the <strong>${escapeHtml(params.plan)}</strong> plan for ${escapeHtml(params.businessName)} at <strong>$${params.amount}/month</strong>.</p>
        <p><a href="${params.paymentUrl}" style="display:inline-block;background:#111827;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Confirm payment and activate</a></p>
        <p>We will provision your AI receptionist, business number, and dashboard only after Stripe confirms the payment. You will receive a separate activation email when everything is ready.</p>
      </div>`,
    }),
  })
  return response.ok
}

export async function POST(request: NextRequest) {
  const input = await request.json()
  const ownerName = safeText(input.ownerName, 120)
  const businessName = safeText(input.businessName, 160)
  const email = safeText(input.email, 254).toLowerCase()
  const phone = normalizePhone(safeText(input.phone, 40))
  const website = safeText(input.website, 500)
  const industry = safeText(input.industry, 120) || 'local-business'
  const city = safeText(input.city, 120)
  const state = safeText(input.state, 40)
  const plan = safeText(input.plan, 80) || 'AI Front Office'
  const amount = Number(input.amount)

  if (!ownerName || !businessName || !emailPattern.test(email) || !phone) {
    return NextResponse.json({ error: 'Owner name, business name, valid email, and valid US phone are required.' }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount < 59 || amount > 5000) {
    return NextResponse.json({ error: 'AI reception onboarding must be between $59 and $5,000 per month.' }, { status: 400 })
  }
  if (website && !/^https?:\/\//i.test(website)) {
    return NextResponse.json({ error: 'Website must start with http:// or https://.' }, { status: 400 })
  }

  const db = await getDb()
  const steps: Step[] = []
  try {
    // Lead identity is the idempotency anchor for every downstream resource.
    let { rows } = await db.query(`SELECT * FROM leads WHERE lower(email)=lower($1) OR phone=$2 ORDER BY created_at DESC LIMIT 1`, [email, phone])
    let lead = rows[0]
    if (!lead) {
      const placeId = `onboard_${Date.now()}_${phone.replace(/\D/g, '').slice(-10)}`
      const inserted = await db.query(`
        INSERT INTO leads (place_id,name,phone,email,website,city,state,niche,status,client_plan,source)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'payment_link_sent',$9,'admin_onboarding') RETURNING *
      `, [placeId, businessName, phone, email, website || null, city || null, state || null, industry, plan])
      lead = inserted.rows[0]
    } else {
      const updated = await db.query(`
        UPDATE leads SET name=$2,phone=$3,email=$4,website=COALESCE(NULLIF($5,''),website),city=COALESCE(NULLIF($6,''),city),
          state=COALESCE(NULLIF($7,''),state),niche=$8,client_plan=$9,status=CASE WHEN paid THEN status ELSE 'payment_link_sent' END,updated_at=now()
        WHERE id=$1 RETURNING *
      `, [lead.id, businessName, phone, email, website, city, state, industry, plan])
      lead = updated.rows[0]
    }
    steps.push({ key: 'client', ok: true, detail: `Client record ${lead.id}` })

    let workspace = (await db.query(`SELECT id FROM growth_workspaces WHERE lead_id=$1 ORDER BY created_at LIMIT 1`, [lead.id])).rows[0]
    if (!workspace) {
      const placeholder = website || `https://onboarding.webcrew.app/client/${lead.id}`
      const agency = (await db.query(`SELECT id FROM agency_accounts WHERE slug='webcrew' LIMIT 1`)).rows[0]
      workspace = (await db.query(`
        INSERT INTO growth_workspaces (lead_id,agency_id,business_name,website_url,industry,city,state,goals,lifecycle_stage,service_tier,onboarding_status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'onboarding',$9,$10) RETURNING id
      `, [lead.id, agency?.id ?? null, businessName, placeholder, industry, city || null, state || null,
          JSON.stringify(['answer_calls','capture_leads','book_appointments']), plan, JSON.stringify({ source: 'one_click_admin', profileComplete: Boolean(website) })])).rows[0]
    }
    steps.push({ key: 'workspace', ok: true, detail: `Workspace ${workspace.id}` })

    let paymentUrl = lead.stripe_payment_url as string | undefined
    if (!paymentUrl) {
      const payment = await createPaymentLink({ leadId: lead.id, email, businessName, plan, amount })
      paymentUrl = payment.url
      await db.query(`UPDATE leads SET stripe_payment_url=$2,subscription_plan=$3 WHERE id=$1`, [lead.id, paymentUrl, plan])
    }
    steps.push({ key: 'billing', ok: true, detail: 'Reusable Stripe subscription link ready' })

    // Payment is the hard provisioning gate. The Stripe webhook performs all
    // billable work only after Stripe reports payment_status=paid.
    const emailSent = await sendPaymentRequestEmail({ to: email, ownerName, businessName, amount, plan, paymentUrl: paymentUrl! })
    steps.push({ key: 'payment_request', ok: emailSent, detail: emailSent ? 'Payment request sent; provisioning is locked' : 'Payment link ready; email provider unavailable' })

    await db.query(`INSERT INTO lead_events (lead_id,event_type,detail) VALUES ($1,'client_payment_requested',$2)`, [lead.id, JSON.stringify({ ownerName, businessName, email, phone, plan, amount, workspaceId: workspace.id, steps })])

    return NextResponse.json({ ok: true, leadId: lead.id, workspaceId: workspace.id, paymentUrl, status: 'awaiting_payment', steps })
  } catch (error: any) {
    steps.push({ key: 'error', ok: false, detail: error?.message ?? String(error) })
    return NextResponse.json({ error: error?.message ?? String(error), steps }, { status: 500 })
  }
}
