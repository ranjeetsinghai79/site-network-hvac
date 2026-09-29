"use client"

import { useEffect, useRef } from "react"
import { gsap, createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"
import type { SiteConfig } from "@core/web/types"

interface Props {
  config: SiteConfig
  videoSrc?: string
  posterSrc?: string
}

export function BarberHero({ config, videoSrc, posterSrc }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const bgRef      = useRef<HTMLDivElement>(null)
  const badgeRef   = useRef<HTMLDivElement>(null)
  const headRef    = useRef<HTMLHeadingElement>(null)
  const subRef     = useRef<HTMLParagraphElement>(null)
  const ctaRef     = useRef<HTMLDivElement>(null)
  const scrollRef  = useRef<HTMLDivElement>(null)
  const reduced    = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const scope = createScope()

    // ── Scroll-driven parallax on the video background ────────────────
    // bgRef is 130% tall so it can drift -23% without revealing edges
    if (bgRef.current && sectionRef.current) {
      const px = gsap.to(bgRef.current, {
        yPercent: -23,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 1.8,
        },
      })
      scope.add(px)
      if (px.scrollTrigger) scope.add(px.scrollTrigger)
    }

    // ── Content fades + drifts up on scroll ───────────────────────────
    const fadeEls = [badgeRef.current, headRef.current, subRef.current, ctaRef.current, scrollRef.current].filter(Boolean)
    if (fadeEls.length && sectionRef.current) {
      const fd = gsap.to(fadeEls, {
        opacity: 0, y: -40, stagger: 0.04, ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "12% top",
          end: "55% top",
          scrub: 1,
        },
      })
      scope.add(fd)
      if (fd.scrollTrigger) scope.add(fd.scrollTrigger)
    }

    // ── Cinematic entrance cascade ────────────────────────────────────
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
    if (badgeRef.current) {
      tl.from(badgeRef.current, { opacity: 0, y: -18, duration: 0.5 }, 0.25)
    }
    if (headRef.current) {
      const words = headRef.current.querySelectorAll<HTMLElement>(".hw")
      if (words.length) {
        tl.from(words, { yPercent: 115, opacity: 0, stagger: 0.06, duration: 0.9 }, "-=0.3")
      }
    }
    if (subRef.current) {
      tl.from(subRef.current, { opacity: 0, y: 22, duration: 0.65 }, "-=0.55")
    }
    if (scrollRef.current) {
      tl.from(scrollRef.current, { opacity: 0, duration: 0.5 }, "-=0.2")
    }
    scope.add(tl)

    return () => scope.kill()
  }, [reduced])

  const biz = config.business

  return (
    <section
      ref={sectionRef}
      id="home"
      style={{
        position: "relative",
        height: "100svh",
        minHeight: "620px",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* ── Video bg — taller than section for parallax drift ──────── */}
      <div
        ref={bgRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "130%",
          willChange: "transform",
          zIndex: 0,
        }}
      >
        {videoSrc ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            poster={posterSrc}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 30%",
              display: "block",
            }}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        ) : posterSrc ? (
          <img
            src={posterSrc}
            alt=""
            aria-hidden
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%", display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#0A0804" }} />
        )}

        {/* Cinematic dark overlays */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(10,8,4,0.5) 0%, rgba(10,8,4,0.28) 45%, rgba(10,8,4,0.72) 100%)",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 80% 60% at 30% 50%, rgba(201,169,110,0.06) 0%, transparent 70%)",
        }} />
        {/* Top letterbox */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "8px", background: "#0A0804" }} />
      </div>

      {/* ── Aurora blobs ──────────────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 1, pointerEvents: "none" }}>
        <div style={{
          position: "absolute", top: "15%", left: "5%",
          width: "550px", height: "550px",
          background: "var(--brand-blob-1)",
          filter: "blur(110px)",
          borderRadius: "50%",
          animation: "aurora-drift-h 14s ease-in-out infinite alternate",
        }} />
        <div style={{
          position: "absolute", bottom: "10%", right: "5%",
          width: "400px", height: "400px",
          background: "var(--brand-blob-2)",
          filter: "blur(130px)",
          borderRadius: "50%",
          animation: "aurora-drift-h 18s ease-in-out infinite alternate-reverse",
        }} />
      </div>

      {/* ── Hero content ──────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          textAlign: "center",
          padding: "0 1.5rem",
          maxWidth: "900px",
          width: "100%",
        }}
      >
        {/* Eyebrow badge */}
        <div
          ref={badgeRef}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.6rem",
            marginBottom: "2rem",
            padding: "0.38rem 1.1rem",
            background: "rgba(201,169,110,0.1)",
            border: "1px solid rgba(201,169,110,0.26)",
            borderRadius: "999px",
            fontSize: "0.62rem",
            fontWeight: 700,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: "var(--brand-accent)",
            fontFamily: "var(--font-body)",
            backdropFilter: "blur(10px)",
          }}
        >
          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--brand-accent)", flexShrink: 0 }} />
          Est. {biz.since} · {biz.city}, California
          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--brand-accent)", flexShrink: 0 }} />
        </div>

        {/* Headline — pre-split for SSR-safe word animation */}
        <h1
          ref={headRef}
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(3.2rem, 9vw, 7rem)",
            fontWeight: 700,
            fontStyle: "italic",
            color: "var(--brand-fg)",
            lineHeight: 1.0,
            letterSpacing: "-0.025em",
            marginBottom: "1.75rem",
          }}
        >
          {biz.tagline.split(" ").map((word, i) => (
            <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom" }}>
              <span className="hw" style={{ display: "inline-block" }}>{word}</span>
              {i < biz.tagline.split(" ").length - 1 && <>&nbsp;</>}
            </span>
          ))}
        </h1>

        {/* Subheading */}
        <p
          ref={subRef}
          style={{
            fontSize: "clamp(0.88rem, 1.8vw, 1.05rem)",
            color: "rgba(255,255,255,0.68)",
            lineHeight: 1.75,
            fontFamily: "var(--font-body)",
            fontWeight: 300,
            maxWidth: "500px",
            margin: "0 auto 3rem",
            letterSpacing: "0.01em",
          }}
        >
          Tracy's premier barbershop since {biz.since}. Precision fades, classic cuts &amp; hot towel shaves. Walk-ins always welcome.
        </p>

        {/* CTAs */}
        <div
          ref={ctaRef}
          style={{
            display: "flex",
            gap: "0.875rem",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <a
            href="#services"
            className="hero-cta-a"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.95rem 2.6rem",
              background: "var(--brand-accent)",
              color: "#0A0804",
              fontFamily: "var(--font-body)",
              fontWeight: 700,
              fontSize: "0.75rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              textDecoration: "none",
              borderRadius: "999px",
              boxShadow: "0 0 40px rgba(201,169,110,0.28), 0 4px 24px rgba(0,0,0,0.4)",
              transition: "transform 0.22s ease",
              animation: "cta-enter 0.55s ease 1.15s both",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.opacity = "0.9" }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.opacity = "1" }}
          >
            View Pricing
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </a>
          <a
            href={biz.phoneHref}
            className="hero-cta-a"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.95rem 2.6rem",
              background: "transparent",
              color: "rgba(255,255,255,0.88)",
              border: "1px solid rgba(255,255,255,0.18)",
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              fontSize: "0.75rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              textDecoration: "none",
              borderRadius: "999px",
              backdropFilter: "blur(8px)",
              transition: "border-color 0.22s ease, background 0.22s ease",
              animation: "cta-enter 0.55s ease 1.28s both",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(201,169,110,0.4)"; e.currentTarget.style.background = "rgba(201,169,110,0.07)" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.background = "transparent" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.42 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 17z"/>
            </svg>
            {biz.phone}
          </a>
        </div>

        {/* Trust strip */}
        <div style={{
          marginTop: "2.5rem",
          display: "flex",
          justifyContent: "center",
          gap: "1.5rem",
          flexWrap: "wrap",
          opacity: 0.55,
        }}>
          {(config.trustBadges ?? ["Licensed Barbers", "Walk-Ins Welcome", "5-Star Rated"]).slice(0, 4).map((badge) => (
            <span
              key={badge}
              style={{
                fontSize: "0.6rem",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                fontFamily: "var(--font-body)",
                color: "var(--brand-fg)",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "var(--brand-accent)", opacity: 0.8 }} />
              {badge}
            </span>
          ))}
        </div>
      </div>

      {/* ── Scroll indicator ──────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        style={{
          position: "absolute",
          bottom: "2.25rem",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.45rem",
          zIndex: 2,
        }}
      >
        <span style={{
          fontSize: "0.55rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.3)",
          fontFamily: "var(--font-body)",
        }}>
          Scroll
        </span>
        <div style={{
          width: "1px",
          height: "48px",
          background: "linear-gradient(to bottom, rgba(201,169,110,0.65), transparent)",
          animation: "scroll-line-pulse 2s ease-in-out infinite",
        }} />
      </div>

      <style>{`
        @keyframes aurora-drift-h {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(25px, -18px) scale(1.07); }
        }
        @keyframes scroll-line-pulse {
          0%, 100% { opacity: 0.35; transform: scaleY(1); transform-origin: top; }
          50%       { opacity: 1;   transform: scaleY(0.65); transform-origin: top; }
        }
        @keyframes cta-enter {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-cta-a { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
    </section>
  )
}
