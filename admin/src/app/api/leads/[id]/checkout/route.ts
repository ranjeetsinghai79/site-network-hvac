export const runtime = "edge"

import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { PLAN_CATALOG, PLAN_KEYS, priceLabel, type PlanKey } from "@/lib/plans"

const STRIPE_KEY  = process.env.STRIPE_SECRET_KEY  ?? ""
const ADMIN_URL   = process.env.ADMIN_URL           ?? "https://webcrew-admin.pages.dev"
const RESEND_KEY  = process.env.RESEND_API_KEY      ?? ""
const FROM_EMAIL  = process.env.OUTREACH_FROM_EMAIL ?? "hello@webcrew.app"

async function stripePost(path: string, params: URLSearchParams): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${STRIPE_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })
  return res.json()
}

async function sendPaymentEmail(params: {
  to: string
  businessName: string
  checkoutUrl: string
  planLabel: string
  amount: string
  note?: string
}): Promise<void> {
  if (!RESEND_KEY) return
  const { to, businessName, checkoutUrl, planLabel, amount, note } = params

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
<tr><td align="center" style="padding:40px 20px;">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

<tr><td style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);border-radius:16px 16px 0 0;padding:36px 40px 28px;border:1px solid rgba(255,255,255,0.08);border-bottom:none;">
  <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:3px;text-transform:uppercase;">💳 Your site is ready</p>
  <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">${businessName}</h1>
  <p style="margin:8px 0 0;color:rgba(255,255,255,0.5);font-size:14px;">${planLabel}</p>
</td></tr>

<tr><td style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-top:none;padding:32px 40px;">
  <p style="margin:0 0 20px;color:rgba(255,255,255,0.75);font-size:16px;line-height:1.65;">
    Your free demo site is live and ready to go. To activate it and unlock your AI team, complete your secure payment below.
  </p>

  <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;">
    <tr>
      <td style="background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:16px 20px;">
        <p style="margin:0;color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:2px;">Plan</p>
        <p style="margin:4px 0 0;color:#fff;font-size:16px;font-weight:700;">${planLabel}</p>
      </td>
      <td width="16"></td>
      <td style="background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:16px 20px;">
        <p style="margin:0;color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:2px;">Amount</p>
        <p style="margin:4px 0 0;color:#22c55e;font-size:20px;font-weight:800;">${amount}</p>
      </td>
    </tr>
  </table>

  <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 12px;">
    <tr><td style="background:linear-gradient(135deg,#6366f1,#4f46e5);border-radius:12px;">
      <a href="${checkoutUrl}" style="display:block;padding:18px 40px;color:#fff;text-decoration:none;font-size:17px;font-weight:700;text-align:center;">
        🔒 &nbsp;Complete Secure Payment
      </a>
    </td></tr>
  </table>
  <p style="margin:0 0 24px;color:rgba(255,255,255,0.35);font-size:11px;text-align:center;">Powered by Stripe · 256-bit SSL encryption</p>

  <p style="margin:0;color:rgba(255,255,255,0.4);font-size:13px;line-height:1.6;">
    Questions? Reply to this email — we respond within a few hours.<br>
    — The WebCrew Team
  </p>
</td></tr>

<tr><td style="background:#0f172a;border:1px solid rgba(255,255,255,0.06);border-top:none;border-radius:0 0 16px 16px;padding:20px 40px;">
  <p style="margin:0;color:rgba(255,255,255,0.2);font-size:11px;">
    You received this because you requested a demo from webcrew.app.
    <a href="${ADMIN_URL}/unsubscribe" style="color:rgba(255,255,255,0.3);">Unsubscribe</a>
  </p>
</td></tr>

