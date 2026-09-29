"use client"

import { useEffect, useRef } from "react"
import { ShieldCheck, Star, Calendar, CheckCircle2, Phone, ArrowRight } from "lucide-react"
import type { SiteConfig } from "../types"
import { gsap } from "../lib/gsap-init"
import { createScope } from "../lib/kill-scope"
import { useReducedMotion } from "../hooks/use-reduced-motion"
import { getIcon } from "./icon-map"

interface Props {
  config: SiteConfig
  label?: string
  imageSrc?: string
}

export function About({ config, label = "About Us", imageSrc = "/hero-2.jpg" }: Props) {
  const business = config.business
  const about = config.about

  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const stepsRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!about) return
    if (reduced) {
      gsap.set([leftRef.current, rightRef.current, stepsRef.current].filter(Boolean), { opacity: 1, x: 0, y: 0 })
      return
    }

    const scope = createScope()

    const l = gsap.from(leftRef.current, {
      opacity: 0, x: -40, duration: 0.85, ease: "power3.out",
      scrollTrigger: { trigger: leftRef.current, start: "top 80%", once: true },
    })
    scope.add(l)
    if (l.scrollTrigger) scope.add(l.scrollTrigger)

    const r = gsap.from(rightRef.current, {
      opacity: 0, x: 40, duration: 0.85, ease: "power3.out",
      scrollTrigger: { trigger: rightRef.current, start: "top 80%", once: true },
    })
    scope.add(r)
    if (r.scrollTrigger) scope.add(r.scrollTrigger)

    if (stepsRef.current) {
      const steps = stepsRef.current.querySelectorAll<HTMLElement>("[data-step]")
      const t = gsap.from(steps, {
        opacity: 0, y: 24, stagger: 0.12, duration: 0.6, ease: "power3.out",
        scrollTrigger: { trigger: stepsRef.current, start: "top 82%", once: true },
      })
      scope.add(t)
      if (t.scrollTrigger) scope.add(t.scrollTrigger)
    }

    return () => scope.kill()
  }, [reduced, about])

  if (!about) return null

  return (
    <section
      id="about"
      className="py-24 px-6"
      style={{ background: "var(--brand-bg-section)" }}
    >
      <div className="max-w-7xl mx-auto">

        {/* ── Top: Story + Photo ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20">

          {/* Left — story */}
          <div ref={leftRef}>
            <span className="section-label">{label}</span>

            <h2
              className="font-display text-white mb-5"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
              }}
            >
              {about.heading ?? `${business.name} — Serving ${business.city} Since ${business.since}`}
            </h2>

            <p
              className="font-body text-white/65 leading-relaxed mb-8"
              style={{ fontSize: "1.05rem", maxWidth: "32rem" }}
            >
              {about.body}
            </p>

            {/* Highlights */}
            {about.highlights && about.highlights.length > 0 && (
              <ul className="space-y-3 mb-8">
                {about.highlights.map((h) => (
                  <li key={h.text} className="flex items-start gap-3">
                    <CheckCircle2
                      className="w-5 h-5 shrink-0 mt-0.5"
                      style={{ color: "var(--brand-accent)" }}
                    />
                    <span className="font-body text-white/75 text-sm leading-relaxed">{h.text}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Trust pills */}
            <div className="flex flex-wrap gap-3 mb-8">
              {business.since && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full glass-dark" style={{ fontSize: "0.75rem" }}>
                  <Calendar className="w-3.5 h-3.5" style={{ color: "var(--brand-accent)" }} />
                  <span className="font-body text-white/70">Est. {business.since}</span>
                </div>
              )}
              {business.google_rating && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full glass-dark" style={{ fontSize: "0.75rem" }}>
                  <Star className="w-3.5 h-3.5 fill-current" style={{ color: "var(--brand-accent)" }} />
                  <span className="font-body text-white/70">
                    <span className="text-white font-bold">{business.google_rating}</span> · {business.review_count} reviews
                  </span>
                </div>
              )}
              {business.license && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full glass-dark" style={{ fontSize: "0.75rem" }}>
                  <ShieldCheck className="w-3.5 h-3.5" style={{ color: "var(--brand-accent)" }} />
                  <span className="font-body text-white/70">{business.license}</span>
                </div>
              )}
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3">
              <a href="#contact" className="btn-primary">
                Get Free Estimate
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href={business.phoneHref}
                className="btn-ghost flex items-center gap-2"
              >
                <Phone className="w-4 h-4" />
                {business.phone}
              </a>
            </div>
          </div>

          {/* Right — image with overlay cards */}
          <div ref={rightRef} className="relative">
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{ aspectRatio: "4/3", boxShadow: "0 24px 80px -16px rgba(0,0,0,0.25)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc}
                alt={business.name}
                className="w-full h-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(to top, color-mix(in srgb, var(--brand-bg) 35%, transparent) 0%, transparent 55%)" }}
              />
            </div>

            {/* Floating stat bottom-left */}
            {config.stats && config.stats[0] && (
              <div
                className="absolute -bottom-5 -left-5 glass-dark rounded-2xl px-5 py-4"
                style={{ boxShadow: "0 8px 32px -8px rgba(0,0,0,0.2)", minWidth: "120px" }}
              >
                <div
                  className="font-display text-3xl tabular-nums"
                  style={{ fontWeight: 900, color: "var(--brand-accent)", fontFamily: "var(--font-display)" }}
                >
                  {config.stats[0].value}{config.stats[0].suffix}
                </div>
                <div className="font-body text-white/60 text-xs mt-0.5 leading-tight">{config.stats[0].label}</div>
              </div>
            )}

            {/* Trust badge top-right */}
            {config.trustBadges && config.trustBadges[0] && (
              <div
                className="absolute -top-4 -right-4 glass-dark rounded-xl px-4 py-2.5"
                style={{ boxShadow: "0 4px 16px -4px rgba(0,0,0,0.15)" }}
              >
                <div className="font-body text-xs font-semibold" style={{ color: "var(--brand-accent)" }}>
                  ✓ {config.trustBadges[0]}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom: How It Works steps ─────────────────────────────── */}
        <div ref={stepsRef}>
          <div className="text-center mb-10">
            <span className="section-label">How It Works</span>
            <h3
              className="font-display text-white"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
            >
              Simple. Fast. <span style={{ color: "var(--brand-accent)" }}>Done Today.</span>
            </h3>
          </div>

          {/* Horizontal timeline */}
          <div className="relative">
            {/* Connector line — desktop only */}
            <div
              className="hidden md:block absolute h-px pointer-events-none"
              style={{
                top: "1.25rem",
                left: "16.67%",
                right: "16.67%",
                background: "linear-gradient(90deg, var(--brand-accent), var(--brand-accent-light))",
                opacity: 0.25,
              }}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-4">
              {[
                { n: "01", icon: "phone",     title: "Call or Text",  desc: `Reach us at ${business.phone}. No hold music, no voicemail — a real person picks up every time.` },
                { n: "02", icon: "wrench",    title: "We Diagnose",   desc: "A certified tech arrives with a stocked truck and gives you an upfront quote before any work starts." },
                { n: "03", icon: "thumbs-up", title: "Fixed Today",   desc: "90% of jobs are resolved on the first visit. You pay exactly what was quoted — no hidden fees, ever." },
              ].map((step) => (
                <div key={step.n} data-step className="flex flex-col items-center text-center">
                  {/* Numbered circle */}
                  <div
                    className="relative z-10 w-10 h-10 rounded-full flex items-center justify-center mb-5 shrink-0"
                    style={{
                      background: "var(--brand-accent)",
                      boxShadow: "0 0 24px -4px color-mix(in srgb, var(--brand-accent) 55%, transparent)",
                    }}
                  >
                    <span className="font-display text-white text-sm" style={{ fontWeight: 800 }}>{step.n}</span>
                  </div>
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{
                      background: "color-mix(in srgb, var(--brand-accent) 12%, transparent)",
                      color: "var(--brand-accent)",
                      border: "1px solid color-mix(in srgb, var(--brand-accent) 22%, transparent)",
                    }}
                  >
                    {getIcon(step.icon, "w-5 h-5")}
                  </div>
                  <h4
                    className="font-display text-white mb-2"
                    style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1rem" }}
                  >
                    {step.title}
                  </h4>
                  <p className="font-body text-white/60 text-sm leading-relaxed" style={{ maxWidth: "220px" }}>
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
