"use client"

import { useEffect, useRef } from "react"
import { gsap, createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"
import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

const AGE_GROUPS = [
  {
    age: "Infant",
    range: "6 weeks – 18 months",
    ratio: "1:3",
    emoji: "👶",
    color: "#EC4899",
    highlights: ["Sensory play daily", "Sleep schedule honored", "Feeding logged in app", "Monthly milestone updates"],
  },
  {
    age: "Toddler",
    range: "18 months – 3 years",
    ratio: "1:5",
    emoji: "🧒",
    color: "#8B5CF6",
    highlights: ["Language immersion", "Potty training support", "Music & movement", "Nature walks weekly"],
  },
  {
    age: "Pre-K",
    range: "3 – 5 years",
    ratio: "1:7",
    emoji: "🎓",
    color: "#06B6D4",
    highlights: ["Kindergarten readiness", "STEM activities", "Bilingual exposure", "Art & creativity daily"],
  },
  {
    age: "After School",
    range: "K – 12th grade",
    ratio: "1:10",
    emoji: "📚",
    color: "#10B981",
    highlights: ["Homework help", "Supervised free time", "Healthy snack", "Pick-up by 6:30 PM"],
  },
]

export function CurriculumSection({ config }: Props) {
  const business = config.business
  const sectionRef = useRef<HTMLElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const scope = createScope()

    const h = gsap.from(headRef.current, {
      opacity: 0, y: 32, duration: 0.7, ease: "power3.out",
      scrollTrigger: { trigger: sectionRef.current, start: "top 82%", once: true },
    })
    scope.add(h)
    if (h.scrollTrigger) scope.add(h.scrollTrigger)

    const cards = cardsRef.current?.querySelectorAll<HTMLElement>(".age-card")
    if (cards?.length) {
      const t = gsap.from(cards, {
        opacity: 0, y: 40, stagger: 0.08, duration: 0.6, ease: "power3.out",
        scrollTrigger: { trigger: cardsRef.current, start: "top 80%", once: true },
      })
      scope.add(t)
      if (t.scrollTrigger) scope.add(t.scrollTrigger)
    }

    return () => scope.kill()
  }, [reduced])

  return (
    <section
      ref={sectionRef}
      id="services"
      style={{ background: "var(--brand-bg-section)", padding: "6rem 0" }}
    >
      <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 2rem" }}>
        {/* Header */}
        <div ref={headRef} style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <span style={{ display: "inline-block", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--brand-accent)", marginBottom: "1rem", padding: "0.3rem 0.85rem", border: "1px solid color-mix(in srgb, var(--brand-accent) 30%, transparent)", borderRadius: "999px", background: "color-mix(in srgb, var(--brand-accent) 8%, transparent)" }}>
            Our Programs
          </span>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.1, color: "var(--brand-fg)", marginBottom: "1rem" }}>
            Every age.{" "}
            <span style={{ background: "linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Every milestone.
            </span>
          </h2>
          <p style={{ fontSize: "1rem", color: "var(--brand-fg-muted)", maxWidth: "500px", margin: "0 auto", lineHeight: 1.7 }}>
            Age-appropriate curriculum designed by early childhood specialists. Small groups, big results.
          </p>
        </div>

        {/* Age group cards */}
        <div
          ref={cardsRef}
          style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.25rem" }}
          className="curriculum-grid"
        >
          {AGE_GROUPS.map((group) => (
            <div
              key={group.age}
              className="age-card"
              style={{
                borderRadius: "1.25rem",
                padding: "1.75rem",
                background: "var(--brand-card-bg)",
                border: `1px solid ${group.color}22`,
                boxShadow: "var(--shadow-card)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* color stripe top */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: group.color, borderRadius: "1.25rem 1.25rem 0 0" }} />

              <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>{group.emoji}</div>

              <div style={{ marginBottom: "0.25rem" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 800, color: "var(--brand-fg)" }}>{group.age}</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--brand-fg-sub)", marginBottom: "0.75rem" }}>{group.range}</div>

              {/* Ratio badge */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.25rem 0.75rem", borderRadius: "999px", background: `${group.color}14`, marginBottom: "1.25rem" }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.06em", color: group.color, textTransform: "uppercase" }}>Ratio {group.ratio}</span>
              </div>

              {/* Highlights */}
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {group.highlights.map((h) => (
                  <li key={h} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.82rem", color: "var(--brand-fg-muted)", padding: "0.3rem 0", borderBottom: "1px solid var(--brand-card-border)" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={group.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: "0.2rem", flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Schedule tour CTA */}
        <div style={{ marginTop: "3rem", textAlign: "center" }}>
          <p style={{ fontSize: "1rem", color: "var(--brand-fg-muted)", marginBottom: "1.25rem" }}>
            Every family gets a complimentary tour before enrollment.
          </p>
          <a href={business.phoneHref} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "var(--brand-accent)", color: "#fff", fontWeight: 700, fontSize: "0.9rem", padding: "0.9rem 2rem", borderRadius: "999px", textDecoration: "none", boxShadow: "var(--shadow-cta)" }}>
            Schedule a Tour — {business.phone}
          </a>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .curriculum-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 560px) {
          .curriculum-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
