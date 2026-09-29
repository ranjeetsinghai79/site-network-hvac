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

export default function HvacServices({ config }: Props) {
  const services = (config.services ?? []).slice(0, 6)
  const sectionRef = useRef<HTMLElement>(null)
  const headRef    = useRef<HTMLDivElement>(null)
  const rowsRef    = useRef<HTMLDivElement>(null)
  const pathRef    = useRef<SVGPolylineElement>(null)

  const N = services.length

  useEffect(() => {
    if (!headRef.current || !rowsRef.current) return

    gsap.from(headRef.current, {
      opacity: 0, y: 32, duration: 0.7, ease: "power3.out",
      immediateRender: false,
      scrollTrigger: { trigger: headRef.current, start: "top 85%", once: true },
    })

    const rows = rowsRef.current.querySelectorAll<HTMLElement>(".zz-row")
    rows.forEach((row, i) => {
      const fromSide = i % 2 === 0 ? -1 : 1
      const text = row.querySelector<HTMLElement>(".zz-text")
      const img  = row.querySelector<HTMLElement>(".zz-img")
      gsap.from(text, {
        opacity: 0, x: fromSide * 50, duration: 0.7, ease: "power3.out",
        immediateRender: false,
        scrollTrigger: { trigger: row, start: "top 80%", once: true },
      })
      gsap.from(img, {
        opacity: 0, x: -fromSide * 50, rotate: fromSide * 4, duration: 0.8, ease: "power3.out",
        immediateRender: false,
        scrollTrigger: { trigger: row, start: "top 80%", once: true },
      })
    })

    // Draw the connecting zigzag line as the section scrolls
    if (pathRef.current) {
      const length = pathRef.current.getTotalLength()
      gsap.set(pathRef.current, { strokeDasharray: length, strokeDashoffset: length })
      gsap.to(pathRef.current, {
        strokeDashoffset: 0,
        ease: "none",
        scrollTrigger: { trigger: rowsRef.current, start: "top 70%", end: "bottom 60%", scrub: 0.6 },
      })
    }
  }, [])

  // Zigzag connector points — alternating left/right per row
  const points = services.map((_, i) => {
    const x = i % 2 === 0 ? 22 : 78
    const y = ((i + 0.5) / N) * 100
    return `${x},${y}`
  }).join(" ")

  return (
    <section
      ref={sectionRef}
      id="services"
      className="relative py-24 lg:py-32"
      style={{ background: "var(--brand-bg-2)" }}
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 xl:px-16">
        {/* Heading */}
        <div ref={headRef} className="mb-16 max-w-2xl">
          <p className="section-label mb-3">Our Services</p>
          <h2
            className="font-display font-700"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 4.5vw, 3.6rem)",
              lineHeight: 1.02,
              color: "var(--brand-fg)",
              letterSpacing: "-0.02em",
            }}
          >
            Everything HVAC. <span style={{ color: "var(--brand-accent)" }}>One call.</span>
          </h2>
        </div>

        {/* Zigzag rows */}
        <div ref={rowsRef} className="relative">
          {/* Connector line — desktop only */}
          <svg
            className="hidden lg:block absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ zIndex: 0 }}
          >
            <polyline
              ref={pathRef}
              points={points}
              fill="none"
              stroke="var(--brand-accent)"
              strokeWidth="0.3"
              strokeDasharray="2 2"
              strokeLinecap="round"
              opacity={0.4}
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {services.map((service, i) => {
            const IconEl = SERVICE_ICONS[service.icon] ?? SERVICE_ICONS.wrench
            const imgSrc = service.image ?? `/service-${(i % 6) + 1}.jpg`
            const reverse = i % 2 === 1

            return (
              <div
                key={i}
                className={`zz-row relative flex flex-col lg:flex-row ${reverse ? "lg:flex-row-reverse" : ""} items-center gap-8 lg:gap-16 py-10 lg:py-14`}
                style={{ zIndex: 1 }}
              >
                {/* Text */}
                <div className="zz-text flex-1 max-w-lg">
                  <div
                    className="inline-flex items-center justify-center mb-5 rounded-xl"
                    style={{ width: 52, height: 52, background: "rgba(79,70,229,0.08)", color: "var(--brand-accent)" }}
                  >
                    <div style={{ width: 26, height: 26 }}>{IconEl}</div>
                  </div>
                  {service.urgent && (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-700 uppercase tracking-wider mb-3 ml-2"
                      style={{ background: "rgba(255,107,74,0.12)", color: "var(--brand-ice, #FF6B4A)", fontFamily: "var(--font-display)" }}
                    >
                      24/7
                    </span>
                  )}
                  <h3
                    className="font-display font-700 mb-3"
                    style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: "var(--brand-fg)", letterSpacing: "-0.01em" }}
                  >
                    {service.title}
                  </h3>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.98rem", lineHeight: 1.75, color: "var(--brand-fg-muted)" }}>
                    {service.desc}
                  </p>
                  {service.urgent && (
                    <a href={config.business.phoneHref} className="mt-4 inline-flex items-center gap-2 font-display font-600 text-sm" style={{ color: "var(--brand-accent)" }}>
                      Call Now
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </a>
                  )}
                </div>

                {/* Image */}
                <div className="zz-img flex-1 w-full max-w-md">
                  <div
                    className="rounded-2xl overflow-hidden hover-lift"
                    style={{
                      aspectRatio: "4/3",
                      transform: `rotate(${reverse ? -2 : 2}deg)`,
                      border: "5px solid #fff",
                      boxShadow: "0 20px 40px -16px rgba(11,14,26,0.2)",
                    }}
                  >
                    <img src={imgSrc} alt={service.title} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
