"use client"

import { useEffect, useRef } from "react"
import { gsap, createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"
import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

const STEPS = [
  {
    n: "01",
    title: "Call or Book Online",
    desc: "60-second booking. Tell us roughly how much junk. We give you a price window — no surprises on arrival.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/>
      </svg>
    ),
  },
  {
    n: "02",
    title: "We Show Up. You Approve.",
    desc: "Our crew arrives in your 2-hour window. We look at the junk, give you the exact price. You say yes — we load it.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
      </svg>
    ),
  },
  {
    n: "03",
    title: "Junk Gone. You Relax.",
    desc: "We haul everything out, sweep up, and you're done. Most jobs take under an hour. We donate and recycle what we can.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
  },
]

export function ProcessSection({ config }: Props) {
  const business = config.business
  const sectionRef = useRef<HTMLElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const stepsRef = useRef<HTMLDivElement>(null)
  const tickerRef = useRef<HTMLDivElement>(null)
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

    const steps = stepsRef.current?.querySelectorAll<HTMLElement>(".process-step")
    if (steps?.length) {
      const t = gsap.from(steps, {
        opacity: 0, y: 56, stagger: 0.13, duration: 0.65, ease: "power3.out",
        scrollTrigger: { trigger: stepsRef.current, start: "top 80%", once: true },
      })
      scope.add(t)
      if (t.scrollTrigger) scope.add(t.scrollTrigger)
    }

    // Ticker animation
    const ticker = tickerRef.current
    if (ticker) {
      const tw = gsap.fromTo(ticker, { opacity: 0 }, {
        opacity: 1, duration: 0.5,
        scrollTrigger: { trigger: ticker, start: "top 90%", once: true },
      })
      scope.add(tw)
      if (tw.scrollTrigger) scope.add(tw.scrollTrigger)
    }

    return () => scope.kill()
  }, [reduced])

  return (
    <section
      ref={sectionRef}
      id="services"
      style={{ background: "var(--brand-bg-section)", padding: "6rem 0" }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 2rem" }}>
        {/* Header */}
        <div ref={headRef} style={{ textAlign: "center", marginBottom: "4rem" }}>
          <span style={{ display: "inline-block", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--brand-accent)", marginBottom: "1rem", padding: "0.3rem 0.85rem", border: "1px solid color-mix(in srgb, var(--brand-accent) 30%, transparent)", borderRadius: "999px", background: "color-mix(in srgb, var(--brand-accent) 8%, transparent)" }}>
            How It Works
          </span>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.1, color: "var(--brand-fg)", marginBottom: "1rem" }}>
            Gone in{" "}
            <span style={{ background: "linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              3 simple steps.
            </span>
          </h2>
          <p style={{ fontSize: "1rem", color: "var(--brand-fg-muted)", maxWidth: "480px", margin: "0 auto", lineHeight: 1.7 }}>
            No lifting. No hauling. No disposal fees. We do all the work — you just point at what goes.
          </p>
        </div>

        {/* Steps */}
        <div
          ref={stepsRef}
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0", position: "relative" }}
          className="steps-grid"
        >
          {/* connector line */}
          <div aria-hidden style={{ position: "absolute", top: "3rem", left: "calc(16.66% + 1.5rem)", right: "calc(16.66% + 1.5rem)", height: "2px", background: "linear-gradient(90deg, var(--brand-accent), color-mix(in srgb, var(--brand-accent) 40%, transparent))", zIndex: 0 }} />

          {STEPS.map((step, i) => (
            <div
              key={step.n}
              className="process-step"
              style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "0 2rem 0" }}
            >
              <div
                style={{
                  width: "6rem",
                  height: "6rem",
                  borderRadius: "50%",
                  margin: "0 auto 1.75rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: i === 1 ? "var(--brand-accent)" : "var(--brand-card-bg)",
                  border: i === 1 ? "none" : "2px solid var(--brand-card-border)",
                  color: i === 1 ? "#FFFFFF" : "var(--brand-accent)",
                  boxShadow: i === 1 ? "var(--shadow-cta)" : "var(--shadow-card)",
                }}
              >
                {step.icon}
              </div>

              <div style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--brand-accent)", marginBottom: "0.5rem" }}>
                STEP {step.n}
              </div>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 700, color: "var(--brand-fg)", marginBottom: "0.65rem" }}>
                {step.title}
              </h3>
              <p style={{ fontSize: "0.875rem", color: "var(--brand-fg-muted)", lineHeight: 1.65 }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Urgency ticker */}
        <div
          ref={tickerRef}
          style={{ marginTop: "3.5rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", padding: "1rem 1.5rem", borderRadius: "0.875rem", background: "color-mix(in srgb, var(--brand-accent) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--brand-accent) 20%, transparent)" }}
        >
          <div style={{ width: "0.5rem", height: "0.5rem", borderRadius: "50%", background: "var(--brand-accent)", animation: "pulse-dot 2s ease-in-out infinite" }} />
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--brand-fg-muted)" }}>
            Same-day available in <strong style={{ color: "var(--brand-fg)" }}>{business.city}</strong> — call before noon.
          </span>
          <a href={business.phoneHref} style={{ marginLeft: "auto", flexShrink: 0, fontSize: "0.82rem", fontWeight: 700, color: "var(--brand-accent)", textDecoration: "none", whiteSpace: "nowrap" }}>
            Book Now →
          </a>
        </div>

        {/* CTA */}
        <div style={{ marginTop: "2.5rem", textAlign: "center" }}>
          <a href={business.phoneHref} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "var(--brand-accent)", color: "#fff", fontWeight: 700, fontSize: "0.9rem", padding: "0.9rem 2rem", borderRadius: "999px", textDecoration: "none", boxShadow: "var(--shadow-cta)" }}>
            Get Upfront Quote — {business.phone}
          </a>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .steps-grid { grid-template-columns: 1fr !important; }
          .steps-grid > div:first-child::after { display: none; }
        }
      `}</style>
    </section>
  )
}
