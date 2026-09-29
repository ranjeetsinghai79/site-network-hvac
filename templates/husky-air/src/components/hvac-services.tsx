"use client"

import React, { useEffect, useRef } from "react"
import { gsap } from "@core/web"
import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

const SERVICE_ICONS: Record<string, React.ReactElement> = {
  thermometer: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z"/>
    </svg>
  ),
  flame: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 3z"/>
    </svg>
  ),
  droplets: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05zM12.56 6.6A5.28 5.28 0 0014 3s1.06.45 2.2 1.41a8.62 8.62 0 012.76 3.84c.5 1.48.5 2.9 0 4.38-.5 1.52-1.46 2.71-2.76 3.58A5.41 5.41 0 0112.56 17"/>
    </svg>
  ),
  zap: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  "shield-check": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  ),
  wrench: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
}

/* All cards equal — no bento-large, clean 3×2 grid */

export default function HvacServices({ config }: Props) {
  const services = config.services ?? []
  const sectionRef = useRef<HTMLElement>(null)
  const headRef    = useRef<HTMLDivElement>(null)
  const gridRef    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!headRef.current || !gridRef.current) return

    const cards = gridRef.current.querySelectorAll<HTMLElement>(".service-card")

    gsap.from(headRef.current, {
      opacity: 0, y: 32, duration: 0.7, ease: "power3.out",
      immediateRender: false,
      scrollTrigger: { trigger: headRef.current, start: "top 85%", once: true },
    })

    gsap.from(cards, {
      opacity: 0, y: 48, scale: 0.96,
      stagger: 0.07, duration: 0.65, ease: "power3.out",
      immediateRender: false,
      scrollTrigger: { trigger: gridRef.current, start: "top 80%", once: true },
    })
  }, [])

  return (
    <section
      ref={sectionRef}
      id="services"
      className="relative py-24 lg:py-32 hvac-grid-bg"
      style={{ background: "var(--brand-bg-2)" }}
    >
      {/* Section accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.3), transparent)" }}
      />

      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 xl:px-16">
        {/* Heading */}
        <div ref={headRef} className="mb-14">
          <p className="section-label mb-3">Our Services</p>
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
            Everything HVAC.
            <br />
            <span style={{ color: "var(--brand-accent)" }}>One Call.</span>
          </h2>
        </div>

        {/* Bento grid */}
        <div ref={gridRef} className="bento-grid">
          {services.map((service, i) => {
            const IconEl = SERVICE_ICONS[service.icon] ?? SERVICE_ICONS.wrench
            const imgSrc = service.image ?? `/service-${(i % 6) + 1}.jpg`

            return (
              <div
                key={i}
                className="service-card cursor-pointer hover-lift"
                style={{
                  padding: "2rem",
                  position: "relative",
                  overflow: "hidden",
                  background: "var(--brand-bg-card)",
                  border: "1px solid var(--brand-border)",
                  borderRadius: 12,
                  transition: "border-color 0.3s ease",
                  minHeight: 240,
                }}
              >
                {/* Background service image — real cinematic photo, moody grade */}
                <div
                  className="absolute inset-0 z-0"
                  style={{ borderRadius: 12, overflow: "hidden" }}
                >
                  <img
                    src={imgSrc}
                    alt=""
                    aria-hidden
                    className="w-full h-full object-cover object-center"
                    style={{ opacity: 0.55, filter: "saturate(0.65) brightness(0.85)", transition: "opacity 0.4s ease, transform 0.5s ease" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLImageElement).style.transform = "scale(1.06)" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLImageElement).style.transform = "scale(1)" }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(180deg, rgba(14,28,42,0.55) 0%, rgba(14,28,42,0.88) 75%, rgba(14,28,42,0.96) 100%)" }}
                  />
                </div>

                {/* Urgent badge */}
                {service.urgent && (
                  <div
                    className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-700 uppercase tracking-wider"
                    style={{
                      background: "rgba(249,115,22,0.15)",
                      border: "1px solid rgba(249,115,22,0.35)",
                      color: "#F97316",
                      fontFamily: "var(--font-display)",
                      zIndex: 2,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "#F97316", boxShadow: "0 0 6px #F97316" }}
                    />
                    24/7
                  </div>
                )}

                {/* Corner glow on urgent cards */}
                {service.urgent && (
                  <div
                    className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
                    style={{ background: "radial-gradient(ellipse, rgba(249,115,22,0.12) 0%, transparent 70%)", filter: "blur(20px)", zIndex: 1 }}
                  />
                )}

                {/* Content wrapper above image */}
                <div className="relative z-10">

                {/* Icon */}
                <div className="mb-5" style={{ width: 44, height: 44, color: "var(--brand-accent)", filter: "drop-shadow(0 0 8px rgba(249,115,22,0.4))" }}>
                  {IconEl}
                </div>

                {/* Title */}
                <h3 className="font-display font-700 uppercase mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", lineHeight: 1.1, color: "var(--brand-fg)", letterSpacing: "-0.01em" }}>
                  {service.title}
                </h3>

                {/* Description */}
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", lineHeight: 1.7, color: "var(--brand-fg-muted)" }}>
                  {service.desc}
                </p>

                {/* CTA link for urgent */}
                {service.urgent && (
                  <a href={config.business.phoneHref} className="mt-4 inline-flex items-center gap-2 font-display font-600 uppercase text-sm tracking-wider" style={{ color: "var(--brand-accent)", letterSpacing: "0.1em" }}>
                    Call Now
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </a>
                )}

                </div>{/* end content wrapper */}

                {/* Bottom accent rule */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 transition-opacity duration-300"
                  style={{
                    background: "linear-gradient(90deg, var(--brand-accent), transparent)",
                  }}
                  aria-hidden
                />
              </div>
            )
          })}
        </div>

        {/* Bottom CTA strip */}
        <div
          className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-6 px-8 py-6 rounded-xl"
          style={{
            background: "linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(56,189,248,0.04) 100%)",
            border: "1px solid rgba(249,115,22,0.15)",
          }}
        >
          <div>
            <p
              className="font-display font-700 uppercase"
              style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", color: "var(--brand-fg)", letterSpacing: "-0.01em" }}
            >
              Not sure what you need?
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9rem", color: "var(--brand-fg-muted)", marginTop: 4 }}>
              Call us and we'll walk through what's going on before anyone comes out.
            </p>
          </div>
          <a
            href={config.business.phoneHref}
            className="btn-primary shrink-0 px-7 py-3.5"
            style={{ fontSize: "0.95rem" }}
          >
            {config.business.phone}
          </a>
        </div>
      </div>
    </section>
  )
}
