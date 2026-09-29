"use client"

import { useEffect, useRef } from "react"
import { gsap, createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"
import type { SiteConfig } from "@core/web/types"

interface Props {
  config: SiteConfig
}

export function AttorneySection({ config }: Props) {
  const attorney = config.business.attorney
  if (!attorney) return null

  const sectionRef = useRef<HTMLElement>(null)
  const photoRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const scope = createScope()

    const p = gsap.from(photoRef.current, {
      opacity: 0, x: -40, duration: 0.8, ease: "power3.out",
      scrollTrigger: { trigger: sectionRef.current, start: "top 78%", once: true },
    })
    scope.add(p)
    if (p.scrollTrigger) scope.add(p.scrollTrigger)

    const c = gsap.from(contentRef.current, {
      opacity: 0, x: 40, duration: 0.8, ease: "power3.out",
      scrollTrigger: { trigger: sectionRef.current, start: "top 78%", once: true },
    })
    scope.add(c)
    if (c.scrollTrigger) scope.add(c.scrollTrigger)

    return () => scope.kill()
  }, [reduced])

  return (
    <section
      ref={sectionRef}
      id="attorney"
      style={{
        background: "var(--brand-bg)",
        padding: "6rem 0",
        borderTop: "1px solid var(--brand-card-border)",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "0 2rem",
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: "5rem",
          alignItems: "center",
        }}
        className="attorney-grid"
      >
        {/* Attorney photo */}
        <div ref={photoRef}>
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "4/5",
              borderRadius: "1.25rem",
              overflow: "hidden",
              background: "linear-gradient(145deg, color-mix(in srgb, var(--brand-accent) 12%, var(--brand-bg-section)), color-mix(in srgb, var(--brand-accent) 6%, var(--brand-bg-mid)))",
              border: "1px solid var(--brand-card-border)",
              boxShadow: "0 32px 64px -16px rgba(0,0,0,0.4)",
            }}
          >
            <img
              src="/attorney.jpg"
              alt={attorney.name}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center top",
                display: "block",
              }}
              onError={(e) => {
                // Fallback to placeholder if image missing
                const el = e.currentTarget
                el.style.display = "none"
                const parent = el.parentElement
                if (parent) {
                  const fb = document.createElement("div")
                  fb.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center"
                  fb.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
                  parent.appendChild(fb)
                }
              }}
            />
            {/* Bottom gradient overlay */}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)" }} />

            {/* Yrs experience badge */}
            {attorney.yearsExp && (
              <div
                style={{
                  position: "absolute",
                  bottom: "1.25rem",
                  left: "1.25rem",
                  background: "var(--brand-accent)",
                  color: "#fff",
                  borderRadius: "0.75rem",
                  padding: "0.6rem 1rem",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                }}
              >
                <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 800, lineHeight: 1 }}>
                  {attorney.yearsExp}+
                </div>
                <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.9 }}>
                  Years Experience
                </div>
              </div>
            )}

            {/* Name overlay at bottom right */}
            <div
              style={{
                position: "absolute",
                bottom: "1.25rem",
                right: "1.25rem",
                textAlign: "right",
              }}
            >
              <div style={{ fontFamily: "var(--font-display)", fontSize: "0.9rem", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
                {attorney.name}
              </div>
              <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.75)", marginTop: "0.15rem" }}>
                Lead Attorney
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div ref={contentRef}>
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
            Lead Attorney
          </span>

          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 3.5vw, 2.75rem)",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
              color: "var(--brand-fg)",
              marginBottom: "0.5rem",
            }}
          >
            {attorney.name}
          </h2>

          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--brand-accent)",
              fontWeight: 600,
              letterSpacing: "0.02em",
              marginBottom: "1.75rem",
            }}
          >
            {attorney.credentials}
          </p>

          {/* Rule */}
          <div
            style={{
              width: "2.5rem",
              height: "2px",
              background: "var(--brand-accent)",
              borderRadius: "999px",
              marginBottom: "1.75rem",
            }}
          />

          <p
            style={{
              fontSize: "1rem",
              lineHeight: 1.8,
              color: "var(--brand-fg-muted)",
              marginBottom: "2rem",
            }}
          >
            {attorney.bio}
          </p>

          {/* Trust badges */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
            {(config.trustBadges ?? []).slice(0, 4).map((badge) => (
              <span
                key={badge}
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  color: "var(--brand-fg-muted)",
                  padding: "0.35rem 0.8rem",
                  borderRadius: "999px",
                  border: "1px solid var(--brand-card-border)",
                  background: "var(--brand-card-bg)",
                }}
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .attorney-grid {
            grid-template-columns: 1fr !important;
            gap: 2.5rem !important;
          }
          .attorney-grid > div:first-child {
            max-width: 280px;
            margin: 0 auto;
          }
        }
      `}</style>
    </section>
  )
}
