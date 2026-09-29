"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { gsap } from "@core/web"
import type { SiteConfig, Testimonial } from "@core/web/types"

interface Props { config: SiteConfig }

function StarRow({ n }: { n: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width="14" height="14"
          viewBox="0 0 24 24"
          fill={i < n ? "var(--brand-accent)" : "none"}
          stroke="var(--brand-accent)"
          strokeWidth="1.5"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </div>
  )
}

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

// Card-position transform — always shows left / center(active) / right, matching
// the 21st.dev "Circular Testimonials" pattern (maxim.bort.devel), rebuilt on GSAP
// (repo standard, no Framer Motion) with honest avatar-scale imagery — full-bleed
// portrait photography would misrepresent reviewers we only have small avatars for.
function getCardStyle(index: number, activeIndex: number, total: number, gap: number): React.CSSProperties {
  const isActive = index === activeIndex
  const isLeft   = (activeIndex - 1 + total) % total === index
  const isRight  = (activeIndex + 1) % total === index
  const base: React.CSSProperties = { transition: "all 0.7s cubic-bezier(.4,2,.3,1)" }

  if (isActive) return { ...base, zIndex: 3, opacity: 1, pointerEvents: "auto", transform: "translateX(0) scale(1) rotateY(0deg)" }
  if (isLeft)   return { ...base, zIndex: 2, opacity: 0.55, pointerEvents: "none", transform: `translateX(-${gap}px) scale(0.86) rotateY(18deg)` }
  if (isRight)  return { ...base, zIndex: 2, opacity: 0.55, pointerEvents: "none", transform: `translateX(${gap}px) scale(0.86) rotateY(-18deg)` }
  return { ...base, zIndex: 1, opacity: 0, pointerEvents: "none" }
}

