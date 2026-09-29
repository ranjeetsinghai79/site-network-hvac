"use client"

import { useEffect, useRef } from "react"
import { gsap } from "@core/web/lib"
import { createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"
import type { SiteConfig } from "@core/web/types"

interface Credential {
  icon: React.ReactNode
  label: string
  sub?: string
}

const credentials: Credential[] = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
    label: "Board-Certified",
    sub: "MD · NP · PA only",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
      </svg>
    ),
    label: "FDA-Cleared",
    sub: "Devices & injectables",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="8" r="6" />
        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
      </svg>
    ),
    label: "AmSpa Member",
    sub: "American Med Spa Association",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ),
    label: "5.0 Google Rating",
    sub: "234+ verified reviews",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
    label: "0% Financing",
    sub: "CareCredit · Affirm",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
      </svg>
    ),
    label: "Since 2015",
    sub: "Tracy & Bay Area",
  },
]

interface Props {
  config: SiteConfig
}

export function SocialProofStrip({ config: _ }: Props) {
  const stripRef = useRef<HTMLDivElement>(null)
  const reduced  = useReducedMotion()

  useEffect(() => {
    const strip = stripRef.current
    if (!strip || reduced) return

    const scope = createScope()
    const items = strip.querySelectorAll<HTMLElement>(".proof-item")

    const t = gsap.from(items, {
      opacity: 0,
      y: 20,
      stagger: 0.07,
      duration: 0.6,
      ease: "power3.out",
      scrollTrigger: { trigger: strip, start: "top 90%", once: true },
    })
    scope.add(t)
    if (t.scrollTrigger) scope.add(t.scrollTrigger)

    return () => scope.kill()
  }, [reduced])

  return (
    <section
      aria-label="Credentials"
      style={{
        position: "relative",
        background: "#1E1915",
        padding: "0",
        borderBottom: "1px solid rgba(184,149,90,0.12)",
      }}
    >
      {/* Top gold rule */}
      <div aria-hidden style={{ height: "1px", background: "linear-gradient(90deg, transparent 0%, rgba(184,149,90,0.35) 30%, rgba(184,149,90,0.55) 50%, rgba(184,149,90,0.35) 70%, transparent 100%)" }} />

      <div
        ref={stripRef}
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 2rem",
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "0",
        }}
        className="proof-grid"
      >
        {credentials.map((c, i) => (
          <div
            key={c.label}
            className="proof-item"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.5rem",
              padding: "1.75rem 1rem",
              borderRight: i < credentials.length - 1 ? "1px solid rgba(184,149,90,0.10)" : "none",
              cursor: "default",
            }}
          >
            <span style={{ color: "rgba(212,180,131,0.95)" }}>
              {c.icon}
            </span>
            <span style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "rgba(250,247,241,0.85)",
              textAlign: "center",
              lineHeight: 1.3,
            }}>
              {c.label}
            </span>
            {c.sub && (
              <span style={{
                fontSize: "0.63rem",
                color: "rgba(212,180,131,0.75)",
                textAlign: "center",
                letterSpacing: "0.03em",
                lineHeight: 1.4,
              }}>
                {c.sub}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Bottom gold rule */}
      <div aria-hidden style={{ height: "1px", background: "linear-gradient(90deg, transparent 0%, rgba(184,149,90,0.35) 30%, rgba(184,149,90,0.55) 50%, rgba(184,149,90,0.35) 70%, transparent 100%)" }} />

      <style>{`
        @media (max-width: 900px) {
          .proof-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
          .proof-item:nth-child(3) {
            border-right: none !important;
          }
        }
        @media (max-width: 540px) {
          .proof-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .proof-item:nth-child(2n) {
            border-right: none !important;
          }
        }
      `}</style>
    </section>
  )
}