</table></td></tr></table>
</body></html>`

  await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from:    FROM_EMAIL,
      to,
      subject: note
        ? `${note} — ${businessName} 🚀`
        : `Complete your payment — ${businessName} is ready 🚀`,
      html,
    }),
  }).catch(() => {})
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!STRIPE_KEY) return NextResponse.json({ error: "STRIPE_SECRET_KEY not set" }, { status: 500 })

  const { id } = await params
  const body   = await req.json() as {
    plan?:               string
    base_plan?:          string   // custom pricing only — enforces PLAN_CATALOG[base_plan].floor
    custom_amount?:      number   // cents
    custom_description?: string
    custom_interval?:    "one-time" | "monthly"
    note?:               string
    send_email?:         boolean
    checkout_url?:       string   // reuse existing URL instead of creating new session
  }

  const db = await getDb()
  const { rows } = await db.query(`SELECT * FROM leads WHERE id = $1`, [id])
  const lead = rows[0]
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  if (!lead.email) return NextResponse.json({ error: "Lead has no email address" }, { status: 400 })

  const planKey  = body.plan ?? "ai_front_office"
  const sendEmail = body.send_email !== false  // default true unless explicitly false
  const note      = body.note ?? ""

  // If caller passes an existing URL, skip session creation and just email it
  if (body.checkout_url) {
    if (sendEmail) {
      const catalogPlan = (PLAN_KEYS as string[]).includes(planKey) ? PLAN_CATALOG[planKey as PlanKey] : null
      const info = catalogPlan
        ? { label: `${catalogPlan.name} (${priceLabel(catalogPlan)}${catalogPlan.billing === "one_time" ? " one-time" : ""})`, amount: priceLabel(catalogPlan) }
        : { label: body.custom_description ?? "Custom Plan", amount: body.custom_amount ? `$${(body.custom_amount / 100).toFixed(0)}` : "" }
      await sendPaymentEmail({ to: lead.email, businessName: lead.name, checkoutUrl: body.checkout_url, planLabel: info.label, amount: info.amount, note })
    }
    return NextResponse.json({ ok: true, checkoutUrl: body.checkout_url })
  }

  let checkoutUrl: string
  let sessionId:   string

  if (planKey === "custom") {
    // ── Custom pricing: use price_data inline ────────────────────────────────
    const amountCents = body.custom_amount ?? 0
    if (amountCents < 50) return NextResponse.json({ error: "Minimum amount is $0.50" }, { status: 400 })

    // A negotiated custom amount can still be tied to a real plan's floor
    // (e.g. a founder-approved deal below the automated ladder) — if
    // base_plan is given, never let it undercut that plan's own floor.
    if (body.base_plan && (PLAN_KEYS as string[]).includes(body.base_plan)) {
      const basePlan = PLAN_CATALOG[body.base_plan as PlanKey]
      const floor = basePlan.floor ?? basePlan.price
      if (amountCents < floor) {
        return NextResponse.json({ error: `Below ${basePlan.name}'s floor of ${priceLabel(basePlan, floor)} — this needs explicit override, not the standard custom-amount path.` }, { status: 400 })
      }
    }

    const desc     = body.custom_description || `WebCrew — Custom plan for ${lead.name}`
    const isMonthly = body.custom_interval === "monthly"
    const mode      = isMonthly ? "subscription" : "payment"

    const p = new URLSearchParams()
    p.set("mode",                mode)
    p.set("customer_email",      lead.email)
    p.set("metadata[lead_id]",   id)
    p.set("metadata[plan]",      "custom")
    p.set("success_url",         `${ADMIN_URL}/leads?payment=success&id=${id}`)
    p.set("cancel_url",          `${ADMIN_URL}/leads?payment=cancelled&id=${id}`)
    p.set("allow_promotion_codes","true")

    if (isMonthly) {
      p.set("line_items[0][price_data][currency]",                       "usd")
      p.set("line_items[0][price_data][product_data][name]",             desc)
      p.set("line_items[0][price_data][unit_amount]",                    String(amountCents))
      p.set("line_items[0][price_data][recurring][interval]",            "month")
      p.set("line_items[0][quantity]",                                   "1")
      p.set("subscription_data[metadata][lead_id]",                      id)
      p.set("subscription_data[metadata][plan]",                        "custom")
    } else {
      p.set("line_items[0][price_data][currency]",                       "usd")
      p.set("line_items[0][price_data][product_data][name]",             desc)
      p.set("line_items[0][price_data][unit_amount]",                    String(amountCents))
      p.set("line_items[0][quantity]",                                   "1")
      p.set("payment_intent_data[metadata][lead_id]",                    id)
    }

    const session = await stripePost("/checkout/sessions", p)
    if (!session.url) return NextResponse.json({ error: session.error?.message ?? "Stripe session failed" }, { status: 502 })
    checkoutUrl = session.url
    sessionId   = session.id

    if (sendEmail) {
      const dollars = (amountCents / 100).toFixed(0)
      await sendPaymentEmail({ to: lead.email, businessName: lead.name, checkoutUrl, planLabel: desc, amount: `$${dollars}${isMonthly ? "/mo" : ""}`, note })
    }

  } else {
    // ── Preset plans: use pre-created Stripe price IDs ───────────────────────
    if (!(PLAN_KEYS as string[]).includes(planKey)) return NextResponse.json({ error: `Unknown plan: ${planKey}` }, { status: 400 })
    const plan = PLAN_CATALOG[planKey as PlanKey]
    if (!plan.available) return NextResponse.json({ error: `${plan.name} is not available yet` }, { status: 400 })
    const mode = plan.billing === "one_time" ? "payment" : "subscription"

    const priceId = process.env[plan.envKey]
    if (!priceId) {
      return NextResponse.json(
        { error: `${plan.envKey} not set. Create price in Stripe Dashboard and add ID to admin/.env.local` },
        { status: 500 }
      )
    }

    const p = new URLSearchParams()
    p.set("mode",                          mode)
    p.set("line_items[0][price]",          priceId)
    p.set("line_items[0][quantity]",       "1")
    p.set("customer_email",                lead.email)
    p.set("metadata[lead_id]",             id)
    p.set("metadata[business_name]",       lead.name ?? "")
    p.set("metadata[plan]",                planKey)
    p.set("success_url",                   `${ADMIN_URL}/leads?payment=success&id=${id}`)
    p.set("cancel_url",                    `${ADMIN_URL}/leads?payment=cancelled&id=${id}`)
    p.set("allow_promotion_codes",         "true")
    if (mode === "payment") {
      p.set("payment_intent_data[metadata][lead_id]", id)
    } else {
      // Every subscription plan is sold with a 30-day free trial (site copy,
      // Sofia's SMS close, RECEPTION_OFFER.trialDays) — without this, Stripe
      // charges the full amount immediately on card entry instead of after
      // the trial.
      p.set("subscription_data[trial_period_days]", "30")
      p.set("subscription_data[metadata][lead_id]",  id)
      p.set("subscription_data[metadata][plan]",      planKey)
    }

    const session = await stripePost("/checkout/sessions", p)
    if (!session.url) return NextResponse.json({ error: session.error?.message ?? "Stripe session failed" }, { status: 502 })
    checkoutUrl = session.url
    sessionId   = session.id

    if (sendEmail) {
      const label = `${plan.name} (${priceLabel(plan)}${plan.billing === "one_time" ? " one-time" : ""})`
      await sendPaymentEmail({ to: lead.email, businessName: lead.name, checkoutUrl, planLabel: label, amount: priceLabel(plan), note })
    }
  }

  // Persist
  await db.query(
    `UPDATE leads SET stripe_payment_link = $1, stripe_session_id = $2,
     status = 'payment_link_sent', updated_at = NOW() WHERE id = $3`,
    [checkoutUrl, sessionId, id]
  )

  return NextResponse.json({ ok: true, checkoutUrl, sessionId })
}
