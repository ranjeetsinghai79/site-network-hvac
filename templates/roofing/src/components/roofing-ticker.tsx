"use client"

const ITEMS = [
  { label: "EMERGENCY DISPATCH ACTIVE", accent: true },
  { label: "287+ Roofs Installed" },
  { label: "4.8★ Google Rating" },
  { label: "GAF Master Elite — Top 3%" },
  { label: "Same-Day Emergency Tarping" },
  { label: "24/7 Storm Response" },
  { label: "95% Insurance Covered" },
  { label: "CSLB Licensed · Fully Insured" },
  { label: "Serving Tracy & Central Valley" },
]

function Item({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span className="inline-flex items-center gap-5 shrink-0 px-2" style={{ fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "0.1em" }}>
      <span className="text-xs uppercase" style={{ color: accent ? "var(--brand-accent)" : "rgba(245,245,245,0.45)" }}>{label}</span>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent ? "var(--brand-accent)" : "rgba(234,88,12,0.25)" }} />
    </span>
  )
}

export default function RoofingTicker() {
  return (
    <div className="relative overflow-hidden py-3" style={{ background: "linear-gradient(90deg, #0D0F12 0%, #111316 50%, #0D0F12 100%)", borderTop: "1px solid rgba(234,88,12,0.1)", borderBottom: "1px solid rgba(234,88,12,0.1)" }}>
      <div className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none" style={{ background: "linear-gradient(90deg, #0D0F12, transparent)" }} />
      <div className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none" style={{ background: "linear-gradient(-90deg, #0D0F12, transparent)" }} />
      <div className="ticker-track">{[...ITEMS, ...ITEMS].map((item, i) => <Item key={i} {...item} />)}</div>
    </div>
  )
}
