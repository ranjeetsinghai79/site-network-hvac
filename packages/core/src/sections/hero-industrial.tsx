"use client"

import { useEffect, useRef } from "react"
import { Phone, ArrowRight, ShieldCheck, Star, Zap, BadgeCheck } from "lucide-react"
import type { SiteConfig } from "../types"
import { gsap } from "../lib/gsap-init"
import { createScope } from "../lib/kill-scope"
import { useReducedMotion } from "../hooks/use-reduced-motion"
import { useCounter } from "../hooks/use-counter"
import { SplitText } from "../effects/split-text"

interface Props {
  config: SiteConfig
  imageSrc?: string
  image2Src?: string
  image3Src?: string
  label?: string
  paragraph?: string
  badge?: string
}

// UI/UX Pro Max: metric pulse animation on counter complete (stat reveal)
function StatCounter({
  value, label, suffix = "", decimals = 0,
}: {
  value: number; label: string; suffix?: string; decimals?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  useCounter(ref, {
    to: value, decimals, suffix,
    onComplete: () => {
      if (wrapRef.current) {
        gsap.fromTo(wrapRef.current, { scale: 1 }, { scale: 1.06, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out" })
      }
    },
  })
  return (
    <div ref={wrapRef} className="text-center px-6 py-4">
      <div
        className="font-display tabular-nums"
        style={{ fontWeight: 900, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", color: "var(--brand-accent)" }}
      >
        <span ref={ref}>0{suffix}</span>
      </div>
      <div className="font-body text-sm mt-0.5 whitespace-nowrap" style={{ color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
        {label}
      </div>
    </div>
  )
}

export function HeroIndustrial({
  config,
  imageSrc = "/hero-1.jpg",
  image2Src = "/hero-2.jpg",
  image3Src = "/hero-3.jpg",
  label,
  paragraph,
  badge,
}: Props) {
  const business   = config.business
  const stats      = config.stats ?? []
  const trustBadges = config.trustBadges ?? []

  const sectionRef  = useRef<HTMLElement>(null)
  const labelRef    = useRef<HTMLDivElement>(null)
  const h1Ref       = useRef<HTMLHeadingElement>(null)
  const taglineRef  = useRef<HTMLDivElement>(null)
  const paraRef     = useRef<HTMLParagraphElement>(null)
  const ctaRef      = useRef<HTMLDivElement>(null)
  const trustRef    = useRef<HTMLDivElement>(null)
  const photoColRef = useRef<HTMLDivElement>(null)
  const statsRef    = useRef<HTMLDivElement>(null)
  const certRef     = useRef<HTMLDivElement>(null)
  const ratingRef   = useRef<HTMLDivElement>(null)

  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) {
      const els = [labelRef, h1Ref, taglineRef, paraRef, ctaRef, trustRef, photoColRef, statsRef, certRef, ratingRef]
        .map(r => r.current).filter(Boolean)
      gsap.set(els, { opacity: 1, x: 0, y: 0 })
      return
    }

    const scope = createScope()
    const words = h1Ref.current?.querySelectorAll<HTMLElement>(".split-word")

    const tl = gsap.timeline({ defaults: { ease: "expo.out" } })

    // Left: staggered cascade (UI/UX Pro Max: high-impact entrance with stagger)
    tl.from(labelRef.current,   { opacity: 0, x: -28, duration: 0.5 })
      .from(words ?? [],         { yPercent: 120, opacity: 0, stagger: 0.038, duration: 0.75 }, "-=0.3")
      .from(taglineRef.current, { opacity: 0, x: -20, duration: 0.5 }, "-=0.5")
      .from(paraRef.current,    { opacity: 0, y: 18, duration: 0.55 }, "-=0.42")
      .from(ctaRef.current,     { opacity: 0, y: 14, duration: 0.5 }, "-=0.4")
      .from(trustRef.current,   { opacity: 0, y: 10, duration: 0.45 }, "-=0.35")

    // Right: reveal column (clipPath wipe left→right, industrial feel)
    tl.from(photoColRef.current, {
      clipPath: "inset(0 100% 0 0)",
      opacity: 0,
      duration: 1.05,
      ease: "expo.inOut",
    }, 0.1)

    // Floating elements pop in after column
    tl.from(certRef.current,   { opacity: 0, scale: 0.7, rotation: -20, duration: 0.6, ease: "back.out(2)" }, "-=0.35")
    tl.from(ratingRef.current, { opacity: 0, y: 20, duration: 0.5, ease: "expo.out" }, "-=0.45")

    // Stats strip
    tl.from(statsRef.current, { opacity: 0, y: 28, duration: 0.65, ease: "expo.out" }, "-=0.5")

    scope.add(tl)
    return () => scope.kill()
  }, [reduced])

  const heroLabel = label ?? (business.niche ? business.niche.toUpperCase().replace(/-/g, " ") + " SERVICES" : "HOME SERVICES")
  const heroBadge = badge ?? (business.emergency ? "24/7 Emergency — We answer every call" : `Serving ${business.city} & Surrounding Areas`)
  const heroPara  = paragraph ?? `${business.name} — licensed, insured, and rated ${business.google_rating}★ by ${business.review_count}+ customers. Flat-rate pricing, same-day availability.`

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative overflow-hidden"
      style={{
        background: "var(--brand-bg)",
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Subtle grid texture (frontend-design: add depth, not flat) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(var(--brand-grid) 1px, transparent 1px), linear-gradient(90deg, var(--brand-grid) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          opacity: 0.6,
          zIndex: 0,
        }}
        aria-hidden
      />

      {/* Right-side accent wash */}
      <div
        className="absolute top-0 right-0 pointer-events-none hidden lg:block"
        style={{
          width: "48%",
          height: "100%",
          background: "linear-gradient(135deg, transparent 25%, color-mix(in srgb, var(--brand-accent) 4%, transparent) 60%, color-mix(in srgb, var(--brand-accent) 7%, transparent))",
          zIndex: 0,
        }}
        aria-hidden
      />

      {/* Diagonal accent bar (industrial signature element) */}
      <div
        className="absolute pointer-events-none hidden lg:block"
        style={{
          top: 0, bottom: 0,
          left: "52%",
          width: "4px",
          background: "linear-gradient(180deg, transparent 5%, var(--brand-accent) 25%, var(--brand-accent) 75%, transparent 95%)",
          transform: "skewX(-6deg)",
          opacity: 0.22,
          zIndex: 1,
        }}
        aria-hidden
      />

      {/* ── Main grid ── */}
      <div
        className="relative flex-1 grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] items-center max-w-7xl mx-auto w-full px-6 lg:px-12 pt-28 pb-10 gap-10 lg:gap-8"
        style={{ zIndex: 2 }}
      >
        {/* LEFT: content */}
        <div className="flex flex-col gap-5 max-w-[560px]">

          {/* Niche label — UI/UX Pro Max: prominent trust signal at top */}
          <div ref={labelRef}>
            <span
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-body text-xs uppercase tracking-[0.12em] cursor-default"
              style={{
                background: "color-mix(in srgb, var(--brand-accent) 10%, transparent)",
                color: "var(--brand-accent)",
                border: "1px solid color-mix(in srgb, var(--brand-accent) 30%, transparent)",
                fontWeight: 700,
              }}
            >
              <Zap className="w-3 h-3 fill-current" />
              {heroLabel}
            </span>
          </div>

          {/* Headline */}
          <h1
            ref={h1Ref}
            className="font-display leading-[1.04] overflow-hidden"
            style={{
              fontWeight: 900,
              fontSize: "clamp(2.75rem, 5.8vw, 4.5rem)",
              letterSpacing: "-0.035em",
              color: "var(--brand-fg)",
            }}
          >
            <SplitText>{business.name}</SplitText>
          </h1>

          {/* Tagline with orange accent bar */}
          <div ref={taglineRef} className="flex items-center gap-3">
            <div
              style={{
                width: "36px", height: "4px",
                background: "var(--brand-accent)",
                borderRadius: "2px",
                flexShrink: 0,
              }}
            />
            <span
              className="font-display"
              style={{
                color: "var(--brand-accent)",
                fontWeight: 700,
                fontSize: "clamp(1rem, 1.8vw, 1.25rem)",
                letterSpacing: "-0.01em",
              }}
            >
              {business.tagline}
            </span>
          </div>

          {/* Paragraph (frontend-design: body copy that converts) */}
          <p
            ref={paraRef}
            className="font-body leading-relaxed"
            style={{
              color: "var(--brand-fg-muted)",
              fontSize: "1.0625rem",
              maxWidth: "38ch",
              lineHeight: 1.7,
            }}
          >
            {heroPara}
          </p>

          {/* CTAs — UI/UX Pro Max: phone = primary, unmissable orange, cursor-pointer */}
          <div ref={ctaRef} className="flex flex-wrap gap-3 items-center">
            <a
              href={business.phoneHref}
              className="btn-primary cursor-pointer"
              style={{
                fontSize: "1.0625rem",
                paddingInline: "2rem",
                paddingBlock: "0.9375rem",
                fontWeight: 800,
              }}
              aria-label={`Call ${business.phone}`}
            >
              <Phone className="w-5 h-5" />
              {business.phone}
            </a>
            <a
              href="#contact"
              className="inline-flex items-center gap-2 font-body cursor-pointer"
              style={{
                color: "var(--brand-fg)",
                fontWeight: 700,
                fontSize: "0.9375rem",
                transition: "color 0.2s, gap 0.2s",
                textDecoration: "none",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = "var(--brand-accent)"
                e.currentTarget.style.gap = "0.625rem"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = "var(--brand-fg)"
                e.currentTarget.style.gap = "0.5rem"
              }}
            >
              Free Estimate <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Trust badges — UI/UX Pro Max: badges with hover glow (not infinite animation) */}
          <div ref={trustRef} className="flex flex-wrap gap-2">
            {trustBadges.slice(0, 5).map(b => (
              <span
                key={b}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-body text-xs cursor-default"
                style={{
                  background: "var(--brand-bg-section)",
                  border: "1px solid var(--brand-card-border)",
                  color: "var(--brand-fg-muted)",
                  fontWeight: 600,
                  transition: "border-color 0.2s, box-shadow 0.2s, color 0.2s",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget
                  el.style.borderColor = "color-mix(in srgb, var(--brand-accent) 45%, transparent)"
                  el.style.boxShadow = "0 0 12px -2px color-mix(in srgb, var(--brand-accent) 20%, transparent)"
                  el.style.color = "var(--brand-fg)"
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget
                  el.style.borderColor = "var(--brand-card-border)"
                  el.style.boxShadow = "none"
                  el.style.color = "var(--brand-fg-muted)"
                }}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--brand-accent)" }} />
                {b}
              </span>
            ))}
          </div>

          {/* License badge — UI/UX Pro Max: Trust & Authority, no hidden credentials */}
          {business.license && (
            <div
              className="inline-flex items-center gap-3 px-4 py-2.5 rounded-xl w-fit cursor-default"
              style={{
                background: "color-mix(in srgb, var(--brand-accent) 7%, transparent)",
                border: "1px solid color-mix(in srgb, var(--brand-accent) 22%, transparent)",
              }}
            >
              <BadgeCheck className="w-5 h-5 shrink-0" style={{ color: "var(--brand-accent)" }} />
              <div>
                <div className="font-display text-sm" style={{ fontWeight: 800, color: "var(--brand-fg)" }}>
                  {business.license}
                </div>
                <div className="font-body text-[11px]" style={{ color: "var(--brand-fg-muted)" }}>
                  Licensed · Bonded · Insured
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: photo stack */}
        <div
          ref={photoColRef}
          className="relative hidden lg:block"
          style={{
            height: "530px",
            clipPath: "inset(0 0 0 0)",  // GSAP animates this on entrance
          }}
        >
          {/* Main hero image — frontend-design: polygon clip for industrial feel */}
          {/* Next.js stack: loading=eager = priority for LCP */}
          <div
            className="absolute rounded-2xl overflow-hidden"
            style={{
              top: "4%", left: "4%", right: "14%", bottom: "8%",
              clipPath: "polygon(0 0, 100% 0, 96% 100%, 0% 100%)",
              boxShadow: "0 28px 72px -12px color-mix(in srgb, var(--brand-accent) 20%, rgba(0,0,0,0.35))",
            }}
          >
            <img
              src={imageSrc}
              alt={`${business.name} — HVAC technician`}
              className="w-full h-full object-cover"
              loading="eager"
              style={{ transform: "scale(1.04)", transition: "transform 6s ease" }}
            />
            {/* Orange gradient overlay at bottom */}
            <div
              className="absolute inset-x-0 bottom-0 pointer-events-none"
              style={{
                height: "40%",
                background: "linear-gradient(transparent, color-mix(in srgb, var(--brand-accent) 18%, rgba(0,0,0,0.4)))",
              }}
            />
          </div>

          {/* Secondary photo — top-right float */}
          <div
            className="absolute rounded-xl overflow-hidden"
            style={{
              top: "0%", right: "0%",
              width: "42%", aspectRatio: "4/3",
              boxShadow: "0 16px 44px -8px rgba(0,0,0,0.22)",
              border: "3px solid var(--brand-bg)",
            }}
          >
            <img
              src={image2Src}
              alt={`${business.name} — equipment`}
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>

          {/* Cert/authority stamp — UI/UX Pro Max: Trust & Authority, rotated industrial stamp */}
          <div
            ref={certRef}
            className="absolute flex items-center gap-2.5 px-4 py-2.5 rounded-xl cursor-default"
            style={{
              bottom: "5%", right: "6%",
              background: "var(--brand-fg)",
              color: "#fff",
              transform: "rotate(-3deg)",
              boxShadow: "0 8px 28px -4px rgba(0,0,0,0.32)",
              zIndex: 10,
            }}
          >
            <ShieldCheck className="w-5 h-5 shrink-0" style={{ color: "var(--brand-accent)" }} />
            <div>
              <div className="font-display text-sm leading-tight" style={{ fontWeight: 800 }}>
                {business.since ? `Est. ${business.since}` : "Certified"}
              </div>
              <div className="font-body text-[10px] leading-tight" style={{ color: "rgba(255,255,255,0.6)" }}>
                Trusted Local Pros
              </div>
            </div>
          </div>

          {/* Rating badge — Google rating, prominent */}
          <div
            ref={ratingRef}
            className="absolute flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-default"
            style={{
              bottom: "22%", left: "0%",
              background: "var(--brand-bg)",
              boxShadow: "var(--shadow-card)",
              border: "1px solid var(--brand-card-border)",
              zIndex: 10,
            }}
          >
            <Star className="w-5 h-5 fill-current" style={{ color: "#F59E0B" }} />
            <div>
              <div className="font-display text-base" style={{ fontWeight: 900, color: "var(--brand-fg)" }}>
                {business.google_rating}
              </div>
              <div className="font-body text-[10px]" style={{ color: "var(--brand-fg-muted)" }}>
                {business.review_count}+ verified reviews
              </div>
            </div>
          </div>

          {/* Third image — small circle */}
          <div
            className="absolute rounded-full overflow-hidden"
            style={{
              top: "38%", right: "1%",
              width: "90px", height: "90px",
              border: "3px solid var(--brand-bg)",
              boxShadow: "0 6px 20px -4px rgba(0,0,0,0.2)",
              zIndex: 5,
            }}
          >
            <img
              src={image3Src}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              aria-hidden
            />
          </div>
        </div>
      </div>

      {/* ── Stats strip — dark bg for contrast + animated counters ── */}
      {stats.length > 0 && (
        <div
          ref={statsRef}
          className="relative w-full"
          style={{ background: "var(--brand-fg)", zIndex: 2 }}
        >
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-center flex-wrap gap-0">
            {stats.map((s, i) => {
              const num = typeof s.value === "number" ? s.value : parseFloat(String(s.value).replace(/[^\d.]/g, ""))
              return (
                <div key={s.label} className="flex items-center">
                  <StatCounter
                    value={isFinite(num) ? num : 0}
                    label={s.label}
                    suffix={s.suffix ?? ""}
                    decimals={s.decimals ?? 0}
                  />
                  {i < stats.length - 1 && (
                    <div
                      style={{
                        width: "1px", height: "48px", flexShrink: 0,
                        background: "rgba(255,255,255,0.12)",
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
