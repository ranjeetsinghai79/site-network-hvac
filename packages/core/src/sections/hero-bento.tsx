"use client"

import { useEffect, useRef } from "react"
import { Star } from "lucide-react"
import type { SiteConfig } from "../types"
import { gsap } from "../lib/gsap-init"
import { createScope } from "../lib/kill-scope"
import { useReducedMotion } from "../hooks/use-reduced-motion"
import { SplitText } from "../effects/split-text"

interface Props {
  config: SiteConfig
  /** Hero photo — displays in the large right cell */
  photoSrc?: string
}

const NICHE_CTA: Record<string, string> = {
  hvac:             "Schedule Service",
  roofing:          "Get Free Inspection",
  dentist:          "Book Appointment",
  medspa:           "Book Consultation",
  lawfirm:          "Free Case Review",
  remodeling:       "Get Free Estimate",
  cleaning:         "Get Instant Quote",
  "junk-removal":   "Book Same-Day",
  daycare:          "Schedule a Tour",
  "auto-detailing": "Book Your Detail",
  restaurant:       "Make a Reservation",
  "luxury-realestate": "View Properties",
}

/** Shared cell base styles */
const cell = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: "color-mix(in srgb, var(--brand-bg-section) 80%, transparent)",
  border: "1px solid color-mix(in srgb, var(--brand-accent) 12%, transparent)",
  borderRadius: "16px",
  padding: "28px",
  position: "relative",
  overflow: "hidden",
  ...extra,
})

