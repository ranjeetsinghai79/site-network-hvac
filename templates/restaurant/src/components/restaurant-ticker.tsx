"use client"

const ITEMS = [
  { label: "Authentic Indian Cuisine", accent: true },
  { label: "Weekend Buffet $17.99" },
  { label: "4.8★ Google Rating" },
  { label: "Beer & Wine Bar" },
  { label: "Sports Lounge" },
  { label: "Biryanis · Curries · Dosa" },
  { label: "Private Dining Available" },
  { label: "Catering & Events" },
  { label: "Open 7 Days a Week" },
  { label: "Tracy, California" },
]

function Item({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span className="inline-flex items-center gap-6 shrink-0 px-2">
      <span style={{ fontFamily: "'Karla', sans-serif", fontSize: "0.7rem", fontWeight: accent ? 600 : 400, letterSpacing: "0.14em", textTransform: "uppercase", color: accent ? "#E8B84B" : "rgba(245,237,216,0.45)" }}>
        {label}
      </span>
      <span style={{ width: 3, height: 3, borderRadius: "50%", background: accent ? "#E8B84B" : "rgba(232,184,75,0.25)", flexShrink: 0, display: "inline-block" }} />
    </span>
  )
}

export default function RestaurantTicker() {
  return (
    <div style={{ position: "relative", overflow: "hidden", padding: "0.7rem 0", background: "#0D0A06", borderTop: "1px solid rgba(232,184,75,0.12)", borderBottom: "1px solid rgba(232,184,75,0.12)" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 80, zIndex: 1, pointerEvents: "none", background: "linear-gradient(90deg, #0D0A06, transparent)" }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 80, zIndex: 1, pointerEvents: "none", background: "linear-gradient(-90deg, #0D0A06, transparent)" }} />
      <div className="ticker-track">
        {[...ITEMS, ...ITEMS].map((item, i) => <Item key={i} {...item} />)}
      </div>
    </div>
  )
}
