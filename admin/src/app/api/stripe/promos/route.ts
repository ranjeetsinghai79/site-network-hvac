export const runtime = "edge"

import { NextRequest, NextResponse } from "next/server"
import { PLAN_CATALOG, PLAN_KEYS, type PlanKey } from "@/lib/plans"

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? ""

async function stripePost(path: string, params: URLSearchParams): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${STRIPE_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body:    params.toString(),
  })
  return res.json()
}

async function stripeGet(path: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  })
  return res.json()
}

// POST — create a new promo code
// Body: { code, percent_off?, amount_off?, max_redemptions?, expires_days?, applies_to_plan? }
export async function POST(req: NextRequest) {
  if (!STRIPE_KEY) return NextResponse.json({ error: "STRIPE_SECRET_KEY not set" }, { status: 500 })

  const body = await req.json() as {
    code:                string   // e.g. "WELCOME50"
    percent_off?:        number   // 0–100
    amount_off?:         number   // cents, e.g. 5000 = $50
    currency?:           string   // default "usd"
    max_redemptions?:    number   // limit uses (e.g. 1 for single-use)
    expires_days?:       number   // days from now until expiry
    applies_to_plan?:    string   // a PlanKey from admin/src/lib/plans.ts (restricts which price)
  }

  if (!body.code) return NextResponse.json({ error: "code required" }, { status: 400 })
  if (!body.percent_off && !body.amount_off) {
    return NextResponse.json({ error: "percent_off or amount_off required" }, { status: 400 })
  }

  // 1. Create coupon
  const couponParams = new URLSearchParams()
  if (body.percent_off) {
    couponParams.set("percent_off", String(body.percent_off))
  } else {
    couponParams.set("amount_off", String(body.amount_off))
    couponParams.set("currency",   body.currency ?? "usd")
  }
  couponParams.set("duration", "once")
  if (body.max_redemptions) couponParams.set("max_redemptions", String(body.max_redemptions))
  if (body.expires_days) {
    const exp = Math.floor(Date.now() / 1000) + body.expires_days * 86400
    couponParams.set("redeem_by", String(exp))
  }

  // Restrict to specific price if requested
  const priceId = (body.applies_to_plan && (PLAN_KEYS as string[]).includes(body.applies_to_plan))
    ? process.env[PLAN_CATALOG[body.applies_to_plan as PlanKey].envKey]
    : undefined
  if (priceId) couponParams.set("applies_to[products][0]", priceId)

  const coupon = await stripePost("/coupons", couponParams)
  if (!coupon.id) {
    return NextResponse.json({ error: coupon.error?.message ?? "Coupon creation failed" }, { status: 502 })
  }

  // 2. Create promo code tied to that coupon
  const promoParams = new URLSearchParams()
  promoParams.set("coupon", coupon.id)
  promoParams.set("code",   body.code.toUpperCase().replace(/\s/g, ""))
  if (body.max_redemptions) promoParams.set("max_redemptions", String(body.max_redemptions))

  const promo = await stripePost("/promotion_codes", promoParams)
  if (!promo.id) {
    return NextResponse.json({ error: promo.error?.message ?? "Promo code creation failed" }, { status: 502 })
  }

  return NextResponse.json({
    ok:            true,
    promo_id:      promo.id,
    code:          promo.code,
    coupon_id:     coupon.id,
    percent_off:   coupon.percent_off ?? null,
    amount_off:    coupon.amount_off ?? null,
    max_redemptions: promo.max_redemptions ?? null,
    times_redeemed:  promo.times_redeemed ?? 0,
    expires_at:    coupon.redeem_by ?? null,
    active:        promo.active,
  })
}

// GET — list active promo codes
export async function GET() {
  if (!STRIPE_KEY) return NextResponse.json({ error: "STRIPE_SECRET_KEY not set" }, { status: 500 })

  const data = await stripeGet("/promotion_codes?limit=20&active=true&expand[]=data.coupon")
  const codes = (data.data ?? []).map((p: any) => ({
    id:              p.id,
    code:            p.code,
    active:          p.active,
    percent_off:     p.coupon?.percent_off ?? null,
    amount_off:      p.coupon?.amount_off ?? null,
    max_redemptions: p.max_redemptions ?? null,
    times_redeemed:  p.times_redeemed ?? 0,
    expires_at:      p.coupon?.redeem_by ?? null,
  }))

  return NextResponse.json({ codes })
}

// DELETE — deactivate a promo code
export async function DELETE(req: NextRequest) {
  if (!STRIPE_KEY) return NextResponse.json({ error: "STRIPE_SECRET_KEY not set" }, { status: 500 })

  const { promo_id } = await req.json() as { promo_id: string }
  if (!promo_id) return NextResponse.json({ error: "promo_id required" }, { status: 400 })

  const p = new URLSearchParams()
  p.set("active", "false")
  const res = await stripePost(`/promotion_codes/${promo_id}`, p)
  return NextResponse.json({ ok: true, active: res.active })
}
