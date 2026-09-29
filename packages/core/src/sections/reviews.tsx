"use client"

import { useEffect, useRef } from "react"
import { Star } from "lucide-react"
import type { SiteConfig } from "../types"
import { gsap } from "../lib/gsap-init"
import { createScope } from "../lib/kill-scope"
import { useReducedMotion } from "../hooks/use-reduced-motion"
import { SplitText } from "../effects/split-text"

interface Props {
  config: SiteConfig
  label?: string
  heading?: React.ReactNode
  ctaText?: string
}

export function Reviews({ config, label = "Customer Reviews", heading, ctaText }: Props) {
  const business = config.business
  const testimonials = config.testimonials ?? []

  const headingRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const scope = createScope()

    const h = gsap.from(headingRef.current, {
      opacity: 0, y: 45, duration: 0.8, ease: "expo.out",
      scrollTrigger: { trigger: headingRef.current, start: "top 88%", once: true },
    })
    scope.add(h)
    if (h.scrollTrigger) scope.add(h.scrollTrigger)

    const cards = gridRef.current?.querySelectorAll<HTMLElement>(".review-card")
    if (cards?.length) {
      const t = gsap.from(cards, {
        opacity: 0, y: 70, scale: 0.88, rotationX: 6, stagger: 0.13, duration: 0.9, ease: "expo.out",
        transformOrigin: "center top",
        scrollTrigger: { trigger: gridRef.current, start: "top 85%", once: true },
      })
      scope.add(t)
      if (t.scrollTrigger) scope.add(t.scrollTrigger)
    }

    if (ctaRef.current) {
      const t = gsap.from(ctaRef.current, {
        opacity: 0, y: 20, duration: 0.6,
        scrollTrigger: { trigger: ctaRef.current, start: "top 92%", once: true },
      })
      scope.add(t)
      if (t.scrollTrigger) scope.add(t.scrollTrigger)
    }

    return () => scope.kill()
  }, [reduced])

  if (!testimonials.length) return null

  return (
    <section
      id="reviews"
      className="py-24 px-6 relative overflow-hidden"
      style={{ background: "var(--brand-bg)" }}
    >
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(var(--brand-accent-light) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
        aria-hidden
      />

      <div className="relative max-w-7xl mx-auto">
        <div ref={headingRef} className="text-center mb-14">
          <span className="section-label">{label}</span>
          <h2
            className="font-display text-white text-4xl md:text-5xl mb-4"
            style={{ fontWeight: 800 }}
          >
            {heading ?? <SplitText>What Customers Say</SplitText>}
          </h2>
          <div className="flex items-center justify-center gap-2 mb-4">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className="w-5 h-5 fill-current"
                style={{ color: "var(--brand-accent)" }}
              />
            ))}
            <span className="font-display text-white text-lg ml-2" style={{ fontWeight: 700 }}>{business.google_rating}</span>
            <span className="font-body text-white/45 text-sm">({business.review_count} reviews)</span>
          </div>
          <div className="brand-rule brand-rule-center" />
        </div>

        <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="review-card glass-dark rounded-2xl p-7 cursor-default hover-lift"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(t.stars)].map((_, j) => (
                  <Star
                    key={j}
                    className="w-4 h-4 fill-current"
                    style={{ color: "var(--brand-accent)" }}
                  />
                ))}
              </div>
              <p className="font-body text-white/80 text-sm leading-relaxed mb-6 italic">
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="border-t border-white/10 pt-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {t.avatar ? (
                    <img
                      src={t.avatar}
                      alt={t.name}
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-display text-white text-sm shrink-0"
                      style={{ background: "color-mix(in srgb, var(--brand-accent) 30%, transparent)", fontWeight: 700 }}
                    >
                      {t.name[0]}
                    </div>
                  )}
                  <div>
                    <div className="font-body text-white text-sm" style={{ fontWeight: 700 }}>{t.name}</div>
                    <div className="font-body text-white/45 text-xs">{t.location ?? t.role ?? ""}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" aria-hidden>
                    <path d="M8 .5a5.5 5.5 0 1 0 0 11A5.5 5.5 0 0 0 8 .5zm-.75 8.25L5 6.5l.75-.75L7.25 7.2l3-3 .75.75z" fill="currentColor" style={{ color: "var(--brand-accent)" }} />
                  </svg>
                  <span className="font-body text-white/40 text-[0.65rem]">Verified</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {ctaText && (
          <div ref={ctaRef} className="text-center mt-12">
            <a href={business.phoneHref} className="btn-primary">{ctaText}</a>
          </div>
        )}
      </div>
    </section>
  )
}
