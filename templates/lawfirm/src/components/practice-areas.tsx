"use client"

import { useEffect, useRef } from "react"
import { gsap, createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"
import { getIcon } from "@core/web/sections"
import type { SiteConfig } from "@core/web/types"

interface Props {
  config: SiteConfig
}

const URGENCY_LABEL: Record<string, string> = {
  "Personal Injury": "No Fee Unless We Win",
  "Criminal Defense": "24/7 Emergency Line",
}

export function PracticeAreasSection({ config }: Props) {
  const services = config.services ?? []
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const scope = createScope()

    const h = gsap.from(headingRef.current, {
      opacity: 0, y: 32, duration: 0.7, ease: "power3.out",
      scrollTrigger: { trigger: sectionRef.current, start: "top 82%", once: true },
    })
    scope.add(h)
    if (h.scrollTrigger) scope.add(h.scrollTrigger)

    const cards = gridRef.current?.querySelectorAll<HTMLElement>(".practice-card")
    if (cards?.length) {
      const t = gsap.from(cards, {
        opacity: 0, y: 48, scale: 0.96, stagger: 0.07, duration: 0.65, ease: "power3.out",
        scrollTrigger: { trigger: gridRef.current, start: "top 80%", once: true },
      })
      scope.add(t)
      if (t.scrollTrigger) scope.add(t.scrollTrigger)
    }

    return () => scope.kill()
  }, [reduced, services.length])

  return (
    <section
      ref={sectionRef}
      id="services"
      style={{
        background: "var(--brand-bg-section)",
        padding: "6rem 0",
      }}
    >
      <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 2rem" }}>
        {/* Header */}
        <div ref={headingRef} style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <span
            style={{
              display: "inline-block",
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--brand-accent)",
              marginBottom: "1rem",
              padding: "0.3rem 0.85rem",
              border: "1px solid color-mix(in srgb, var(--brand-accent) 30%, transparent)",
              borderRadius: "999px",
              background: "color-mix(in srgb, var(--brand-accent) 8%, transparent)",
            }}
          >
            Practice Areas
          </span>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 4vw, 3rem)",
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
              color: "var(--brand-fg)",
              marginBottom: "1rem",
            }}
          >
            We fight for you.{" "}
            <span
              style={{
                background: "linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Every case.
            </span>
          </h2>
          <p
            style={{
              fontSize: "1rem",
              color: "var(--brand-fg-muted)",
              maxWidth: "540px",
              margin: "0 auto",
              lineHeight: 1.7,
            }}
          >
            Our attorneys handle the full spectrum of civil and criminal matters. No referrals, no hand-offs — the attorney you hire stays on your case.
          </p>
        </div>

        {/* Grid */}
        <div
          ref={gridRef}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {services.map((service) => (
            <PracticeCard key={service.title} service={service} />
          ))}
        </div>

        {/* CTA bar */}
        <div
          style={{
            marginTop: "3rem",
            padding: "2rem 2.5rem",
            borderRadius: "1.25rem",
            background: "var(--brand-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1.5rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.25rem",
                fontWeight: 800,
                color: "#FFFFFF",
                marginBottom: "0.25rem",
              }}
            >
              Not sure where your case fits?
            </p>
            <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.8)" }}>
              Speak with an attorney free — we'll tell you exactly how we can help.
            </p>
          </div>
          <a
            href={config.business.phoneHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "#FFFFFF",
              color: "var(--brand-accent)",
              fontWeight: 800,
              fontSize: "0.9rem",
              padding: "0.85rem 1.75rem",
              borderRadius: "999px",
              textDecoration: "none",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Free Case Evaluation →
          </a>
        </div>
      </div>
    </section>
  )
}

function PracticeCard({ service }: { service: NonNullable<SiteConfig["services"]>[number] }) {
  const cardRef = useRef<HTMLDivElement>(null)

  function onEnter() {
    const icon = cardRef.current?.querySelector<HTMLElement>(".card-icon")
    gsap.to(cardRef.current, { y: -4, duration: 0.3, ease: "power2.out" })
    if (icon) gsap.to(icon, { background: "var(--brand-accent)", color: "#fff", duration: 0.25 })
  }
  function onLeave() {
    const icon = cardRef.current?.querySelector<HTMLElement>(".card-icon")
    gsap.to(cardRef.current, { y: 0, duration: 0.3, ease: "power2.in" })
    if (icon) gsap.to(icon, { background: "color-mix(in srgb, var(--brand-accent) 10%, transparent)", color: "var(--brand-accent)", duration: 0.25 })
  }

  return (
    <div
      ref={cardRef}
      className="practice-card"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        background: "var(--brand-card-bg)",
        border: "1px solid var(--brand-card-border)",
        borderRadius: "1rem",
        padding: "1.75rem",
        boxShadow: "var(--shadow-card)",
        cursor: "default",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {service.urgent && URGENCY_LABEL[service.title] && (
        <div
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            fontSize: "0.6rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--brand-accent)",
            background: "color-mix(in srgb, var(--brand-accent) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--brand-accent) 25%, transparent)",
            padding: "0.2rem 0.6rem",
            borderRadius: "999px",
          }}
        >
          {URGENCY_LABEL[service.title]}
        </div>
      )}

      <div
        className="card-icon"
        style={{
          width: "3rem",
          height: "3rem",
          borderRadius: "0.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "1.25rem",
          background: "color-mix(in srgb, var(--brand-accent) 10%, transparent)",
          color: "var(--brand-accent)",
          transition: "background 0.25s, color 0.25s",
        }}
      >
        {getIcon(service.icon, "w-6 h-6")}
      </div>

      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.1rem",
          fontWeight: 700,
          color: "var(--brand-fg)",
          marginBottom: "0.6rem",
        }}
      >
        {service.title}
      </h3>
      <p style={{ fontSize: "0.875rem", lineHeight: 1.65, color: "var(--brand-fg-muted)" }}>
        {service.desc}
      </p>
    </div>
  )
}
