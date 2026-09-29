export const runtime = "edge"

import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"

// webcrew/src/app/terms/page.tsx's "Satisfaction Guarantee" clause promises
// a full refund within 30 days of delivery — until now there was no code
// path to actually issue one; it relied entirely on someone manually
// finding the charge in the Stripe dashboard. Admin-triggered only (not
// self-serve), matching the ToS's own "confirmed... by a human team member"
// framing for anything outside the flat published plans.

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? ""
const RESEND_KEY = process.env.RESEND_API_KEY ?? ""
const FROM_EMAIL = process.env.OUTREACH_FROM_EMAIL ?? "hello@webcrew.app"

async function stripeGet(path: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  })
  return res.json()
}

async function stripePost(path: string, params: URLSearchParams): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })
  return res.json()
}

async function sendRefundEmail(to: string, businessName: string, amountCents: number, reason: string): Promise<void> {
  if (!RESEND_KEY) return
  const dollars = (amountCents / 100).toFixed(2)
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL, to,
      subject: `Your refund has been processed — $${dollars}`,
      html: `<p>Hi,</p><p>We've processed a refund of <b>$${dollars}</b> for ${businessName}${reason ? ` (${reason})` : ""}.</p>
             <p>It typically takes 5-10 business days to appear on your statement, depending on your bank.</p>
             <p>Questions? Just reply to this email.</p>`,
    }),
  }).catch(() => {})
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!STRIPE_KEY) return NextResponse.json({ error: "STRIPE_SECRET_KEY not set" }, { status: 500 })

  const { id } = await params
  const body = await req.json() as {
    amount_cents?: number  // omit for a full refund of the original payment
    reason?: string        // internal note, also used in the customer email
  }

  const db = await getDb()
  const { rows } = await db.query(`SELECT * FROM leads WHERE id = $1`, [id])
  const lead = rows[0]
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  if (!lead.stripe_session_id) return NextResponse.json({ error: "No Stripe checkout session on record for this lead" }, { status: 400 })

  // Resolve the payment intent from the original checkout session — covers
  // both one-time payments and a subscription's first invoice. Refunding a
  // LATER subscription cycle isn't supported here (would need that specific
  // invoice/charge id, not stored anywhere today) — use the Stripe dashboard
  // directly for that case.
  const session = await stripeGet(`/checkout/sessions/${lead.stripe_session_id}`)
  const paymentIntentId = session?.payment_intent
  if (!paymentIntentId) {
    return NextResponse.json({ error: session?.error?.message ?? "Could not resolve a payment_intent for this checkout session — it may not be paid, or may be a subscription cycle beyond the first" }, { status: 400 })
  }

  const p = new URLSearchParams()
  p.set("payment_intent", paymentIntentId)
  if (body.amount_cents) p.set("amount", String(body.amount_cents))
  p.set("metadata[lead_id]", id)
  if (body.reason) p.set("metadata[reason]", body.reason.slice(0, 500))

  const refund = await stripePost("/refunds", p)
  if (!refund.id) return NextResponse.json({ error: refund.error?.message ?? "Refund failed" }, { status: 502 })

  await db.query(
    `UPDATE leads SET refunded = TRUE, refunded_at = NOW(), status = 'refunded', updated_at = NOW() WHERE id = $1`,
    [id]
  )

  if (lead.email) {
    await sendRefundEmail(lead.email, lead.name, refund.amount ?? body.amount_cents ?? 0, body.reason ?? "")
  }

  return NextResponse.json({ ok: true, refundId: refund.id, amountCents: refund.amount, status: refund.status })
}
