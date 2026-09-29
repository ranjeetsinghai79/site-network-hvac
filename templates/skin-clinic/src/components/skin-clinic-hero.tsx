"use client"

import { useEffect, useRef, useState } from "react"
import { gsap } from "@core/web/lib"
import { createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"
import type { SiteConfig } from "@core/web/types"

interface Props {
  config: SiteConfig
  posterSrc?: string
}

const CONCERNS = [
  { id: "acne",    label: "Acne & Breakouts", icon: "●", rec: "Acne Treatment Series",  sessions: "4–6 sessions", from: "$125/session" },
  { id: "aging",   label: "Fine Lines",        icon: "◇", rec: "Laser Resurfacing",      sessions: "3–5 sessions", from: "$299/session" },
  { id: "pigment", label: "Pigmentation",      icon: "◈", rec: "Chemical Peel + Laser",  sessions: "6 sessions",   from: "$149/peel" },
  { id: "texture", label: "Texture / Pores",   icon: "✦", rec: "Microneedling RF",       sessions: "3–4 sessions", from: "$249/session" },
]

const TRUST = [
  { icon: "★", label: "4.9 Google" },
  { icon: "✓", label: "CA Licensed" },
  { icon: "◎", label: "All Skin Tones" },
  { icon: "⬡", label: "Free Consult" },
]

export default function SkinClinicHero({ config, posterSrc = "/hero-4.jpg" }: Props) {
  const { business } = config
  const reduced = useReducedMotion()
  const [active, setActive] = useState("acne")

  const sectionRef  = useRef<HTMLElement>(null)
  const parallaxRef = useRef<HTMLDivElement>(null)
  const labelRef    = useRef<HTMLDivElement>(null)
  const badgeRef    = useRef<HTMLDivElement>(null)
  const h1Ref       = useRef<HTMLHeadingElement>(null)
  const paraRef     = useRef<HTMLParagraphElement>(null)
  const ctaRef      = useRef<HTMLDivElement>(null)
  const trustRef    = useRef<HTMLDivElement>(null)
  const widgetRef   = useRef<HTMLDivElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)

  /* ── Particles ── */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || reduced) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let raf = 0
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener("resize", resize, { passive: true })
    const dots = Array.from({ length: 50 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.3 + 0.3, vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15,
    }))
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = "rgba(249,168,212,0.35)"
      for (const d of dots) {
        d.x = (d.x + d.vx + canvas.width) % canvas.width
        d.y = (d.y + d.vy + canvas.height) % canvas.height
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize) }
  }, [reduced])

  /* ── GSAP entrance ── */
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    if (reduced) {
      gsap.set([labelRef.current, badgeRef.current, h1Ref.current, paraRef.current, ctaRef.current, trustRef.current, widgetRef.current].filter(Boolean), { opacity: 1, y: 0, x: 0 })
      return
    }
    const scope = createScope()
    const words = h1Ref.current?.querySelectorAll<HTMLElement>(".split-word")
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
    tl.from(labelRef.current,  { opacity: 0, x: -28, duration: 0.5 })
      .from(badgeRef.current,  { opacity: 0, y: -12, duration: 0.4 }, "-=0.2")
      .from(words ?? [],       { yPercent: 115, opacity: 0, stagger: 0.04, duration: 0.72 }, "-=0.3")
      .from(paraRef.current,   { opacity: 0, y: 22, duration: 0.6 }, "-=0.45")
      .from(ctaRef.current,    { opacity: 0, y: 18, duration: 0.5 }, "-=0.38")
      .from(trustRef.current,  { opacity: 0, y: 10, duration: 0.4 }, "-=0.32")
      .from(widgetRef.current, { opacity: 0, x: 52, duration: 0.88, ease: "expo.out" }, "-=0.9")
    scope.add(tl)
    if (parallaxRef.current) {
      const t = gsap.to(parallaxRef.current, { yPercent: -20, ease: "none", scrollTrigger: { trigger: section, start: "top top", end: "bottom top", scrub: 1.5 } })
      scope.add(t); if (t.scrollTrigger) scope.add(t.scrollTrigger)
    }
    const blob1 = section.querySelector<HTMLElement>(".sc-blob-1")
    const blob2 = section.querySelector<HTMLElement>(".sc-blob-2")
    const onMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2
      if (blob1) gsap.to(blob1, { x: (e.clientX - cx) * 0.02, y: (e.clientY - cy) * 0.02, duration: 1.2, ease: "power1.out" })
      if (blob2) gsap.to(blob2, { x: (e.clientX - cx) * -0.013, y: (e.clientY - cy) * -0.013, duration: 1.4, ease: "power1.out" })
    }
    window.addEventListener("mousemove", onMove)
    return () => { scope.kill(); window.removeEventListener("mousemove", onMove) }
  }, [reduced])

  const activeConcern = CONCERNS.find(c => c.id === active) ?? CONCERNS[0]

  return (
    <section ref={sectionRef} id="hero" className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: "var(--brand-bg)" }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" aria-hidden />

      {/* Aurora blobs */}
      <div className="sc-blob-1 absolute pointer-events-none" aria-hidden style={{ width: "70vw", height: "70vw", maxWidth: 860, maxHeight: 860, top: "-20%", left: "-15%", background: "radial-gradient(ellipse, rgba(232,121,160,0.12) 0%, transparent 65%)", filter: "blur(80px)" }} />
      <div className="sc-blob-2 absolute pointer-events-none" aria-hidden style={{ width: "55vw", height: "55vw", maxWidth: 680, maxHeight: 680, bottom: "-10%", right: "-8%", background: "radial-gradient(ellipse, rgba(190,24,93,0.08) 0%, transparent 65%)", filter: "blur(80px)" }} />

      {/* BG photo */}
      <div ref={parallaxRef} className="absolute inset-0 z-0 pointer-events-none">
        <img src={posterSrc} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover object-center" style={{ opacity: 0.2 }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 25%, rgba(15,10,20,0.88) 100%)" }} />
        <div className="absolute bottom-0 left-0 right-0 h-48" style={{ background: "linear-gradient(to top, var(--brand-bg), transparent)" }} />
      </div>
      <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      <div className="relative z-10 flex-1 flex items-center" style={{ padding: "7rem 2rem 4rem" }}>
        <div className="w-full mx-auto" style={{ maxWidth: "1280px", display: "grid", gridTemplateColumns: "1fr auto", gap: "3rem", alignItems: "center" }}>

          {/* Left */}
          <div style={{ maxWidth: "640px" }}>
            <div ref={labelRef} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--brand-accent)", marginBottom: "1.2rem" }}>
              <span style={{ display: "inline-block", width: "1.5rem", height: "1px", background: "var(--brand-accent)" }} />
              {business.serviceAreas[0]} · CA Licensed Clinic · Since {business.since ?? "2016"}
            </div>
            <div ref={badgeRef} style={{ marginBottom: "1.4rem" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.72rem", fontWeight: 700, color: "rgba(249,168,212,0.9)", border: "1px solid rgba(232,121,160,0.25)", background: "rgba(232,121,160,0.08)", padding: "0.3rem 0.85rem", borderRadius: "999px" }}>
                <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "var(--brand-accent)", boxShadow: "0 0 10px rgba(232,121,160,0.8)", animation: "pulse-sc 2s ease-in-out infinite" }} />
                Free Skin Consultation · All Skin Tones Welcome
              </span>
            </div>

            <h1 ref={h1Ref} style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.8rem, 6.5vw, 5rem)", fontWeight: 700, lineHeight: 1.0, letterSpacing: "-0.02em", color: "var(--brand-fg)", marginBottom: "1.4rem" }}>
              {["Your Best", "Skin,", "Revealed."].map((word) => (
                <span key={word} style={{ display: "block", overflow: "hidden" }}>
                  <span className="split-word" style={{ display: "inline-block", fontStyle: word === "Revealed." ? "italic" : undefined, background: word === "Revealed." ? "linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to))" : undefined, WebkitBackgroundClip: word === "Revealed." ? "text" : undefined, WebkitTextFillColor: word === "Revealed." ? "transparent" : undefined, backgroundClip: word === "Revealed." ? "text" : undefined }}>
                    {word}
                  </span>
                </span>
              ))}
            </h1>

            <p ref={paraRef} style={{ fontSize: "clamp(1rem, 1.8vw, 1.12rem)", color: "var(--brand-fg-muted)", lineHeight: 1.75, marginBottom: "2rem", maxWidth: "520px" }}>
              Medical-grade treatments for acne, pigmentation, aging, and texture. {business.review_count}+ clients in {business.serviceAreas.slice(0, 3).join(", ")} — safe and effective for all skin tones.
            </p>

            <div ref={ctaRef} style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "2.5rem" }}>
              <a href="#contact" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.85rem 2rem", borderRadius: "999px", background: "linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to))", color: "#fff", fontWeight: 700, fontSize: "0.9rem", textDecoration: "none", boxShadow: "var(--shadow-cta)", transition: "transform 0.2s" }} onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)" }} onMouseLeave={e => { e.currentTarget.style.transform = "" }}>
                Book Free Consultation
              </a>
              <a href={business.phoneHref} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.85rem 1.75rem", borderRadius: "999px", border: "1px solid rgba(232,121,160,0.3)", color: "var(--brand-fg)", fontWeight: 600, fontSize: "0.9rem", textDecoration: "none", background: "rgba(232,121,160,0.06)", transition: "border-color 0.2s, background 0.2s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(232,121,160,0.6)"; e.currentTarget.style.background = "rgba(232,121,160,0.12)" }} onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(232,121,160,0.3)"; e.currentTarget.style.background = "rgba(232,121,160,0.06)" }}>
                {business.phone}
              </a>
            </div>

            <div ref={trustRef} style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              {TRUST.map(({ icon, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.72rem", color: "var(--brand-fg-muted)", fontWeight: 500 }}>
                  <span style={{ color: "var(--brand-accent)", fontSize: "0.8rem" }}>{icon}</span>
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Skin concern selector */}
          <div ref={widgetRef} style={{ width: "320px", flexShrink: 0, background: "rgba(15,10,20,0.88)", border: "1px solid rgba(232,121,160,0.2)", borderRadius: "1.5rem", padding: "1.75rem", backdropFilter: "blur(16px)", boxShadow: "0 24px 80px -12px rgba(0,0,0,0.65), 0 0 0 1px rgba(232,121,160,0.06)" }}>
            <div style={{ marginBottom: "1.25rem" }}>
              <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--brand-accent)", marginBottom: "0.35rem" }}>What's Your Concern?</p>
              <p style={{ fontSize: "0.78rem", color: "var(--brand-fg-muted)", lineHeight: 1.4 }}>We'll match you with the right treatment.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1.25rem" }}>
              {CONCERNS.map(c => (
                <button key={c.id} onClick={() => setActive(c.id)} style={{ padding: "0.75rem 0.5rem", borderRadius: "0.75rem", border: `1px solid ${active === c.id ? "rgba(232,121,160,0.5)" : "rgba(232,121,160,0.1)"}`, cursor: "pointer", textAlign: "center", background: active === c.id ? "rgba(232,121,160,0.1)" : "transparent", transition: "all 0.2s" }}>
                  <div style={{ fontSize: "0.9rem", marginBottom: "0.25rem", color: active === c.id ? "var(--brand-accent)" : "var(--brand-fg-muted)" }}>{c.icon}</div>
                  <div style={{ fontSize: "0.62rem", fontWeight: 700, color: active === c.id ? "var(--brand-accent)" : "var(--brand-fg-muted)", letterSpacing: "0.03em", lineHeight: 1.3 }}>{c.label}</div>
                </button>
              ))}
            </div>

            <div style={{ background: "rgba(232,121,160,0.06)", border: "1px solid rgba(232,121,160,0.15)", borderRadius: "0.875rem", padding: "1.1rem", marginBottom: "1.25rem" }}>
              <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--brand-fg-muted)", marginBottom: "0.35rem" }}>Recommended</p>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 600, color: "var(--brand-fg)", marginBottom: "0.5rem" }}>{activeConcern.rec}</p>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--brand-fg-muted)" }}>
                <span>{activeConcern.sessions}</span>
                <span style={{ color: "var(--brand-accent)", fontWeight: 700 }}>{activeConcern.from}</span>
              </div>
            </div>

            <a href="#contact" style={{ display: "block", textAlign: "center", padding: "0.85rem", borderRadius: "999px", background: "linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to))", color: "#fff", fontWeight: 700, fontSize: "0.875rem", textDecoration: "none", boxShadow: "var(--shadow-cta)", transition: "transform 0.2s" }} onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)" }} onMouseLeave={e => { e.currentTarget.style.transform = "" }}>
              Book Free Consultation →
            </a>
            <p style={{ textAlign: "center", fontSize: "0.65rem", color: "var(--brand-fg-subtle)", marginTop: "0.75rem" }}>No pressure · Personalized treatment plan</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex justify-center" style={{ paddingBottom: "2rem" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem", fontSize: "0.6rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--brand-fg-subtle)" }}>
          <span>Scroll</span>
          <span style={{ fontSize: "0.9rem", animation: "bounce-sc 1.8s ease-in-out infinite" }}>↓</span>
        </div>
      </div>

      <style>{`
        @keyframes pulse-sc { 0%,100%{opacity:1;box-shadow:0 0 10px rgba(232,121,160,0.8);}50%{opacity:0.6;box-shadow:0 0 20px rgba(232,121,160,0.5);} }
        @keyframes bounce-sc { 0%,100%{transform:translateY(0);}50%{transform:translateY(4px);} }
        @media (max-width:1024px){ #hero>div>div{grid-template-columns:1fr!important;} #hero>div>div>div:last-child{display:none!important;} }
        @media (max-width:640px){ #hero h1{font-size:2.6rem!important;} }
      `}</style>
    </section>
  )
}
