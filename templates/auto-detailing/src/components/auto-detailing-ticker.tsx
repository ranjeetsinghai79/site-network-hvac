"use client"

const ITEMS = [
  { label: "Ceramic Pro Certified Installer", accent: true },
  { label: "276+ Vehicles Detailed" },
  { label: "5.0★ Google Rating" },
  { label: "5-Year Ceramic Warranty" },
  { label: "Mobile Service Available" },
  { label: "Paint Correction Specialists" },
  { label: "Free Paint Assessment" },
  { label: "Gyeon · Gtechniq · CarPro" },
  { label: "Serving Tracy & Central Valley" },
]

function TickerItem({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-5 shrink-0 px-2"
      style={{ fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "0.1em" }}
    >
      <span
        className="text-xs uppercase"
        style={{ color: accent ? "var(--brand-accent)" : "rgba(240,246,255,0.45)" }}
      >
        {label}
      </span>
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: accent ? "var(--brand-accent)" : "rgba(59,130,246,0.25)" }}
      />
    </span>
  )
}

export default function AutoDetailingTicker() {
  const repeated = [...ITEMS, ...ITEMS]

  return (
    <div
      className="relative overflow-hidden py-3"
      style={{
        background: "linear-gradient(90deg, #070D1A 0%, #0B1221 50%, #070D1A 100%)",
        borderTop:    "1px solid rgba(59,130,246,0.1)",
        borderBottom: "1px solid rgba(59,130,246,0.1)",
      }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
        style={{ background: "linear-gradient(90deg, #070D1A, transparent)" }} />
      <div className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
        style={{ background: "linear-gradient(-90deg, #070D1A, transparent)" }} />

      <div className="ticker-track">
        {repeated.map((item, i) => (
          <TickerItem key={i} {...item} />
        ))}
      </div>
    </div>
  )
}
