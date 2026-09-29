"use client"

const ITEMS = [
  { label: "CA Licensed Skin Clinic", accent: true },
  { label: "4.9★ Google Rating" },
  { label: "187+ Happy Clients" },
  { label: "Medical-Grade Treatments" },
  { label: "All Skin Tones Welcome" },
  { label: "Free Skin Consultation" },
  { label: "FDA-Cleared Devices" },
  { label: "Chemical Peels · Laser · RF Microneedling" },
  { label: "Serving Tracy & Central Valley" },
]

function Item({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span className="inline-flex items-center gap-5 shrink-0 px-2" style={{ fontFamily: "var(--font-display)", fontWeight: 500, letterSpacing: "0.08em" }}>
      <span className="text-xs uppercase" style={{ color: accent ? "var(--brand-accent)" : "rgba(240,230,245,0.45)" }}>{label}</span>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent ? "var(--brand-accent)" : "rgba(232,121,160,0.25)" }} />
    </span>
  )
}

export default function SkinClinicTicker() {
  return (
    <div className="relative overflow-hidden py-3" style={{ background: "var(--brand-bg-2)", borderTop: "1px solid rgba(232,121,160,0.1)", borderBottom: "1px solid rgba(232,121,160,0.1)" }}>
      <div className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none" style={{ background: "linear-gradient(90deg, var(--brand-bg-2), transparent)" }} />
      <div className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none" style={{ background: "linear-gradient(-90deg, var(--brand-bg-2), transparent)" }} />
      <div className="ticker-track">{[...ITEMS, ...ITEMS].map((item, i) => <Item key={i} {...item} />)}</div>
    </div>
  )
}
