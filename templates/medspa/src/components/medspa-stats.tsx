"use client"

import { useEffect, useRef } from "react"
import { gsap } from "@core/web/lib"
import { createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"
import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

const STATS = [
  { value: 5.0,  suffix: "★",  decimals: 1, label: "Google Rating",       sub: "234+ verified reviews" },
  { value: 234,  suffix: "+",  decimals: 0, label: "Clients Served",      sub: "and counting" },
  { value: 12,   suffix: "+",  decimals: 0, label: "Years Combined",      sub: "provider experience" },
  { value: 100,  suffix: "%",  decimals: 0, label: "Free Consultations",  sub: "no commitment required" },
]

function StatCounter({ value, suffix, decimals, label, sub, reduced, last }: {
  value: number; suffix: string; decimals: number; label: string; sub: string; reduced: boolean; last: boolean
}) {
  const numRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (reduced) { if (numRef.current) numRef.current.textContent = value.toFixed(decimals) + suffix; return }
    const obj = { val: 0 }
    const t = gsap.to(obj, { val: value, duration: 1.6, ease: "power2.out", scrollTrigger: { trigger: numRef.current, start: "top 85%", once: true }, onUpdate: () => { if (numRef.current) numRef.current.textContent = obj.val.toFixed(decimals) + suffix } })
    return () => { t.kill(); if (t.scrollTrigger) t.scrollTrigger.kill() }
  }, [value, suffix, decimals, reduced])
  return (
    <div className="stat-item" style={{ textAlign: "center", position: "relative" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.2rem,4vw,3.2rem)", fontWeight: 600, fontStyle: "italic", lineHeight: 1, marginBottom: "0.4rem", background: "linear-gradient(135deg,var(--brand-grad-from,#D4B26B),var(--brand-grad-to,#B8955A))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
        <span ref={numRef}>0{suffix}</span>
      </div>
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#3D2B1F", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.2rem" }}>{label}</div>
      <div style={{ fontSize: "0.7rem", color: "rgba(61,43,31,0.55)" }}>{sub}</div>
      {!last && <div style={{ position: "absolute", right: 0, top: "15%", bottom: "15%", width: 1, background: "rgba(184,149,90,0.2)" }} />}
    </div>
  )
}

export default function MedspaStats({ config: _config }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const innerRef   = useRef<HTMLDivElement>(null)
  const reduced    = useReducedMotion()
  useEffect(() => {
    if (reduced || !innerRef.current) return
    const scope = createScope()
    const items = innerRef.current.querySelectorAll<HTMLElement>(".stat-item")
    const t = gsap.from(items, { opacity: 0, y: 28, stagger: 0.1, duration: 0.7, ease: "power3.out", scrollTrigger: { trigger: sectionRef.current, start: "top 82%", once: true } })
    scope.add(t); if (t.scrollTrigger) scope.add(t.scrollTrigger)
    return () => scope.kill()
  }, [reduced])
  return (
    <section ref={sectionRef} style={{ padding: "4rem 2rem", background: "#FFFFFF" }}>
      <div style={{ maxWidth: "1120px", margin: "0 auto", borderTop: "1px solid rgba(184,149,90,0.2)", paddingTop: "3.5rem" }}>
        <div ref={innerRef} className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "2rem" }}>
          {STATS.map((s, i) => <StatCounter key={i} {...s} reduced={reduced} last={i === STATS.length - 1} />)}
        </div>
      </div>
      <style>{`@media(max-width:768px){.stats-grid{grid-template-columns:repeat(2,1fr)!important;gap:2.5rem!important;}}@media(max-width:480px){.stats-grid{grid-template-columns:1fr!important;}}`}</style>
    </section>
  )
}
