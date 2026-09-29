"use client"

import { useEffect, useRef, useState } from "react"
import { gsap } from "@core/web/lib"
import { createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"
import type { SiteConfig } from "@core/web/types"

const GOALS = [
  {
    icon: "🎯",
    label: "Retire Early",
    target: "Target $2.5M by age 60",
    detail: "Avg client retires 4.2 years earlier",
  },
  {
    icon: "📈",
    label: "Grow Investments",
    target: "Avg return: 11.3%/yr",
    detail: "Fee-only portfolios outperform by 1.8% annually",
  },
  {
    icon: "🛡",
    label: "Protect Family",
    target: "Coverage gap analysis — free",
    detail: "We shop 40+ carriers for the best rate",
  },
  {
    icon: "📋",
    label: "Tax Strategy",
    target: "Avg client saves $8,200/yr",
    detail: "Roth conversions, harvesting, business deductions",
  },
]

interface Props { config: SiteConfig; posterSrc?: string }

export default function FinancialAdvisorHero({ config, posterSrc = "/hero-1.jpg" }: Props) {
  const { business } = config
  const sectionRef  = useRef<HTMLElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const labelRef    = useRef<HTMLDivElement>(null)
  const headRef     = useRef<HTMLHeadingElement>(null)
  const paraRef     = useRef<HTMLParagraphElement>(null)
  const ctaRef      = useRef<HTMLDivElement>(null)
  const trustRef    = useRef<HTMLDivElement>(null)
  const widgetRef   = useRef<HTMLDivElement>(null)
  const imgRef      = useRef<HTMLImageElement>(null)
  const reduced     = useReducedMotion()
  const [active, setActive] = useState(0)

  // Particle canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || reduced) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let raf: number
    const particles: { x: number; y: number; r: number; vx: number; vy: number; o: number }[] = []
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener("resize", resize)
    for (let i = 0; i < 55; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.4 + 0.4,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        o: Math.random() * 0.6 + 0.15,
      })
    }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(201,165,90,${p.o})`
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize) }
  }, [reduced])

  // GSAP entrance
  useEffect(() => {
    if (reduced) return
    const scope = createScope()
    const el = headRef.current
    const words = el ? Array.from(el.querySelectorAll<HTMLElement>(".fa-word-inner")) : []
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
    if (labelRef.current)  tl.from(labelRef.current,  { opacity: 0, x: -28, duration: 0.45 })
    if (words.length)      tl.from(words, { yPercent: 115, opacity: 0, stagger: 0.042, duration: 0.72 }, "-=0.3")
    if (paraRef.current)   tl.from(paraRef.current,   { opacity: 0, y: 22, duration: 0.6 }, "-=0.55")
    if (ctaRef.current)    tl.from(ctaRef.current,    { opacity: 0, y: 18, duration: 0.55 }, "-=0.48")
    if (trustRef.current)  tl.from(trustRef.current,  { opacity: 0, y: 10, duration: 0.45 }, "-=0.4")
    if (widgetRef.current) tl.from(widgetRef.current, { opacity: 0, x: 48, duration: 0.7, ease: "expo.out" }, "-=0.9")
    scope.add(tl)
    return () => scope.kill()
  }, [reduced])

  // Hero image parallax
  useEffect(() => {
    if (reduced || !imgRef.current || !sectionRef.current) return
    const scope = createScope()
    const t = gsap.to(imgRef.current, {
      yPercent: -22, ease: "none",
      scrollTrigger: { trigger: sectionRef.current, start: "top top", end: "bottom top", scrub: 1.5 },
    })
    scope.add(t); if (t.scrollTrigger) scope.add(t.scrollTrigger)
    return () => scope.kill()
  }, [reduced])

  const goal = GOALS[active]

  return (
    <section ref={sectionRef} className="fa-hero-section" style={{ position: "relative", minHeight: "100svh", display: "flex", alignItems: "center", overflow: "hidden", background: "var(--brand-bg, #080C12)" }}>
      {/* Poster */}
      <img ref={imgRef} src={posterSrc} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "115%", objectFit: "cover", objectPosition: "center", opacity: 0.28, willChange: "transform" }} />

      {/* Gradient overlay */}
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, rgba(8,12,18,0.97) 0%, rgba(8,12,18,0.75) 55%, rgba(8,12,18,0.4) 100%)" }} />

      {/* Aurora blobs */}
      <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div className="fa-blob-1" style={{ position: "absolute", top: "20%", left: "8%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(201,165,90,0.10) 0%, transparent 70%)", filter: "blur(72px)", animation: "fa-aurora 7s ease-in-out infinite alternate" }} />
        <div className="fa-blob-2" style={{ position: "absolute", bottom: "15%", right: "12%", width: 440, height: 440, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(80,110,170,0.08) 0%, transparent 70%)", filter: "blur(72px)", animation: "fa-aurora 9s ease-in-out infinite alternate-reverse" }} />
      </div>

      {/* Particle canvas */}
      <canvas ref={canvasRef} aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 1240, margin: "0 auto", padding: "7rem 2rem 5rem", display: "grid", gridTemplateColumns: "1fr auto", gap: "4rem", alignItems: "center" }}>

        {/* Left: copy */}
        <div>
          <div ref={labelRef} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(201,165,90,0.1)", border: "1px solid rgba(201,165,90,0.25)", borderRadius: 20, padding: "0.3rem 0.9rem", marginBottom: "1.5rem" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C9A55A", display: "inline-block" }} />
            <span style={{ fontFamily: "var(--font-body)", fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: "#C9A55A" }}>CFP® · Fiduciary · Fee-Only</span>
          </div>

          <h1 ref={headRef} style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.4rem, 5vw, 4rem)", fontWeight: 700, lineHeight: 1.1, color: "#E8E0D0", marginBottom: "1.5rem", overflow: "hidden" }}>
            {["Your Wealth.", "Your Legacy.", "Our Mission."].map((line, li) => (
              <span key={li} style={{ display: "block", overflow: "hidden" }}>
                {line.split(" ").map((w, wi) => (
                  <span key={wi} style={{ display: "inline-block", marginRight: "0.28em", overflow: "hidden" }}>
                    <span className="fa-word-inner" style={{ display: "inline-block" }}>
                      {li === 2 && wi === 1 ? (
                        <em style={{ fontStyle: "italic", background: "linear-gradient(135deg, #C9A55A, #E8CA80)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{w}</em>
                      ) : w}
                    </span>
                  </span>
                ))}
              </span>
            ))}
          </h1>

          <p ref={paraRef} style={{ fontFamily: "var(--font-body)", fontSize: "1.05rem", lineHeight: 1.7, color: "rgba(232,224,208,0.7)", maxWidth: 480, marginBottom: "2rem" }}>
            Fee-only, fiduciary CFP® advisors. Zero commissions. Zero conflicts. Just clear, honest guidance built around your goals — and a legal obligation to always put you first.
          </p>

          <div ref={ctaRef} style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "2.5rem" }}>
            <a href={`tel:${business.phone}`} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "linear-gradient(135deg, #C9A55A, #B8944A)", color: "#06090E", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.9rem", padding: "0.85rem 1.8rem", borderRadius: 6, textDecoration: "none", letterSpacing: "0.03em" }}>
              Book Free Consultation
            </a>
            <a href="#services" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", border: "1px solid rgba(201,165,90,0.35)", color: "#E8CA80", fontFamily: "var(--font-body)", fontWeight: 500, fontSize: "0.9rem", padding: "0.85rem 1.6rem", borderRadius: 6, textDecoration: "none" }}>
              Our Services ↓
            </a>
          </div>

          <div ref={trustRef} style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            {["4.9★ Google", "CFP® Certified", "FINRA Registered", "Fee-Only"].map((b) => (
              <span key={b} style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem", color: "rgba(201,165,90,0.7)", fontWeight: 500, letterSpacing: "0.05em" }}>✓ {b}</span>
            ))}
          </div>
        </div>

        {/* Right: Wealth Goal Selector widget */}
        <div ref={widgetRef} className="fa-widget" style={{ width: 300, background: "rgba(12,18,30,0.85)", backdropFilter: "blur(24px)", border: "1px solid rgba(201,165,90,0.18)", borderRadius: 16, padding: "1.75rem", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#C9A55A", marginBottom: "1rem" }}>What&apos;s Your Goal?</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1.25rem" }}>
            {GOALS.map((g, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className="fa-goal-btn"
                style={{ background: active === i ? "rgba(201,165,90,0.14)" : "rgba(255,255,255,0.04)", border: active === i ? "1px solid rgba(201,165,90,0.4)" : "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "0.65rem 0.5rem", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}
              >
                <div style={{ fontSize: "1rem", marginBottom: "0.25rem" }}>{g.icon}</div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: "0.68rem", fontWeight: 500, color: active === i ? "#E8CA80" : "rgba(232,224,208,0.6)", lineHeight: 1.3 }}>{g.label}</div>
              </button>
            ))}
          </div>

          <div style={{ background: "rgba(201,165,90,0.08)", border: "1px solid rgba(201,165,90,0.2)", borderRadius: 10, padding: "1rem", marginBottom: "1.25rem" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem", fontWeight: 600, color: "#E8CA80", marginBottom: "0.35rem", fontStyle: "italic" }}>{goal.target}</div>
            <div style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem", color: "rgba(232,224,208,0.55)", lineHeight: 1.5 }}>{goal.detail}</div>
          </div>

          <a href="#contact" style={{ display: "block", textAlign: "center", background: "linear-gradient(135deg, #C9A55A, #B8944A)", color: "#06090E", fontFamily: "var(--font-body)", fontWeight: 700, fontSize: "0.8rem", padding: "0.75rem", borderRadius: 8, textDecoration: "none", letterSpacing: "0.05em" }}>
            Book Free 60-Min Consult →
          </a>

          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.62rem", color: "rgba(232,224,208,0.3)", textAlign: "center", marginTop: "0.75rem" }}>No obligation · Fiduciary from minute one</p>
        </div>
      </div>

      {/* Scroll cue */}
      <div aria-hidden style={{ position: "absolute", bottom: "2.5rem", left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem", animation: "fa-bounce 2s ease-in-out infinite" }}>
        <div style={{ width: 1, height: 40, background: "linear-gradient(to bottom, rgba(201,165,90,0.5), transparent)" }} />
      </div>

      <style>{`
        @keyframes fa-aurora { from { transform: translate(0,0) scale(1); } to { transform: translate(35px,-25px) scale(1.08); } }
        @keyframes fa-bounce { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(6px); } }
        @media(max-width:1023px) { .fa-widget { display: none !important; } }
        @media(max-width:1023px) { .fa-hero-section > div { grid-template-columns: 1fr !important; } }
        .fa-goal-btn:hover { background: rgba(201,165,90,0.12) !important; border-color: rgba(201,165,90,0.35) !important; }
      `}</style>
    </section>
  )
}
