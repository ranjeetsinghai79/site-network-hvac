"use client"

import { useEffect, useRef } from "react"
import { Wrench, ArrowRight } from "lucide-react"
import type { SiteConfig } from "../types"
import { gsap, ScrollTrigger } from "../lib/gsap-init"
import { createScope } from "../lib/kill-scope"
import { useReducedMotion } from "../hooks/use-reduced-motion"
import { getIcon } from "./icon-map"

interface Props {
  config: SiteConfig
  /** "zigzag" alternates image/text full-width rows. "grid" is a card grid. "horizontal" pins + scrolls. Default: "grid". */
  layout?: "horizontal" | "grid" | "zigzag"
  label?: string
  heading?: React.ReactNode
  subheading?: string
  paragraph?: string
}

// ── Zigzag row ──────────────────────────────────────────────────────────────

function ZigzagRow({
  service,
  idx,
  reduced,
}: {
  service: SiteConfig["services"] extends (infer S)[] | undefined ? S : never
  idx: number
  reduced: boolean
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reduced) {
      gsap.set([imgRef.current, contentRef.current].filter(Boolean), { opacity: 1, x: 0, y: 0 })
      return
    }
    const scope = createScope()
    const isEven = idx % 2 === 0

    const img = gsap.fromTo(imgRef.current,
      { opacity: 0, x: isEven ? -50 : 50 },
      { opacity: 1, x: 0, duration: 0.85, ease: "power3.out",
        scrollTrigger: { trigger: rowRef.current, start: "top 85%", once: true } },
    )
    scope.add(img)
    if (img.scrollTrigger) scope.add(img.scrollTrigger)

    const content = gsap.fromTo(contentRef.current,
      { opacity: 0, x: isEven ? 50 : -50 },
      { opacity: 1, x: 0, duration: 0.85, ease: "power3.out",
        scrollTrigger: { trigger: rowRef.current, start: "top 85%", once: true } },
    )
    scope.add(content)
    if (content.scrollTrigger) scope.add(content.scrollTrigger)

    return () => scope.kill()
  }, [reduced, idx])

  const isEven = idx % 2 === 0
  const imgSrc = (service as any).image || null
  const hasImage = !!imgSrc

  return (
    <div
      ref={rowRef}
      className={`flex flex-col ${isEven ? "lg:flex-row" : "lg:flex-row-reverse"} gap-0 items-stretch`}
      style={{ borderBottom: "1px solid var(--brand-card-border)" }}
    >
      {/* Image half */}
      <div
        ref={imgRef}
        className="relative lg:w-1/2 overflow-hidden"
        style={{ minHeight: "340px" }}
      >
        {hasImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc}
              alt={(service as any).title}
              className="w-full h-full object-cover transition-transform duration-700"
              style={{ position: "absolute", inset: 0 }}
            />
            {/* Gradient overlay toward content side */}
            <div
              className="absolute inset-0"
              style={{
                background: isEven
                  ? "linear-gradient(to right, transparent 55%, color-mix(in srgb, var(--brand-bg) 60%, transparent) 100%)"
                  : "linear-gradient(to left, transparent 55%, color-mix(in srgb, var(--brand-bg) 60%, transparent) 100%)",
              }}
            />
          </>
        ) : (
          /* No-image fallback: accent-tinted bg + centered icon ring */
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-4"
            style={{ background: "color-mix(in srgb, var(--brand-accent) 6%, var(--brand-bg-section))" }}
          >
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center"
              style={{
                background: "color-mix(in srgb, var(--brand-accent) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--brand-accent) 28%, transparent)",
                color: "var(--brand-accent)",
              }}
            >
              {getIcon((service as any).icon, "w-12 h-12") ?? <Wrench className="w-12 h-12" />}
            </div>
          </div>
        )}
        {/* Urgent badge */}
        {(service as any).urgent && (
          <span
            className="absolute top-5 left-5 font-body text-white text-[0.6rem] font-bold px-3 py-1 rounded-full tracking-wider"
            style={{ background: "var(--brand-accent)" }}
          >
            24/7
          </span>
        )}
        {/* Index number watermark */}
        <div
          className="absolute bottom-4 right-5 font-display tabular-nums select-none"
          style={{
            color: hasImage ? "rgba(255,255,255,0.12)" : "color-mix(in srgb, var(--brand-accent) 8%, transparent)",
            fontFamily: "var(--font-display)",
            fontWeight: 900,
            fontSize: "5rem",
            lineHeight: 1,
          }}
          aria-hidden
        >
          {String(idx + 1).padStart(2, "0")}
        </div>
      </div>

      {/* Content half */}
      <div
        ref={contentRef}
        className="lg:w-1/2 flex flex-col justify-center px-10 py-12"
        style={{ background: "var(--brand-bg)" }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
          style={{
            background: "color-mix(in srgb, var(--brand-accent) 12%, transparent)",
            color: "var(--brand-accent)",
            border: "1px solid color-mix(in srgb, var(--brand-accent) 22%, transparent)",
          }}
        >
          {getIcon((service as any).icon, "w-5 h-5") ?? <Wrench className="w-5 h-5" />}
        </div>

        <h3
          className="font-display text-white mb-3"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "clamp(1.25rem, 2vw, 1.6rem)",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}
        >
          {(service as any).title}
        </h3>

        <p
          className="font-body text-white/65 leading-relaxed mb-6"
          style={{ fontSize: "1rem", maxWidth: "30rem" }}
        >
          {(service as any).desc}
        </p>

        {(service as any).meta && (
          <p className="font-body text-sm font-semibold mb-5" style={{ color: "var(--brand-accent)" }}>
            {(service as any).meta}
          </p>
        )}

        <a
          href="#contact"
          className="flex items-center gap-2 hover-lift w-fit"
          style={{ color: "var(--brand-accent)", textDecoration: "none" }}
        >
          <span className="font-body text-sm font-semibold">Get a Free Estimate</span>
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function Services({
  config,
  layout = "grid",
  label = "What We Do",
  heading,
  subheading,
  paragraph,
}: Props) {
  const services = config.services ?? []

  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (layout === "zigzag") return // ZigzagRow handles its own animations
    const section = sectionRef.current
    const track = trackRef.current
    if (!section || !track) return

    if (reduced) {
      gsap.set([headingRef.current, ...track.querySelectorAll(".service-card")].filter(Boolean), { opacity: 1, y: 0 })
      return
    }

    const scope = createScope()
    const mm = gsap.matchMedia()

    if (layout === "horizontal") {
      mm.add("(min-width: 1024px)", () => {
        const getScrollAmount = () => -(track.scrollWidth - window.innerWidth)
        const tween = gsap.to(track, {
          x: getScrollAmount,
          ease: "none",
          scrollTrigger: {
            trigger: section, pin: true, start: "top top",
            end: () => `+=${Math.abs(getScrollAmount())}`,
            scrub: 1.2, invalidateOnRefresh: true,
            onUpdate: (self) => {
              if (progressRef.current) progressRef.current.style.width = `${self.progress * 100}%`
            },
          },
        })
        scope.add(tween)
        if (tween.scrollTrigger) scope.add(tween.scrollTrigger)
      })

      mm.add("(max-width: 1023px)", () => {
        const cards = track.querySelectorAll<HTMLElement>(".service-card")
        if (cards.length) {
          const t = gsap.from(cards, {
            opacity: 0, y: 60, scale: 0.92, stagger: 0.07, duration: 0.7, ease: "power3.out",
            scrollTrigger: { trigger: track, start: "top 82%", once: true },
          })
          scope.add(t)
          if (t.scrollTrigger) scope.add(t.scrollTrigger)
        }
      })
    } else {
      const headingTween = gsap.from(headingRef.current, {
        opacity: 0, y: 32, duration: 0.6, ease: "power3.out",
        scrollTrigger: { trigger: section, start: "top 90%", once: true },
      })
      scope.add(headingTween)
      if (headingTween.scrollTrigger) scope.add(headingTween.scrollTrigger)

      const cards = track.querySelectorAll<HTMLElement>(".service-card")
      if (cards.length) {
        const t = gsap.from(cards, {
          opacity: 0, y: 48, scale: 0.95, stagger: 0.08, duration: 0.65, ease: "power3.out",
          scrollTrigger: { trigger: track, start: "top 85%", once: true },
        })
        scope.add(t)
        if (t.scrollTrigger) scope.add(t.scrollTrigger)
      }
    }

    return () => { scope.kill(); mm.revert() }
  }, [reduced, layout, services.length])

  // ── Zigzag render ───────────────────────────────────────────────────────
  if (layout === "zigzag") {
    return (
      <section
        ref={sectionRef}
        id="services"
        className="relative overflow-hidden"
        style={{ background: "var(--brand-bg)" }}
      >
        {/* Section heading */}
        <div className="text-center pt-20 pb-12 px-5" ref={headingRef}>
          <span className="section-label">{label}</span>
          <h2
            className="font-display text-white"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 4vw, 3.25rem)",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              fontWeight: 900,
            }}
          >
            {heading ?? <>What We <span style={{ color: "var(--brand-accent)" }}>Do</span></>}
          </h2>
          {paragraph && (
            <p className="font-body text-white/55 max-w-xl mx-auto leading-relaxed text-lg mt-4">
              {paragraph}
            </p>
          )}
        </div>

        {/* Zigzag rows */}
        <div style={{ borderTop: "1px solid var(--brand-card-border)" }}>
          {services.map((service, idx) => (
            <ZigzagRow key={(service as any).title} service={service as any} idx={idx} reduced={reduced} />
          ))}
        </div>
      </section>
    )
  }

  // ── Grid / Horizontal render ─────────────────────────────────────────────
  return (
    <section
      ref={sectionRef}
      id="services"
      className="relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, var(--brand-bg) 0%, color-mix(in srgb, var(--brand-bg) 85%, #000) 100%)",
        minHeight: layout === "horizontal" ? "100vh" : "auto",
        padding: layout === "grid" ? "6rem 0" : undefined,
      }}
    >
      <div className="relative z-10 max-w-[none] mx-auto">
        <div ref={headingRef} className="text-center pt-20 pb-12 px-5">
          <span className="section-label">{label}</span>
          <h2
            className="font-display text-white mb-5"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 4vw, 3.25rem)",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              fontWeight: 900,
            }}
          >
            {heading ?? <>What We <span style={{ color: "var(--brand-accent)" }}>Do</span></>}
            {subheading && <><br /><span style={{ color: "var(--brand-accent)" }}>{subheading}</span></>}
          </h2>
          {paragraph && (
            <p className="font-body text-white/55 max-w-xl mx-auto leading-relaxed text-lg">{paragraph}</p>
          )}
          {layout === "horizontal" && (
            <>
              <div className="hidden lg:block mt-8 max-w-xs mx-auto h-[2px] bg-white/10 rounded-full overflow-hidden">
                <div
                  ref={progressRef}
                  className="h-full rounded-full transition-none"
                  style={{ width: "0%", background: "linear-gradient(90deg, var(--brand-accent), var(--brand-accent-light))" }}
                />
              </div>
              <p className="hidden lg:block mt-3 text-white/30 text-xs font-body tracking-widest">scroll to explore →</p>
            </>
          )}
        </div>

        <div
          ref={trackRef}
          className={`flex gap-8 px-5 pb-20 ${
            layout === "horizontal"
              ? "lg:flex-nowrap lg:justify-start lg:pl-[max(8rem,calc(50vw-560px))] lg:pr-[max(8rem,calc(50vw-560px))] flex-wrap justify-center"
              : "flex-wrap justify-center max-w-7xl mx-auto"
          }`}
        >
          {services.map((service, idx) => (
            <div
              key={(service as any).title}
              className="service-card group relative rounded-2xl flex-shrink-0 overflow-hidden hover-lift"
              style={{
                width: layout === "horizontal" ? "clamp(280px, 340px, 380px)" : "min(340px, 100%)",
                background: "var(--brand-card-bg)",
                border: (service as any).urgent
                  ? "1px solid color-mix(in srgb, var(--brand-accent) 40%, transparent)"
                  : "1px solid var(--brand-card-border)",
                boxShadow: (service as any).urgent
                  ? "0 0 32px -8px color-mix(in srgb, var(--brand-accent) 20%, transparent), var(--shadow-card)"
                  : "var(--shadow-card)",
                transition: "border-color 0.3s ease, box-shadow 0.35s ease, transform 0.35s ease",
              }}
            >
              {(service as any).urgent && (
                <div className="absolute left-0 top-6 bottom-6 w-0.5 rounded-full" style={{ background: "var(--brand-accent)" }} />
              )}
              {(service as any).image && (
                <div
                  className="relative overflow-hidden rounded-t-2xl"
                  style={{ height: "160px", margin: "-1px -1px 0 -1px" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={(service as any).image}
                    alt={(service as any).title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(to bottom, transparent 45%, var(--brand-card-bg) 100%)" }}
                  />
                </div>
              )}
              <div className="p-7 flex flex-col h-full">
                <div className={`flex items-start justify-between ${(service as any).image ? 'mb-4' : 'mb-6'}`}>
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{
                      background: "color-mix(in srgb, var(--brand-accent) 12%, transparent)",
                      color: "var(--brand-accent)",
                      border: "1px solid color-mix(in srgb, var(--brand-accent) 20%, transparent)",
                    }}
                  >
                    {getIcon((service as any).icon, "w-5 h-5") ?? <Wrench className="w-5 h-5" />}
                  </div>
                  <span
                    aria-hidden
                    className="font-display tabular-nums select-none"
                    style={{ color: "var(--brand-fg-ghost)", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "2.25rem", lineHeight: 1 }}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                </div>
                {(service as any).urgent && (
                  <span className="font-body text-white text-[0.6rem] font-bold px-2.5 py-1 rounded-full tracking-wider mb-3 w-fit" style={{ background: "var(--brand-accent)" }}>
                    24/7
                  </span>
                )}
                <h3 className="font-display mb-3" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem", color: "var(--brand-fg)", letterSpacing: "-0.01em" }}>
                  {(service as any).title}
                </h3>
                <p className="font-body text-sm leading-relaxed flex-1" style={{ color: "var(--brand-fg-muted)" }}>
                  {(service as any).desc}
                </p>
                {(service as any).meta && (
                  <p className="font-body text-xs mt-4 font-semibold" style={{ color: "var(--brand-accent)" }}>
                    {(service as any).meta}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
