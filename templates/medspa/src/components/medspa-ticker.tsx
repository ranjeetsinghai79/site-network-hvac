"use client"

const ITEMS = [
  { label: "Board-Certified Providers Only", accent: true },
  { label: "234+ Happy Clients" },
  { label: "5.0★ Google Rating" },
  { label: "FDA-Cleared Devices" },
  { label: "AmSpa Member Clinic" },
  { label: "Free Consultation" },
  { label: "Botox · Filler · Laser · RF" },
  { label: "All Skin Tones Welcome" },
  { label: "Serving Tracy & Bay Area" },
]

function Item({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span className="inline-flex items-center gap-5 shrink-0 px-2" style={{ fontFamily: "var(--font-body)", fontWeight: 400, letterSpacing: "0.08em" }}>
      <span className="text-xs uppercase" style={{ color: accent ? "var(--brand-accent)" : "rgba(120,100,80,0.65)" }}>{label}</span>
      <span className="w-1 h-1 rounded-full shrink-0" style={{ background: accent ? "var(--brand-accent)" : "rgba(184,149,90,0.3)" }} />
    </span>
  )
}

export default function MedspaTicker() {
  return (
    <div className="relative overflow-hidden py-3" style={{ background: "#FAF8F4", borderTop: "1px solid rgba(184,149,90,0.2)", borderBottom: "1px solid rgba(184,149,90,0.2)" }}>
      <div className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none" style={{ background: "linear-gradient(90deg, #FAF8F4, transparent)" }} />
      <div className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none" style={{ background: "linear-gradient(-90deg, #FAF8F4, transparent)" }} />
      <div className="ticker-track">{[...ITEMS, ...ITEMS].map((item, i) => <Item key={i} {...item} />)}</div>
    </div>
  )
}
