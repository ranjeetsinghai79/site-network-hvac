"use client"

import { useEffect, useRef } from "react"
import { gsap, createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"

const BARBERS = [
  {
    name: "Marcus Webb",
    title: "Master Barber",
    specialty: "Precision Fades & Tapers",
    years: "12 yrs",
    // Unique portrait — not used in gallery or work grid
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=85&fit=crop&crop=face",
  },
  {
    name: "Diego Reyes",
    title: "Senior Barber",
    specialty: "Classic Cuts & Hot Shaves",
    years: "8 yrs",
    image: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=600&q=85&fit=crop&crop=face",
  },
  {
    name: "Jordan Blake",
    title: "Barber",
    specialty: "Designs & Color Blending",
    years: "5 yrs",
    image: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&q=85&fit=crop&crop=face",
  },
]

export function BarbersSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const headRef   = useRef<HTMLDivElement>(null)
  const gridRef   = useRef<HTMLDivElement>(null)
  const reduced   = useReducedMotion()

  useEffect(() => {
    const section = sectionRef.current
    const head    = headRef.current
    const grid    = gridRef.current
    if (!section || !head || !grid) return

    const scope = createScope()

    if (!reduced) {
      const ht = gsap.from(head, {
        opacity: 0, y: 36, duration: 0.75, ease: "power3.out",
        scrollTrigger: { trigger: section, start: "top 80%", once: true },
      })
      scope.add(ht)
      if (ht.scrollTrigger) scope.add(ht.scrollTrigger)

      const cards = grid.querySelectorAll<HTMLElement>(".barber-card")
      if (cards.length) {
        const ct = gsap.from(cards, {
          opacity: 0, y: 64, stagger: 0.14, duration: 0.8, ease: "power3.out",
          scrollTrigger: { trigger: grid, start: "top 82%", once: true },
        })
        scope.add(ct)
        if (ct.scrollTrigger) scope.add(ct.scrollTrigger)
      }

      // 3D tilt per card
      grid.querySelectorAll<HTMLElement>(".barber-card").forEach((card) => {
        const inner = card.querySelector<HTMLElement>(".barber-inner")
        const img   = card.querySelector<HTMLElement>(".barber-portrait")
        if (!inner) return

        const setRX = gsap.quickTo(inner, "rotationX", { duration: 0.45, ease: "power2.out" })
        const setRY = gsap.quickTo(inner, "rotationY", { duration: 0.45, ease: "power2.out" })
        gsap.set(inner, { transformPerspective: 900, transformStyle: "preserve-3d" })

        function onMove(e: MouseEvent) {
          const rect = card.getBoundingClientRect()
          const x = (e.clientX - rect.left) / rect.width - 0.5
          const y = (e.clientY - rect.top) / rect.height - 0.5
          setRX(-y * 9)
          setRY(x * 9)
          if (img) gsap.to(img, { scale: 1.05, duration: 0.4, ease: "power2.out" })
        }
        function onLeave() {
          setRX(0)
          setRY(0)
          if (img) gsap.to(img, { scale: 1, duration: 0.55, ease: "power2.out" })
        }

        card.addEventListener("mousemove", onMove)
        card.addEventListener("mouseleave", onLeave)
      })
    }

    return () => scope.kill()
  }, [reduced])

  return (
    <section
      ref={sectionRef}
      id="team"
      style={{ position: "relative", background: "var(--brand-bg)", padding: "8rem 0", overflow: "hidden" }}
    >
      {/* Subtle grid texture */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.025,
        backgroundImage: `linear-gradient(rgba(201,169,110,1) 1px, transparent 1px), linear-gradient(90deg, rgba(201,169,110,1) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
        pointerEvents: "none",
      }} />

      {/* Gold glow left edge */}
      <div style={{
        position: "absolute", top: "20%", left: "-100px",
        width: "400px", height: "600px",
        background: "radial-gradient(ellipse, rgba(201,169,110,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 2rem" }}>

        {/* Header */}
        <div ref={headRef} style={{ textAlign: "center", marginBottom: "4.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", justifyContent: "center", marginBottom: "1.75rem" }}>
            <div style={{ width: "48px", height: "1px", background: "rgba(201,169,110,0.45)" }} />
            <span style={{ fontSize: "0.62rem", letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--brand-accent)", fontFamily: "var(--font-body)", fontWeight: 600 }}>
              The Team
            </span>
            <div style={{ width: "48px", height: "1px", background: "rgba(201,169,110,0.45)" }} />
          </div>
          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.5rem, 5vw, 3.75rem)",
            fontWeight: 700,
            color: "var(--brand-fg)",
            letterSpacing: "-0.01em",
            lineHeight: 1.05,
            marginBottom: "1.1rem",
          }}>
            Meet Your Barbers
          </h2>
          <p style={{ fontSize: "0.95rem", color: "var(--brand-fg-muted)", lineHeight: 1.75, maxWidth: "460px", margin: "0 auto", fontFamily: "var(--font-body)" }}>
            Every barber is state-licensed and honed their craft for years. Request your preferred barber when you book.
          </p>
        </div>

        {/* Cards */}
        <div
          ref={gridRef}
          className="barbers-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}
        >
          {BARBERS.map((barber) => (
            <div
              key={barber.name}
              className="barber-card"
              style={{ cursor: "pointer" }}
            >
              <div
                className="barber-inner"
                style={{
                  borderRadius: "1.25rem",
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(201,169,110,0.14)",
                  boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
                }}
              >
                {/* Portrait */}
                <div style={{ position: "relative", aspectRatio: "3/4", overflow: "hidden" }}>
                  <img
                    className="barber-portrait"
                    src={barber.image}
                    alt={barber.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      filter: "grayscale(25%) contrast(1.05) brightness(0.9)",
                      transition: "transform 0.5s ease",
                      display: "block",
                    }}
                  />
                  {/* Gradient overlay */}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(to top, rgba(10,8,4,0.88) 0%, rgba(10,8,4,0.15) 55%, transparent 100%)",
                    pointerEvents: "none",
                  }} />
                  {/* Gold accent at bottom */}
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    height: "2px",
                    background: "linear-gradient(90deg, transparent, var(--brand-accent), transparent)",
                  }} />
                  {/* Years badge */}
                  <div style={{
                    position: "absolute", top: "1rem", right: "1rem",
                    background: "rgba(10,8,4,0.6)",
                    border: "1px solid rgba(201,169,110,0.35)",
                    backdropFilter: "blur(10px)",
                    borderRadius: "999px",
                    padding: "0.28rem 0.7rem",
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--brand-accent)",
                    fontFamily: "var(--font-body)",
                  }}>
                    {barber.years}
                  </div>
                </div>

                {/* Info */}
                <div style={{ padding: "1.5rem 1.75rem 1.75rem", borderTop: "1px solid rgba(201,169,110,0.12)" }}>
                  <div style={{
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: "var(--brand-accent)",
                    marginBottom: "0.5rem",
                    fontFamily: "var(--font-body)",
                  }}>
                    {barber.title}
                  </div>
                  <h3 style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.45rem",
                    fontWeight: 700,
                    color: "var(--brand-fg)",
                    marginBottom: "0.4rem",
                    lineHeight: 1.15,
                  }}>
                    {barber.name}
                  </h3>
                  <p style={{
                    fontSize: "0.82rem",
                    color: "var(--brand-fg-muted)",
                    marginBottom: "1.5rem",
                    fontFamily: "var(--font-body)",
                    lineHeight: 1.5,
                  }}>
                    {barber.specialty}
                  </p>
                  <a
                    href="tel:+15554560987"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.45rem",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--brand-accent)",
                      textDecoration: "none",
                      paddingBottom: "2px",
                      borderBottom: "1px solid rgba(201,169,110,0.35)",
                      transition: "border-color 0.2s ease",
                      fontFamily: "var(--font-body)",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand-accent)" }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(201,169,110,0.35)" }}
                  >
                    Book a Session
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .barbers-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 641px) and (max-width: 1023px) {
          .barbers-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </section>
  )
}
