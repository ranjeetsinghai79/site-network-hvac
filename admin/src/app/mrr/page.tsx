export const runtime = "edge"
export const dynamic = "force-dynamic"

import { DollarSign, Target, TrendingUp, Users } from "lucide-react"
import { getWaitlistCounts } from "@/lib/db"
import { PLAN_CATALOG, PLAN_KEYS, priceLabel, type PlanKey } from "@/lib/plans"

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? ""
const MRR_TARGET_CENTS = 100_000_00 // $100k/mo

// No shared Stripe helper exists in this codebase yet (every route hand-
// rolls its own — see checkout/route.ts, promos/route.ts) — matching that
// established pattern rather than introducing a new lib file for one call.
async function stripeGet(path: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  })
  return res.json()
}

interface PlanMrr {
  plan: PlanKey | "custom" | "unknown"
  count: number
  mrrCents: number   // monthly-equivalent revenue — one-time plans contribute 0 here
  oneTimeCents: number
}

async function getActiveSubscriptions(): Promise<any[]> {
  if (!STRIPE_KEY) return []
  const all: any[] = []
  let startingAfter: string | undefined
  for (let page = 0; page < 10; page++) {
    const qs = new URLSearchParams({ status: "active", limit: "100" })
    if (startingAfter) qs.set("starting_after", startingAfter)
    const res = await stripeGet(`/subscriptions?${qs}`)
    if (!res?.data) break
    all.push(...res.data)
    if (!res.has_more) break
    startingAfter = res.data[res.data.length - 1]?.id
  }
  return all
}

function summarizeByPlan(subs: any[]): PlanMrr[] {
  const byPlan = new Map<string, PlanMrr>()
  for (const sub of subs) {
    const key = (sub.metadata?.plan && (PLAN_KEYS as string[]).includes(sub.metadata.plan)) ? sub.metadata.plan
      : sub.metadata?.plan === "custom" ? "custom" : "unknown"
    const entry = byPlan.get(key) ?? { plan: key as PlanKey | "custom" | "unknown", count: 0, mrrCents: 0, oneTimeCents: 0 }
    entry.count += 1
    for (const item of sub.items?.data ?? []) {
      const unitAmount = item.price?.unit_amount ?? item.plan?.amount ?? 0
      const quantity = item.quantity ?? 1
      const interval = item.price?.recurring?.interval ?? item.plan?.interval
      // Normalize to a monthly-equivalent figure — yearly billing would
      // otherwise wildly overstate MRR. No plan sells yearly today, but a
      // custom session could.
      const monthly = interval === "year" ? Math.round((unitAmount * quantity) / 12) : unitAmount * quantity
      entry.mrrCents += monthly
    }
    byPlan.set(key, entry)
  }
  return [...byPlan.values()].sort((a, b) => b.mrrCents - a.mrrCents)
}

export default async function MrrPage() {
  const [subs, waitlist] = await Promise.all([getActiveSubscriptions(), getWaitlistCounts()])
  const byPlan = summarizeByPlan(subs)
  const totalMrrCents = byPlan.reduce((sum, p) => sum + p.mrrCents, 0)
  const totalCustomers = byPlan.reduce((sum, p) => sum + p.count, 0)
  const pctToTarget = Math.min(100, Math.round((totalMrrCents / MRR_TARGET_CENTS) * 100))
  const dollars = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1180 }}>
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)" }}>
          MRR
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 4 }}>
          {!STRIPE_KEY
            ? "STRIPE_SECRET_KEY not set — showing zero until configured."
            : "Live from Stripe active subscriptions, grouped by plan. Target: $100k/mo."}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 26 }}>
        <TopCard icon={<DollarSign size={16} />} label="Current MRR" value={dollars(totalMrrCents)} color="var(--success)" />
        <TopCard icon={<Users size={16} />} label="Paying Customers" value={String(totalCustomers)} color="var(--accent-light)" />
        <TopCard icon={<Target size={16} />} label="Progress to $100k/mo" value={`${pctToTarget}%`} color="var(--paid)" />
        <TopCard icon={<TrendingUp size={16} />} label="Avg Revenue / Customer" value={totalCustomers ? dollars(Math.round(totalMrrCents / totalCustomers)) : "—"} color="var(--warning)" />
      </div>

      <section style={panel}>
        <div style={panelHeader}>Progress to $100k/mo</div>
        <div style={{ padding: "18px 18px 20px" }}>
          <div style={{ height: 10, borderRadius: 100, background: "var(--border)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pctToTarget}%`, borderRadius: 100, background: "linear-gradient(90deg, var(--accent-light), var(--success))", transition: "width 0.4s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "var(--text-2)" }}>
            <span>{dollars(totalMrrCents)}/mo</span>
            <span>$100,000/mo target</span>
          </div>
        </div>
      </section>

      <section style={{ ...panel, marginTop: 18 }}>
        <div style={panelHeader}>MRR by Plan</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr>
                {["Plan", "Customers", "MRR", "List Price"].map(h => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {byPlan.length === 0 && (
                <tr><td style={td} colSpan={4}>No active subscriptions yet.</td></tr>
              )}
              {byPlan.map(row => {
                const plan = row.plan in PLAN_CATALOG ? PLAN_CATALOG[row.plan as PlanKey] : null
                return (
                  <tr key={row.plan}>
                    <td style={tdStrong}>{plan?.name ?? (row.plan === "custom" ? "Custom / negotiated" : "Unknown")}</td>
                    <td style={td}>{row.count}</td>
                    <td style={{ ...td, color: "var(--success)", fontWeight: 750 }}>{dollars(row.mrrCents)}</td>
                    <td style={{ ...td, color: "var(--text-2)" }}>{plan ? priceLabel(plan) : "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ ...panel, marginTop: 18 }}>
        <div style={panelHeader}>Demand — Waitlist (not-yet-built plans)</div>
        <div style={{ padding: "16px 18px", display: "flex", gap: 24, flexWrap: "wrap" }}>
          {(["everything", "marketing_only"] as PlanKey[]).map(key => {
            const count = waitlist.find(w => w.plan_key === key)?.count ?? 0
            return (
              <div key={key}>
                <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                  {PLAN_CATALOG[key].name}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{count}</div>
              </div>
            )
          })}
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-2)", alignSelf: "flex-end" }}>
            Signal for when to prioritize building marketing — not counted toward MRR.
          </p>
        </div>
      </section>
    </div>
  )
}

function TopCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{ ...panel, padding: "15px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color, marginBottom: 10 }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 25, fontWeight: 850, color: "var(--text)", letterSpacing: "-0.04em" }}>{value}</div>
    </div>
  )
}

const panel: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  overflow: "hidden",
}

const panelHeader: React.CSSProperties = {
  padding: "13px 18px",
  borderBottom: "1px solid var(--border)",
  fontSize: 11,
  fontWeight: 800,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
}

const th: React.CSSProperties = {
  textAlign: "left",
  fontSize: 11,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  padding: "12px 14px",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
}

const td: React.CSSProperties = {
  fontSize: 12.5,
  color: "var(--text)",
  padding: "14px",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "top",
}

const tdStrong: React.CSSProperties = {
  ...td,
  fontWeight: 800,
  color: "var(--text)",
}
