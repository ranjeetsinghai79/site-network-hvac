"use client"

const ITEMS = [
  { label: "Fiduciary Advisor — Always Your Best Interest", accent: true },
  { label: "CFP® Certified Financial Planners" },
  { label: "$2.4B+ Assets Under Advisory" },
  { label: "4.9★ Google Rating" },
  { label: "Retirement · Investments · Insurance · Estate" },
  { label: "Fee-Only — Zero Commissions" },
  { label: "Free 60-Minute Consultation" },
  { label: "FINRA / SEC Registered" },
  { label: "Serving Tracy & Central Valley" },
]

function Item({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span className="inline-flex items-center gap-6 shrink-0 px-2">
      <span style={{ fontFamily: "var(--font-body)", fontSize: "0.7rem", fontWeight: accent ? 600 : 400, letterSpacing: "0.12em", textTransform: "uppercase", color: accent ? "var(--brand-accent, #C9A55A)" : "rgba(232,224,208,0.42)" }}>
        {label}
      </span>
      <span style={{ width: 3, height: 3, borderRadius: "50%", background: accent ? "var(--brand-accent, #C9A55A)" : "rgba(201,165,90,0.25)", flexShrink: 0, display: "inline-block" }} />
    </span>
  )
}

export default function FinancialAdvisorTicker() {
  return (
    <div style={{ position: "relative", overflow: "hidden", padding: "0.75rem 0", background: "var(--brand-bg-2, #0C1218)", borderTop: "1px solid var(--brand-border, rgba(201,165,90,0.15))", borderBottom: "1px solid var(--brand-border, rgba(201,165,90,0.15))" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 80, zIndex: 1, pointerEvents: "none", background: "linear-gradient(90deg, var(--brand-bg-2, #0C1218), transparent)" }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 80, zIndex: 1, pointerEvents: "none", background: "linear-gradient(-90deg, var(--brand-bg-2, #0C1218), transparent)" }} />
      <div className="ticker-track">
        {[...ITEMS, ...ITEMS].map((item, i) => <Item key={i} {...item} />)}
      </div>
    </div>
  )
}
