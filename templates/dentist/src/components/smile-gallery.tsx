"use client"

import { useEffect, useRef } from "react"
import { gsap, createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"
import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

const OVERLAYS = [
  { label: "Teeth Whitening", sub: "In-office results in 60 min" },
  { label: "Smile Makeover", sub: "Veneers + whitening combined" },
  { label: "Invisalign", sub: "Clear aligners, no metal" },
  { label: "Implants", sub: "Permanent tooth replacement" },
]

export function SmileGallerySection({ config }: Props) {
  const business = config.business
  const stats = config.stats ?? []
  const sectionRef = useRef<HTMLElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
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

    const cards = gridRef.current?.querySelectorAll<HTMLElement>(".gallery-card")
    if (cards?.length) {
      const t = gsap.from(cards, {
        opacity: 0, scale: 0.92, stagger: 0.09, duration: 0.65, ease: "power3.out",
        scrollTrigger: { trigger: gridRef.current, start: "top 80%", once: true },
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
        <div ref={headRef} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1.5rem", marginBottom: "3rem" }}>
          <div>
            <span style={{ display: "inline-block", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--brand-accent)", marginBottom: "0.75rem", padding: "0.3rem 0.85rem", border: "1px solid color-mix(in srgb, var(--brand-accent) 30%, transparent)", borderRadius: "999px", background: "color-mix(in srgb, var(--brand-accent) 8%, transparent)" }}>
              Our Work
            </span>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.1, color: "var(--brand-fg)", maxWidth: "480px" }}>
              Smiles that speak{" "}
              <span style={{ background: "linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                for themselves.
              </span>
            </h2>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: "2.5rem" }}>
            {stats.slice(0, 3).map((s) => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 800, color: "var(--brand-accent)", lineHeight: 1 }}>
                  {s.value}{s.suffix}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--brand-fg-muted)", marginTop: "0.25rem", letterSpacing: "0.04em" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2×2 Grid */}
        <div
          ref={gridRef}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "280px 280px", gap: "1rem" }}
          className="smile-grid"
        >
          {OVERLAYS.map((o, i) => (
            <div
              key={o.label}
              className="gallery-card"
              style={{
                position: "relative",
                borderRadius: "1rem",
                overflow: "hidden",
                background: `linear-gradient(${135 + i * 20}deg, color-mix(in srgb, var(--brand-accent) ${14 + i * 4}%, var(--brand-bg-mid)), color-mix(in srgb, var(--brand-accent) ${6 + i * 2}%, var(--brand-bg)))`,
                border: "1px solid var(--brand-card-border)",
                gridRow: i === 0 ? "1 / 3" : "auto",
                cursor: "default",
              }}
              onMouseEnter={(e) => gsap.to(e.currentTarget, { scale: 1.02, duration: 0.35, ease: "power2.out" })}
              onMouseLeave={(e) => gsap.to(e.currentTarget, { scale: 1, duration: 0.35, ease: "power2.in" })}
            >
              {/* Image placeholder */}
              <img
                src={`/hero-${i + 1}.jpg`}
                alt={o.label}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.6 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
              />

              {/* Overlay gradient */}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 55%)" }} />

              {/* Label */}
              <div style={{ position: "absolute", bottom: "1.25rem", left: "1.25rem", right: "1.25rem" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: i === 0 ? "1.25rem" : "1rem", fontWeight: 700, color: "#FFFFFF", marginBottom: "0.2rem" }}>
                  {o.label}
                </div>
                <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.7)" }}>
                  {o.sub}
                </div>
              </div>

              {/* Corner badge */}
              <div style={{ position: "absolute", top: "1rem", right: "1rem", background: "var(--brand-accent)", color: "#fff", fontSize: "0.6rem", fontWeight: 700, padding: "0.25rem 0.6rem", borderRadius: "999px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {i + 1 < 10 ? `0${i + 1}` : i + 1}
              </div>
            </div>
          ))}
        </div>

        {/* CTA strip */}
        <div style={{ marginTop: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", padding: "1.5rem 2rem", borderRadius: "1rem", background: "var(--brand-card-bg)", border: "1px solid var(--brand-card-border)", boxShadow: "var(--shadow-card)" }}>
          <p style={{ fontSize: "1rem", fontWeight: 600, color: "var(--brand-fg)" }}>
            Ready to transform your smile? Most plans cover more than you think.
          </p>
          <a href={business.phoneHref} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "var(--brand-accent)", color: "#fff", fontWeight: 700, fontSize: "0.875rem", padding: "0.75rem 1.5rem", borderRadius: "999px", textDecoration: "none", whiteSpace: "nowrap", boxShadow: "var(--shadow-cta)" }}>
            Book Free Consultation →
          </a>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .smile-grid { grid-template-columns: 1fr !important; grid-template-rows: auto !important; }
          .smile-grid .gallery-card { grid-row: auto !important; min-height: 220px; }
        }
      `}</style>
    </section>
  )
}
