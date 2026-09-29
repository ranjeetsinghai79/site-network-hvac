"use client"

import { useEffect, useRef } from "react"
import { gsap } from "@core/web/lib"
import { createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"

import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

const STATS = [
  { value: 4.9, suffix: "★",  decimals: 1, label: "Google Rating",       sub: "189+ verified reviews" },
  { value: 2.4, suffix: "B+", decimals: 1, label: "Assets Under Advisory", sub: "fee-only, no commissions" },
  { value: 22,  suffix: "+",  decimals: 0, label: "Years of Experience",  sub: "Tracy's trusted CFP® firm" },
  { value: 100, suffix: "%",  decimals: 0, label: "Fiduciary Standard",   sub: "legally on your side" },
]

function StatCounter({ value, suffix, decimals, label, sub, prefix, reduced, last }: {
  value: number; suffix: string; decimals: number; label: string; sub: string; prefix?: string; reduced: boolean; last: boolean
}) {
  const numRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (reduced) { if (numRef.current) numRef.current.textContent = value.toFixed(decimals) + suffix; return }
    const obj = { val: 0 }
    const t = gsap.to(obj, {
      val: value, duration: 1.8, ease: "power2.out",
      scrollTrigger: { trigger: numRef.current, start: "top 85%", once: true },
      onUpdate: () => { if (numRef.current) numRef.current.textContent = obj.val.toFixed(decimals) + suffix },
    })
    return () => { t.kill(); if (t.scrollTrigger) t.scrollTrigger.kill() }
  }, [value, suffix, decimals, reduced])

  return (
    <div className="fa-stat-item" style={{ textAlign: "center", position: "relative" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 700, fontStyle: "italic", lineHeight: 1, marginBottom: "0.4rem", background: "linear-gradient(135deg, var(--brand-grad-from,#C9A55A), var(--brand-grad-to,#E8CA80))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
        {prefix && <span>{prefix}</span>}<span ref={numRef}>0{suffix}</span>
      </div>
      <div style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem", fontWeight: 600, color: "var(--brand-text, #E8E0D0)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.2rem" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-body)", fontSize: "0.68rem", color: "var(--brand-muted, rgba(232,224,208,0.45))" }}>{sub}</div>
      {!last && <div style={{ position: "absolute", right: 0, top: "15%", bottom: "15%", width: 1, background: "var(--brand-border, rgba(201,165,90,0.15))" }} />}
    </div>
  )
}

export default function FinancialAdvisorStats({ config: _config }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const innerRef   = useRef<HTMLDivElement>(null)
  const reduced    = useReducedMotion()

  useEffect(() => {
    if (reduced || !innerRef.current) return
    const scope = createScope()
    const items = innerRef.current.querySelectorAll<HTMLElement>(".fa-stat-item")
    const t = gsap.from(items, { opacity: 0, y: 28, stagger: 0.1, duration: 0.7, ease: "power3.out", scrollTrigger: { trigger: sectionRef.current, start: "top 82%", once: true } })
    scope.add(t); if (t.scrollTrigger) scope.add(t.scrollTrigger)
    return () => scope.kill()
  }, [reduced])

  return (
    <section ref={sectionRef} style={{ padding: "4rem 2rem", background: "var(--brand-bg, #080C12)", borderTop: "1px solid var(--brand-border, rgba(201,165,90,0.15))", borderBottom: "1px solid var(--brand-border, rgba(201,165,90,0.15))" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div ref={innerRef} className="fa-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "2rem" }}>
          {STATS.map((s, i) => (
            <StatCounter
              key={i}
              {...s}
              prefix={s.suffix === "B+" ? "$" : undefined}
              reduced={reduced}
              last={i === STATS.length - 1}
            />
          ))}
        </div>
      </div>
      <style>{`
        @media(max-width:768px){ .fa-stats-grid{ grid-template-columns:repeat(2,1fr)!important;gap:2.5rem!important; } }
        @media(max-width:480px){ .fa-stats-grid{ grid-template-columns:1fr!important; } }
      `}</style>
    </section>
  )
}
