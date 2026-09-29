"use client"

import { useEffect, useRef } from "react"
import { gsap, createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"
import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

export function GuaranteeSection({ config }: Props) {
  const services = config.services ?? []
  const business = config.business
  const sectionRef = useRef<HTMLElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const scope = createScope()

    const h = gsap.from(headRef.current, {
      opacity: 0, y: 40, duration: 0.8, ease: "power3.out",
      scrollTrigger: { trigger: sectionRef.current, start: "top 80%", once: true },
    })
    scope.add(h)
    if (h.scrollTrigger) scope.add(h.scrollTrigger)

    const items = listRef.current?.querySelectorAll<HTMLElement>(".checklist-item")
    if (items?.length) {
      const t = gsap.from(items, {
        opacity: 0, x: -24, stagger: 0.06, duration: 0.55, ease: "power3.out",
        scrollTrigger: { trigger: listRef.current, start: "top 82%", once: true },
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
      style={{ background: "var(--brand-bg-section)", padding: "6rem 0" }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 2rem" }}>
        {/* Guarantee block */}
        <div
          ref={headRef}
          style={{
            borderRadius: "1.5rem",
            background: "var(--brand-accent)",
            padding: "3.5rem 3rem",
            marginBottom: "3.5rem",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* decorative circle */}
          <div aria-hidden style={{ position: "absolute", top: "-4rem", right: "-4rem", width: "20rem", height: "20rem", borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
          <div aria-hidden style={{ position: "absolute", bottom: "-6rem", left: "8rem", width: "28rem", height: "28rem", borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(255,255,255,0.15)", borderRadius: "999px", padding: "0.35rem 1rem", marginBottom: "1.5rem" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "white" }}>100% Satisfaction Guarantee</span>
            </div>

            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.75rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.15, color: "#FFFFFF", marginBottom: "1rem", maxWidth: "640px" }}>
              If it's not clean, we come back.<br />
              <span style={{ opacity: 0.85 }}>No questions. No charge.</span>
            </h2>

            <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.7, maxWidth: "520px", marginBottom: "2rem" }}>
              Every clean is backed by our 24-hour re-clean guarantee. Find anything we missed — we return within one business day and fix it free.
            </p>

            <a href={business.phoneHref} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "#FFFFFF", color: "var(--brand-accent)", fontWeight: 800, fontSize: "0.875rem", padding: "0.85rem 1.75rem", borderRadius: "999px", textDecoration: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
              Book Your First Clean →
            </a>
          </div>
        </div>

        {/* What's Included */}
        <div>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--brand-fg)", marginBottom: "0.5rem" }}>
            What's included in every visit
          </h3>
          <p style={{ fontSize: "0.9rem", color: "var(--brand-fg-muted)", marginBottom: "2rem" }}>
            Every home clean covers these areas as standard. Add-ons available at booking.
          </p>

          <div
            ref={listRef}
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}
          >
            {services.map((service) => (
              <div
                key={service.title}
                className="checklist-item"
                style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem", padding: "1.25rem 1.5rem", borderRadius: "0.875rem", background: "var(--brand-card-bg)", border: "1px solid var(--brand-card-border)", boxShadow: "var(--shadow-card)" }}
              >
                <div style={{ flexShrink: 0, width: "1.5rem", height: "1.5rem", borderRadius: "50%", background: "color-mix(in srgb, var(--brand-accent) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", marginTop: "0.1rem" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9rem", color: "var(--brand-fg)", marginBottom: "0.2rem" }}>{service.title}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--brand-fg-muted)", lineHeight: 1.55 }}>{service.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