function CircularTestimonials({ testimonials, autoplay = true, googleReviewsUrl }: { testimonials: Testimonial[]; autoplay?: boolean; googleReviewsUrl?: string }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const stageRef  = useRef<HTMLDivElement>(null)
  const quoteRef  = useRef<HTMLParagraphElement>(null)
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const total = testimonials.length
  const active = testimonials[activeIndex]

  useEffect(() => {
    if (!autoplay || total < 2) return
    autoplayRef.current = setInterval(() => setActiveIndex(p => (p + 1) % total), 5500)
    return () => { if (autoplayRef.current) clearInterval(autoplayRef.current) }
  }, [autoplay, total])

  const handleNext = useCallback(() => {
    setActiveIndex(p => (p + 1) % total)
    if (autoplayRef.current) clearInterval(autoplayRef.current)
  }, [total])
  const handlePrev = useCallback(() => {
    setActiveIndex(p => (p - 1 + total) % total)
    if (autoplayRef.current) clearInterval(autoplayRef.current)
  }, [total])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev()
      if (e.key === "ArrowRight") handleNext()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [handleNext, handlePrev])

  // Word-by-word quote reveal on change — GSAP, not Framer Motion
  useEffect(() => {
    if (!quoteRef.current) return
    const words = quoteRef.current.querySelectorAll<HTMLElement>(".word")
    gsap.fromTo(words,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.35, ease: "power2.out", stagger: 0.02 }
    )
  }, [activeIndex])

  if (!active) return null

  return (
    <div className="grid gap-10 md:grid-cols-2 items-center">
      {/* Card stage */}
      <div ref={stageRef} className="relative" style={{ height: 320, perspective: 1000 }}>
        {testimonials.map((t, i) => (
          <div
            key={t.name + i}
            className="absolute inset-0 flex items-center justify-center"
            style={getCardStyle(i, activeIndex, total, 90)}
          >
            <div
              className="w-full h-full rounded-2xl flex flex-col items-center justify-center gap-4 p-8"
              style={{
                background: "var(--brand-bg-2)",
                border: "1px solid color-mix(in srgb, var(--brand-fg) 8%, transparent)",
                boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
              }}
            >
              {t.avatar ? (
                <img
                  src={t.avatar}
                  alt={t.name}
                  width={84}
                  height={84}
                  className="rounded-full"
                  style={{ border: "3px solid var(--brand-accent)" }}
                />
              ) : (
                <div
                  className="w-[84px] h-[84px] rounded-full flex items-center justify-center font-display font-700"
                  style={{
                    background: "color-mix(in srgb, var(--brand-accent) 15%, transparent)",
                    border: "3px solid var(--brand-accent)",
                    color: "var(--brand-accent)",
                    fontFamily: "var(--font-display)",
                    fontSize: "1.75rem",
                  }}
                >
                  {t.name.charAt(0)}
                </div>
              )}
              <StarRow n={t.stars} />
              <GoogleG />
            </div>
          </div>
        ))}
      </div>

      {/* Quote content */}
      <div>
        <h3
          className="font-display font-700"
          style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", color: "var(--brand-fg)" }}
        >
          {active.name}
        </h3>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--brand-fg-muted)", marginBottom: "1.75rem" }}>
          {active.role ?? active.location ?? "Verified Customer"}
          {googleReviewsUrl && (
            <>
              {" · "}
              <a
                href={googleReviewsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--brand-accent)" }}
              >
                See all reviews on Google ↗
              </a>
            </>
          )}
        </p>
        <p
          ref={quoteRef}
          style={{ fontFamily: "var(--font-body)", fontSize: "1.05rem", lineHeight: 1.75, color: "color-mix(in srgb, var(--brand-fg) 82%, transparent)", fontStyle: "italic" }}
        >
          "{active.text.split(" ").map((w, i) => (
            <span key={i} className="word" style={{ display: "inline-block" }}>{w}&nbsp;</span>
          ))}"
        </p>

        <div className="flex gap-4 pt-8">
          <button
            onClick={handlePrev}
            aria-label="Previous testimonial"
            className="w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-colors"
            style={{ background: "var(--brand-bg-2)", border: "1px solid color-mix(in srgb, var(--brand-fg) 12%, transparent)", color: "var(--brand-fg)" }}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={handleNext}
            aria-label="Next testimonial"
            className="w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-colors"
            style={{ background: "var(--brand-accent)", border: "1px solid var(--brand-accent)", color: "#fff" }}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function HvacReviews({ config }: Props) {
  const testimonials = config.testimonials ?? []
  const sectionRef = useRef<HTMLElement>(null)
  const headRef    = useRef<HTMLDivElement>(null)
  const bodyRef    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!headRef.current || !bodyRef.current) return
    gsap.from(headRef.current, {
      opacity: 0, y: 30, duration: 0.7, ease: "power3.out",
      immediateRender: false,
      scrollTrigger: { trigger: headRef.current, start: "top 85%", once: true },
    })
    gsap.from(bodyRef.current, {
      opacity: 0, y: 40, duration: 0.8, ease: "power3.out",
      immediateRender: false,
      scrollTrigger: { trigger: bodyRef.current, start: "top 85%", once: true },
    })
  }, [])

  return (
    <section
      ref={sectionRef}
      id="reviews"
      className="relative py-24 lg:py-32 overflow-hidden"
      style={{ background: "var(--brand-bg-2)" }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--brand-accent) 25%, transparent), transparent)" }}
      />

      <div className="relative max-w-[1400px] mx-auto px-6 lg:px-12 xl:px-16">
        {/* Heading */}
        <div ref={headRef} className="mb-14 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <p className="section-label mb-3">Customer Reviews</p>
            <h2
              className="font-display font-700 uppercase"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2rem, 5vw, 4rem)",
                lineHeight: 0.95,
                color: "var(--brand-fg)",
                letterSpacing: "-0.02em",
              }}
            >
              Real People.
              <br />
              <span style={{ color: "var(--brand-accent)" }}>Real Results.</span>
            </h2>
          </div>

          <div
            className="flex items-center gap-5 px-6 py-4 rounded-xl shrink-0"
            style={{
              background: "color-mix(in srgb, var(--brand-accent) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--brand-accent) 20%, transparent)",
            }}
          >
            <div className="text-center">
              <div
                className="font-display font-700 tabular-nums"
                style={{ fontFamily: "var(--font-display)", fontSize: "2.5rem", lineHeight: 1, color: "var(--brand-accent)" }}
              >
                {config.business.google_rating}
              </div>
              <StarRow n={5} />
            </div>
            <div className="w-px self-stretch" style={{ background: "color-mix(in srgb, var(--brand-accent) 20%, transparent)" }} />
            <div className="text-left">
              <p className="font-display font-700" style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", color: "var(--brand-fg)" }}>
                {config.business.review_count}+
              </p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--brand-fg-muted)" }}>
                Google Reviews
              </p>
            </div>
          </div>
        </div>

        {/* Circular testimonials */}
        <div ref={bodyRef} className="rounded-2xl p-8 lg:p-14" style={{ background: "var(--brand-bg)", border: "1px solid color-mix(in srgb, var(--brand-fg) 6%, transparent)" }}>
          {testimonials.length > 0
            ? <CircularTestimonials testimonials={testimonials} autoplay googleReviewsUrl={config.business.social?.google} />
            : <p style={{ color: "var(--brand-fg-muted)" }}>Reviews coming soon.</p>}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9rem", color: "var(--brand-fg-muted)", marginBottom: 16 }}>
            Join {config.business.review_count}+ satisfied customers across {config.business.city ?? "the area"}
          </p>
          <a
            href={config.business.phoneHref}
            className="btn-primary inline-flex items-center gap-3 px-8 py-4"
            style={{ fontSize: "0.95rem" }}
          >
            Schedule Your Service
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>
        </div>
      </div>
    </section>
  )
}
