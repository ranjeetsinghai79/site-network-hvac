"use client"

import { useEffect, useRef } from "react"
import { gsap } from "@core/web"
import type { SiteConfig } from "@core/web/types"
import HeroThermostat from "./hero-thermostat"

interface Props { config: SiteConfig }

export default function HvacHero({ config }: Props) {
  const { business } = config

  const TRUST = [
    { icon: "★", label: `${business.google_rating} Google` },
    { icon: "✓", label: `${business.review_count} Reviews` },
    { icon: "⚡", label: "24/7 Emergency" },
    { icon: "◎", label: "Upfront Pricing" },
  ]
  const sectionRef  = useRef<HTMLElement>(null)
  const labelRef    = useRef<HTMLDivElement>(null)
  const h1Ref       = useRef<HTMLHeadingElement>(null)
  const taglineRef  = useRef<HTMLDivElement>(null)
  const paraRef     = useRef<HTMLParagraphElement>(null)
  const ctaRef      = useRef<HTMLDivElement>(null)
  const trustRef    = useRef<HTMLDivElement>(null)
  const thermoRef   = useRef<HTMLDivElement>(null)
  const scrollRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const words = h1Ref.current?.querySelectorAll<HTMLElement>(".split-word")

    const tl = gsap.timeline({ defaults: { ease: "expo.out" } })
    tl.from(labelRef.current,   { opacity: 0, x: -28, duration: 0.5 })
      .from(words ?? [],         { yPercent: 120, opacity: 0, stagger: 0.042, duration: 0.72 }, "-=0.28")
      .from(taglineRef.current, { opacity: 0, y: 16, duration: 0.5 }, "-=0.4")
      .from(paraRef.current,    { opacity: 0, y: 14, duration: 0.5 }, "-=0.38")
      .from(ctaRef.current,     { opacity: 0, y: 12, duration: 0.5 }, "-=0.38")
      .from(trustRef.current,   { opacity: 0, y: 8,  duration: 0.45 }, "-=0.32")
      .from(thermoRef.current,  { opacity: 0, x: 48, duration: 0.8, ease: "power3.out" }, "-=0.9")
      .from(scrollRef.current,  { opacity: 0, duration: 0.4 }, "-=0.1")

    // Scroll progress bar
    const bar = document.querySelector<HTMLElement>(".scroll-progress-bar")
    const onScroll = () => {
      const pct = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      if (bar) bar.style.setProperty("--scroll-pct", String(pct))
    }
    window.addEventListener("scroll", onScroll, { passive: true })

    // Parallax blobs
    const blob1 = sectionRef.current?.querySelector<HTMLElement>(".blob-1")
    const blob2 = sectionRef.current?.querySelector<HTMLElement>(".blob-2")
    const onMouseMove = (e: MouseEvent) => {
      const { clientX: x, clientY: y } = e
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2
      if (blob1) gsap.to(blob1, { x: (x - cx) * 0.025, y: (y - cy) * 0.025, duration: 1.2, ease: "power1.out" })
      if (blob2) gsap.to(blob2, { x: (x - cx) * -0.015, y: (y - cy) * -0.015, duration: 1.4, ease: "power1.out" })
    }
    window.addEventListener("mousemove", onMouseMove)

    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("mousemove", onMouseMove)
      tl.kill()
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: "var(--brand-bg)" }}
    >
      {/* Scroll progress bar */}
      <div className="scroll-progress-bar" />

      {/* Cinematic background image — full bleed, dark overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src="/hero-1.jpg"
          alt=""
          aria-hidden
          className="w-full h-full object-cover object-center"
          style={{ opacity: 0.45, filter: "saturate(0.75)" }}
        />
        {/* Multi-layer dark gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, rgba(5,10,15,0.93) 0%, rgba(5,10,15,0.6) 45%, rgba(5,10,15,0.88) 100%)",
          }}
        />
        {/* Bottom fade to next section */}
        <div
          className="absolute bottom-0 left-0 right-0 h-48"
          style={{ background: "linear-gradient(180deg, transparent, var(--brand-bg))" }}
        />
      </div>

      {/* Vent grid pattern on top of image */}
      <div className="absolute inset-0 z-0 hvac-grid-bg" style={{ opacity: 0.3 }} />

      {/* Aurora blobs */}
      <div
        className="aurora-blob blob-1"
        style={{
          width: 700, height: 700,
          top: "-20%", left: "-15%",
          background: "var(--brand-blob-1)",
          zIndex: 1,
        }}
      />
      <div
        className="aurora-blob aurora-blob-2 blob-2"
        style={{
          width: 500, height: 500,
          top: "10%", right: "-10%",
          background: "var(--brand-blob-2)",
          zIndex: 1,
        }}
      />

      {/* Nav area spacer */}
      <div className="h-20 relative z-10" />

      {/* Main hero grid */}
      <div className="relative z-10 flex-1 flex items-center">
        <div className="w-full max-w-[1400px] mx-auto px-6 lg:px-12 xl:px-16">
          <div className="grid lg:grid-cols-[1fr_auto] gap-12 xl:gap-20 items-center">

            {/* ── Left: copy ── */}
            <div className="max-w-2xl">
              {/* Label pill */}
              <div ref={labelRef} className="mb-6">
                <span
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-body font-600"
                  style={{
                    background: "rgba(249,115,22,0.1)",
                    border: "1px solid rgba(249,115,22,0.25)",
                    color: "#F97316",
                    letterSpacing: "0.12em",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "#F97316", boxShadow: "0 0 6px #F97316" }}
                  />
                  LIVE · {business.city} HVAC DISPATCH
                </span>
              </div>

              {/* H1 */}
              <h1
                ref={h1Ref}
                className="font-display font-700 uppercase"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(3.2rem, 8vw, 7.5rem)",
                  lineHeight: 0.88,
                  letterSpacing: "-0.02em",
                  color: "var(--brand-fg)",
                }}
              >
                {["Straight", "Answers.", "Fast", "Fixes."].map((word, i) => (
                  <span key={i} className="split-word-outer block">
                    <span
                      className="split-word block"
                      style={
                        i === 1
                          ? { color: "var(--brand-accent)", WebkitTextStroke: "1px rgba(249,115,22,0.3)" }
                          : i === 3
                          ? { color: "var(--brand-accent)" }
                          : {}
                      }
                    >
                      {word}
                    </span>
                  </span>
                ))}
              </h1>

              {/* Tagline strip */}
              <div ref={taglineRef} className="mt-6 flex items-center gap-4">
                <div
                  className="h-px flex-1 max-w-[60px]"
                  style={{ background: "var(--brand-accent)" }}
                />
                <p
                  className="font-display font-600 uppercase tracking-widest"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "0.75rem",
                    color: "var(--brand-fg-muted)",
                    letterSpacing: "0.25em",
                  }}
                >
                  {business.tagline}{business.since ? ` · Est. ${business.since}` : ""}
                </p>
              </div>

              {/* Paragraph */}
              <p
                ref={paraRef}
                className="mt-6 leading-relaxed"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "clamp(1rem, 1.8vw, 1.15rem)",
                  color: "var(--brand-fg-muted)",
                  maxWidth: "52ch",
                }}
              >
                {business.review_count} real Google reviews, {business.google_rating}★ average. Fast diagnosis,
                fair pricing quoted before we touch anything, and a phone that gets answered — {business.hours?.toLowerCase() ?? "24/7"}.
              </p>

              {/* CTAs — full width stack on mobile, inline on sm+ */}
              <div ref={ctaRef} className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
                <a
                  href={business.phoneHref}
                  className="btn-primary inline-flex items-center justify-center gap-3 px-8 py-4"
                  style={{ fontSize: "1.05rem", minHeight: 56 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.003 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.85 6.85l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                  </svg>
                  Call {business.phone}
                </a>
                <a
                  href="#contact"
                  className="btn-ghost inline-flex items-center justify-center gap-3 px-8 py-4"
                  style={{ fontSize: "1.05rem", minHeight: 56 }}
                >
                  Request Service
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </a>
              </div>

              {/* Trust badges */}
              <div ref={trustRef} className="mt-8 flex flex-wrap gap-3">
                {TRUST.map(({ icon, label }) => (
                  <div
                    key={label}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(248,250,252,0.7)",
                      fontFamily: "var(--font-body)",
                      fontWeight: 500,
                    }}
                  >
                    <span style={{ color: "var(--brand-accent)", fontSize: "0.85rem" }}>{icon}</span>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Right: Thermostat widget ── */}
            <div
              ref={thermoRef}
              className="hidden lg:flex items-center justify-center"
              style={{ minWidth: 440 }}
            >
              <div className="relative">
                {/* Glow ring behind thermostat */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "radial-gradient(ellipse at center, rgba(249,115,22,0.12) 0%, rgba(56,189,248,0.06) 50%, transparent 70%)",
                    filter: "blur(40px)",
                    transform: "scale(1.3)",
                  }}
                />
                <HeroThermostat />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom scroll indicator */}
      <div ref={scrollRef} className="relative z-10 pb-8 flex justify-center">
        <div className="flex flex-col items-center gap-2">
          <span
            className="text-[10px] uppercase tracking-[0.2em]"
            style={{ color: "var(--brand-fg-subtle)", fontFamily: "var(--font-display)" }}
          >
            Scroll
          </span>
          <div
            className="w-px h-10 relative overflow-hidden rounded-full"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <div
              className="absolute w-full"
              style={{
                background: "linear-gradient(180deg, var(--brand-accent), transparent)",
                height: "60%",
                animation: "scroll-drop 2s ease-in-out infinite",
              }}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scroll-drop {
          0%   { top: -60%; }
          100% { top: 160%; }
        }
      `}</style>
    </section>
  )
}
