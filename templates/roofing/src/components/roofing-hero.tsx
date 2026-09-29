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

const DAMAGE_TYPES = [
  { id: "storm",    label: "Storm / Hail",  icon: "⚡", coverage: "95%", note: "Usually 100% covered" },
  { id: "wind",     label: "Wind Damage",   icon: "🌬", coverage: "90%", note: "File before 30 days" },
  { id: "leak",     label: "Active Leak",   icon: "💧", coverage: "75%", note: "Emergency same-day" },
  { id: "aging",    label: "Age / Wear",    icon: "🏠", coverage: "—",   note: "Free inspection today" },
]

const TRUST = [
  { icon: "★", label: "4.8 Google" },
  { icon: "✓", label: "GAF Master Elite" },
  { icon: "⚡", label: "24/7 Emergency" },
  { icon: "◎", label: "Same-Day Response" },
]

export default function RoofingHero({ config, posterSrc = "/hero-1.jpg" }: Props) {
  const { business } = config
  const reduced = useReducedMotion()
  const [active, setActive] = useState("storm")

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
      r: Math.random() * 1.4 + 0.4, vx: (Math.random() - 0.5) * 0.16, vy: (Math.random() - 0.5) * 0.16,
    }))
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = "rgba(251,146,60,0.38)"
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
    const blob1 = section.querySelector<HTMLElement>(".rf-blob-1")
    const blob2 = section.querySelector<HTMLElement>(".rf-blob-2")
    const onMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2
      if (blob1) gsap.to(blob1, { x: (e.clientX - cx) * 0.02, y: (e.clientY - cy) * 0.02, duration: 1.2, ease: "power1.out" })
      if (blob2) gsap.to(blob2, { x: (e.clientX - cx) * -0.013, y: (e.clientY - cy) * -0.013, duration: 1.4, ease: "power1.out" })
    }
    window.addEventListener("mousemove", onMove)
    return () => { scope.kill(); window.removeEventListener("mousemove", onMove) }
  }, [reduced])

  const activeDmg = DAMAGE_TYPES.find(d => d.id === active) ?? DAMAGE_TYPES[0]

  return (
    <section ref={sectionRef} id="hero" className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: "var(--brand-bg)" }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" aria-hidden />
      <div className="rf-blob-1 absolute pointer-events-none" aria-hidden style={{ width: "72vw", height: "72vw", maxWidth: 880, maxHeight: 880, top: "-22%", left: "-18%", background: "radial-gradient(ellipse, rgba(234,88,12,0.10) 0%, transparent 65%)", filter: "blur(80px)" }} />
      <div className="rf-blob-2 absolute pointer-events-none" aria-hidden style={{ width: "55vw", height: "55vw", maxWidth: 660, maxHeight: 660, bottom: "-10%", right: "-8%", background: "radial-gradient(ellipse, rgba(239,68,68,0.07) 0%, transparent 65%)", filter: "blur(80px)" }} />
      <div ref={parallaxRef} className="absolute inset-0 z-0 pointer-events-none">
        <img src={posterSrc} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover object-center" style={{ opacity: 0.15 }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 25%, rgba(8,9,11,0.85) 100%)" }} />
        <div className="absolute bottom-0 left-0 right-0 h-48" style={{ background: "linear-gradient(to top, var(--brand-bg), transparent)" }} />
      </div>
      <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      <div className="relative z-10 flex-1 flex items-center" style={{ padding: "7rem 2rem 4rem" }}>
        <div className="w-full mx-auto" style={{ maxWidth: "1280px", display: "grid", gridTemplateColumns: "1fr auto", gap: "3rem", alignItems: "center" }}>

          {/* Left: Copy */}
          <div style={{ maxWidth: "640px" }}>
            <div ref={labelRef} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--brand-accent)", marginBottom: "1.2rem" }}>
              <span style={{ display: "inline-block", width: "1.5rem", height: "1px", background: "var(--brand-accent)" }} />
              {business.serviceAreas[0]} · CSLB Licensed · Since {business.since ?? "2005"}
            </div>
            <div ref={badgeRef} style={{ marginBottom: "1.4rem" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", color: "rgba(251,146,60,0.9)", border: "1px solid rgba(234,88,12,0.25)", background: "rgba(234,88,12,0.08)", padding: "0.3rem 0.85rem", borderRadius: "999px" }}>
                <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#EA580C", boxShadow: "0 0 10px rgba(234,88,12,0.8)", animation: "pulse-rf 2s ease-in-out infinite" }} />
                24/7 Emergency Response · Storm Damage Experts
              </span>
            </div>

            <h1 ref={h1Ref} style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.8rem, 6.5vw, 5rem)", fontWeight: 900, lineHeight: 0.95, letterSpacing: "-0.03em", color: "var(--brand-fg)", marginBottom: "1.4rem" }}>
              {["Storm-Ready.", "Storm-Proof."].map((word) => (
                <span key={word} style={{ display: "block", overflow: "hidden" }}>
                  <span className="split-word" style={{ display: "inline-block", background: word === "Storm-Proof." ? "linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to))" : undefined, WebkitBackgroundClip: word === "Storm-Proof." ? "text" : undefined, WebkitTextFillColor: word === "Storm-Proof." ? "transparent" : undefined, backgroundClip: word === "Storm-Proof." ? "text" : undefined }}>
                    {word}
                  </span>
                </span>
              ))}
            </h1>

            <p ref={paraRef} style={{ fontSize: "clamp(1rem, 1.8vw, 1.12rem)", color: "var(--brand-fg-muted)", lineHeight: 1.7, marginBottom: "2rem", maxWidth: "520px" }}>
              {business.review_count}+ roofs replaced across {business.serviceAreas.slice(0, 3).join(", ")}. GAF Master Elite certified — top 3% nationwide. We handle your insurance claim start to finish.
            </p>

            <div ref={ctaRef} style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "2.5rem" }}>
              <a href={business.phoneHref} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.85rem 2rem", borderRadius: "999px", background: "linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to))", color: "#fff", fontWeight: 700, fontSize: "0.9rem", textDecoration: "none", boxShadow: "var(--shadow-cta)", transition: "transform 0.2s" }} onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)" }} onMouseLeave={e => { e.currentTarget.style.transform = "" }}>
                ⚡ {business.phone}
              </a>
              <a href="#services" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.85rem 1.75rem", borderRadius: "999px", border: "1px solid rgba(234,88,12,0.3)", color: "var(--brand-fg)", fontWeight: 600, fontSize: "0.9rem", textDecoration: "none", background: "rgba(234,88,12,0.06)", transition: "border-color 0.2s, background 0.2s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(234,88,12,0.6)"; e.currentTarget.style.background = "rgba(234,88,12,0.12)" }} onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(234,88,12,0.3)"; e.currentTarget.style.background = "rgba(234,88,12,0.06)" }}>
                Free Inspection ↓
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

          {/* Right: Damage type selector widget */}
          <div ref={widgetRef} style={{ width: "320px", flexShrink: 0, background: "rgba(13,15,18,0.88)", border: "1px solid rgba(234,88,12,0.2)", borderRadius: "1.5rem", padding: "1.75rem", backdropFilter: "blur(16px)", boxShadow: "0 24px 80px -12px rgba(0,0,0,0.65), 0 0 0 1px rgba(234,88,12,0.07)" }}>
            <div style={{ marginBottom: "1.25rem" }}>
              <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--brand-accent)", marginBottom: "0.35rem" }}>What Happened?</p>
              <p style={{ fontSize: "0.78rem", color: "var(--brand-fg-muted)", lineHeight: 1.4 }}>Select your damage type — we'll tell you your coverage.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1.25rem" }}>
              {DAMAGE_TYPES.map(dmg => (
                <button key={dmg.id} onClick={() => setActive(dmg.id)} style={{ padding: "0.75rem 0.5rem", borderRadius: "0.75rem", border: `1px solid ${active === dmg.id ? "rgba(234,88,12,0.5)" : "rgba(234,88,12,0.1)"}`, cursor: "pointer", textAlign: "center", background: active === dmg.id ? "rgba(234,88,12,0.12)" : "transparent", transition: "all 0.2s" }}>
                  <div style={{ fontSize: "1.1rem", marginBottom: "0.25rem" }}>{dmg.icon}</div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, color: active === dmg.id ? "var(--brand-accent)" : "var(--brand-fg-muted)", letterSpacing: "0.03em" }}>{dmg.label}</div>
                </button>
              ))}
            </div>

            <div style={{ background: "rgba(234,88,12,0.07)", border: "1px solid rgba(234,88,12,0.15)", borderRadius: "0.875rem", padding: "1.1rem", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--brand-fg-muted)" }}>Typical Coverage</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 900, color: "var(--brand-accent)" }}>{activeDmg.coverage}</span>
              </div>
              <p style={{ fontSize: "0.78rem", color: "var(--brand-fg-muted)", lineHeight: 1.5 }}>{activeDmg.note} — we document everything for your adjuster.</p>
            </div>

            <a href={business.phoneHref} style={{ display: "block", textAlign: "center", padding: "0.85rem", borderRadius: "999px", background: "linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to))", color: "#fff", fontWeight: 700, fontSize: "0.875rem", textDecoration: "none", boxShadow: "var(--shadow-cta)", transition: "transform 0.2s" }} onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)" }} onMouseLeave={e => { e.currentTarget.style.transform = "" }}>
              Get Free Inspection →
            </a>
            <p style={{ textAlign: "center", fontSize: "0.65rem", color: "var(--brand-fg-subtle)", marginTop: "0.75rem" }}>Drone inspection + written report · No charge</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex justify-center" style={{ paddingBottom: "2rem" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem", fontSize: "0.6rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--brand-fg-subtle)" }}>
          <span>Scroll</span>
          <span style={{ fontSize: "0.9rem", animation: "bounce-rf 1.8s ease-in-out infinite" }}>↓</span>
        </div>
      </div>

      <style>{`
        @keyframes pulse-rf { 0%,100%{opacity:1;box-shadow:0 0 10px rgba(234,88,12,0.8);}50%{opacity:0.6;box-shadow:0 0 20px rgba(234,88,12,0.5);} }
        @keyframes bounce-rf { 0%,100%{transform:translateY(0);}50%{transform:translateY(4px);} }
        @media (max-width:1024px){ #hero>div>div{grid-template-columns:1fr!important;} #hero>div>div>div:last-child{display:none!important;} }
        @media (max-width:640px){ #hero h1{font-size:2.6rem!important;} }
      `}</style>
    </section>
  )
}
