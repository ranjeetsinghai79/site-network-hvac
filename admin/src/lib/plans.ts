// Canonical WebCrew plan/pricing table for admin billing — single source of
// truth for admin/src/app/api/leads/[id]/checkout/route.ts,
// admin/src/components/payment-modal.tsx, and billing-card.tsx, which
// previously each hand-rolled their own copy and had drifted out of sync
// (checkout/route.ts said reception=$69/mo, payment-modal.tsx's own two
// arrays disagreed with each other at $69 vs $149, billing-card.tsx had a
// fifth, unrelated launch/grow/scale scheme). Mirrors api/src/index.ts's
// PLAN_CATALOG exactly (no shared package across the Worker/Next.js
// runtimes today) — keep both copies in sync by hand when a price changes.

export type PlanKey = 'website_only' | 'website_hosted' | 'ai_front_office' | 'ai_reception_only' | 'everything' | 'marketing_only'

export interface PlanDef {
  key: PlanKey
  name: string
  price: number         // list price, cents
  floor?: number         // never sell below this, cents — absent means no discount at all
  ladder?: number[]      // negotiation steps, cents, first entry = list price
  billing: 'one_time' | 'subscription'
  available: boolean     // false = not sellable yet (marketing isn't built)
  envKey: string          // process.env var name holding this plan's real Stripe Price ID
  desc: string
}

export const PLAN_CATALOG: Record<PlanKey, PlanDef> = {
  website_only: {
    key: 'website_only', name: 'Website only', price: 39900, floor: 19900, ladder: [39900, 29900, 19900], billing: 'one_time', available: true,
    envKey: 'STRIPE_PRICE_ID_WEBSITE_ONLY', desc: 'Website ownership — hosted on Cloudflare Pages, no monthly commitment',
  },
  website_hosted: {
    key: 'website_hosted', name: 'Website, hosted + maintained', price: 4900, floor: 2900, ladder: [4900, 2900],
    billing: 'subscription', available: true,
    envKey: 'STRIPE_PRICE_ID_WEBSITE_HOSTED', desc: 'Hosting + weekly GBP posts + review replies + weekly report',
  },
  ai_front_office: {
    key: 'ai_front_office', name: 'AI Front Office', price: 29700, floor: 17900, ladder: [29700, 22900, 17900],
    billing: 'subscription', available: true,
    envKey: 'STRIPE_PRICE_ID_AI_FRONT_OFFICE', desc: 'Website + 24/7 AI reception + booking + lead capture/nurture/follow-ups + revenue recovery',
  },
  ai_reception_only: {
    key: 'ai_reception_only', name: 'AI Reception only', price: 19900, floor: 12900, ladder: [19900, 15900, 12900],
    billing: 'subscription', available: true,
    envKey: 'STRIPE_PRICE_ID_AI_RECEPTION_ONLY', desc: '24/7 AI phone reception + booking — no website included',
  },
  everything: {
    key: 'everything', name: 'Everything + Marketing', price: 49900, billing: 'subscription', available: false,
    envKey: 'STRIPE_PRICE_ID_EVERYTHING', desc: 'Website + AI Reception + Lead Gen + Marketing — coming soon',
  },
  marketing_only: {
    key: 'marketing_only', name: 'Marketing only', price: 24900, billing: 'subscription', available: false,
    envKey: 'STRIPE_PRICE_ID_MARKETING_ONLY', desc: 'Marketing only — coming soon',
  },
}

export const PLAN_KEYS = Object.keys(PLAN_CATALOG) as PlanKey[]

export function priceLabel(plan: PlanDef, cents: number = plan.price): string {
  return plan.billing === 'one_time' ? `$${(cents / 100).toFixed(0)}` : `$${(cents / 100).toFixed(0)}/mo`
}

export function planLabel(plan: PlanDef, cents: number = plan.price): string {
  return `${plan.name} (${priceLabel(plan, cents)}${plan.billing === 'one_time' ? ' one-time' : ''})`
}
