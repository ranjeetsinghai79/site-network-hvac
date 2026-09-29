"use client"

import { useEffect, useRef } from "react"
import { gsap, createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"
import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

const PACKAGES = [
  {
    name: "Essential Detail",
    price: "from $149",
    gloss: 55,
    tagline: "Restore your finish",
    includes: [
      "Exterior hand wash + dry",
      "Clay bar decontamination",
      "One-step machine polish",
      "Paint sealant (6-month protection)",
      "Tire dressing + window clean",
      "Interior vacuum + wipe-down",
    ],
    duration: "3–4 hrs",
  },
  {
    name: "Signature Detail",
    price: "from $349",
    gloss: 80,
    tagline: "Show-ready condition",
    includes: [
      "Everything in Essential",
      "Two-stage paint correction",
      "Graphene sealant (12-month)",
      "Engine bay clean",
      "Leather conditioning",
      "Headlight restoration",
      "Odor elimination",
    ],
    duration: "6–8 hrs",
    featured: true,
  },
  {
    name: "Ceramic Coating",
    price: "from $899",
    gloss: 100,
    tagline: "5-year protection",
    includes: [
      "Everything in Signature",
      "Full paint correction",
      "Gyeon or CarPro coating",
      "5-year coating warranty",
      "Ceramic glass coating",
      "Wheel coating",
      "Maintenance kit included",
    ],
    duration: "2 days",
  },
]

export function PackagesSection({ config }: Props) {
  const business = config.business
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

    const cards = cardsRef.current?.querySelectorAll<HTMLElement>(".pkg-card")
    if (cards?.length) {
      const t = gsap.from(cards, {
        opacity: 0, y: 48, stagger: 0.1, duration: 0.65, ease: "power3.out",
        scrollTrigger: { trigger: cardsRef.current, start: "top 80%", once: true },
      })
      scope.add(t)
      if (t.scrollTrigger) scope.add(t.scrollTrigger)
    }

    // Gloss meter animation
    const bars = cardsRef.current?.querySelectorAll<HTMLElement>(".gloss-fill")
    if (bars?.length) {
      gsap.from(bars, {
        width: "0%",
        duration: 1.2,
        ease: "power2.out",
        stagger: 0.1,
        scrollTrigger: { trigger: cardsRef.current, start: "top 80%", once: true },
      })
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
            Detail Packages
          </span>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.1, color: "var(--brand-fg)", marginBottom: "1rem" }}>
            Pick your protection{" "}
            <span style={{ background: "linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              level.
            </span>
          </h2>
          <p style={{ fontSize: "1rem", color: "var(--brand-fg-muted)", maxWidth: "480px", margin: "0 auto", lineHeight: 1.7 }}>
            From a single-step polish to a multi-year ceramic coating — we'll tell you exactly what your paint needs.
          </p>
        </div>

        {/* Package cards */}
        <div
          ref={cardsRef}
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem", alignItems: "start" }}
          className="packages-grid"
        >
          {PACKAGES.map((pkg) => (
            <div
              key={pkg.name}
              className="pkg-card"
              style={{
                borderRadius: "1.25rem",
                padding: "2rem",
                background: pkg.featured ? "var(--brand-accent)" : "var(--brand-card-bg)",
                border: pkg.featured ? "none" : "1px solid var(--brand-card-border)",
                boxShadow: pkg.featured ? "var(--shadow-cta)" : "var(--shadow-card)",
                position: "relative",
              }}
            >
              {pkg.featured && (
                <div style={{ position: "absolute", top: "-0.75rem", left: "50%", transform: "translateX(-50%)", background: "#FFFFFF", color: "var(--brand-accent)", fontSize: "0.62rem", fontWeight: 800, padding: "0.25rem 0.9rem", borderRadius: "999px", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  Most Popular
                </div>
              )}

              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 700, color: pkg.featured ? "#FFFFFF" : "var(--brand-fg)", marginBottom: "0.25rem" }}>
                  {pkg.name}
                </h3>
                <p style={{ fontSize: "0.8rem", color: pkg.featured ? "rgba(255,255,255,0.7)" : "var(--brand-fg-muted)" }}>
                  {pkg.tagline}
                </p>
              </div>

              {/* Gloss meter */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                  <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: pkg.featured ? "rgba(255,255,255,0.7)" : "var(--brand-fg-sub)" }}>
                    Gloss Level
                  </span>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9rem", color: pkg.featured ? "#FFFFFF" : "var(--brand-fg)" }}>
                    {pkg.gloss}%
                  </span>
                </div>
                <div style={{ height: "6px", borderRadius: "999px", background: pkg.featured ? "rgba(255,255,255,0.2)" : "var(--brand-card-border)", overflow: "hidden" }}>
                  <div
                    className="gloss-fill"
                    style={{
                      height: "100%",
                      width: `${pkg.gloss}%`,
                      borderRadius: "999px",
                      background: pkg.featured
                        ? "linear-gradient(90deg, rgba(255,255,255,0.7), #FFFFFF)"
                        : "linear-gradient(90deg, var(--brand-grad-from), var(--brand-grad-to))",
                    }}
                  />
                </div>
              </div>

              {/* Price + duration */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.5rem", paddingBottom: "1.5rem", borderBottom: `1px solid ${pkg.featured ? "rgba(255,255,255,0.15)" : "var(--brand-card-border)"}` }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 800, color: pkg.featured ? "#FFFFFF" : "var(--brand-fg)" }}>
                  {pkg.price}
                </div>
                <div style={{ fontSize: "0.75rem", color: pkg.featured ? "rgba(255,255,255,0.65)" : "var(--brand-fg-sub)" }}>
                  {pkg.duration}
                </div>
              </div>

              {/* Feature list */}
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1.75rem" }}>
                {pkg.includes.map((item) => (
                  <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.82rem", color: pkg.featured ? "rgba(255,255,255,0.9)" : "var(--brand-fg-muted)", padding: "0.3rem 0" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={pkg.featured ? "white" : "var(--brand-accent)"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: "0.3rem", flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                    {item}
                  </li>
                ))}
              </ul>

              <a
                href={business.phoneHref}
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "0.85rem",
                  borderRadius: "999px",
                  background: pkg.featured ? "#FFFFFF" : "var(--brand-accent)",
                  color: pkg.featured ? "var(--brand-accent)" : "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  textDecoration: "none",
                  boxShadow: pkg.featured ? "0 4px 16px rgba(0,0,0,0.12)" : "var(--shadow-cta)",
                }}
              >
                Book {pkg.name} →
              </a>
            </div>
          ))}
        </div>

        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.8rem", color: "var(--brand-fg-sub)" }}>
          Not sure which package? We'll inspect your paint and recommend for free.
        </p>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .packages-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
