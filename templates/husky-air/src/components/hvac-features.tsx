"use client"

import React, { useEffect, useRef } from "react"
import { gsap } from "@core/web"
import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

const REASON_ICONS: Record<string, React.ReactElement> = {
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  "dollar-sign": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  ),
  award: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
    </svg>
  ),
  "thumbs-up": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.003 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.85 6.85l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  smile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
    </svg>
  ),
  "trending-up": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
}

export default function HvacFeatures({ config }: Props) {
  const reasons = config.reasons ?? []
  const sectionRef = useRef<HTMLElement>(null)
  const headRef    = useRef<HTMLDivElement>(null)
  const gridRef    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!headRef.current || !gridRef.current) return

    gsap.from(headRef.current, {
      opacity: 0, y: 30, duration: 0.7, ease: "power3.out",
      immediateRender: false,
      scrollTrigger: { trigger: headRef.current, start: "top 85%", once: true },
    })

    const cards = gridRef.current.querySelectorAll<HTMLElement>(".feature-card")

    gsap.from(cards, {
      opacity: 0, y: 44, scale: 0.95,
      stagger: 0.08, duration: 0.7, ease: "power3.out",
      immediateRender: false,
      scrollTrigger: { trigger: gridRef.current, start: "top 80%", once: true },
    })

    // 3D tilt on each card
    cards.forEach(card => {
      const setRotX = gsap.quickTo(card, "rotationX", { duration: 0.4, ease: "power2.out" })
      const setRotY = gsap.quickTo(card, "rotationY", { duration: 0.4, ease: "power2.out" })
      gsap.set(card, { transformPerspective: 900, transformStyle: "preserve-3d" })

      let shadowX = 0, shadowY = 0

      const onMove = (e: MouseEvent) => {
        const r  = card.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top  + r.height / 2
        const dx = (e.clientX - cx) / (r.width / 2)
        const dy = (e.clientY - cy) / (r.height / 2)
        setRotX(-dy * 8)
        setRotY( dx * 8)
        shadowX = dx * 12
        shadowY = dy * 12
        card.style.boxShadow = `${-shadowX}px ${-shadowY}px 36px rgba(249,115,22,0.12), 0 0 48px -12px rgba(0,0,0,0.5)`
      }
      const onLeave = () => {
        setRotX(0); setRotY(0)
        card.style.boxShadow = ""
      }
      card.addEventListener("mousemove", onMove)
      card.addEventListener("mouseleave", onLeave)
    })
  }, [])

  return (
    <section
      ref={sectionRef}
      id="why-us"
      className="relative py-24 lg:py-32"
      style={{ background: "var(--brand-bg)" }}
    >
      <div
        className="absolute inset-0 hvac-grid-bg"
        style={{ opacity: 0.4 }}
      />

      {/* Ambient glow */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
        style={{
          width: 800, height: 600,
          background: "radial-gradient(ellipse, rgba(249,115,22,0.04) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      <div className="relative max-w-[1400px] mx-auto px-6 lg:px-12 xl:px-16">
        {/* Heading */}
        <div ref={headRef} className="mb-16 max-w-xl">
          <p className="section-label mb-3">Why {config.business.name}</p>
          <h2
            className="font-display font-700 uppercase"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 5vw, 4rem)",
              lineHeight: 0.95,
              color: "var(--brand-fg)",
              letterSpacing: "-0.02em",
            }}
          >
            Built Different.
            <br />
            <span style={{ color: "var(--brand-accent)" }}>Trusted More.</span>
          </h2>
        </div>

        {/* 3D tilt grid */}
        <div
          ref={gridRef}
          className="grid gap-5"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
        >
          {reasons.map((reason, i) => {
            const IconEl = REASON_ICONS[reason.icon] ?? REASON_ICONS.award

            return (
              <div
                key={i}
                className="feature-card tilt-card card-dark cursor-default"
                style={{ padding: "2rem" }}
              >
                {/* Number */}
                <div
                  className="mb-5 font-display font-700 tabular-nums"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "0.65rem",
                    letterSpacing: "0.25em",
                    color: "var(--brand-accent)",
                  }}
                >
                  0{i + 1}
                </div>

                {/* Icon */}
                <div
                  className="mb-4"
                  style={{
                    width: 36, height: 36,
                    color: "var(--brand-accent)",
                    filter: "drop-shadow(0 0 8px rgba(249,115,22,0.5))",
                  }}
                >
                  {IconEl}
                </div>

                {/* Title */}
                <h3
                  className="font-display font-700 uppercase mb-3"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.1rem",
                    lineHeight: 1.15,
                    color: "var(--brand-fg)",
                    letterSpacing: "-0.005em",
                  }}
                >
                  {reason.title}
                </h3>

                {/* Desc */}
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.875rem",
                    lineHeight: 1.7,
                    color: "var(--brand-fg-muted)",
                  }}
                >
                  {reason.desc}
                </p>

                {/* Bottom gradient rule */}
                <div
                  className="mt-5 h-px"
                  style={{
                    background: "linear-gradient(90deg, rgba(249,115,22,0.4), transparent)",
                  }}
                />
              </div>
            )
          })}
        </div>

        {/* Trust badge strip */}
        <div className="mt-14 flex flex-wrap justify-center gap-3">
          {(config.trustBadges ?? []).map(badge => (
            <span
              key={badge}
              className="px-5 py-2 rounded-full text-xs font-body font-600 uppercase tracking-wider"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(248,250,252,0.6)",
                letterSpacing: "0.1em",
              }}
            >
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
