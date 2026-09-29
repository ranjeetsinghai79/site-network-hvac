"use client"

import { useEffect, useRef } from "react"
import { gsap } from "@core/web"
import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

export default function HvacHero({ config }: Props) {
  const { business } = config
  const sectionRef  = useRef<HTMLElement>(null)
  const labelRef    = useRef<HTMLDivElement>(null)
  const h1Ref       = useRef<HTMLHeadingElement>(null)
  const paraRef     = useRef<HTMLParagraphElement>(null)
  const ctaRef      = useRef<HTMLDivElement>(null)
  const trustRef    = useRef<HTMLDivElement>(null)
  const imgARef     = useRef<HTMLDivElement>(null)
  const imgBRef     = useRef<HTMLDivElement>(null)

  const TRUST = [
    { label: `${business.google_rating}★ Google` },
    { label: `${business.review_count} Reviews` },
    { label: "24/7 Emergency" },
    { label: "Upfront Pricing" },
  ]

  useEffect(() => {
    const words = h1Ref.current?.querySelectorAll<HTMLElement>(".split-word")

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
    tl.from(labelRef.current, { opacity: 0, y: -16, duration: 0.45 })
      .from(words ?? [],       { yPercent: 120, opacity: 0, stagger: 0.04, duration: 0.7 }, "-=0.25")
      .from(paraRef.current,   { opacity: 0, y: 16, duration: 0.5 }, "-=0.35")
      .from(ctaRef.current,    { opacity: 0, y: 14, duration: 0.5 }, "-=0.32")
      .from(trustRef.current,  { opacity: 0, y: 10, duration: 0.4 }, "-=0.28")
      .from(imgARef.current,   { opacity: 0, x: 60, rotate: 8, duration: 0.85, ease: "power4.out" }, "-=0.9")
      .from(imgBRef.current,   { opacity: 0, x: 40, y: 40, rotate: -6, duration: 0.85, ease: "power4.out" }, "-=0.65")

    const bar = document.querySelector<HTMLElement>(".scroll-progress-bar")
    const onScroll = () => {
      const pct = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      if (bar) bar.style.setProperty("--scroll-pct", String(pct))
    }
    window.addEventListener("scroll", onScroll, { passive: true })

    return () => {
      window.removeEventListener("scroll", onScroll)
      tl.kill()
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden"
      style={{ background: "var(--brand-bg)" }}
    >
      <div className="scroll-progress-bar" />

      {/* Soft color blobs */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{ width: 600, height: 600, top: "-15%", right: "-10%", background: "var(--brand-blob-1)", filter: "blur(90px)" }}
      />
      <div
        className="absolute rounded-full pointer-events-none"
        style={{ width: 420, height: 420, bottom: "-10%", left: "-8%", background: "var(--brand-blob-2)", filter: "blur(90px)" }}
      />

      <div className="h-20" />

      <div className="relative max-w-[1400px] mx-auto px-6 lg:px-12 xl:px-16 pt-10 pb-24 lg:pb-32">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-16 items-center">

          {/* ── Left: copy ── */}
          <div>
            <div ref={labelRef} className="mb-6">
              <span
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-body font-600"
                style={{
                  background: "rgba(79,70,229,0.08)",
                  border: "1px solid rgba(79,70,229,0.22)",
                  color: "var(--brand-accent)",
                  letterSpacing: "0.1em",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--brand-accent)" }} />
                {business.city} · HVAC, DONE RIGHT
              </span>
            </div>

            <h1
              ref={h1Ref}
              className="font-display font-700"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(3rem, 6.6vw, 5.6rem)",
                lineHeight: 0.98,
                letterSpacing: "-0.03em",
                color: "var(--brand-fg)",
              }}
            >
              {["Cool", "air.", "Warm", "welcome."].map((word, i) => (
                <span key={i} className="split-word-outer inline-block mr-4">
                  <span
                    className="split-word inline-block"
                    style={i === 1 || i === 3 ? { color: "var(--brand-accent)" } : {}}
                  >
                    {word}
                  </span>
                </span>
              ))}
            </h1>

            <p
              ref={paraRef}
              className="mt-7 leading-relaxed"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "clamp(1rem, 1.6vw, 1.15rem)",
                color: "var(--brand-fg-muted)",
                maxWidth: "48ch",
              }}
            >
              {business.review_count} real reviews, {business.google_rating}★ average. Fast diagnosis, fair pricing,
              and a team that actually answers the phone — {business.hours?.toLowerCase() ?? "every day"}.
            </p>

            <div ref={ctaRef} className="mt-9 flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
              <a
                href={business.phoneHref}
                className="btn-primary inline-flex items-center justify-center gap-3 px-8 py-4"
                style={{ fontSize: "1.02rem", minHeight: 56 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.003 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.85 6.85l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                </svg>
                Call {business.phone}
              </a>
              <a
                href="#contact"
                className="btn-ghost inline-flex items-center justify-center gap-3 px-8 py-4"
                style={{ fontSize: "1.02rem", minHeight: 56 }}
              >
                Request Service
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </a>
            </div>

            <div ref={trustRef} className="mt-9 flex flex-wrap gap-3">
              {TRUST.map(({ label }) => (
                <div
                  key={label}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs"
                  style={{
                    background: "var(--brand-bg-card)",
                    border: "1px solid var(--brand-border)",
                    color: "var(--brand-fg-muted)",
                    fontFamily: "var(--font-body)",
                    fontWeight: 600,
                  }}
                >
                  <span style={{ color: "var(--brand-accent)", fontSize: "0.85rem" }}>●</span>
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: zigzag photo stack ── */}
          <div className="relative hidden lg:block" style={{ minHeight: 480 }}>
            <div
              ref={imgARef}
              className="absolute rounded-2xl overflow-hidden"
              style={{
                width: "72%", aspectRatio: "4/5", top: 0, right: 0,
                transform: "rotate(4deg)",
                boxShadow: "0 30px 60px -20px rgba(11,14,26,0.25)",
                border: "6px solid #fff",
              }}
            >
              <img src="/hero-1.jpg" alt="" className="w-full h-full object-cover" />
            </div>
            <div
              ref={imgBRef}
              className="absolute rounded-2xl overflow-hidden"
              style={{
                width: "52%", aspectRatio: "4/3", bottom: 0, left: 0,
                transform: "rotate(-5deg)",
                boxShadow: "0 24px 48px -16px rgba(11,14,26,0.28)",
                border: "6px solid #fff",
                zIndex: 2,
              }}
            >
              <img src="/hero-2.jpg" alt="" className="w-full h-full object-cover" />
            </div>
            {/* Floating stat chip */}
            <div
              className="absolute rounded-xl px-5 py-4 z-10"
              style={{
                bottom: "18%", right: "4%",
                background: "var(--brand-fg)",
                boxShadow: "0 20px 40px -12px rgba(11,14,26,0.3)",
              }}
            >
              <p className="font-display font-700" style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", color: "#fff", lineHeight: 1 }}>
                {business.google_rating}★
              </p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem", color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
                {business.review_count} Google reviews
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Diagonal divider into next section — zigzag signature */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: 48, background: "var(--brand-bg-2)", clipPath: "polygon(0 100%, 100% 40%, 100% 100%)" }}
      />
    </section>
  )
}
