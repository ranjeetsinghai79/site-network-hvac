export const runtime = 'edge'
import { Calculator, DollarSign, Gauge, ShieldCheck, TrendingUp } from "lucide-react"
import { PLAN_CATALOG } from "@/lib/plans"

export const dynamic = "force-dynamic"

// COGS are hand-maintained estimates (same convention as before this table
// was reconciled to the real 6-SKU catalog in admin/src/lib/plans.ts) — not
// derived from pipeline/src/tools/cost-tracker.ts's live UNIT_COSTS, since
// Gemini Live voice cost is flagged unverified there. Revisit once real
// usage data exists.
const tiers = [
  {
    name: PLAN_CATALOG.website_only.name,
    price: PLAN_CATALOG.website_only.price / 100,
    cogs: 15,
    target: "One-time ownership",
    included: PLAN_CATALOG.website_only.desc,
    note: "One-time build cost; no ongoing margin to protect.",
  },
  {
    name: PLAN_CATALOG.website_hosted.name,
    price: PLAN_CATALOG.website_hosted.price / 100,
    cogs: 8,
    target: "Low-commitment recurring",
    included: PLAN_CATALOG.website_hosted.desc,
    note: `High margin only if support is minimal. Floor: $${(PLAN_CATALOG.website_hosted.floor ?? 0) / 100}/mo.`,
  },
  {
    name: PLAN_CATALOG.ai_reception_only.name,
    price: PLAN_CATALOG.ai_reception_only.price / 100,
    cogs: 40,
    target: "No-website prospects",
    included: PLAN_CATALOG.ai_reception_only.desc,
    note: `Voice minutes are the real cost driver. Floor: $${(PLAN_CATALOG.ai_reception_only.floor ?? 0) / 100}/mo.`,
  },
  {
    name: PLAN_CATALOG.ai_front_office.name,
    price: PLAN_CATALOG.ai_front_office.price / 100,
    cogs: 45,
    target: "Best seller — default pitch",
    included: PLAN_CATALOG.ai_front_office.desc,
    note: `Best win-win tier if voice-minute caps are enforced. Floor: $${(PLAN_CATALOG.ai_front_office.floor ?? 0) / 100}/mo.`,
  },
  {
    name: PLAN_CATALOG.marketing_only.name,
    price: PLAN_CATALOG.marketing_only.price / 100,
    cogs: 25,
    target: "Coming soon — not sellable yet",
    included: PLAN_CATALOG.marketing_only.desc,
    note: "Ad spend is always pass-through, not included in COGS.",
  },
  {
    name: PLAN_CATALOG.everything.name,
    price: PLAN_CATALOG.everything.price / 100,
    cogs: 70,
    target: "Coming soon — not sellable yet",
    included: PLAN_CATALOG.everything.desc,
    note: "Ad spend is always pass-through, not included in COGS.",
  },
]

const assumptions = [
  "Ad spend is always paid by the client or billed as pass-through.",
  "Voice minutes, SMS, and image generation need monthly caps per tier.",
  "Human support time is the real margin risk; keep onboarding scripted.",
  "Website-only/hosted plans should never include live voice AI — that's what AI Reception/Front Office are for.",
  "Marketing plans (once built) should require approval before campaign launch or budget changes.",
]

export default function EconomicsPage() {
  return (
    <div style={{ padding: "32px 36px", maxWidth: 1180 }}>
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)" }}>
          Pricing & Unit Economics
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 4 }}>
          Launch pricing for AI Front Office. COGS are conservative operating estimates before labor and payment fees.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 26 }}>
        <TopCard icon={<DollarSign size={16} />} label="Flagship Price" value={`$${PLAN_CATALOG.ai_front_office.price / 100}/mo`} color="var(--success)" />
        <TopCard icon={<TrendingUp size={16} />} label="Flagship Floor" value={`$${(PLAN_CATALOG.ai_front_office.floor ?? 0) / 100}/mo`} color="var(--accent-light)" />
        <TopCard icon={<Gauge size={16} />} label="Flagship Est. Margin" value={`${Math.round(((PLAN_CATALOG.ai_front_office.price / 100 - 45) / (PLAN_CATALOG.ai_front_office.price / 100)) * 100)}%`} color="var(--paid)" />
        <TopCard icon={<ShieldCheck size={16} />} label="Rule" value="Cap Usage" color="var(--warning)" />
      </div>

      <section style={panel}>
        <div style={panelHeader}>Tier Profitability</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
            <thead>
              <tr>
                {["Tier", "Price", "Est. COGS", "Gross Profit", "Margin", "Target", "Included"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier) => {
                const profit = tier.price - tier.cogs
                const margin = tier.price > 0 ? Math.round((profit / tier.price) * 100) : null
                return (
                  <tr key={tier.name}>
                    <td style={tdStrong}>{tier.name}</td>
                    <td style={td}>${tier.price}</td>
                    <td style={td}>${tier.cogs.toFixed(0)}</td>
                    <td style={{ ...td, color: profit >= 0 ? "var(--success)" : "var(--error)", fontWeight: 750 }}>
                      {profit >= 0 ? `$${profit.toFixed(0)}` : `-$${Math.abs(profit).toFixed(0)}`}
                    </td>
                    <td style={td}>{margin === null ? "Lead cost" : `${margin}%`}</td>
                    <td style={td}>{tier.target}</td>
                    <td style={{ ...td, color: "var(--text-2)", lineHeight: 1.45 }}>{tier.included}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }}>
        <section style={{ ...panel, padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <Calculator size={16} color="var(--accent-light)" />
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Win-Win Positioning</div>
          </div>
          <p style={{ color: "var(--text-2)", fontSize: 13, lineHeight: 1.65 }}>
            The offer should be “Hire an AI Business Manager” or “Hire your AI Front Office,” not “marketing SaaS.”
            The client buys outcomes: answered calls, captured leads, follow-up, bookings, reviews, content, and lead campaigns.
          </p>
        </section>

        <section style={{ ...panel, padding: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginBottom: 12 }}>Guardrails</div>
          <div style={{ display: "grid", gap: 8 }}>
            {assumptions.map((a) => (
              <div key={a} style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.45 }}>
                <span style={{ color: "var(--warning)", marginRight: 7 }}>•</span>{a}
              </div>
            ))}
          </div>
        </section>
      </div>
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
