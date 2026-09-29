"use client"

import { useEffect, useRef } from "react"
import { gsap, createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"
import type { SiteConfig, Service } from "@core/web/types"

interface Props {
  config: SiteConfig
}

export function SkinMenuSection({ config }: Props) {
  const services = config.services ?? []
  const business = config.business

  const sectionRef = useRef<HTMLElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const itemsRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const section = sectionRef.current
    const items = itemsRef.current
    const left = leftRef.current
    if (!section || !items || !left) return

    if (reduced) {
      gsap.set([left, ...items.querySelectorAll(".menu-row")], { opacity: 1, y: 0 })
      return
    }

    const scope = createScope()

    const leftTween = gsap.from(left, {
      opacity: 0,
      x: -40,
      duration: 0.85,
      ease: "power3.out",
      scrollTrigger: { trigger: section, start: "top 80%", once: true },
    })
    scope.add(leftTween)
    if (leftTween.scrollTrigger) scope.add(leftTween.scrollTrigger)

    const rows = items.querySelectorAll<HTMLElement>(".menu-row")
    if (rows.length) {
      const rowTween = gsap.from(rows, {
        opacity: 0,
        y: 48,
        stagger: 0.09,
        duration: 0.65,
        ease: "power3.out",
        scrollTrigger: { trigger: items, start: "top 82%", once: true },
      })
      scope.add(rowTween)
      if (rowTween.scrollTrigger) scope.add(rowTween.scrollTrigger)
    }

    return () => scope.kill()
  }, [reduced, services.length])

  return (
    <section
      ref={sectionRef}
      id="treatments"
      style={{
        position: "relative",
        background: "linear-gradient(180deg, var(--brand-bg-section) 0%, var(--brand-bg) 100%)",
        padding: "7rem 0",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "250px",
          background:
            "radial-gradient(ellipse at center top, color-mix(in srgb, var(--brand-accent) 10%, transparent) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          maxWidth: "1240px",
          margin: "0 auto",
          padding: "0 2rem",
          display: "grid",
          gridTemplateColumns: "1fr 1.25fr",
          gap: "6rem",
          alignItems: "start",
        }}
        className="skin-menu-grid"
      >
        <div ref={leftRef} style={{ position: "sticky", top: "6rem" }}>
          <span
            style={{
              display: "inline-block",
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--brand-accent-light)",
              marginBottom: "1.25rem",
              padding: "0.35rem 0.85rem",
              border: "1px solid color-mix(in srgb, var(--brand-accent) 35%, transparent)",
              borderRadius: "999px",
              background: "color-mix(in srgb, var(--brand-accent) 8%, transparent)",
            }}
          >
            Skin Treatments
          </span>

          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(2.5rem, 4.5vw, 4rem)",
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: "var(--brand-fg)",
              marginBottom: "1.5rem",
            }}
          >
            Clinical results.
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Radiant skin.
            </span>
          </h2>

          <p
            style={{
              fontSize: "1rem",
              lineHeight: 1.75,
              color: "var(--brand-fg-muted)",
              marginBottom: "2.5rem",
              maxWidth: "340px",
            }}
          >
            Every treatment at {business.name} is performed by licensed
            dermatology providers using only clinically proven protocols
            and medical-grade technology.
          </p>

          <a
            href={`tel:${business.phone}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              background: "var(--brand-accent)",
              color: "white",
              fontWeight: 700,
              fontSize: "0.875rem",
              letterSpacing: "0.04em",
              padding: "0.9rem 1.75rem",
              borderRadius: "999px",
              textDecoration: "none",
              boxShadow: "var(--shadow-cta)",
              transition: "opacity 0.2s ease, transform 0.2s ease",
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.opacity = "0.88"
              ;(e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.opacity = "1"
              ;(e.currentTarget as HTMLElement).style.transform = "translateY(0)"
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
            </svg>
            Book Free Skin Consultation
          </a>

          <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "var(--brand-fg-sub)" }}>
            No obligation · Results-focused
          </p>
        </div>

        <div ref={itemsRef}>
          {services.map((service, idx) => (
            <MenuRow key={service.title} service={service} index={idx} />
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .skin-menu-grid {
            grid-template-columns: 1fr !important;
            gap: 3rem !important;
          }
          .skin-menu-grid > div:first-child {
            position: static !important;
          }
        }
      `}</style>
    </section>
  )
}

function MenuRow({ service, index }: { service: Service; index: number }) {
  const rowRef = useRef<HTMLDivElement>(null)

  function handleMouseEnter() {
    const el = rowRef.current
    if (!el) return
    gsap.to(el.querySelector(".row-accent-bar"), { scaleY: 1, duration: 0.3, ease: "power2.out" })
    gsap.to(el, { x: 8, duration: 0.3, ease: "power2.out" })
    gsap.to(el.querySelector(".row-num"), { color: "var(--brand-accent-light)", duration: 0.25 })
  }

  function handleMouseLeave() {
    const el = rowRef.current
    if (!el) return
    gsap.to(el.querySelector(".row-accent-bar"), { scaleY: 0, duration: 0.25, ease: "power2.in" })
    gsap.to(el, { x: 0, duration: 0.25, ease: "power2.in" })
    gsap.to(el.querySelector(".row-num"), { color: "color-mix(in srgb, var(--brand-fg) 12%, transparent)", duration: 0.2 })
  }

  return (
    <div
      ref={rowRef}
      className="menu-row"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: "relative",
        display: "flex",
        gap: "1.5rem",
        padding: "1.75rem 0",
        borderBottom: "1px solid var(--brand-card-border)",
        cursor: "default",
      }}
    >
      <div
        className="row-accent-bar"
        aria-hidden
        style={{
          position: "absolute",
          left: "-1.5rem",
          top: 0,
          bottom: 0,
          width: "3px",
          borderRadius: "999px",
          background: "var(--brand-accent)",
          transformOrigin: "top",
          transform: "scaleY(0)",
        }}
      />

      <div
        className="row-num"
        aria-hidden
        style={{
          flexShrink: 0,
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "2rem",
          fontWeight: 600,
          lineHeight: 1,
          color: "color-mix(in srgb, var(--brand-fg) 12%, transparent)",
          paddingTop: "0.2rem",
          minWidth: "2.5rem",
          transition: "color 0.2s",
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </div>

      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          <h3
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "1.375rem",
              fontWeight: 600,
              color: "var(--brand-fg)",
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
            }}
          >
            {service.title}
          </h3>

          {service.meta && (
            <span
              style={{
                flexShrink: 0,
                fontSize: "0.72rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--brand-accent-light)",
                padding: "0.25rem 0.7rem",
                borderRadius: "999px",
                background: "color-mix(in srgb, var(--brand-accent) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--brand-accent) 25%, transparent)",
              }}
            >
              {service.meta}
            </span>
          )}
        </div>

        <p style={{ fontSize: "0.9rem", lineHeight: 1.65, color: "var(--brand-fg-muted)" }}>
          {service.desc}
        </p>
      </div>
    </div>
  )
}
