"use client"

import { useEffect, useRef } from "react"
import type { SiteConfig } from "../types"
import { gsap, ScrollTrigger } from "../lib/gsap-init"
import { createScope } from "../lib/kill-scope"
import { useReducedMotion } from "../hooks/use-reduced-motion"
import { SplitText } from "../effects/split-text"
import { ParticleField } from "../effects/particle-field"
import { AuroraBlobs } from "../effects/aurora-blobs"

interface Props {
  config: SiteConfig
  /** Optional bg image shown at low opacity behind aurora */
  posterSrc?: string
  /** Override label text */
  label?: string
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

export function HeroCentered({ config, posterSrc, label }: Props) {
  const { business, trustBadges = [] } = config

  const sectionRef = useRef<HTMLElement>(null)
  const wrapRef    = useRef<HTMLDivElement>(null)
  const labelRef   = useRef<HTMLDivElement>(null)
  const h1Ref      = useRef<HTMLHeadingElement>(null)
  const tagRef     = useRef<HTMLParagraphElement>(null)
  const ctaRef     = useRef<HTMLDivElement>(null)
  const trustRef   = useRef<HTMLDivElement>(null)
  const scrollRef  = useRef<HTMLDivElement>(null)

  const reduced = useReducedMotion()

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    if (reduced) {
      gsap.set(
        [labelRef.current, tagRef.current, ctaRef.current, trustRef.current, scrollRef.current].filter(Boolean),
        { opacity: 1, y: 0 },
      )
      return
    }

    const scope = createScope()
    const words = h1Ref.current?.querySelectorAll<HTMLElement>(".split-word")

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
    tl.from(labelRef.current,  { opacity: 0, y: -14, duration: 0.45 })
      .from(words ?? [],       { yPercent: 110, opacity: 0, stagger: 0.05, duration: 0.8 }, "-=0.2")
      .from(tagRef.current,    { opacity: 0, y: 22, duration: 0.6 }, "-=0.45")
      .from(ctaRef.current,    { opacity: 0, y: 20, duration: 0.55 }, "-=0.35")
      .from(trustRef.current,  { opacity: 0, y: 16, duration: 0.5 }, "-=0.3")
      .from(scrollRef.current, { opacity: 0, duration: 0.4 }, "-=0.2")
    scope.add(tl)

    // Subtle parallax fade as user scrolls past
    const fade = gsap.to(wrapRef.current, {
      opacity: 0,
      y: -60,
      ease: "none",
      scrollTrigger: { trigger: section, start: "40% top", end: "85% top", scrub: 1 },
    })
    scope.add(fade)
    if (fade.scrollTrigger) scope.add(fade.scrollTrigger)

    return () => scope.kill()
  }, [reduced])

  const nicheCta  = NICHE_CTA[business.niche] ?? "Get Started"
  const labelText = label ?? `${business.serviceAreas?.[0] ?? business.city} · ${business.license ?? "Licensed & Insured"}`

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ background: `linear-gradient(160deg, var(--brand-bg) 0%, var(--brand-bg-mid) 60%, var(--brand-bg) 100%)` }}
    >
      {/* Background layers */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {posterSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0.08, filter: "grayscale(60%)" }}
          />
        )}
        <AuroraBlobs />
        <ParticleField count={40} />
        {/* Radial vignette */}
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, rgba(0,0,0,0.35) 100%)" }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(var(--brand-grid) 1px, transparent 1px), linear-gradient(90deg, var(--brand-grid) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            opacity: 0.4,
          }}
        />
      </div>

      {/* Centered content */}
      <div
        ref={wrapRef}
        className="relative z-10 flex flex-col items-center text-center px-6 pt-28 pb-20"
        style={{ maxWidth: "860px", margin: "0 auto" }}
      >
        {/* Section label */}
        <div
          ref={labelRef}
          style={{ opacity: 0, marginBottom: "32px" }}
        >
          <span
            className="font-body"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 18px",
              borderRadius: "9999px",
              border: "1px solid color-mix(in srgb, var(--brand-accent) 45%, transparent)",
              color: "var(--brand-accent)",
              fontSize: "0.7rem",
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "var(--brand-accent)",
                boxShadow: "0 0 8px var(--brand-accent)",
                animation: "pulse 2s infinite",
              }}
            />
            {labelText}
          </span>
        </div>

        {/* Headline */}
        <h1
          ref={h1Ref}
          className="font-display"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(3.2rem, 9vw, 7.5rem)",
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: "-0.025em",
            color: "var(--brand-fg)",
            marginBottom: "28px",
            overflow: "hidden",
          }}
        >
          <SplitText as="span" className="text-gradient-animate">
            {business.tagline || business.name}
          </SplitText>
        </h1>

        {/* Subtitle */}
        <p
          ref={tagRef}
          className="font-body"
          style={{
            opacity: 0,
            fontSize: "clamp(1rem, 1.8vw, 1.2rem)",
            color: "var(--brand-fg-muted)",
            maxWidth: "560px",
            lineHeight: 1.65,
            marginBottom: "44px",
          }}
        >
          {business.name} — {business.city}&apos;s trusted {business.niche.replace(/-/g, " ")} specialists.
          {business.since ? ` Serving the community since ${business.since}.` : ""}
        </p>

        {/* CTA row */}
        <div
          ref={ctaRef}
          style={{
            opacity: 0,
            display: "flex",
            gap: "16px",
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: "48px",
          }}
        >
          <a
            href={business.phoneHref}
            className="btn-primary font-body"
            style={{ minWidth: "210px", textAlign: "center" }}
          >
            {nicheCta}
          </a>
          <a
            href="#contact"
            className="font-body"
            style={{
              minWidth: "150px",
              padding: "14px 28px",
              border: "1px solid color-mix(in srgb, var(--brand-accent) 50%, transparent)",
              color: "var(--brand-fg-muted)",
              borderRadius: "6px",
              fontWeight: 600,
              textDecoration: "none",
              fontSize: "0.875rem",
              letterSpacing: "0.04em",
              transition: "all 0.2s ease",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Learn More
          </a>
        </div>

        {/* Trust badge strip */}
        <div
          ref={trustRef}
          style={{
            opacity: 0,
            display: "flex",
            gap: "10px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {trustBadges.slice(0, 5).map((badge, i) => (
            <span
              key={i}
              className="font-body"
              style={{
                padding: "5px 12px",
                background: "color-mix(in srgb, var(--brand-accent) 7%, transparent)",
                border: "1px solid color-mix(in srgb, var(--brand-accent) 18%, transparent)",
                borderRadius: "4px",
                fontSize: "0.72rem",
                color: "var(--brand-fg-muted)",
                fontWeight: 500,
                letterSpacing: "0.03em",
              }}
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        ref={scrollRef}
        style={{
          opacity: 0,
          position: "absolute",
          bottom: "28px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "6px",
          pointerEvents: "none",
        }}
      >
        <span
          className="font-body"
          style={{ fontSize: "0.6rem", letterSpacing: "0.16em", color: "var(--brand-fg-muted)", textTransform: "uppercase" }}
        >
          Scroll
        </span>
        <div
          style={{
            width: "1px",
            height: "36px",
            background: "linear-gradient(to bottom, var(--brand-accent), transparent)",
          }}
        />
      </div>
    </section>
  )
}
