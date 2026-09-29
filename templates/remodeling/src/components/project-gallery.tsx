"use client"

import { useEffect, useRef } from "react"
import { gsap, createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"
import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

const PROJECTS = [
  { type: "Kitchen Remodel", scope: "Full gut + custom cabinetry", img: "/project-1.jpg", detail: "8 weeks · $42,000 avg" },
  { type: "Master Bath", scope: "Walk-in shower + dual vanity", img: "/project-2.jpg", detail: "4 weeks · $18,500 avg" },
  { type: "Room Addition", scope: "600 sq ft addition, permit pulled", img: "/project-3.jpg", detail: "12 weeks · $85,000 avg" },
]

export function ProjectGallerySection({ config }: Props) {
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

    const cards = cardsRef.current?.querySelectorAll<HTMLElement>(".project-card")
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
      style={{ background: "var(--brand-bg)", padding: "6rem 0" }}
    >
      <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 2rem" }}>
        {/* Header */}
        <div ref={headRef} style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "1.5rem", marginBottom: "3rem" }}>
          <div>
            <span style={{ display: "inline-block", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--brand-accent)", marginBottom: "0.75rem", padding: "0.3rem 0.85rem", border: "1px solid color-mix(in srgb, var(--brand-accent) 30%, transparent)", borderRadius: "999px", background: "color-mix(in srgb, var(--brand-accent) 8%, transparent)" }}>
              Recent Projects
            </span>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.1, color: "var(--brand-fg)", maxWidth: "480px" }}>
              Built right.{" "}
              <span style={{ background: "linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                On time. On budget.
              </span>
            </h2>
          </div>
          <a href={business.phoneHref} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "var(--brand-accent)", color: "#fff", fontWeight: 700, fontSize: "0.875rem", padding: "0.8rem 1.5rem", borderRadius: "999px", textDecoration: "none", whiteSpace: "nowrap", boxShadow: "var(--shadow-cta)" }}>
            Get Free Design Consult →
          </a>
        </div>

        {/* Project cards */}
        <div
          ref={cardsRef}
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem" }}
          className="project-grid"
        >
          {PROJECTS.map((proj, i) => (
            <div
              key={proj.type}
              className="project-card"
              style={{ position: "relative", borderRadius: "1.25rem", overflow: "hidden", background: `linear-gradient(${140 + i * 15}deg, color-mix(in srgb, var(--brand-accent) ${12 + i * 3}%, var(--brand-bg-mid)), var(--brand-bg-mid))`, aspectRatio: "3/4", border: "1px solid var(--brand-card-border)", cursor: "default" }}
              onMouseEnter={(e) => {
                gsap.to(e.currentTarget.querySelector("img"), { scale: 1.07, duration: 0.5, ease: "power2.out" })
              }}
              onMouseLeave={(e) => {
                gsap.to(e.currentTarget.querySelector("img"), { scale: 1, duration: 0.5, ease: "power2.in" })
              }}
            >
              <img
                src={proj.img}
                alt={proj.type}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
              />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)" }} />

              {/* Number */}
              <div style={{ position: "absolute", top: "1.25rem", left: "1.25rem", fontFamily: "var(--font-display)", fontSize: "3rem", fontWeight: 900, color: "rgba(255,255,255,0.08)", lineHeight: 1 }} aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </div>

              {/* Content */}
              <div style={{ position: "absolute", bottom: "1.5rem", left: "1.5rem", right: "1.5rem" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.65)", marginBottom: "0.35rem" }}>
                  {proj.detail}
                </div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 700, color: "#FFFFFF", lineHeight: 1.2, marginBottom: "0.25rem" }}>
                  {proj.type}
                </h3>
                <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.7)" }}>
                  {proj.scope}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Stats strip */}
        <div style={{ marginTop: "2rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: "var(--brand-card-border)", borderRadius: "1rem", overflow: "hidden", border: "1px solid var(--brand-card-border)" }}>
          {[
            { n: "200+", l: "Projects Completed" },
            { n: "100%", l: "Licensed & Permitted" },
            { n: "10-Year", l: "Workmanship Warranty" },
          ].map((s) => (
            <div key={s.l} style={{ textAlign: "center", padding: "1.5rem", background: "var(--brand-card-bg)" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 800, color: "var(--brand-accent)", lineHeight: 1, marginBottom: "0.35rem" }}>{s.n}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--brand-fg-muted)" }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .project-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
