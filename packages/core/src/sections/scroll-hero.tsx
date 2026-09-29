"use client"

import { useEffect, useRef } from "react"
import { Phone, ArrowRight, CheckCircle } from "lucide-react"
import type { SiteConfig } from "../types"
import { gsap, ScrollTrigger } from "../lib/gsap-init"
import { createScope } from "../lib/kill-scope"
import { useReducedMotion } from "../hooks/use-reduced-motion"
import { SplitText } from "../effects/split-text"
import { AuroraBlobs } from "../effects/aurora-blobs"

/**
 * ScrollHero — premium scroll-scrubbed video hero.
 *
 * Parent is 220svh tall. Child sticks at top:0. Kling-generated MP4 is paused
 * and scrubbed by scroll progress (never autoplay/loop). Text beats fade in as
 * the user scrolls through the pinned section.
 *
 * Reduced-motion: collapses to single-screen still + standard layout.
 *
 * Used by: premium tier sites after client upgrades.
 * Requires: videoSrc (Kling MP4), posterSrc (hero-1.jpg fallback)
 */

interface Props {
  config: SiteConfig
  videoSrc: string
  posterSrc?: string
}

export function ScrollHero({ config, videoSrc, posterSrc }: Props) {
  const { business, trustBadges } = config
  const reduced = useReducedMotion()

  const wrapRef    = useRef<HTMLDivElement>(null)
  const stickyRef  = useRef<HTMLDivElement>(null)
  const videoRef   = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const badgeRef   = useRef<HTMLDivElement>(null)
  const headRef    = useRef<HTMLDivElement>(null)
  const subRef     = useRef<HTMLParagraphElement>(null)
  const ctaRef     = useRef<HTMLDivElement>(null)
  const trustRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reduced || !videoRef.current || !wrapRef.current) return
    const video = videoRef.current

    // Scrub video.currentTime from scroll progress — never autoplay
    video.pause()
    const onMeta = () => {
      const handler = () => {
        const wrap = wrapRef.current!
        const rect = wrap.getBoundingClientRect()
        const total = wrap.offsetHeight - window.innerHeight
        const progress = Math.max(0, Math.min(1, -rect.top / total))
        if (video.duration) video.currentTime = video.duration * progress
      }
      window.addEventListener("scroll", handler, { passive: true })
      return handler
    }
    let scrollHandler: (() => void) | undefined
    if (video.readyState >= 1) {
      scrollHandler = onMeta()
    } else {
      video.addEventListener("loadedmetadata", () => { scrollHandler = onMeta() }, { once: true })
    }

    // Text beats driven by ScrollTrigger — fade in at 20 / 45 / 65 / 80% scroll
    const scope = createScope()
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger:   wrapRef.current,
        start:     "top top",
        end:       "bottom bottom",
        scrub:     0.5,
      },
    })

    tl.from(badgeRef.current,  { opacity: 0, y: -10, duration: 0.15 }, 0.05)
      .from(headRef.current,   { opacity: 0, y: 24,  duration: 0.2  }, 0.15)
      .from(subRef.current,    { opacity: 0, y: 16,  duration: 0.15 }, 0.35)
      .from(ctaRef.current,    { opacity: 0, y: 12,  duration: 0.15 }, 0.50)
      .from(trustRef.current,  { opacity: 0,         duration: 0.12 }, 0.65)

    scope.add(tl)
    ScrollTrigger.refresh()

    return () => {
      scope.kill()
      if (scrollHandler) window.removeEventListener("scroll", scrollHandler)
    }
  }, [reduced])

  // Reduced-motion: render flat single-screen hero with poster still
  if (reduced) {
    return (
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {posterSrc && (
          <img src={posterSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-brand-bg)]/90 to-black/60" />
        <AuroraBlobs />
        <FlatContent business={business} trustBadges={trustBadges} />
      </section>
    )
  }

  return (
    // Outer wrapper sets scroll track height (220svh = ~2.2 screens of scroll travel)
    <div ref={wrapRef} className="scroll-hero relative" style={{ minHeight: "220svh" }}>
      {/* Sticky stage — stays pinned while parent scrolls */}
      <div
        ref={stickyRef}
        className="sticky top-0 h-screen overflow-hidden"
      >
        {/* Kling video — paused, scrubbed by scroll */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          src={videoSrc}
          poster={posterSrc}
          muted
          playsInline
          preload="auto"
        />

        {/* Gradient overlay — light enough not to muddy the video */}
        <div
          ref={overlayRef}
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, var(--color-brand-bg)/75 0%, transparent 55%, var(--color-brand-bg)/40 100%)",
          }}
        />
        <AuroraBlobs />

        {/* Content — positioned left-center */}
        <div className="relative z-10 h-full flex items-center">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 w-full">
            <div className="max-w-2xl">
              {/* Pulse badge */}
              <div ref={badgeRef} className="inline-flex items-center gap-2 mb-6">
                <span className="w-2 h-2 rounded-full bg-[var(--color-brand-accent)] animate-pulse" />
                <span className="text-sm font-600 text-[var(--color-brand-accent)] tracking-widest uppercase">
                  {business.city} • Premium Service
                </span>
              </div>

              {/* Headline */}
              <div ref={headRef}>
                <SplitText
                  as="h1"
                  className="text-5xl lg:text-7xl font-900 leading-[1.05] text-white mb-6"
                >
                  {business.tagline}
                </SplitText>
              </div>

              {/* Subline */}
              <p
                ref={subRef}
                className="text-lg text-white/70 mb-10 leading-relaxed max-w-lg"
              >
                {business.name} — serving {business.city} with unmatched quality.
              </p>

              {/* CTAs */}
              <div ref={ctaRef} className="flex flex-wrap gap-4 mb-12">
                <a
                  href={business.phoneHref}
                  className="btn-primary inline-flex items-center gap-2 px-8 py-4 text-base font-700"
                >
                  <Phone className="w-4 h-4" />
                  {business.phone}
                </a>
                <a
                  href="#contact"
                  className="inline-flex items-center gap-2 px-8 py-4 text-base font-600 border border-white/30 text-white rounded-full hover-lift"
                >
                  Get Free Quote
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>

              {/* Trust badges */}
              {trustBadges && trustBadges.length > 0 && (
                <div ref={trustRef} className="flex flex-wrap gap-3">
                  {trustBadges.slice(0, 4).map((b, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 text-xs text-white/60 bg-white/5 border border-white/10 rounded-full px-3 py-1.5"
                    >
                      <CheckCircle className="w-3 h-3 text-[var(--color-brand-accent)] shrink-0" />
                      {b}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/30">
          <span className="text-xs tracking-widest uppercase">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-white/30 to-transparent animate-pulse" />
        </div>
      </div>
    </div>
  )
}

// ─── Reduced-motion flat layout ──────────────────────────────────────────────

function FlatContent({ business, trustBadges }: Pick<SiteConfig, "business" | "trustBadges">) {
  return (
    <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 py-32">
      <div className="max-w-2xl">
        <h1 className="text-5xl lg:text-7xl font-900 text-white mb-6">{business.tagline}</h1>
        <p className="text-lg text-white/70 mb-10">{business.name} — {business.city}</p>
        <div className="flex flex-wrap gap-4 mb-10">
          <a href={business.phoneHref} className="btn-primary inline-flex items-center gap-2 px-8 py-4">
            <Phone className="w-4 h-4" />
            {business.phone}
          </a>
          <a href="#contact" className="inline-flex items-center gap-2 px-8 py-4 border border-white/30 text-white rounded-full">
            Get Free Quote <ArrowRight className="w-4 h-4" />
          </a>
        </div>
        {trustBadges && trustBadges.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {trustBadges.slice(0, 4).map((b, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-white/60 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
                <CheckCircle className="w-3 h-3 text-[var(--color-brand-accent)] shrink-0" />
                {b}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

