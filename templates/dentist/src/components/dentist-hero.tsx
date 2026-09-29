"use client"

import { useEffect, useRef } from "react"
import { gsap } from "@core/web/lib"
import { createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"
import type { SiteConfig } from "@core/web/types"
import { SplitText } from "@core/web/effects"

interface Props { config: SiteConfig }

export function DentistHero({ config }: Props) {
  const b = config.business
  const reduced = useReducedMotion()

  const sectionRef  = useRef<HTMLElement>(null)
  const labelRef    = useRef<HTMLDivElement>(null)
  const h1Ref       = useRef<HTMLHeadingElement>(null)
  const subRef      = useRef<HTMLParagraphElement>(null)
  const ctaRef      = useRef<HTMLDivElement>(null)
  const statsRef    = useRef<HTMLDivElement>(null)
  const photoRef    = useRef<HTMLDivElement>(null)
  const badgeRef    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reduced) return
    const scope = createScope()
    const words = h1Ref.current?.querySelectorAll<HTMLElement>(".split-word")

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
    tl.from(labelRef.current,  { opacity: 0, y: -16, duration: 0.4 })
      .from(words ?? [],        { yPercent: 115, opacity: 0, stagger: 0.04, duration: 0.7 }, "-=0.25")
      .from(subRef.current,    { opacity: 0, y: 20, duration: 0.5 }, "-=0.45")
      .from(ctaRef.current,    { opacity: 0, y: 18, duration: 0.45 }, "-=0.35")
      .from(statsRef.current,  { opacity: 0, y: 14, duration: 0.4 }, "-=0.3")
      .from(photoRef.current,  { opacity: 0, x: 50, duration: 0.75 }, "-=0.8")
      .from(badgeRef.current,  { opacity: 0, scale: 0.8, duration: 0.4 }, "-=0.3")

    scope.add(tl)
    return () => scope.kill()
  }, [reduced])

  return (
    <section
      ref={sectionRef}
      id="hero"
      style={{
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        position: "relative",
        overflow: "hidden",
        background: "var(--brand-bg)",
      }}
    >
      {/* Full-bleed background photo */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--brand-bg)",
        }}
      >
        <img
          src="/hero-1.jpg"
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center top",
            opacity: 0.18,
          }}
        />
        {/* Strong left-to-right gradient: opaque brand bg → transparent → photo */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(105deg, var(--brand-bg) 0%, var(--brand-bg) 38%, color-mix(in srgb, var(--brand-bg) 65%, transparent) 60%, transparent 100%)",
          }}
        />
        {/* Aurora blobs */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "-10%", left: "-5%", width: "55%", height: "70%", background: "radial-gradient(ellipse, color-mix(in srgb, var(--brand-accent) 12%, transparent) 0%, transparent 70%)", filter: "blur(70px)", animation: "aurora-drift 14s ease-in-out infinite" }} />
          <div style={{ position: "absolute", bottom: "-15%", right: "30%", width: "45%", height: "65%", background: "radial-gradient(ellipse, color-mix(in srgb, var(--brand-accent-light, var(--brand-accent)) 9%, transparent) 0%, transparent 70%)", filter: "blur(80px)", animation: "aurora-drift 18s ease-in-out infinite reverse" }} />
        </div>
      </div>

      {/* Content grid */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "7rem 2rem 5rem",
          display: "grid",
          gridTemplateColumns: "1fr 420px",
          gap: "4rem",
          alignItems: "center",
        }}
        className="dentist-hero-grid"
      >
        {/* Left: copy */}
        <div>
          {/* Label */}
          <div ref={labelRef} style={{ marginBottom: "1.25rem" }}>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--brand-accent)",
              padding: "0.3rem 0.85rem",
              border: "1px solid color-mix(in srgb, var(--brand-accent) 35%, transparent)",
              borderRadius: "999px",
              background: "color-mix(in srgb, var(--brand-accent) 10%, transparent)",
            }}>
              {b.serviceAreas[0]} · Trusted Since {b.since}
            </span>
          </div>

          {/* Headline */}
          <h1
            ref={h1Ref}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.6rem, 5.5vw, 4.2rem)",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              color: "var(--brand-fg)",
              marginBottom: "1.5rem",
            }}
          >
            <SplitText text="Your Perfect" />
            {" "}
            <span style={{ display: "block", background: "linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              <SplitText text="Smile Starts" />
            </span>
            {" "}
            <SplitText text="Right Here." />
          </h1>

          {/* Sub */}
          <p ref={subRef} style={{ fontSize: "1.1rem", lineHeight: 1.75, color: "var(--brand-fg-muted)", maxWidth: "480px", marginBottom: "2.25rem" }}>
            Gentle, anxiety-free dentistry for the whole family. Most insurance accepted.
            Same-day emergencies.{" "}
            <strong style={{ color: "var(--brand-fg)", fontWeight: 600 }}>{b.review_count}+ happy patients</strong> in {b.serviceAreas[0]}.
          </p>

          {/* CTAs */}
          <div ref={ctaRef} style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "2.75rem" }}>
            <a
              href={b.phoneHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "var(--brand-accent)",
                color: "#fff",
                fontWeight: 700,
                fontSize: "0.95rem",
                padding: "0.9rem 1.75rem",
                borderRadius: "999px",
                textDecoration: "none",
                boxShadow: "var(--shadow-cta)",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              📞 Book Free Consult
            </a>
            <a
              href="#services"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "transparent",
                color: "var(--brand-fg)",
                fontWeight: 600,
                fontSize: "0.95rem",
                padding: "0.9rem 1.75rem",
                borderRadius: "999px",
                textDecoration: "none",
                border: "1.5px solid var(--brand-card-border)",
                transition: "border-color 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--brand-accent)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--brand-card-border)")}
            >
              View Services →
            </a>
          </div>

          {/* Stats strip */}
          <div ref={statsRef} style={{ display: "flex", gap: "2.5rem", flexWrap: "wrap" }}>
            {[
              { n: `${b.google_rating}★`, l: "Google Rating" },
              { n: `${b.review_count}+`, l: "Patient Reviews" },
              { n: "16+", l: "Years Experience" },
              { n: "Same Day", l: "Emergencies" },
            ].map(s => (
              <div key={s.l}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 800, color: "var(--brand-accent)", lineHeight: 1 }}>{s.n}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--brand-fg-sub)", letterSpacing: "0.04em", marginTop: "0.2rem" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: main photo card */}
        <div ref={photoRef} style={{ position: "relative" }}>
          {/* Main tall photo */}
          <div
            style={{
              borderRadius: "2rem",
              overflow: "hidden",
              aspectRatio: "4/5",
              boxShadow: "0 40px 80px -20px rgba(0,0,0,0.5), 0 0 0 1px var(--brand-card-border)",
              position: "relative",
            }}
          >
            <img
              src="/hero-2.jpg"
              alt="Patient with beautiful smile"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            {/* Bottom gradient */}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 55%)" }} />
            {/* Name + caption */}
            <div style={{ position: "absolute", bottom: "1.75rem", left: "1.75rem", right: "1.75rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", marginBottom: "0.25rem" }}>
                Real patient result
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>
                Smile Makeover — 1 Visit
              </div>
            </div>
          </div>

          {/* Floating rating badge — top left */}
          <div
            ref={badgeRef}
            style={{
              position: "absolute",
              top: "-1rem",
              left: "-1.5rem",
              background: "var(--brand-card-bg)",
              border: "1px solid var(--brand-card-border)",
              borderRadius: "1rem",
              padding: "0.75rem 1.1rem",
              boxShadow: "0 8px 24px -4px rgba(0,0,0,0.35)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              minWidth: "140px",
            }}
          >
            <div style={{ display: "flex", gap: "0.2rem", marginBottom: "0.25rem" }}>
              {[...Array(5)].map((_, i) => (
                <span key={i} style={{ color: "#FBBF24", fontSize: "0.85rem" }}>★</span>
              ))}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", fontWeight: 800, color: "var(--brand-fg)", lineHeight: 1 }}>
              {b.google_rating}
            </div>
            <div style={{ fontSize: "0.65rem", color: "var(--brand-fg-sub)", marginTop: "0.15rem" }}>
              {b.review_count}+ Google reviews
            </div>
          </div>

          {/* Floating insurance badge — bottom right */}
          <div
            style={{
              position: "absolute",
              bottom: "5rem",
              right: "-1.5rem",
              background: "var(--brand-accent)",
              borderRadius: "1rem",
              padding: "0.7rem 1rem",
              boxShadow: "0 8px 24px -4px rgba(0,0,0,0.4)",
              textAlign: "center",
              minWidth: "130px",
            }}
          >
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fff", fontFamily: "var(--font-display)", lineHeight: 1 }}>
              Insurance
            </div>
            <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "rgba(255,255,255,0.85)", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: "0.2rem" }}>
              Accepted
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes aurora-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(3%, 2%) scale(1.05); }
          66% { transform: translate(-2%, 3%) scale(0.97); }
        }
        @media (max-width: 900px) {
          .dentist-hero-grid {
            grid-template-columns: 1fr !important;
          }
          .dentist-hero-grid > div:last-child {
            max-width: 360px;
            margin: 0 auto;
          }
        }
      `}</style>
    </section>
  )
}
