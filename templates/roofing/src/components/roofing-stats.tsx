"use client"

import { useEffect, useRef } from "react"
import { gsap } from "@core/web/lib"
import { createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"
import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

const STATS = [
  { value: 4.8,  suffix: "★",  decimals: 1, label: "Google Rating",      sub: "287+ verified reviews" },
  { value: 1400, suffix: "+",  decimals: 0, label: "Roofs Replaced",     sub: "since 2005" },
  { value: 21,   suffix: "+",  decimals: 0, label: "Years Experience",   sub: "family owned" },
  { value: 95,   suffix: "%",  decimals: 0, label: "Insurance Covered",  sub: "storm repairs" },
]

function StatCounter({ value, suffix, decimals, label, sub, reduced, last }: {
  value: number; suffix: string; decimals: number; label: string; sub: string; reduced: boolean; last: boolean
}) {
  const numRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (reduced) { if (numRef.current) numRef.current.textContent = value.toFixed(decimals) + suffix; return }
    const obj = { val: 0 }
    const t = gsap.to(obj, {
      val: value, duration: 1.6, ease: "power2.out",
      scrollTrigger: { trigger: numRef.current, start: "top 85%", once: true },
      onUpdate: () => { if (numRef.current) numRef.current.textContent = obj.val.toFixed(decimals) + suffix },
    })
    return () => { t.kill(); if (t.scrollTrigger) t.scrollTrigger.kill() }
  }, [value, suffix, decimals, reduced])

  return (
    <div className="stat-item" style={{ textAlign: "center", position: "relative" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.2rem,4vw,3.5rem)", fontWeight: 900, lineHeight: 1, marginBottom: "0.4rem", background: "linear-gradient(135deg,var(--brand-grad-from),var(--brand-grad-to))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
        <span ref={numRef}>0{suffix}</span>
      </div>
      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--brand-fg)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.2rem" }}>{label}</div>
      <div style={{ fontSize: "0.7rem", color: "var(--brand-fg-muted)" }}>{sub}</div>
      {!last && <div style={{ position: "absolute", right: 0, top: "15%", bottom: "15%", width: 1, background: "rgba(234,88,12,0.12)" }} />}
    </div>
  )
}

export default function RoofingStats({ config: _config }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const innerRef   = useRef<HTMLDivElement>(null)
  const reduced    = useReducedMotion()

  useEffect(() => {
    if (reduced || !innerRef.current) return
    const scope = createScope()
    const items = innerRef.current.querySelectorAll<HTMLElement>(".stat-item")
    const t = gsap.from(items, { opacity: 0, y: 32, stagger: 0.1, duration: 0.7, ease: "power3.out", scrollTrigger: { trigger: sectionRef.current, start: "top 82%", once: true } })
    scope.add(t); if (t.scrollTrigger) scope.add(t.scrollTrigger)
    return () => scope.kill()
  }, [reduced])

  return (
    <section ref={sectionRef} style={{ padding: "5rem 2rem", background: "var(--brand-bg-2)" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", borderTop: "1px solid rgba(234,88,12,0.12)", paddingTop: "4rem" }}>
        <div ref={innerRef} className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "2rem" }}>
          {STATS.map((s, i) => <StatCounter key={i} {...s} reduced={reduced} last={i === STATS.length - 1} />)}
        </div>
      </div>
      <style>{`@media(max-width:768px){.stats-grid{grid-template-columns:repeat(2,1fr)!important;gap:2.5rem!important;}}@media(max-width:480px){.stats-grid{grid-template-columns:1fr!important;}}`}</style>
    </section>
  )
}
