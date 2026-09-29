"use client"

import { useEffect, useRef } from "react"
import { Phone, ArrowRight, ShieldCheck, Star, Clock } from "lucide-react"
import type { SiteConfig } from "../types"
import { gsap, ScrollTrigger } from "../lib/gsap-init"
import { createScope } from "../lib/kill-scope"
import { useReducedMotion } from "../hooks/use-reduced-motion"
import { SplitText } from "../effects/split-text"

interface Props {
  config: SiteConfig
  /** Optional right-column slot (e.g. <HeroThermostat /> for HVAC) */
  rightSlot?: React.ReactNode
  /** Background video URL. Falls back to gradient if absent. */
  videoSrc?: string
  /** Poster image for video / fallback background */
  posterSrc?: string
  /** Override label above headline */
  label?: string
  /** Override pulse badge text */
  badge?: string
  /** Subtitle paragraph override */
  paragraph?: string
  /** Replace the two default CTA buttons */
  ctaSlot?: React.ReactNode
  /** Replace the trust badges row */
  trustSlot?: React.ReactNode
  /** Brightness of poster image (0–1). Default 0.45. Increase for portrait/people shots. */
  posterBrightness?: number
}

export function Hero({
  config,
  rightSlot,
  videoSrc,
  posterSrc,
  label,
  badge,
  paragraph,
  ctaSlot,
  trustSlot,
  posterBrightness = 0.45,
}: Props) {
  const business = config.business
  const trustBadges = config.trustBadges ?? []

  const sectionRef = useRef<HTMLElement>(null)
  const parallaxRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<HTMLDivElement>(null)
  const h1Ref = useRef<HTMLHeadingElement>(null)
  const paraRef = useRef<HTMLParagraphElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const trustRef = useRef<HTMLDivElement>(null)
  const badgesRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)

  const reduced = useReducedMotion()

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    if (reduced) {
      gsap.set(
        [labelRef.current, badgeRef.current, paraRef.current, ctaRef.current, trustRef.current, badgesRef.current, rightRef.current].filter(Boolean),
        { opacity: 1, y: 0 },
      )
      return
    }

    const scope = createScope()
    const words = h1Ref.current?.querySelectorAll<HTMLElement>(".split-word")

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
    tl.from(labelRef.current,   { opacity: 0, y: -16, duration: 0.45 })
      .from(badgeRef.current,   { opacity: 0, y: -12, duration: 0.45 }, "-=0.2")
      .from(words ?? [],         { yPercent: 110, opacity: 0, stagger: 0.045, duration: 0.75 }, "-=0.4")
      .from(paraRef.current,    { opacity: 0, y: 24, duration: 0.6 }, "-=0.5")
      .from(ctaRef.current,     { opacity: 0, y: 20, duration: 0.5 }, "-=0.4")
      .from(trustRef.current,   { opacity: 0, duration: 0.4 }, "-=0.3")
      .from(badgesRef.current,  { opacity: 0, y: 12, duration: 0.4 }, "-=0.25")
    if (rightSlot) tl.from(rightRef.current, { opacity: 0, x: 30, duration: 0.6 }, "-=0.7")

    scope.add(tl)

    if (parallaxRef.current) {
      const t = gsap.to(parallaxRef.current, {
        yPercent: -25,
        ease: "none",
        scrollTrigger: { trigger: section, start: "top top", end: "bottom top", scrub: 1.5 },
      })
      scope.add(t)
      if (t.scrollTrigger) scope.add(t.scrollTrigger)
    }

    if (contentRef.current) {
      const t = gsap.to(contentRef.current, {
        opacity: 0,
        yPercent: -15,
        ease: "none",
        scrollTrigger: { trigger: section, start: "40% top", end: "85% top", scrub: 1 },
      })
      scope.add(t)
      if (t.scrollTrigger) scope.add(t.scrollTrigger)
    }

    return () => scope.kill()
  }, [reduced, rightSlot])

  const labelText = label ?? `${business.serviceAreas[0]} · ${business.license ?? "Licensed & Insured"}`
  const badgeText = badge ?? (business.emergency ? "24/7 Emergency Service" : "Available Now")
  const paragraphText = paragraph ?? `Trusted by ${business.review_count}+ customers in ${business.serviceAreas[0]}.`

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative min-h-screen flex items-center overflow-hidden"
      style={{
        background: `linear-gradient(160deg, var(--brand-bg) 0%, var(--brand-bg-mid) 60%, var(--brand-bg) 100%)`,
      }}
    >
      {/* Parallax wrapper — extra padding prevents edge flicker during yPercent shift */}
      <div
        ref={parallaxRef}
        className="absolute pointer-events-none"
        aria-hidden
        style={{ inset: "-15% 0", overflow: "hidden" }}
      >
        {videoSrc && (
          <video
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay muted loop playsInline
            poster={posterSrc}
            style={{ filter: "brightness(0.4)", willChange: "transform" }}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        )}
        {!videoSrc && posterSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-cover ken-burns"
            style={{ filter: `brightness(${posterBrightness}) saturate(1.1)`, willChange: "transform" }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to right, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.35) 100%)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(0,0,0,0.5) 100%)" }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-28 pb-14 w-full">
        <div className={`grid gap-12 items-center ${rightSlot ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 max-w-3xl"}`}>
          <div ref={contentRef}>
            <div ref={labelRef} className="mb-3">
              <span className="section-label" style={{ marginBottom: 0 }}>{labelText}</span>
            </div>

            <div ref={badgeRef} className="accent-badge mb-5 w-fit">
              <span className="accent-dot" />
              {badgeText}
            </div>

            <h1
              ref={h1Ref}
              className="font-display text-white mb-6"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2.5rem, 8vw, 7rem)",
                letterSpacing: "-0.035em",
                lineHeight: 0.95,
                fontWeight: 900,
              }}
            >
              {business.name}
              <br />
              <SplitText className="text-gradient-animate" style={{ fontSize: "0.85em" }}>
                {business.tagline}
              </SplitText>
            </h1>

            <p
              ref={paraRef}
              className="font-body text-white/65 leading-relaxed mb-9"
              style={{ fontSize: "clamp(1rem, 1.5vw, 1.25rem)", maxWidth: "34rem" }}
            >
              {paragraphText}
            </p>

            <div ref={ctaRef} className="flex flex-col sm:flex-row gap-3 mb-4">
              {ctaSlot ?? (
                <>
                  <a href={business.phoneHref} className="btn-primary">
                    <Phone className="w-4 h-4 shrink-0" />
                    {business.phone}
                  </a>
                  <a href="#contact" className="btn-ghost">
                    Free Estimate
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </>
              )}
            </div>

            {/* Urgency signal */}
            <div className="flex items-center gap-2 mb-6">
              <span
                style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#22c55e",
                  display: "inline-block",
                  flexShrink: 0,
                  animation: "pulse-dot 2s ease-in-out infinite",
                }}
              />
              <span className="font-body text-white/60 text-xs">
                Accepting new clients in {business.city} — availability limited this week
              </span>
            </div>

            <div ref={trustRef} className="flex flex-wrap gap-4 mb-10">
              {trustSlot ?? (
                <>
                  <div className="flex items-center gap-1.5 text-white/55 text-xs font-body">
                    <Star className="w-3.5 h-3.5 fill-current" style={{ color: "var(--brand-accent)" }} />
                    <span className="text-white font-bold">{business.google_rating}</span> rated
                    <span className="text-white/30 ml-1">({business.review_count} reviews)</span>
                  </div>
                  {business.license && (
                    <div className="flex items-center gap-1.5 text-white/55 text-xs font-body">
                      <ShieldCheck className="w-3.5 h-3.5" style={{ color: "var(--brand-accent-light)" }} />
                      {business.license}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-white/55 text-xs font-body">
                    <Clock className="w-3.5 h-3.5" style={{ color: "var(--brand-accent-light)" }} />
                    Since {business.since}
                  </div>
                </>
              )}
            </div>

            {trustBadges.length > 0 && (
              <div ref={badgesRef} className="flex flex-wrap gap-2">
                {trustBadges.map((badge) => (
                  <span
                    key={badge}
                    className="text-white/45 text-[0.65rem] font-body font-semibold border border-white/10 px-3 py-1.5 rounded-full hover:border-white/25 hover:text-white/70 transition-all duration-200"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            )}
          </div>

          {rightSlot && (
            <div ref={rightRef} className="hidden md:flex items-center justify-center">
              {rightSlot}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
