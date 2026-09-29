"use client"

import { useEffect, useRef } from "react"
import { gsap } from "@core/web/lib"
import { createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"

import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

const OFFERINGS = [
  {
    category: "Investments",
    items: [
      { name: "Portfolio Management", fee: "0.75–1.0% AUM", note: "Personalized allocation · quarterly rebalancing" },
      { name: "Retirement Accounts", fee: "Included", note: "IRA, 401(k), Roth optimization" },
      { name: "Socially Responsible Investing", fee: "Included", note: "ESG-screened portfolios available" },
    ],
  },
  {
    category: "Planning",
    items: [
      { name: "Financial Plan", fee: "$2,500–$5,000", note: "One-time comprehensive plan · all goals covered" },
      { name: "Retirement Income Plan", fee: "$1,500", note: "Withdrawal strategy · Social Security timing" },
      { name: "Tax Strategy Session", fee: "$750", note: "Roth conversions · harvesting · deductions" },
    ],
  },
  {
    category: "Protection",
    items: [
      { name: "Insurance Analysis", fee: "Free", note: "Life · disability · LTC · we shop 40+ carriers" },
      { name: "Estate Plan Coordination", fee: "$500", note: "Trust review · beneficiary audit · attorney referral" },
      { name: "Business Continuity", fee: "Custom", note: "Buy-sell · key person · exit strategy" },
    ],
  },
]

export default function WealthServicesSection({ config: _config }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const headRef    = useRef<HTMLHeadingElement>(null)
  const tableRef   = useRef<HTMLDivElement>(null)
  const reduced    = useReducedMotion()

  useEffect(() => {
    if (reduced || !headRef.current || !tableRef.current) return
    const scope = createScope()
    const rows = tableRef.current.querySelectorAll<HTMLElement>(".ws-row")
    const t1 = gsap.from(headRef.current, { opacity: 0, y: 28, duration: 0.65, ease: "power3.out", scrollTrigger: { trigger: sectionRef.current, start: "top 80%", once: true } })
    const t2 = gsap.from(rows, { opacity: 0, x: -24, stagger: 0.05, duration: 0.55, ease: "power3.out", scrollTrigger: { trigger: tableRef.current, start: "top 82%", once: true } })
    scope.add(t1)
    scope.add(t2)
    if (t1.scrollTrigger) scope.add(t1.scrollTrigger)
    if (t2.scrollTrigger) scope.add(t2.scrollTrigger)
    return () => scope.kill()
  }, [reduced])

  return (
    <section ref={sectionRef} id="pricing" style={{ padding: "6rem 2rem", background: "var(--brand-bg, #080C12)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <span style={{ display: "inline-block", fontFamily: "var(--font-body)", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--brand-accent, #C9A55A)", marginBottom: "0.75rem" }}>Transparent Pricing</span>
          <h2 ref={headRef} style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem,3.5vw,2.8rem)", fontWeight: 700, color: "var(--brand-text, #E8E0D0)", lineHeight: 1.2 }}>
            Services & <em style={{ fontStyle: "italic", color: "var(--brand-accent, #C9A55A)" }}>Fee Schedule</em>
          </h2>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9rem", color: "var(--brand-muted, rgba(232,224,208,0.5))", maxWidth: 520, margin: "1rem auto 0", lineHeight: 1.7 }}>
            We believe in full transparency. Every service and fee is disclosed upfront — no surprises, no commissions, no conflicts.
          </p>
        </div>

        <div ref={tableRef} style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
          {OFFERINGS.map((section) => (
            <div key={section.category}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                <span style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--brand-accent, #C9A55A)" }}>{section.category}</span>
                <div style={{ flex: 1, height: 1, background: "var(--brand-border, rgba(201,165,90,0.15))" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {section.items.map((item) => (
                  <div key={item.name} className="ws-row" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "center", padding: "1rem 1.25rem", background: "var(--brand-surface, #111822)", border: "1px solid var(--brand-border, rgba(201,165,90,0.12))", borderRadius: 10, transition: "border-color 0.2s, background 0.2s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,165,90,0.3)"; (e.currentTarget as HTMLElement).style.background = "rgba(201,165,90,0.04)" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,165,90,0.12)"; (e.currentTarget as HTMLElement).style.background = "var(--brand-surface,#111822)" }}
                  >
                    <div>
                      <div style={{ fontFamily: "var(--font-body)", fontSize: "0.9rem", fontWeight: 600, color: "var(--brand-text, #E8E0D0)", marginBottom: "0.2rem" }}>{item.name}</div>
                      <div style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem", color: "var(--brand-muted, rgba(232,224,208,0.45))" }}>{item.note}</div>
                    </div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem", fontWeight: 600, fontStyle: "italic", color: "var(--brand-accent, #C9A55A)", whiteSpace: "nowrap", textAlign: "right" }}>{item.fee}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "3rem", textAlign: "center" }}>
          <a href="#contact" style={{ display: "inline-block", background: "linear-gradient(135deg, var(--brand-btn-from,#C9A55A), var(--brand-btn-to,#B8944A))", color: "#06090E", fontFamily: "var(--font-body)", fontWeight: 700, fontSize: "0.9rem", padding: "0.9rem 2.2rem", borderRadius: 8, textDecoration: "none", letterSpacing: "0.05em" }}>
            Book Your Free Consultation
          </a>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem", color: "var(--brand-muted)", marginTop: "0.75rem" }}>60 minutes · no obligation · fiduciary from the first call</p>
        </div>
      </div>
    </section>
  )
}
