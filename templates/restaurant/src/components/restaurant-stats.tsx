"use client"

import { useEffect, useRef } from "react"
import { motion, useInView } from "framer-motion"

const STATS = [
  { value: 4.8,  suffix: "★",  decimals: 1, label: "Google Rating",     sub: "350+ verified reviews" },
  { value: 192,  suffix: "+",  decimals: 0, label: "Menu Items",        sub: "biryanis, curries & more" },
  { value: 17,   suffix: ".99", decimals: 0, label: "Weekend Buffet",   sub: "all-you-can-eat" },
  { value: 12,   suffix: "+",  decimals: 0, label: "Years of Flavor",   sub: "Tracy's favorite since 2012" },
]

function StatCounter({ value, suffix, decimals, label, sub, last }: {
  value: number; suffix: string; decimals: number; label: string; sub: string; last: boolean
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-10% 0px" })

  useEffect(() => {
    if (!inView || !ref.current) return
    const el = ref.current
    const start = performance.now()
    const dur = 1600
    const raf = requestAnimationFrame(function tick(now) {
      const t = Math.min((now - start) / dur, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      const cur = value * ease
      el.textContent = (decimals === 0 ? Math.round(cur) : cur.toFixed(decimals)) + suffix
      if (t < 1) requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(raf)
  }, [inView, value, suffix, decimals])

  return (
    <div style={{ textAlign: "center", position: "relative" }}>
      <div style={{ fontFamily: "'Playfair Display SC', serif", fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 700, lineHeight: 1, marginBottom: "0.4rem", background: "linear-gradient(135deg, #E8B84B, #F0CB6D)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
        {label === "Weekend Buffet" ? "$" : ""}<span ref={ref}>0{suffix}</span>
      </div>
      <div style={{ fontFamily: "'Karla', sans-serif", fontSize: "0.7rem", fontWeight: 600, color: "#F5EDD8", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.25rem" }}>{label}</div>
      <div style={{ fontFamily: "'Karla', sans-serif", fontSize: "0.68rem", color: "rgba(245,237,216,0.4)" }}>{sub}</div>
      {!last && <div style={{ position: "absolute", right: 0, top: "15%", bottom: "15%", width: 1, background: "rgba(232,184,75,0.15)" }} />}
    </div>
  )
}

export default function RestaurantStats() {
  const sectionRef = useRef<HTMLElement>(null)
  const inView = useInView(sectionRef, { once: true, margin: "-5% 0px" })

  return (
    <section ref={sectionRef} style={{ padding: "4rem 2rem", background: "#0A0805", borderTop: "1px solid rgba(232,184,75,0.08)", borderBottom: "1px solid rgba(232,184,75,0.08)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
          style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "2rem" }}
          className="stats-grid"
        >
          {STATS.map((s, i) => (
            <StatCounter key={i} {...s} last={i === STATS.length - 1} />
          ))}
        </motion.div>
      </div>
      <style>{`
        @media(max-width:768px) { .stats-grid { grid-template-columns: repeat(2,1fr) !important; gap: 2.5rem !important; } }
        @media(max-width:480px) { .stats-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  )
}