export function HeroBento({ config, photoSrc }: Props) {
  const { business, trustBadges = [], stats = [] } = config

  const sectionRef = useRef<HTMLElement>(null)
  const gridRef    = useRef<HTMLDivElement>(null)
  const h1Ref      = useRef<HTMLHeadingElement>(null)

  const reduced = useReducedMotion()

  useEffect(() => {
    const section = sectionRef.current
    if (!section || !gridRef.current) return

    const cells = gridRef.current.querySelectorAll<HTMLElement>(".bento-cell")

    if (reduced) {
      gsap.set(cells, { opacity: 1, y: 0, scale: 1 })
      return
    }

    const scope = createScope()
    const words = h1Ref.current?.querySelectorAll<HTMLElement>(".split-word")

    // Stagger each bento cell in
    const tl = gsap.timeline({ defaults: { ease: "power3.out" }, delay: 0.1 })
    tl.from(cells, { opacity: 0, y: 40, scale: 0.96, stagger: 0.08, duration: 0.7 })
      .from(words ?? [], { yPercent: 110, opacity: 0, stagger: 0.045, duration: 0.65 }, "-=0.5")
    scope.add(tl)

    // Hover 3D tilt on each cell — track cleanups manually (not via scope)
    type Cleanup = () => void
    const cleanups: Cleanup[] = []
    cells.forEach((c) => {
      gsap.set(c, { transformPerspective: 800, transformStyle: "preserve-3d" })
      const setRX = gsap.quickTo(c, "rotationX", { duration: 0.35, ease: "power2.out" })
      const setRY = gsap.quickTo(c, "rotationY", { duration: 0.35, ease: "power2.out" })
      const reset = () => { setRX(0); setRY(0) }
      const onMove = (e: MouseEvent) => {
        const r = c.getBoundingClientRect()
        const x = ((e.clientX - r.left) / r.width  - 0.5) * 12
        const y = ((e.clientY - r.top)  / r.height - 0.5) * -12
        setRY(x); setRX(y)
      }
      c.addEventListener("mousemove", onMove)
      c.addEventListener("mouseleave", reset)
      cleanups.push(() => {
        c.removeEventListener("mousemove", onMove)
        c.removeEventListener("mouseleave", reset)
      })
    })

    return () => { scope.kill(); cleanups.forEach(fn => fn()) }
  }, [reduced])

  const nicheCta  = NICHE_CTA[business.niche] ?? "Get Started"
  const rating    = Number(business.google_rating ?? 4.9)
  const reviews   = business.review_count ?? "200"
  const since     = business.since
  const statYear  = since ? new Date().getFullYear() - Number(since) : undefined
  const feat1     = stats[0] ?? { value: rating, label: "Google Rating", suffix: "★" }
  const feat2     = stats[1] ?? { value: statYear ?? 10, label: "Years Experience", suffix: "+" }

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative overflow-hidden"
      style={{
        minHeight: "100vh",
        background: `linear-gradient(160deg, var(--brand-bg) 0%, var(--brand-bg-mid) 60%, var(--brand-bg) 100%)`,
        display: "flex",
        alignItems: "center",
        padding: "120px 0 60px",
      }}
    >
      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          backgroundImage: "linear-gradient(var(--brand-grid) 1px, transparent 1px), linear-gradient(90deg, var(--brand-grid) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          opacity: 0.35,
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">

        {/* Section label */}
        <div style={{ marginBottom: "24px" }}>
          <span
            className="font-body section-label"
            style={{ color: "var(--brand-accent)", fontSize: "0.72rem" }}
          >
            {business.city} · {business.niche.replace(/-/g, " ")}
          </span>
        </div>

        {/* Bento grid */}
        <div
          ref={gridRef}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gridTemplateRows: "auto auto",
            gap: "12px",
          }}
        >
          {/* ── Cell A: Main headline + CTA ─────────────────────────── */}
          <div
            className="bento-cell hover-lift"
            style={cell({
              gridColumn: "span 7",
              gridRow: "span 2",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              minHeight: "360px",
              background: "color-mix(in srgb, var(--brand-bg-section) 90%, transparent)",
            })}
          >
            {/* Accent glow */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: "-60px",
                left: "-60px",
                width: "240px",
                height: "240px",
                borderRadius: "50%",
                background: "radial-gradient(ellipse, var(--brand-blob-1) 0%, transparent 70%)",
                filter: "blur(40px)",
                pointerEvents: "none",
              }}
            />

            <h1
              ref={h1Ref}
              className="font-display"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2.6rem, 5.5vw, 5.5rem)",
                fontWeight: 800,
                lineHeight: 1.0,
                letterSpacing: "-0.03em",
                color: "var(--brand-fg)",
                marginBottom: "20px",
                overflow: "hidden",
              }}
            >
              <SplitText as="span">{business.name}</SplitText>
              <br />
              <SplitText as="span" className="text-gradient-animate" style={{ fontSize: "0.72em" }}>
                {business.tagline}
              </SplitText>
            </h1>

            <p
              className="font-body"
              style={{
                color: "var(--brand-fg-muted)",
                fontSize: "1rem",
                lineHeight: 1.6,
                marginBottom: "32px",
                maxWidth: "420px",
              }}
            >
              Trusted by {reviews}+ customers in {business.city}
              {business.since ? ` since ${business.since}` : ""}.
            </p>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <a
                href={business.phoneHref}
                className="btn-primary font-body"
              >
                {nicheCta}
              </a>
              <a
                href={`tel:${business.phone?.replace(/\D/g, "")}`}
                className="font-body"
                style={{
                  padding: "14px 22px",
                  border: "1px solid color-mix(in srgb, var(--brand-accent) 40%, transparent)",
                  color: "var(--brand-fg-muted)",
                  borderRadius: "8px",
                  textDecoration: "none",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                }}
              >
                {business.phone}
              </a>
            </div>
          </div>

          {/* ── Cell B: Rating ────────────────────────────────────────── */}
          <div
            className="bento-cell hover-lift"
            style={cell({
              gridColumn: "span 5",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "flex-start",
              gap: "8px",
            })}
          >
            <div style={{ display: "flex", gap: "4px" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={20}
                  style={{ color: "var(--brand-accent)", fill: i < Math.round(rating) ? "var(--brand-accent)" : "transparent" }}
                />
              ))}
            </div>
            <div
              className="font-display"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "3.5rem",
                fontWeight: 800,
                color: "var(--brand-fg)",
                lineHeight: 1,
                letterSpacing: "-0.03em",
              }}
            >
              {rating.toFixed(1)}
            </div>
            <div className="font-body" style={{ fontSize: "0.85rem", color: "var(--brand-fg-muted)" }}>
              {reviews}+ Google reviews
            </div>
          </div>

          {/* ── Cell C: Photo ─────────────────────────────────────────── */}
          <div
            className="bento-cell"
            style={cell({
              gridColumn: "span 3",
              padding: 0,
              overflow: "hidden",
              minHeight: "180px",
            })}
          >
            {photoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoSrc}
                alt={`${business.name} work`}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.5s ease" }}
                className="group-hover:scale-105"
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  minHeight: "180px",
                  background: "linear-gradient(135deg, var(--brand-blob-1), var(--brand-blob-2))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span className="font-display" style={{ fontSize: "3rem", color: "var(--brand-fg-muted)" }}>
                  {business.name.charAt(0)}
                </span>
              </div>
            )}
          </div>

          {/* ── Cell D: Stat ──────────────────────────────────────────── */}
          <div
            className="bento-cell hover-lift"
            style={cell({ gridColumn: "span 2", display: "flex", flexDirection: "column", justifyContent: "center" })}
          >
            <div
              className="font-display"
              style={{ fontFamily: "var(--font-display)", fontSize: "2.8rem", fontWeight: 800, color: "var(--brand-accent)", lineHeight: 1, letterSpacing: "-0.02em" }}
            >
              {feat2.value}{feat2.suffix}
            </div>
            <div className="font-body" style={{ fontSize: "0.8rem", color: "var(--brand-fg-muted)", marginTop: "6px" }}>
              {feat2.label}
            </div>
          </div>

          {/* ── Cell E: Trust badges ─────────────────────────────────── */}
          <div
            className="bento-cell hover-lift"
            style={cell({ gridColumn: "span 5", display: "flex", flexDirection: "column", justifyContent: "center", gap: "8px" })}
          >
            <div className="font-body" style={{ fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--brand-accent)", fontWeight: 600, marginBottom: "4px" }}>
              Why Us
            </div>
            {trustBadges.slice(0, 4).map((badge, i) => (
              <div
                key={i}
                className="font-body"
                style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "var(--brand-fg-muted)" }}
              >
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--brand-accent)", flexShrink: 0 }} />
                {badge}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
