"use client"

import { useEffect, useRef } from "react"
import { gsap, createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"
import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

const MATERIALS = [
  {
    name: "Asphalt Shingles",
    icon: "🏠",
    lifespan: "25–30 yrs",
    warranty: "50-Year System",
    bestFor: "Most homes",
    desc: "The most popular choice. Affordable, durable, and available in dozens of colors to match any home style.",
    specs: ["Impact-resistant options", "Class A fire rating", "Wind-resistant up to 130mph", "GAF & Owens Corning certified"],
  },
  {
    name: "Metal Roofing",
    icon: "⚡",
    lifespan: "40–70 yrs",
    warranty: "Lifetime",
    bestFor: "Long-term value",
    desc: "Built to outlast the house. Metal roofs handle extreme weather and reflect heat to cut cooling costs.",
    specs: ["3× longer than shingles", "Saves 10–25% on energy", "100% recyclable", "Excellent hail resistance"],
    featured: true,
  },
  {
    name: "Flat / TPO",
    icon: "📐",
    lifespan: "20–30 yrs",
    warranty: "20-Year System",
    bestFor: "Low-slope roofs",
    desc: "The right solution for flat and low-pitched roofs. Seamless installation means fewer leak points.",
    specs: ["Fully waterproof membrane", "Energy Star rated", "Excellent UV resistance", "Easy maintenance access"],
  },
]

export function MaterialsSection({ config }: Props) {
  const business = config.business
  const badges = config.trustBadges ?? []
  const sectionRef = useRef<HTMLElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const scope = createScope()

    const h = gsap.from(headRef.current, {
      opacity: 0, y: 32, duration: 0.7, ease: "power3.out",
      scrollTrigger: { trigger: sectionRef.current, start: "top 82%", once: true },
    })
    scope.add(h)
    if (h.scrollTrigger) scope.add(h.scrollTrigger)

    const cards = cardsRef.current?.querySelectorAll<HTMLElement>(".material-card")
    if (cards?.length) {
      const t = gsap.from(cards, {
        opacity: 0, y: 48, stagger: 0.1, duration: 0.65, ease: "power3.out",
        scrollTrigger: { trigger: cardsRef.current, start: "top 80%", once: true },
      })
      scope.add(t)
      if (t.scrollTrigger) scope.add(t.scrollTrigger)
    }

    return () => scope.kill()
  }, [reduced])

  return (
    <section
      ref={sectionRef}
      id="services"
      style={{ background: "var(--brand-bg-section)", padding: "6rem 0" }}
    >
      <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 2rem" }}>
        {/* Header */}
        <div ref={headRef} style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <span style={{ display: "inline-block", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--brand-accent)", marginBottom: "1rem", padding: "0.3rem 0.85rem", border: "1px solid color-mix(in srgb, var(--brand-accent) 30%, transparent)", borderRadius: "999px", background: "color-mix(in srgb, var(--brand-accent) 8%, transparent)" }}>
            Roofing Materials
          </span>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.1, color: "var(--brand-fg)", marginBottom: "1rem" }}>
            We install what lasts.{" "}
            <span style={{ background: "linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              You choose.
            </span>
          </h2>
          <p style={{ fontSize: "1rem", color: "var(--brand-fg-muted)", maxWidth: "520px", margin: "0 auto", lineHeight: 1.7 }}>
            Certified installer for all major manufacturers. We help you pick the right material for your roof pitch, climate, and budget.
          </p>
        </div>

        {/* Material cards */}
        <div
          ref={cardsRef}
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem" }}
          className="materials-grid"
        >
          {MATERIALS.map((mat) => (
            <div
              key={mat.name}
              className="material-card"
              style={{
                position: "relative",
                borderRadius: "1.25rem",
                padding: "2rem",
                background: mat.featured ? "var(--brand-accent)" : "var(--brand-card-bg)",
                border: mat.featured ? "none" : "1px solid var(--brand-card-border)",
                boxShadow: mat.featured ? "var(--shadow-cta)" : "var(--shadow-card)",
              }}
            >
              {mat.featured && (
                <div style={{ position: "absolute", top: "-0.75rem", left: "50%", transform: "translateX(-50%)", background: "#FFFFFF", color: "var(--brand-accent)", fontSize: "0.62rem", fontWeight: 800, padding: "0.25rem 0.8rem", borderRadius: "999px", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  Most Popular
                </div>
              )}

              <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>{mat.icon}</div>

              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 700, color: mat.featured ? "#FFFFFF" : "var(--brand-fg)" }}>
                  {mat.name}
                </h3>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "999px", background: mat.featured ? "rgba(255,255,255,0.2)" : "color-mix(in srgb, var(--brand-accent) 10%, transparent)", color: mat.featured ? "#FFFFFF" : "var(--brand-accent)", letterSpacing: "0.06em" }}>
                  {mat.bestFor}
                </span>
              </div>

              <p style={{ fontSize: "0.875rem", color: mat.featured ? "rgba(255,255,255,0.85)" : "var(--brand-fg-muted)", lineHeight: 1.65, marginBottom: "1.5rem" }}>
                {mat.desc}
              </p>

              {/* Specs */}
              <ul style={{ listStyle: "none", padding: 0, margin: 0, marginBottom: "1.5rem" }}>
                {mat.specs.map((s) => (
                  <li key={s} style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.82rem", color: mat.featured ? "rgba(255,255,255,0.9)" : "var(--brand-fg-muted)", padding: "0.3rem 0", borderBottom: `1px solid ${mat.featured ? "rgba(255,255,255,0.12)" : "var(--brand-card-border)"}` }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={mat.featured ? "white" : "var(--brand-accent)"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {s}
                  </li>
                ))}
              </ul>

              {/* Lifespan + warranty */}
              <div style={{ display: "flex", gap: "1rem" }}>
                <div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: mat.featured ? "rgba(255,255,255,0.6)" : "var(--brand-fg-sub)", marginBottom: "0.2rem" }}>Lifespan</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: mat.featured ? "#FFFFFF" : "var(--brand-fg)" }}>{mat.lifespan}</div>
                </div>
                <div style={{ width: "1px", background: mat.featured ? "rgba(255,255,255,0.2)" : "var(--brand-card-border)" }} />
                <div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: mat.featured ? "rgba(255,255,255,0.6)" : "var(--brand-fg-sub)", marginBottom: "0.2rem" }}>Warranty</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: mat.featured ? "#FFFFFF" : "var(--brand-fg)" }}>{mat.warranty}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Certification badges */}
        {badges.length > 0 && (
          <div style={{ marginTop: "2.5rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "center" }}>
            {badges.map((b) => (
              <span key={b} style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--brand-fg-muted)", padding: "0.4rem 1rem", borderRadius: "999px", border: "1px solid var(--brand-card-border)", background: "var(--brand-card-bg)" }}>
                ✓ {b}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <div style={{ marginTop: "2.5rem", textAlign: "center" }}>
          <a href={business.phoneHref} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "var(--brand-accent)", color: "#fff", fontWeight: 700, fontSize: "0.9rem", padding: "0.9rem 2rem", borderRadius: "999px", textDecoration: "none", boxShadow: "var(--shadow-cta)" }}>
            Get Free Roof Inspection →
          </a>
          <p style={{ fontSize: "0.78rem", color: "var(--brand-fg-sub)", marginTop: "0.75rem" }}>Drone inspection + written estimate. No obligation.</p>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .materials-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
