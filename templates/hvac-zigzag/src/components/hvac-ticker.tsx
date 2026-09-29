"use client"

const ITEMS = [
  { label: "EMERGENCY DISPATCH ACTIVE", accent: true },
  { label: "Average Response: 45 Min" },
  { label: "4.9★ — 312 Google Reviews" },
  { label: "NATE Certified Technicians" },
  { label: "Same-Day Service Available" },
  { label: "Licensed · Bonded · Insured" },
  { label: "FREE Estimates — Call Now" },
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
        style={{ color: accent ? "#4F46E5" : "rgba(11,14,26,0.55)" }}
      >
        {label}
      </span>
      <span
        className="w-1 h-1 rounded-full shrink-0"
        style={{ background: accent ? "#4F46E5" : "rgba(11,14,26,0.2)" }}
      />
    </span>
  )
}

export default function HvacTicker() {
  const repeated = [...ITEMS, ...ITEMS] // double for seamless loop

  return (
    <div
      className="relative overflow-hidden py-3"
      style={{
        background: "linear-gradient(90deg, #F1F2F8 0%, #FFFFFF 50%, #F1F2F8 100%)",
        borderTop:    "1px solid rgba(11,14,26,0.05)",
        borderBottom: "1px solid rgba(11,14,26,0.05)",
      }}
    >
      {/* Left fade mask */}
      <div
        className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
        style={{ background: "linear-gradient(90deg, #F1F2F8, transparent)" }}
      />
      {/* Right fade mask */}
      <div
        className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
        style={{ background: "linear-gradient(-90deg, #F1F2F8, transparent)" }}
      />

      <div className="ticker-track">
        {repeated.map((item, i) => (
          <TickerItem key={i} {...item} />
        ))}
      </div>
    </div>
  )
}
