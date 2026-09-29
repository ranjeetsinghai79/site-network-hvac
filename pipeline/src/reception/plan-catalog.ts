// Canonical WebCrew plan/pricing table — Node-side copy for voice reception
// (twilio-relay.ts + browser-relay.ts, which duplicate get_webcrew_pricing/
// build_founder_offer between them; both import this one module instead of
// each hand-rolling its own copy). Mirrors api/src/index.ts's PLAN_CATALOG
// exactly (Cloudflare Workers can't import this file directly — no shared
// package across the two runtimes today, same as CAL_EVENT_TYPE_ID etc.).
// Keep both copies in sync by hand when a price changes.

export type PlanKey = 'website_only' | 'website_hosted' | 'ai_front_office' | 'ai_reception_only' | 'everything' | 'marketing_only'

export interface PlanDef {
  name: string
  price: number         // list price, cents
  floor?: number         // never sell below this, cents — absent means no discount at all
  ladder?: number[]      // negotiation steps, cents, first entry = list price
  billing: 'one_time' | 'subscription'
  available: boolean     // false = not sellable yet (marketing isn't built) — waitlist only
  includes: string[]
}

export const PLAN_CATALOG: Record<PlanKey, PlanDef> = {
  website_only: {
    name: 'Website only', price: 39900, floor: 19900, ladder: [39900, 29900, 19900], billing: 'one_time', available: true,
    includes: ['custom mobile-ready website', 'no monthly commitment'],
  },
  website_hosted: {
    name: 'Website, hosted + maintained', price: 4900, floor: 2900, ladder: [4900, 2900],
    billing: 'subscription', available: true,
    includes: ['hosting, SSL, and performance maintenance', 'weekly Google Business Profile posts', 'Google review reply assistance', 'weekly report'],
  },
  ai_front_office: {
    name: 'AI Front Office', price: 29700, floor: 17900, ladder: [29700, 22900, 17900],
    billing: 'subscription', available: true,
    includes: ['custom mobile-ready website', 'hosting, SSL, and performance maintenance', 'custom domain connection', '24/7 AI phone receptionist', 'lead qualification', 'appointment booking', 'call recording, transcripts, and summaries', 'instant lead SMS and email alerts', 'weekly Google Business Profile posts', 'Google review reply assistance', 'monthly search performance report'],
  },
  ai_reception_only: {
    name: 'AI Reception only', price: 19900, floor: 12900, ladder: [19900, 15900, 12900],
    billing: 'subscription', available: true,
    includes: ['24/7 AI phone receptionist', 'lead qualification', 'appointment booking', 'call recording, transcripts, and summaries', 'instant lead SMS and email alerts', 'no website included'],
  },
  everything: {
    name: 'Everything + Marketing', price: 49900, billing: 'subscription', available: false,
    includes: ['website + AI Reception + Lead Gen + Marketing — coming soon'],
  },
  marketing_only: {
    name: 'Marketing only', price: 24900, billing: 'subscription', available: false,
    includes: ['marketing only — coming soon'],
  },
}

/**
 * Deterministic "how much do we actually offer" resolver. The AI decides
 * WHICH plan and WHETHER to move forward — this decides the number, so a
 * free-text model can never invent or discount a figure outside the
 * approved ladder. pushbackCount steps through a plan's ladder (0 = list
 * price, 1 = next rung, ...), clamped to the last rung (the floor). Returns
 * null if the plan isn't sellable yet, or a stated budget is below even the
 * floor — the caller should fall back to cheapestPlanUnder() instead of a
 * flat decline.
 */
export function resolveOffer(planKey: PlanKey, statedBudgetCents: number, pushbackCount: number): { amountCents: number; atFloor: boolean } | null {
  const plan = PLAN_CATALOG[planKey]
  if (!plan.available) return null
  const ladder = plan.ladder ?? [plan.price]
  const rung = Math.min(Math.max(pushbackCount, 0), ladder.length - 1)
  let amountCents = ladder[rung]
  const floor = plan.floor ?? plan.price
  if (statedBudgetCents > 0 && statedBudgetCents < amountCents) {
    if (statedBudgetCents < floor) return null
    amountCents = Math.max(statedBudgetCents, floor)
  }
  return { amountCents, atFloor: amountCents <= floor }
}

/** "Never just say no" fallback — closest available plan under a stated budget. */
export function cheapestPlanUnder(statedBudgetCents: number): PlanKey | null {
  const candidates = (Object.entries(PLAN_CATALOG) as [PlanKey, PlanDef][])
    .filter(([, p]) => p.available)
    .map(([key, p]) => [key, p.floor ?? p.price] as const)
    .filter(([, floor]) => floor <= statedBudgetCents)
    .sort((a, b) => b[1] - a[1])
  return candidates[0]?.[0] ?? null
}

export function priceLabel(plan: PlanDef, cents: number): string {
  return plan.billing === 'one_time' ? `$${(cents / 100).toFixed(0)} one-time` : `$${(cents / 100).toFixed(0)}/mo`
}
